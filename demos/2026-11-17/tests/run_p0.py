"""Run Chrome regression tests: python3 tests/run_p0.py [path-to-Chrome]."""
from pathlib import Path
from html.parser import HTMLParser
import json, subprocess, sys, tempfile
root = Path(__file__).resolve().parent.parent
html = (root/'index.html').read_text()
harness = (root/'tests/P0_REGRESSION.js').read_text()
errors = '<script>window.P0_ERRORS=[];addEventListener("error",e=>P0_ERRORS.push(e.message));addEventListener("unhandledrejection",e=>P0_ERRORS.push(String(e.reason)));</script>'
html = html.replace('<script>', errors+'<script>',1).replace('</body>','<script>'+harness+'</script></body>')
chrome = sys.argv[1] if len(sys.argv)>1 else '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
class ResultParser(HTMLParser):
    active = False
    text = ''
    def handle_starttag(self, tag, attrs):
        if tag=='pre' and dict(attrs).get('id')=='p0-test-results': self.active=True
    def handle_endtag(self, tag):
        if tag=='pre': self.active=False
    def handle_data(self, data):
        if self.active: self.text+=data
with tempfile.TemporaryDirectory(prefix='gull-p0-') as tmp:
    page=Path(tmp)/'regression.html'; page.write_text(html)
    run=subprocess.run([chrome,'--headless','--no-sandbox','--disable-gpu','--no-first-run',
        '--user-data-dir='+tmp+'/profile','--virtual-time-budget=1000','--dump-dom',page.as_uri()],
        capture_output=True,text=True,timeout=40,check=True)
    parser=ResultParser(); parser.feed(run.stdout)
    if not parser.text: raise RuntimeError('Browser did not produce test results: '+run.stderr[-1000:])
    report=json.loads(parser.text)
(root/'tests/P0_RESULTS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(f"{report['passed']}/{report['total']} passed; uncaught errors: {report['uncaughtErrors']}")
for test in report['results']:
    if not test['pass']: print(test['name']+'\n'+test['error'])
sys.exit(0 if report['passed']==report['total'] and not report['uncaughtErrors'] else 1)
