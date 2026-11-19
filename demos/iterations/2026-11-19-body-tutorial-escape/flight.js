'use strict';

const $ = id => document.getElementById(id);
const stage = $('stage');
const preview = $('previewCanvas');
const previewContext = preview.getContext('2d');
const device = $('device');
const video = document.createElement('video');
video.muted = true;
video.playsInline = true;
const poseFrame = document.createElement('canvas');
const poseContext = poseFrame.getContext('2d');
const handFrame = document.createElement('canvas');
const handContext = handFrame.getContext('2d');
const ESCAPE_SECONDS = 20;
const LEAN_DEADZONE = .055;
const ATTACK_NOTICE = .5;
const ATTACK_CHARGE = 2.3;
const MAX_FRIES = 3;
const TRACKING_GRACE = 320;
const CALIBRATION_MS = 1000;
const BODY_INPUT = Object.freeze({tuckEnter:1.32,tuckExit:1.46,tuckMs:110,
  escapeSpan:1.5,escapeOut:.60,escapeMs:100,grabGuardMs:80,
  handGraceMs:900,handConfirmMs:33,flapSpan:1.25,flapTravel:.16,flapCooldownMs:200});
const VISION_ROOTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.21'
];
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

let game = {phase:'setup',round:1,score:0,target:-1,blocked:-1,x:0,z:50};
const view = {x:0,z:50,height:140,pitch:0,bank:0,lift:0,wings:1,speed:0};
let mode = 'keyboard', inputLift = 0, inputSpread = 1, keyboardFlap = 0;
let audio, muted = false, heyBuffer;
let session = 0, cameraRequest = 0, opening = false, stream = null, tracker = null, handTracker = null, modelTask = null;
let landmarks = null, latestPose = null, neutral = null, calibration = null, motion = makeMotion();
let lastVideoTime = -1, lastPoseAt = -Infinity, lastValidAt = -Infinity;
let trackingPaused = false, lastTick = performance.now();
let bodyLesson=null;
const LESSON_STEPS=[
  ['🪽 ↕ 🪽','拍动双臂两次','双肩和手肘保持入镜，上下拍动；下方会显示次数。'],
  ['↙ 🧍 ↘','侧倾对准薯条','缓慢向金圈方向倾斜，画面对准后自动继续。'],
  ['🪽 → 🧍 ← 🪽','收翅俯冲','两侧手肘收向身体，短暂保持；不用先展翅。'],
  ['🖐️ → ✊','张手再握拳','单手伸到胸前，张开五指后用同一只手握拳。'],
  ['🧍 → 🪽','展开双臂离开','抓到薯条后直接展开双臂，保持片刻就能飞走。'],
  ['🏡','准备正式出发','目标：把薯条带回巢。练习所得不会计入正式得分。']
];
function showBodyLesson(){
  $('bodyLesson').hidden=!bodyLesson;
  if(!bodyLesson)return;
  const [demo,title,detail]=LESSON_STEPS[bodyLesson.step];
  $('lessonProgress').textContent=bodyLesson.step===5 ? '练习完成 · '+Math.ceil(bodyLesson.countdown)+' 秒后开始' : '体感练习 '+(bodyLesson.step+1)+' / 5 · 无攻击、无倒计时';
  $('lessonDemo').textContent=demo;$('lessonTitle').textContent=title;$('lessonDetail').textContent=detail;
}
function startBodyLesson(){beginRound('body',true);bodyLesson={step:0,countdown:3};showBodyLesson();}
function lessonStep(step){if(bodyLesson){bodyLesson.step=step;showBodyLesson();}}

function makeMotion() {
  return {lean:0, leanAt:null, raised:false, open:false, tuckAt:null,
    escapeAt:null, hand:null, activeHand:null, handStatus:'', candidate:null, candidateAt:0,
    handSeenAt:-Infinity, handSampleAt:-Infinity, handCrop:null,
    escapeArmed:false,lastGrabAt:-Infinity,poseAt:null,tuckStatus:'',
    flapPeak:null,flapLow:null,lastFlapAt:-Infinity};
}

function cue(title,detail = '') {
  if ($('cueText').textContent !== title) $('cueText').textContent = title;
  if ($('cueDetail').textContent !== detail) $('cueDetail').textContent = detail;
}

function setPhase(phase) {
  motion.tuckAt=null; motion.escapeAt=null; motion.escapeArmed=false;
  motion.raised=false; motion.candidate=null;
  game.phase = phase;
  game.elapsed = 0;
  stage.dataset.phase = phase;
  $('setup').hidden = phase !== 'setup';
  $('hud').hidden = phase === 'setup' || phase === 'result';
  $('result').hidden = phase !== 'result';
  $('settings').hidden = phase === 'setup';
  $('motionStatus').hidden = true;
}

function tone(notes) {
  if (muted || !audio || audio.state !== 'running') return;
  for (const [frequency,offset,duration,type] of notes) {
    const start = audio.currentTime+offset;
    const osc = audio.createOscillator();
    const volume = audio.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = frequency;
    volume.gain.setValueAtTime(.001,start);
    volume.gain.exponentialRampToValueAtTime(.07,start+.022);
    volume.gain.exponentialRampToValueAtTime(.001,start+duration);
    osc.connect(volume).connect(audio.destination);
    osc.start(start);
    osc.stop(start+duration+.01);
  }
}

function startAudio() {
  try {
    audio ??= new AudioContext();
    audio.resume().catch(() => {});
  } catch {
    muted = true;
  }
}

function playWind() {
  if (muted || audio?.state !== 'running') return;
  const length = .71;
  const buffer = audio.createBuffer(1,Math.round(audio.sampleRate*length),audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let air = 0;
  for (let i=0;i<samples.length;i++) {
    air = air*.81+(Math.random()*2-1)*.19;
    samples[i] = air*.65*Math.sin(Math.PI*i/samples.length);
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(audio.destination);
  source.start();
}

function playHey() {
  if (muted || audio?.state !== 'running') return;
  if (!heyBuffer) {
    const length = .39;
    const step = 1/audio.sampleRate;
    heyBuffer = audio.createBuffer(1,Math.round(length/step),audio.sampleRate);
    const samples = heyBuffer.getChannelData(0);
    let pitch = 0;
    for (let i=0;i<samples.length;i++) {
      const time = i*step;
      const vowel = limit((time-.055)/.28,0,1);
      const fundamental = 210-57*vowel;
      pitch += TAU*fundamental*step;
      const envelope = limit((time-.045)/.046,0,1)*limit((length-time)/.078,0,1);
      let voiced = 0;
      for (let harmonic=1;harmonic<=17;harmonic++) {
        const hz = fundamental*harmonic;
        const formants = Math.exp(-((hz-(525-220*vowel))**2)/25000) +
          .76*Math.exp(-((hz-(1710+550*vowel))**2)/90000) +
          .34*Math.exp(-((hz-2780)**2)/115000);
        voiced += Math.sin(pitch*harmonic)*formants/Math.sqrt(harmonic);
      }
      const breath = time<.09 ? (Math.random()*2-1)*Math.sin(Math.PI*time/.09)*.14 : 0;
      samples[i] = Math.tanh(.87*voiced)*envelope*.72+breath;
    }
  }
  const source = audio.createBufferSource();
  const pan = audio.createStereoPanner();
  pan.pan.value = .9;
  source.buffer = heyBuffer;
  source.connect(pan).connect(audio.destination);
  source.start();
}

function updateHUD() {
  $('round').textContent = game.round;
  $('score').textContent = game.score;
  $('load').hidden = !game.carry;
  $('carry').textContent = game.carry;
  const notice = $('reaction');
  const call = game.feedback || (game.attack && !game.attack.resolved ? 'HEY!!!' : '');
  if (notice.textContent !== call) notice.textContent = call;
  notice.hidden = !call;
  notice.classList.toggle('success',call === 'TOO SLOW!');
  $('timePanel').hidden = game.phase !== 'chase';
  if (game.phase === 'chase') {
    $('timeText').textContent = Math.max(0,game.remaining).toFixed(1);
    $('timePanel').classList.toggle('urgent',game.remaining<2);
  }
}

function beginRound(newMode, restart = false) {
  bodyLesson=null;showBodyLesson();
  mode = newMode;
  if (mode === 'keyboard') closeCamera();
  startAudio();
  const round = restart ? 1 : game.round+1;
  const target = round%2 ? -1 : 1;
  game = {round,score:restart ? 0 : game.score,target,blocked:target,x:0,z:50,lean:0,
    elapsed:0,flaps:0,ready:false,carry:0,remaining:ESCAPE_SECONDS,boost:0,clawOpen:false,
    clawSnap:0,climb:0,grabPending:0,slow:0,flash:0,
    obstacles:[{z:1450,kind:'crates',lane:0},{z:2200,kind:'sign',lane:target},
      {z:2900,kind:'crates',lane:0}]};
  Object.assign(view,{x:0,z:50,height:140,pitch:0,bank:0,lift:0,wings:1,speed:0});
  motion = makeMotion();
  inputLift = keyboardFlap = 0;
  inputSpread = 1;
  trackingPaused = false;
  setPhase('launch');
  refreshCue();
  updateHUD();
  $('settings').blur();
}

function returnToSetup() {
  bodyLesson=null;showBodyLesson();
  game = {round:1,score:0,x:0,target:-1,blocked:-1,z:50,elapsed:0,carry:0,flash:0};
  Object.assign(view,{x:0,z:50,height:140,pitch:0,bank:0,lift:0,wings:1,speed:0});
  calibration = null;
  trackingPaused = false;
  setPhase('setup');
  updateCameraButtons();
}

function refreshCue() {
  const key = mode === 'keyboard';
  const direction = side => side < 0 ? '左' : '右';
  const sideKey = side => side < 0 ? 'A / ←' : 'D / →';
  if (game.phase === 'launch') {
    cue('拍两下翅膀', key ? '按 W 或空格 · '+game.flaps+'/2' : '张开双臂，上下扑动 · '+game.flaps+'/2');
  } else if (game.phase === 'approach') {
    const turn = Math.sign(routeX(game.target)-game.x);
    if (!isLinedUp(game)) {
      cue('向'+direction(turn)+'倾斜',key ? sideKey(turn)+' · 飞向薯条盒' : '上半身缓慢朝薯条倾斜');
    } else if (!game.ready) {
      cue('看准薯条', '等盒子亮起金圈');
    } else {
      cue(key ? '自动俯冲' : '收翅俯冲',key ? '对准即可降落，不用按键' : '把两侧手肘收向身体');
    }
  } else if (game.phase === 'dive') {
    cue('俯冲！');
  } else if (game.phase === 'grab') {
    const escape = key ? '空格 / W · 向上飞走，躲开游客' : '双臂展开，向上逃跑';
    if (game.carry >= MAX_FRIES) cue('展翅逃跑',escape);
    else if (game.clawOpen) cue(key ? '鸟爪抓取中' : '握拳抓薯条',key ? '每按一次 E 抓一根' : motion.handStatus || '握紧刚才伸出的那只手');
    else cue(key ? (game.carry ? '再抢一根，还是逃？' : '抢薯条！') : game.carry ? '再张手，或飞走' : '伸手张开五指',key ? 'E 抓一根 · '+escape
      : game.carry ? escape : motion.handStatus || '把一只手伸到胸前，掌心朝向摄像头');
  } else if (game.phase === 'chase') {
    if (game.attack && !game.attack.resolved) {
      cue('向上逃跑！',key ? '空格 / W · 拍翅升空' : '展开双臂，拍翅升空');
    } else {
      const obstacle = game.obstacles.find(item => !item.passed && item.z>game.z-40);
      if (obstacle && obstacle.z-game.z<650) {
        cue(obstacle.kind==='crates' ? '拍翅！飞过货箱' : '避开码头招牌', key
          ? obstacle.kind==='crates' ? '空格 / W · 向上飞' : (obstacle.lane>0 ? 'A / ← · 飞到左边' : 'D / → · 飞到右边')
          : obstacle.kind==='crates' ? '拍动双臂，飞越货箱' : '身体侧倾，绕开招牌');
      } else cue('沿栈道飞回巢穴',key ? '空格 / W 拍翅 · A / D 换边' : '拍翅飞翔，侧倾绕开障碍');
    }
  } else if (game.phase === 'hit') {
    cue('薯条掉了！');
  } else if (game.phase === 'home') {
    cue('落巢！', '+'+game.deposited+' 根薯条');
  }
}

function canAct() {
  return mode === 'keyboard' || !trackingPaused;
}

function steer(side) {
  if (!canAct() || !['approach','chase'].includes(game.phase) || game.x === routeX(side)) return;
  game.x = routeX(side);
  tone([[420,0,.12]]);
  refreshCue();
}

function flap() {
  if (!canAct()) return;
  if (mode === 'keyboard') keyboardFlap = .31;
  if (game.phase === 'launch') {
    game.flaps++;
    tone([[game.flaps === 1 ? 540 : 740,0,.14]]);
    if (game.flaps >= 2) {
      motion.lean = 0;
      setPhase('approach');
    }
    refreshCue();
  } else if (game.phase === 'chase') {
    game.boost = 1.3;
    game.climb = 1.7;
    tone([[490,0,.12],[570,.075,.14]]);
  } else if (game.phase === 'grab') {
    beginChase();
  }
}

function tuck() {
  if(bodyLesson && bodyLesson.step!==2)return;
  if (!canAct() || game.phase !== 'approach' || !game.ready || !isLinedUp(game)) return;
  setPhase('dive');
  game.diveFrom = game.z;
  playWind();
  refreshCue();
}

function beginGrab() {
  game.x = routeX(game.target);
  motion.escapeAt = null;
  motion.handStatus = '';
  motion.handCrop = null;
  setPhase('grab');
  lessonStep(3);
  refreshCue();
}

function openClaw(hand) {
  if (!canAct() || game.phase !== 'grab' || game.clawOpen || game.carry>=MAX_FRIES) return;
  game.clawOpen = true;
  motion.hand = hand;
  tone([[560,0,.075]]);
  refreshCue();
}

function closeClaw(hand) {
  if (!canAct() || game.phase !== 'grab' || !game.clawOpen || hand !== motion.hand) return;
  game.clawOpen = false;
  game.clawSnap = .28;
  game.carry++;
  if(bodyLesson)lessonStep(4);
  motion.lastGrabAt=performance.now();
  motion.escapeAt=null;
  motion.escapeArmed=true;
  tone([[740,0,.085],[1050,.06,.11]]);
  if (game.carry === 2 && !bodyLesson) {
    game.attack = {elapsed:0,resolved:false};
    playHey();
  }
  refreshCue();
  updateHUD();
}

function keyboardGrab() {
  if (game.phase!=='grab' || game.grabPending || game.carry>=MAX_FRIES) return;
  openClaw('keyboard');
  game.grabPending = .18;
}

function beginChase(confirmedSpread=false) {
  if (game.phase !== 'grab' || !game.carry) return;
  if (mode==='body' && !confirmedSpread && (game.clawOpen || motion.candidate)) return;
  motion.candidate=null;
  game.z = TRAY_Z+25;
  game.clawOpen = false;
  game.grabPending = 0;
  game.remaining = ESCAPE_SECONDS;
  game.boost = 1.3;
  game.climb = 1.7;
  game.flash = .48;
  game.flashColor = '#ffda79';
  setPhase('chase');
  lessonStep(5);
  tone([[540,0,.13],[780,.08,.15]]);
  refreshCue();
}

function updateAttack(dt) {
  if (!game.attack || game.attack.resolved) return;
  game.attack.elapsed += dt;
  const escaped = game.phase === 'chase' && game.elapsed>=.16;
  if (game.attack.elapsed < ATTACK_NOTICE+ATTACK_CHARGE && !escaped) return;
  game.attack.resolved = true;
  if (escaped) {
    game.feedback = 'TOO SLOW!';
    game.feedbackTime = 1.45;
    tone([[520,0,.14],[775,.08,.17]]);
    refreshCue();
  } else {
    game.dropped = game.carry;
    game.carry = 0;
    game.clawOpen = false;
    game.feedback = 'BONK!!!';
    game.flash = .78;
    game.flashColor = '#f5655c';
    tone([[150,0,.22,'sawtooth'],[105,.08,.25]]);
    setPhase('hit');
    refreshCue();
  }
}

function arrive() {
  game.deposited = game.carry;
  game.score += game.carry;
  game.carry = 0;
  game.flash = .49;
  game.flashColor = '#ffe098';
  setPhase('home');
  tone([[560,0,.14],[710,.11,.15],[920,.22,.28]]);
  refreshCue();
}

function showResult(success, reason = '') {
  game.carry = 0;
  $('resultTitle').textContent = success ? (game.deposited ? '偷到了！' : '空爪回巢') : reason;
  $('resultText').textContent = success
    ? '这趟带回 '+game.deposited+' 根。巢里共有 '+game.score+' 根薯条。'
    : '这趟的薯条掉了。巢里还有 '+game.score+' 根。';
  if (!success) tone([[175,0,.28,'sawtooth'],[120,.11,.24,'triangle']]);
  setPhase('result');
  updateHUD();
  $('again').focus({preventScroll:true});
}

function updateFlight(dt) {
  if(bodyLesson?.step===5){
    bodyLesson.countdown=Math.max(0,bodyLesson.countdown-dt);showBodyLesson();
    if(!bodyLesson.countdown)beginRound('body',true);
    return;
  }
  if(bodyLesson && game.phase==='approach'){
    if(bodyLesson.step===0)lessonStep(1);
    if(bodyLesson.step===1 && isLinedUp(game))lessonStep(2);
  }
  game.elapsed += dt;
  game.flash = Math.max(0,game.flash-dt*1.9);
  game.clawSnap = Math.max(0,game.clawSnap-dt);
  keyboardFlap = Math.max(0,keyboardFlap-dt);
  game.climb = Math.max(0,(game.climb || 0)-dt);
  game.slow = Math.max(0,(game.slow || 0)-dt);
  if (game.grabPending>0) {
    game.grabPending = Math.max(0,game.grabPending-dt);
    if (!game.grabPending && game.phase==='grab') closeClaw('keyboard');
  }
  if (game.feedbackTime > 0) {
    game.feedbackTime -= dt;
    if (game.feedbackTime <= 0) game.feedback = '';
  }

  if (game.phase === 'approach') {
    if (mode === 'body') {
      const linedUp = isLinedUp(game);
      game.x = limit(game.x+game.lean*222*dt,-210,210);
      if (linedUp !== isLinedUp(game)) refreshCue();
    }
    game.z = Math.min(APPROACH_LIMIT,game.z+243*dt);
    if (!game.ready && game.z >= TRAY_Z-323) {
      game.ready = true;
      if (isLinedUp(game)) tone([[690,0,.12]]);
      refreshCue();
    }
    if (mode==='keyboard' && game.ready && isLinedUp(game) && game.z>=APPROACH_LIMIT) tuck();
  } else if (game.phase === 'dive') {
    const progress = limit(game.elapsed/.63,0,1);
    game.z = game.diveFrom+(TRAY_Z-105-game.diveFrom)*progress;
    game.x = smooth(game.x,routeX(game.target),dt,9);
    if (progress === 1) beginGrab();
  } else if (game.phase === 'chase') {
    game.remaining -= dt;
    game.boost = Math.max(0,game.boost-dt);
    const home = NEST_Z-85;
    const previousZ = game.z;
    game.z = Math.min(home,game.z+(game.slow ? 130 : game.boost ? 310 : 235)*dt);
    if (mode === 'body') game.x = limit(game.x+game.lean*240*dt,-210,210);
    for (const obstacle of game.obstacles) {
      if (obstacle.passed || obstacle.z>game.z || obstacle.z<previousZ) continue;
      obstacle.passed = true;
      const collided = obstacle.kind==='crates' ? game.climb<=0 : Math.abs(game.x-routeX(obstacle.lane))<85;
      if (collided) {
        game.carry = Math.max(0,game.carry-1);
        game.flash = .55;
        game.flashColor = '#f5655c';
        game.slow = .65;
        game.feedback = '擦碰！掉了 1 根';
        game.feedbackTime = 1.25;
        tone([[140,0,.18,'sawtooth']]);
      } else {
        game.feedback = '漂亮！';
        game.feedbackTime = .75;
        tone([[800,0,.09],[1050,.08,.12]]);
      }
    }
    if (home-game.z<200) game.x = smooth(game.x,routeX(-game.blocked),dt,3.5);
    refreshCue();
    if (game.remaining <= 0) {
      showResult(false,'没赶回巢');
      return;
    }
    if (game.z >= home) arrive();
  } else if (game.phase === 'hit') {
    if (game.elapsed>.78) showResult(false,'BONK!!!');
  } else if (game.phase === 'home') {
    game.z = Math.min(NEST_Z-46,game.z+75*dt);
    if (game.elapsed > 1.0) showResult(true);
  }
  if (game.phase === 'grab' || game.phase === 'chase') updateAttack(dt);
  if (game.phase !== 'setup') updateHUD();
}

function updateView(dt) {
  const dive = game.phase === 'dive';
  const low = dive || game.phase === 'grab' || game.phase === 'hit';
  const chase = game.phase === 'chase';
  const home = game.phase === 'home';
  const targetX = game.x;
  const steering = targetX-view.x;
  view.x = smooth(view.x,targetX,dt,11);
  view.z = smooth(view.z,game.z,dt,dive ? 16 : 10);
  view.height = smooth(view.height,low ? 61 : home ? 65 : chase ? (game.climb>0 ? 200 : 105) : 141,dt,5.6);
  view.pitch = smooth(view.pitch,low ? -92 : home ? -62 : chase ? -34 : 0,dt,5.2);
  view.bank = smooth(view.bank,limit(steering*.00045+game.lean*.042,-.10,.10),dt,9);
  const lift = keyboardFlap > 0 ? Math.sin((.31-keyboardFlap)*Math.PI/.31) : inputLift;
  view.lift = smooth(view.lift,dive ? -.23 : lift,dt,11);
  view.wings = smooth(view.wings,low ? .16 : Math.max(.62,inputSpread),dt,10);
  view.speed = smooth(view.speed,dive || game.boost ? 1 : chase ? .63 : game.phase === 'approach' && game.z<APPROACH_LIMIT ? .42 : 0,dt,5);
}

function readPose(points, aspect) {
  const visible = i => {
    const joint = points[i];
    return joint && (joint.visibility ?? 1) > .49 && joint.x > .01 && joint.x < .99 &&
      joint.y > .02 && joint.y < .98;
  };
  if (!points || ![11,12].every(visible)) return null;
  const [left,right,hipA,hipB] = [11,12,23,24].map(i => points[i]);
  const shoulders = Math.abs(left.x-right.x)*aspect;
  const shoulderY = (left.y+right.y)/2;
  const hipsVisible=visible(23) && visible(24);
  // Shoulder width gives a scale when the waist is outside the camera frame.
  const torso=hipsVisible ? (hipA.y+hipB.y)/2-shoulderY : shoulders*.95;
  const hipY=shoulderY+torso;
  if (torso < .077 || shoulders < .055) return null;
  const shoulderX = (left.x+right.x)/2, hipX = hipsVisible ? (hipA.x+hipB.x)/2 : shoulderX;
  const orientation = Math.sign(left.x-right.x);
  const pose = {x:(1-hipX*.76-shoulderX*.24)*aspect, torso,
    lean:(right.y-left.y)*orientation/shoulders, shoulderX, shoulderY, hipY, span:null,
    wrists:[15,16].filter(visible).map(arm=>({arm,x:points[arm].x,y:points[arm].y}))};
  if (!visible(13) || !visible(14)) return pose;
  const elbowA = points[13], elbowB = points[14];
  pose.span = Math.abs(elbowA.x-elbowB.x)*aspect/shoulders;
  pose.lift = (shoulderY-(elbowA.y+elbowB.y)*.5)/torso;
  pose.bothOut = Math.min((elbowA.x-shoulderX)*orientation,(shoulderX-elbowB.x)*orientation)*aspect/shoulders;
  return pose;
}

function trackMotion(pose, now) {
  if (motion.poseAt!==null && now-motion.poseAt>120) {
    motion.tuckAt=null; motion.escapeAt=null; motion.escapeArmed=false;
    motion.raised=false;
    motion.flapPeak=motion.flapLow=null;
  }
  motion.poseAt=now;
  const lean = pose.lean-neutral.lean;
  const magnitude = Math.abs(lean);
  const target = Math.sign(lean)*limit((magnitude-LEAN_DEADZONE)/.22,0,1);
  const elapsed = now-(motion.leanAt ?? now);
  game.lean = smooth(game.lean,target,Math.min(elapsed,100)/1000,15);
  motion.lean = lean;
  motion.leanAt = now;
  if (pose.span === null) {
    motion.escapeAt = null;
    motion.tuckAt = null;
    motion.raised = false;
    motion.flapPeak=motion.flapLow=null;
    motion.escapeArmed=false;
    if (game.phase==='approach' && game.ready && isLinedUp(game)) cue('收翅俯冲','请让两侧手肘保持入镜');
    return;
  }
  inputSpread = limit((pose.span-1.06)/.7,0,1);
  inputLift = limit((pose.lift+.27)*1.6,-1,1);

  const spread = pose.bothOut>.72;
  if (game.phase==='grab') {
    // Successful grab arms escape. Only a bilateral spread can leave GRAB;
    // an open palm seen during that movement must not lock the player here.
    if (now-motion.lastGrabAt<BODY_INPUT.grabGuardMs) {motion.escapeAt=null;return;}
    if (pose.span<BODY_INPUT.tuckExit) motion.escapeArmed=true;
    if (game.carry && motion.escapeArmed && pose.bothOut>BODY_INPUT.escapeOut && pose.span>BODY_INPUT.escapeSpan) {
      motion.escapeAt ??= now;
      if (now-motion.escapeAt>=BODY_INPUT.escapeMs) beginChase(true);
    } else {
      motion.escapeAt = null;
    }
    return;
  }
  const canTuck=game.phase==='approach' && game.ready && isLinedUp(game);
  if (canTuck && pose.span<BODY_INPUT.tuckEnter) {
    motion.tuckAt ??= now;
    cue('收翅俯冲','已看到收翅，确认中…');
    if (now-motion.tuckAt>=BODY_INPUT.tuckMs) {
      motion.raised = false;
      tuck();
    }
  } else if (!canTuck || pose.span>BODY_INPUT.tuckExit) {
    motion.tuckAt = null;
  }

  if (['launch','chase'].includes(game.phase) && pose.span>BODY_INPUT.flapSpan) {
    motion.flapPeak ??= pose.lift;
    motion.flapLow ??= pose.lift;
    if (!motion.raised) {
      motion.flapLow=Math.min(motion.flapLow,pose.lift);
      if (pose.lift-motion.flapLow>=BODY_INPUT.flapTravel || pose.lift>-.14) {
        motion.raised=true; motion.flapPeak=pose.lift;
      }
    } else {
      motion.flapPeak=Math.max(motion.flapPeak,pose.lift);
      if (motion.flapPeak-pose.lift>=BODY_INPUT.flapTravel && now-motion.lastFlapAt>=BODY_INPUT.flapCooldownMs) {
        motion.raised=false; motion.flapLow=pose.lift;motion.lastFlapAt=now;flap();
      }
    }
  } else {
    motion.raised=false;motion.flapPeak=motion.flapLow=null;
  }
}

function classifyHand(points, aspect, category) {
  if (category?.score>=.52 && ['Open_Palm','Closed_Fist'].includes(category.categoryName)) return category.categoryName;
  let straight = 0, folded = 0;
  const vector = (from,to) => [(to.x-from.x)*aspect,to.y-from.y,((to.z ?? 0)-(from.z ?? 0))*aspect];
  const length = (from,to) => Math.hypot(...vector(from,to));
  for (const base of [5,9,13,17]) {
    const joint = points[base+1], tip = points[base+3];
    if (!points[base] || !joint || !tip || !points[0]) return null;
    const a = vector(points[base],joint), b = vector(joint,tip);
    const bend = (a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b));
    const reach = length(points[0],tip)/length(points[0],joint);
    if (bend>.72 && reach>1.16) straight++;
    if (bend<.23 || reach<1.09) folded++;
  }
  if (straight===4) return 'Open_Palm';
  if (folded>=3 && !straight) return 'Closed_Fist';
  return null;
}

function trackHand(result, pose, aspect, crop, now) {
  if (game.phase!=='grab') return;
  const distance = (a,b) => Math.hypot((a.x-b.x)*aspect,a.y-b.y);
  const fullFrame = point => ({x:crop.x+point.x*crop.width,y:crop.y+point.y*crop.height});
  const sameHand = (a,b) => a.arm && b.arm ? a.arm===b.arm : Boolean(a.side && a.side===b.side);
  const handedness = result.handedness ?? result.handednesses;
  const hands = result.landmarks.map((points,index) => {
    if (!points[0] || !points[9]) return null;
    const palm = fullFrame(points[9]);
    const wrist = fullFrame(points[0]);
    const side = handedness?.[index]?.[0]?.categoryName;
    let closest = pose.torso*.63, arm;
    for (const candidate of pose.wrists) {
      const gap = distance(wrist,candidate);
      if (gap<closest) { closest = gap; arm = candidate.arm; }
    }
    const world = result.worldLandmarks?.[index];
    const shape = classifyHand(world || points,world ? 1 : aspect*crop.width/crop.height,result.gestures[index]?.[0]);
    const inFront = Math.abs(palm.x-pose.shoulderX)*aspect<pose.torso*1.48 &&
      palm.y>pose.shoulderY-pose.torso*.94 && palm.y<pose.hipY+pose.torso*.26;
    return {side,arm,shape,inFront};
  }).filter(Boolean);

  const hand = game.clawOpen
    ? hands.find(hand=>sameHand(hand,motion.activeHand))
    : hands.find(hand=>hand.inFront && hand.shape==='Open_Palm' && (hand.arm || hand.side));
  if (hand) motion.handSeenAt = now;
  if (!hand && game.clawOpen && now-motion.handSeenAt>BODY_INPUT.handGraceMs) {
    game.clawOpen = false;
    motion.activeHand=null;
  }
  const status = game.clawOpen
    ? (hand ? '已识别张手 · 握紧同一只手' : '请把刚才那只手放回镜头里')
    : hands.some(hand=>hand.inFront) ? '已看到手 · 请张开五指' :
      hands.length ? '已看到手 · 请把手抬到胸口前' : '还没看到手 · 掌心朝向摄像头';
  if (motion.handStatus!==status) {
    motion.handStatus = status;
    refreshCue();
  }
  const expected = game.clawOpen ? 'Closed_Fist' : 'Open_Palm';
  if (!hand || hand.shape!==expected) {
    motion.candidate = null;
    return;
  }
  if (!motion.candidate || !sameHand(hand,motion.candidate) || motion.candidate.shape!==expected) {
    motion.candidate = hand;
    motion.candidateAt = now;
    return;
  }
  if (now-motion.candidateAt<BODY_INPUT.handConfirmMs) return;
  motion.candidate = null;
  motion.handStatus = '';
  if (game.clawOpen) closeClaw(motion.hand);
  else {
    motion.activeHand = hand;
    openClaw(hand.arm ?? hand.side);
  }
}

function detectHand(pose, aspect, now) {
  const width = video.videoWidth, height = video.videoHeight;
  if (!motion.handCrop) {
    const cropWidth = Math.min(1,Math.max(.40,pose.torso*4.7/aspect));
    const cropHeight = Math.min(1,Math.max(.54,pose.torso*3.3));
    const x = limit(pose.shoulderX-cropWidth/2,0,1-cropWidth);
    const y = limit(pose.shoulderY+pose.torso*.25-cropHeight/2,0,1-cropHeight);
    motion.handCrop = {x,y,width:cropWidth,height:cropHeight};
  }
  const crop = motion.handCrop;
  const inputHeight = Math.round(640*crop.height/(aspect*crop.width));
  if (handFrame.width!==640 || handFrame.height!==inputHeight) {
    handFrame.width = 640;
    handFrame.height = inputHeight;
  }
  handContext.drawImage(video,crop.x*width,crop.y*height,crop.width*width,crop.height*height,
    0,0,handFrame.width,handFrame.height);
  trackHand(handTracker.recognizeForVideo(handFrame,now),pose,aspect,crop,now);
}

function recordCalibration(pose, now) {
  const bar = $('calibrationProgress');
  if (!pose || pose.span===null || (calibration.count && Math.abs(pose.x-calibration.x/calibration.count)>pose.torso*.24)) {
    calibration = {started:null,count:0,x:0,lean:0};
    bar.value = 0;
    return;
  }
  calibration.started ??= now;
  calibration.x += pose.x;
  calibration.lean += pose.lean;
  calibration.count++;
  bar.value = Math.min(1,(now-calibration.started)/CALIBRATION_MS);
  if (bar.value < 1) return;
  neutral = {lean:calibration.lean/calibration.count};
  calibration = null;
  cameraStatus('校准完成。开始体感后，张开双臂拍两下起飞。');
  updateCameraButtons();
}

function drawVideoPreview() {
  if (!stream) return;
  drawMirror(video,previewContext,preview.width,preview.height,landmarks,Boolean(latestPose));
}

function updatePose(now) {
  if (!stream || !tracker || video.readyState<2 || video.currentTime===lastVideoTime || now-lastPoseAt<42) return;
  lastVideoTime = video.currentTime;
  lastPoseAt = now;
  const aspect = video.videoWidth/video.videoHeight;
  if (poseFrame.width!==640 || poseFrame.height!==Math.round(640/aspect)) {
    poseFrame.width = preview.width = 640;
    poseFrame.height = preview.height = Math.round(640/aspect);
    $('preview').style.aspectRatio = String(aspect);
  }
  poseContext.drawImage(video,0,0,poseFrame.width,poseFrame.height);

  try {
    landmarks = tracker.detectForVideo(poseFrame,now).landmarks[0] || null;
  } catch (error) {
    console.warn('Pose tracking interrupted',error);
    tracker.close();
    handTracker.close();
    tracker = handTracker = modelTask = null;
    closeCamera();
    returnToSetup();
    cameraStatus('姿态识别中断。请重新开启摄像头。',true);
    return;
  }
  latestPose = readPose(landmarks,aspect);
  if (game.phase==='setup' && calibration) recordCalibration(latestPose,now);
  if (!latestPose) {
    motion.tuckAt = null;
    motion.escapeAt=null;
    motion.escapeArmed=false;
    motion.raised=false;
    motion.candidate=null;
    return;
  }
  lastValidAt = now;
  if (mode==='body' && neutral && ['launch','approach','dive','grab','chase'].includes(game.phase)) {
    if (trackingPaused) {
      trackingPaused = false;
      motion = makeMotion();
      game.clawOpen = false;
      game.lean = 0;
      refreshCue();
    }
    if (game.phase==='grab' && game.carry<MAX_FRIES && now-motion.handSampleAt>=40) {
      motion.handSampleAt = now;
      try {
        detectHand(latestPose,aspect,now);
      } catch (error) {
        console.warn('Hand tracking interrupted',error);
        handTracker.close();
        tracker.close();
        tracker = handTracker = modelTask = null;
        closeCamera();
        returnToSetup();
        cameraStatus('手势识别中断。请重新开启摄像头。',true);
      }
    }
    trackMotion(latestPose,now);
  }
}

function cameraStatus(message,error = false) {
  $('cameraStatus').textContent = message;
  $('cameraStatus').classList.toggle('error',error);
}

function updateCameraButtons() {
  $('cameraButton').disabled = opening;
  $('cameraButton').textContent = stream ? '关闭摄像头' : '开启摄像头';
  $('calibrate').disabled = !stream || !tracker || Boolean(calibration) || opening;
  $('bodyStart').disabled = !stream || !tracker || !handTracker || !neutral || !latestPose || latestPose.span===null || performance.now()-lastValidAt>TRACKING_GRACE || opening || Boolean(calibration);
  $('calibrationProgress').hidden = !calibration;
  $('previewEmpty').hidden = Boolean(stream);
  preview.hidden = !stream;
}

function closeCamera() {
  session++;
  cameraRequest++;
  opening = false;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  latestPose = landmarks = neutral = calibration = null;
  lastVideoTime = -1;
  lastValidAt = lastPoseAt = -Infinity;
  updateCameraButtons();
}

async function listCameras(selected = stream?.getVideoTracks()[0]?.getSettings().deviceId || device.value) {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const request = ++cameraRequest;
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(input => input.kind==='videoinput' && input.deviceId);
  if (request !== cameraRequest) return;
  device.replaceChildren(new Option('系统默认摄像头',''));
  inputs.forEach((input,index) => device.add(new Option(input.label || '视频输入 '+(index+1),input.deviceId)));
  if (inputs.some(input => input.deviceId===selected)) device.value = selected;
}

async function createTracker(root) {
  let expired = false;
  let timeout;
  const load = (async () => {
    const vision = await import(root+'/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(root+'/wasm');
    if (expired) return null;
    const pose = await vision.PoseLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:POSE_MODEL,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,
      minPoseDetectionConfidence:.50,minPosePresenceConfidence:.50,minTrackingConfidence:.50
    });
    if (expired) { pose.close(); return null; }
    try {
      const hand = await vision.GestureRecognizer.createFromOptions(files,{
        baseOptions:{modelAssetPath:HAND_MODEL,delegate:'CPU'},runningMode:'VIDEO',numHands:2,
        minHandDetectionConfidence:.47,minHandPresenceConfidence:.47,minTrackingConfidence:.45
      });
      if (expired) { pose.close(); hand.close(); return null; }
      return {pose,hand};
    } catch (error) {
      pose.close();
      throw error;
    }
  })();
  const deadline = new Promise((_,reject) => {
    timeout = setTimeout(() => { expired = true; reject(new Error('Model load timed out')); },15000);
  });
  return Promise.race([load,deadline]).finally(() => clearTimeout(timeout));
}

async function getTracker() {
  if (tracker && handTracker) return tracker;
  modelTask ??= (async () => {
    for (const root of VISION_ROOTS) {
      try {
        return await createTracker(root);
      } catch (error) {
        console.warn('Pose model unavailable',error);
      }
    }
    return null;
  })();
  const models = await modelTask;
  tracker = models?.pose ?? null;
  handTracker = models?.hand ?? null;
  if (!models) modelTask = null;
  return tracker;
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus('体感请用 Chrome 打开本地试玩网址，再开启摄像头。',true);
    return;
  }
  const selected = device.value;
  closeCamera();
  const ticket = session;
  opening = true;
  updateCameraButtons();
  cameraStatus('等待相机权限…');
  try {
    const input = selected ? {deviceId:{exact:selected}} : {};
    let received;
    try {
      received = await navigator.mediaDevices.getUserMedia({
        audio:false,video:{...input,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}
      });
    } catch (error) {
      if (session!==ticket || !['OverconstrainedError','NotReadableError','AbortError'].includes(error.name)) throw error;
      received = await navigator.mediaDevices.getUserMedia({audio:false,video:input});
    }
    if (session!==ticket) {
      received.getTracks().forEach(track => track.stop());
      return;
    }
    const track = received.getVideoTracks()[0];
    stream = received;
    video.srcObject = stream;
    let playbackTimeout;
    try {
      await Promise.race([
        video.play(),
        new Promise((_,reject) => {
          playbackTimeout = setTimeout(() => reject(new DOMException('相机未输出视频','NotReadableError')),8000);
        })
      ]);
    } finally {
      clearTimeout(playbackTimeout);
    }
    if (session!==ticket) return;
    track.addEventListener('ended',() => {
      if (stream !== received) return;
      closeCamera();
      returnToSetup();
      cameraStatus('相机已断开。重新连接后点击开启摄像头。',true);
    });
    listCameras().catch(() => {});
    opening = false;
    updateCameraButtons();
    cameraStatus('正在加载身体和手势识别…');
    const model = await getTracker();
    if (session!==ticket) return;
    cameraStatus(model ? (track.label || '摄像头已连接')+' · 调整镜头，让双肩和两侧手肘入镜，再校准；不必拍到髋部。'
      : '体感识别加载失败。检查网络后重新开启相机。',!model);
    updateCameraButtons();
  } catch (error) {
    if (session!==ticket) return;
    closeCamera();
    const hints = {
      NotAllowedError:'请允许 Chrome 访问摄像头，再点开启。',
      NotReadableError:'相机正被占用或读不到画面。关闭正在使用相机的页面后重试。',
      NotFoundError:'未找到相机。检查 DJI 已进入 Webcam 模式并重新选择。'
    };
    cameraStatus(hints[error.name] || '相机启动失败。请重新选择视频输入。',true);
  }
}

function tick(now) {
  const dt = Math.min(.055,Math.max(0,(now-lastTick)/1000));
  lastTick = now;
  updatePose(now);
  if (game.phase==='setup') updateCameraButtons();
  const active = !['setup','result'].includes(game.phase);
  trackingPaused = mode==='body' && active && !['home','hit'].includes(game.phase) && now-lastValidAt>TRACKING_GRACE;
  const elbowsMissing=mode==='body' && active && latestPose && latestPose.span===null;
  $('motionStatus').hidden = !trackingPaused && !elbowsMissing;
  if (trackingPaused || elbowsMissing) $('motionStatus').textContent=!latestPose
    ? '请后退或调整镜头，让双肩入镜（只有脸无法识别拍翅）'
    : '请让两侧手肘入镜，再上下拍动双臂';
  if (active && !trackingPaused) {
    updateFlight(dt);
    updateView(dt);
  }
  if (game.phase==='setup') drawVideoPreview();
  if (mode==='body' && stream && ['launch','result'].includes(game.phase)) {
    drawMirror(video,paint,W,H,landmarks,Boolean(latestPose),true);
  } else {
    drawFlight(game,view,now/1000);
  }
  requestAnimationFrame(tick);
}

$('cameraButton').onclick = () => {
  if (stream) {
    closeCamera();
    cameraStatus('摄像头已关闭。');
  } else openCamera();
};
device.onchange = () => { if (stream || opening) openCamera(); };
navigator.mediaDevices?.addEventListener('devicechange',() => listCameras().catch(() => {}));
listCameras().catch(() => {});
$('calibrate').onclick = () => {
  calibration = {started:null,count:0,x:0,lean:0};
  neutral = null;
  $('calibrationProgress').value = 0;
  updateCameraButtons();
  cameraStatus('在活动区中央正对屏幕，站稳约 1 秒。');
};
$('bodyStart').onclick = () => {
  if (!latestPose || latestPose.span===null || performance.now()-lastValidAt>TRACKING_GRACE) {
    cameraStatus('请让双肩和两侧手肘入镜，再开始体感。',true);
    return;
  }
  startBodyLesson();
};
$('lessonRetry').onclick=startBodyLesson;
$('lessonSkip').onclick=()=>beginRound('body',true);
$('keyboardStart').onclick = () => beginRound('keyboard',true);
$('again').onclick = () => beginRound(mode);
$('back').onclick = returnToSetup;
$('settings').onclick = returnToSetup;
$('sound').onclick = () => {
  muted = !muted;
  $('sound').setAttribute('aria-pressed',String(muted));
  if (!muted) startAudio();
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('fullscreen').textContent = '用浏览器全屏';
  }
};
document.addEventListener('fullscreenchange',() => {
  $('fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
});
window.addEventListener('keydown',event => {
  const {code} = event;
  if (mode!=='keyboard' || ['setup','result','home','hit'].includes(game.phase) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLButtonElement && ['Space','Enter'].includes(code)) return;
  if (['Space','KeyW','ArrowUp','KeyA','ArrowLeft','KeyD','ArrowRight','KeyS','ArrowDown','KeyE','KeyF'].includes(code)) {
    event.preventDefault();
    if (event.repeat) return;
    if (['Space','KeyW','ArrowUp'].includes(code)) flap();
    else if (['KeyA','ArrowLeft','KeyD','ArrowRight'].includes(code)) {
      const side = ['KeyA','ArrowLeft'].includes(code) ? -1 : 1;
      steer(side);
    }
    else if (code==='KeyE') keyboardGrab();
    else if (code==='KeyF') closeClaw('keyboard');
    else tuck();
  }
});
window.addEventListener('pagehide',() => {
  closeCamera();
  if (game.phase!=='setup') returnToSetup();
});
updateCameraButtons();
if (new URLSearchParams(window.location.search).get('mode') === 'keyboard') {
  beginRound('keyboard',true);
}
requestAnimationFrame(tick);
