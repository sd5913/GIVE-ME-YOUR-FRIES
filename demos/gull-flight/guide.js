'use strict';
// Observer only: never changes gameplay, input, timing, or camera state.
const learnedActions=new Set(), seenObstacleTypes=new Set();
const guideCopy={
 flap:['↕','拍翅起飞','Flap to take off'],
 lean:['↔','侧倾对准游客','Lean toward the tourist'],
 tuck:['↓','收肘俯冲','Tuck elbows to dive'],
 grab:['✋ → ✊','张手再握拳，每次一根','Open, then close: one fry'],
 escape:['↑','继续抓或展翅逃跑','Grab more or spread to escape'],
 crates:['↑','拍翅飞越木箱','Flap over the crates'],
 sign:['↔','侧倾绕过路牌','Lean around the sign'],
 highCrates:['↑','拍翅飞越高箱堆','Flap over the tall crates'],
 umbrella:['↔','侧倾绕开遮阳伞','Lean around the umbrella'],
 bunting:['↔','侧倾避开彩旗绳','Lean around the bunting'],
 restaurant:['↔','绕过餐厅招牌','Dodge the restaurant sign'],
 cart:['↔','绕开移动餐车','Dodge the moving cart'],
 gull:['↔','避让竞争海鸥','Dodge the rival gull'],
 home:['⌂','带薯条返回巢穴','Bring your fries home']
};
let guideKey='',guideUntil=0,guideShown=new Set();
function resetGuide(){guideKey='';guideShown.clear();}
function guideCandidate(g){
 if(g.phase==='launch')return 'flap';
 if(g.phase==='approach')return isLinedUp(g)?'tuck':'lean';
 if(g.phase==='grab')return g.carry?'escape':'grab';
 if(g.phase==='chase'){
  const o=upcomingObstacle(g);
  return o?o.kind:'home';
 }
 return '';
}
function updateGuide(g,now){
 const panel=document.getElementById('bodyLesson');
 const key=guideCandidate(g);
 if(key!==guideKey){
  if(guideKey)learnedActions.add(guideKey);
  guideKey=key;guideUntil=now+4500;
  if(!key){panel.hidden=true;return;}
  const obstacle=g.phase==='chase' && key!=='home';
  const animate=obstacle?!seenObstacleTypes.has(key):!learnedActions.has(key);
  if(obstacle)seenObstacleTypes.add(key);
  const copy=guideCopy[key]||['↔','侧倾避让','Lean to dodge'];
  const repeated=guideShown.has(key);guideShown.add(key);
  panel.dataset.animate=String(animate&&!repeated);
  panel.dataset.action=key;
  document.getElementById('lessonProgress').textContent='Level 0'+currentLevel+' · GUIDE / 动作提示';
  document.getElementById('lessonTitle').textContent=copy[1];
  document.getElementById('lessonDetail').textContent=copy[2];
  document.getElementById('lessonDemo').innerHTML='<span>'+copy[0]+'</span><svg viewBox="0 0 240 160"><g class="demo-person" fill="none" stroke="#fff2ca" stroke-width="10" stroke-linecap="round"><circle cx="120" cy="22" r="13" fill="#ffd46e" stroke="none"/><path d="M120 47V104M120 104L100 145M120 104L140 145"/><g class="demo-arm left"><path d="M110 52L77 69L42 61"/></g><g class="demo-arm right"><path d="M130 52L163 69L198 61"/></g></g></svg>';
 }
 panel.hidden=!key || now>guideUntil || ['setup','hit','home','result','dive'].includes(g.phase);
}
