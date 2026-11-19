from pathlib import Path
import subprocess,re,json,html
root=Path(__file__).resolve().parents[1]
probe=r'''
const checks=[];const check=(name,fn)=>{try{checks.push({name,pass:!!fn()})}catch(e){checks.push({name,pass:false,error:String(e)})}};
muted=true;const pose={lean:0,span:1.1,lift:-.4,bothOut:.35};
function upperBody(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));for(const [i,x,y] of [[11,.4,.3],[12,.6,.3],[13,.32,.45],[14,.68,.45]])p[i]={x,y,visibility:.95};return p;}
check('shoulders and elbows work without visible hips',()=>readPose(upperBody(),1.77)?.span!==null);
check('face alone is not an actionable body',()=>readPose(Array.from({length:33},()=>({x:.5,y:.5,visibility:0})),1.77)===null);
function fresh(){beginRound('keyboard',true);mode='body';neutral={lean:0};trackingPaused=false;}
function ready(){fresh();setPhase('approach');game.ready=true;game.x=routeX(game.target);}
function fold(){for(let i=0;i<5;i++)trackMotion(pose,1000+i*45);}
check('fold works without prior spread',()=>{ready();fold();return game.phase==='dive'});
check('not ready cannot dive',()=>{ready();game.ready=false;fold();return game.phase==='approach'});
check('not aligned cannot dive',()=>{ready();game.x=routeX(-game.target);fold();return game.phase==='approach'});
check('missing elbow cancels confirmation',()=>{ready();trackMotion(pose,1000);trackMotion({...pose,span:null},1050);trackMotion(pose,1100);return game.phase==='approach'});
check('sample gap cannot complete old action',()=>{ready();trackMotion(pose,1000);trackMotion(pose,1500);return game.phase==='approach'});
check('two arm cycles launch exactly once',()=>{fresh();for(let i=0;i<2;i++){trackMotion({...pose,span:1.8,lift:0,bothOut:.9},1000+i*200);trackMotion({...pose,span:1.8,lift:-.5,bothOut:.9},1100+i*200);}return game.phase==='approach'&&game.flaps===2});
check('two modest cycles work with partly extended arms',()=>{fresh();for(const [i,lift] of [-.1,-.2,-.3,-.2,-.1,-.2,-.3].entries())trackMotion({...pose,span:1.35,lift},1000+i*90);return game.phase==='approach'&&game.flaps===2});
check('small jitter cannot count as flaps',()=>{fresh();for(let i=0;i<20;i++)trackMotion({...pose,span:1.5,lift:-.1+(i%2)*.02},1000+i*45);return game.flaps===0});
const spread={...pose,span:1.9,lift:0,bothOut:.9};
check('open claw blocks body escape',()=>{fresh();setPhase('grab');game.carry=1;openClaw('Left');for(let i=0;i<8;i++)trackMotion(spread,1000+i*45);beginChase();return game.phase==='grab'});
check('one open close gives one fry, hold fist gives none',()=>{fresh();setPhase('grab');for(let i=0;i<3;i++){openClaw('Left');closeClaw('Right');if(game.carry!==i)return false;closeClaw('Left');closeClaw('Left');if(game.carry!==i+1||$('carry').textContent!==String(i+1))return false;}openClaw('Left');closeClaw('Left');return game.carry===3});
check('fresh spread after grab can escape',()=>{fresh();setPhase('grab');game.carry=1;motion.lastGrabAt=-Infinity;trackMotion(pose,1000);for(let i=0;i<7;i++)trackMotion(spread,1050+i*45);return game.phase==='chase'});
check('held spread cannot escape on grab entry',()=>{fresh();setPhase('grab');game.carry=1;for(let i=0;i<8;i++)trackMotion(spread,1000+i*45);return game.phase==='grab'});
check('keyboard round still reaches result',()=>{beginRound('keyboard',true);flap();flap();steer(-1);for(let i=0;i<260;i++)updateFlight(.01);keyboardGrab();for(let i=0;i<25;i++)updateFlight(.01);if(game.carry!==1)return false;beginChase();for(let i=0;i<1500;i++)updateFlight(.01);return game.phase==='result'});
check('restart clears gesture state',()=>{fresh();return !motion.candidate&&!motion.escapeArmed&&motion.tuckAt===null&&!game.carry});
for(const count of [1,2,3])check('direct spread after '+count+' fries needs no extra fold',()=>{
 fresh();setPhase('grab');for(let i=0;i<count;i++){openClaw('Left');closeClaw('Left');}
 const start=motion.lastGrabAt;
 for(let i=0;i<8;i++)trackMotion({...spread,span:1.55,bothOut:.64},start+90+i*42);
 return game.phase==='chase'&&game.carry===count;
});
check('palm rearm during deliberate spread cannot lock escape',()=>{fresh();setPhase('grab');openClaw('Left');closeClaw('Left');const start=motion.lastGrabAt;openClaw('Left');motion.candidate={shape:'Closed_Fist'};for(let i=0;i<7;i++)trackMotion(spread,start+90+i*42);return game.phase==='chase'&&game.carry===1&&!game.clawOpen&&!motion.candidate;});
check('single-arm extension while grabbing never escapes',()=>{fresh();setPhase('grab');openClaw('Left');closeClaw('Left');const start=motion.lastGrabAt;openClaw('Left');for(let i=0;i<20;i++)trackMotion({...spread,bothOut:.25},start+90+i*42);return game.phase==='grab'&&game.clawOpen;});
check('brief spread noise does not escape',()=>{fresh();setPhase('grab');openClaw('Left');closeClaw('Left');const start=motion.lastGrabAt;trackMotion(spread,start+90);trackMotion(pose,start+132);return game.phase==='grab';});
check('body lesson starts at launch and ignores wrong action',()=>{startBodyLesson();neutral={lean:0};trackingPaused=false;tuck();closeClaw('Left');return bodyLesson.step===0&&game.phase==='launch'&&!game.carry;});
check('lesson advances via launch align dive grab escape',()=>{
 flap();flap();updateFlight(.01);if(bodyLesson.step!==1)return false;
 game.x=routeX(game.target);updateFlight(.01);if(bodyLesson.step!==2)return false;
 game.ready=true;tuck();for(let i=0;i<70;i++)updateFlight(.01);if(bodyLesson.step!==3)return false;
 openClaw('Left');closeClaw('Left');if(bodyLesson.step!==4||game.carry!==1)return false;
 motion.lastGrabAt=-Infinity;trackMotion(pose,1000);for(let i=0;i<7;i++)trackMotion(spread,1050+i*45);
 return bodyLesson.step===5&&game.phase==='chase';
});
check('lesson countdown freezes chase and resets practice score',()=>{const z=game.z,remaining=game.remaining;updateFlight(1);if(game.z!==z||game.remaining!==remaining)return false;updateFlight(2.1);return bodyLesson===null&&game.phase==='launch'&&game.score===0&&game.carry===0&&game.flaps===0;});
check('practice grabs cannot start visitor attack',()=>{startBodyLesson();setPhase('grab');bodyLesson.step=3;for(let i=0;i<3;i++){openClaw('Left');closeClaw('Left');}for(let i=0;i<400;i++)updateFlight(.01);return !game.attack&&game.carry===3&&game.phase==='grab';});
check('retry skip and settings clear lesson',()=>{$('lessonRetry').click();if(bodyLesson.step!==0||game.carry)return false;$('lessonSkip').click();if(bodyLesson||game.phase!=='launch')return false;startBodyLesson();returnToSetup();return !bodyLesson&&$('bodyLesson').hidden;});
startBodyLesson();setTimeout(()=>{const el=document.createElement('pre');el.id='test-result';el.hidden=true;el.textContent=JSON.stringify(checks);document.body.append(el)},100);
'''
page=root/'qa/check.html'
page.write_text((root/'index.html').read_text().replace('href="flight.css','href="../flight.css').replace('src="scene.js','src="../scene.js').replace('src="flight.js','src="../flight.js').replace('</body>','<script>'+probe+'</script></body>'))
p=subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless','--no-sandbox','--disable-gpu','--user-data-dir=/tmp/gull-body-step1','--window-size=1280,863','--virtual-time-budget=600','--screenshot='+str(root/'qa/setup.png'),'--dump-dom',page.as_uri()],capture_output=True,text=True,timeout=40)
m=re.search(r'<pre id="test-result"[^>]*>([\s\S]*?)</pre>',p.stdout)
if not m:raise RuntimeError(p.stderr[-1000:])
results=json.loads(html.unescape(m.group(1)));(root/'qa/results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))
assert all(t['pass'] for t in results)
