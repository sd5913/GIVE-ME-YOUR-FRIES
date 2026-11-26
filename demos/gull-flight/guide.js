
'use strict';

// Non-blocking tutorial overlay.
// Never changes gameplay, input or timing.

const learnedActions = new Set();
const seenObstacleTypes = new Set();

const guideCopy = {
  flap: ['↕', '拍翅起飞', 'Flap to take off'],
  lean: ['↔', '侧倾对准游客', 'Lean toward the tourist'],
  glide: ['↓', '停止拍翅，自然下降', 'Stop flapping to glide down'],
  grab: ['✋ → ✊', '张开手掌，再握拳抓取', 'Open your palm, then close your fist to grab'],
  escape: ['↑', '展翅逃跑', 'Spread your wings to escape'],
  crates: ['↑', '拍翅飞越木箱', 'Flap over the crates'],
  sign: ['↔', '侧倾绕过路牌', 'Lean around the sign'],
  highCrates: ['↑', '拍翅飞越高箱堆', 'Flap over tall crates'],
  umbrella: ['↔', '绕开遮阳伞', 'Dodge the umbrella'],
  bunting: ['↔', '避开彩旗绳', 'Dodge the bunting'],
  restaurant: ['↔', '绕过餐厅招牌', 'Dodge the restaurant sign'],
  cart: ['↔ / ↑', '换道绕开或拍翅升至高空', 'Change lanes or flap above the moving cart'],
  gull: ['↔', '避让其他海鸥', 'Dodge the rival gull'],
  home: ['⌂', '飞回巢穴', 'Fly back to your nest']
};

let guideKey = '';
let guideShown = new Set();
let previousObstacle = null;

function resetGuide() {
  guideKey = '';
  guideShown.clear();
  previousObstacle = null;

  if (currentLevel === 1) {
    learnedActions.clear();
    seenObstacleTypes.clear();
  }

  document.getElementById('bodyLesson').hidden = true;
}

function guideCandidate(g) {
  if (g.phase === 'launch') return 'flap';

  if (g.phase === 'approach') {
    if(!isLinedUp(g))return 'lean';
    return mode==='keyboard'||g.grabReady?'grab':'glide';
  }

  if(g.phase==='dive')return 'grab';

  if (g.phase === 'grab') {
    return g.carry && !g.clawOpen ? 'escape' : 'grab';
  }

  if (g.phase === 'chase') {
    const obstacle = upcomingObstacle(g);
    return obstacle ? obstacle.kind : 'home';
  }

  return '';
}

function updateGuide(g, now) {
  const panel = document.getElementById('bodyLesson');
  const key = guideCandidate(g);

  if (g.flaps >= 2) learnedActions.add('flap');
  if (g.phase === 'dive') {
    learnedActions.add('lean');
    learnedActions.add('glide');
  }
  if (g.npcs?.some(n => n.stolen > 0)) {
    learnedActions.add('grab');
  }
  if (g.phase === 'chase') {
    learnedActions.add('escape');
  }

  const obstacle = g.phase === 'chase'
    ? upcomingObstacle(g)
    : null;

  if (previousObstacle?.passed) {
    seenObstacleTypes.add(previousObstacle.kind);
    previousObstacle = null;
  }

  if (!key) {
    panel.hidden = true;
    guideKey = '';
    return;
  }

  if (key !== guideKey || obstacle !== previousObstacle) {
    guideKey = key;
    previousObstacle = obstacle;

    const animate = currentLevel === 1
      ? !guideShown.has(key)
      : Boolean(obstacle && !seenObstacleTypes.has(key));

    guideShown.add(key);

    panel.dataset.animate = String(animate);

  }

  const detail = document.getElementById('lessonDetail');
  const confirmed = mode==='body' && !trackingPaused && latestPose?.span != null &&
    now<motion.armLabelUntil ? tr(motion.armLabel) : '';
  panel.dataset.confirmed=String(Boolean(confirmed));
  panel.hidden=mode!=='body'||g.phase==='home'||trackingPaused;

  const hands=key==='grab';
  const fist=hands && (g.clawOpen || g.phase==='dive');
  const motionType=hands?'hand':
    ['flap','crates','highCrates'].includes(key)?'flap':
    key==='escape'?'spread':key==='glide'?'glide':key==='home'?'home':'lean';
  let direction=0;
  if(motionType==='lean'){
    if(key==='lean')direction=Math.sign(routeX(g.target)-g.x);
    else {
      const hazard=obstacleX(obstacle,g.routeTime,obstacle.z);
      const clearance=OBSTACLE_TYPES[key].width/2+20;
      if(Math.abs(g.x-hazard)<clearance){
        direction=hazard>0?-1:hazard<0?1:g.x<0?-1:1;
      }else panel.hidden=true;
    }
  }
  panel.dataset.direction=direction<0?'left':direction>0?'right':'';
  const art=fist?'fist':hands?'palm':motionType;
  const title=hands ? tr(fist?'用同一只手握拳':'张开五指') :
    direction ? tr(direction<0?'向左侧倾':'向右侧倾') : guideCopy[key]?.[document.documentElement.lang==='en'?2:1] ?? tr('注意避让');
  const heading=document.getElementById('lessonTitle');
  if(heading.textContent!==title)heading.textContent=title;
  if(detail.textContent!==(confirmed?'✓ '+confirmed:''))detail.textContent=confirmed?'✓ '+confirmed:'';
  if(panel.dataset.art!==art){
    panel.dataset.art=art;
    panel.dataset.motion=motionType;
    document.getElementById('lessonDemo').innerHTML=gestureIllustration(art);
  }
}

function gestureIllustration(art){
  const hand=art==='palm'||art==='fist';
  const arrows={
    flap:'M20 44v34m-6-7 6 7 6-7m-12-20 6-7 6 7 M160 44v34m-6-7 6 7 6-7m-12-20 6-7 6 7',
    lean:'M123 40h28m-10-8 10 8-10 8',
    spread:'M28 85H14l6-6m-6 6 6 6 M152 85h14l-6-6m6 6-6 6',
    glide:'M146 47v31m-7-7 7 7 7-7'
  };
  const armsOut=art==='flap'||art==='spread';
  const arm='<path d="M72 59Q61 56 51 63L38 66 25 64Q20 63 18 67Q16 71 22 74L38 77Q43 78 48 76L74 70Z"/><path class="guide-shirt" d="M76 62Q68 55 60 59L52 63 57 75 75 71Z"/>';
  const figure=`<g class="guide-person">
    <g class="guide-sleeve left"><g transform="rotate(${armsOut?0:-53} 68 65)">${arm}</g></g>
    <g class="guide-sleeve right">
      <g transform="rotate(${armsOut?0:53} 112 65) translate(180 0) scale(-1 1)">${arm}</g>
    </g>
    <path class="guide-shorts" d="M75 101H105L107 120H96L90 111 84 120H73Z"/>
    <path d="M85 48H95V62H85Z"/>
    <path class="guide-shirt" d="M64 62Q74 56 83 56Q90 64 97 56Q106 56 113 61L111 73 103 70 105 102Q90 106 75 102L77 70 69 73Z"/>
    <path class="guide-stripe" d="M78 80H102M77 91H103"/>
    <path d="M78 39Q78 27 90 27Q102 27 102 39V43Q100 54 90 55Q80 54 78 43Z"/>
    <path class="guide-hair" d="M78 40Q75 28 87 26Q100 23 103 35L101 41Q99 35 94 34Q87 39 78 40Z"/>
  </g>`;
  return `<svg viewBox="0 0 180 145">
    <ellipse class="guide-disc" cx="90" cy="72" rx="81" ry="68"/>
    ${hand?`<use class="guide-hand" href="#guide-${art}" transform="translate(-32 7) scale(.92 .9)" stroke="currentColor" stroke-width="3"/>`:art==='home'
      ?'<path class="guide-arrow" d="M57 78q33 29 66 0zM69 65l10 13m9-15 4 15m13-14-5 14"/>'
      :figure}
    <path class="guide-arrow" d="${arrows[art]||''}"/>
  </svg>`;
}
