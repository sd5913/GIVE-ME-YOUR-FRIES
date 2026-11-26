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
const LEAN_CONTROL=Object.freeze({
  shoulderWeight:.6,headWeight:.4,sameDirectionBoost:1.12,conflictShoulderWeight:.8,
  triggerDegrees:10,neutralDegrees:4,confirmMs:120,flightNeutral:6,flightTrigger:12,flightConfirmMs:160
});
const ATTACK_NOTICE = .5;
const ATTACK_CHARGE = 2.3;
let MAX_FRIES = 3;
const TRACKING_GRACE = 320;
const CALIBRATION_MS = 2000;
const BODY_INPUT = Object.freeze({escapeSpan:1.5,escapeOut:.60,escapeMs:100,grabGuardMs:80,
  handGraceMs:900,handConfirmMs:33,flapSpan:1.25,flapTravel:.16,flapCooldownMs:120});
const BODY_INPUT_PERF=Object.freeze({poseIntervalMs:50,handIntervalMs:60,poseWidth:480});
const VISION_ROOTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.21'
];
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

let game = {phase:'welcome',round:1,score:0,target:-1,blocked:-1,x:0,z:50};
const view = {x:0,z:50,height:155,reach:0,pitch:0,bank:0,lift:0,wings:1,speed:0};
let mode = 'keyboard', inputLift = 0, inputSpread = 1, keyboardFlap = 0;
const heldKeys = new Set();
let audio, muted = false, heyBuffer;
let session = 0, cameraRequest = 0, opening = false, stream = null, tracker = null, handTracker = null, modelTask = null;
let landmarks = null, latestPose = null, neutral = null, calibration = null, motion = makeMotion();
let lastVideoTime = -1, lastPoseAt = -Infinity, lastValidAt = -Infinity;
let trackingPaused = false, lastTick = performance.now();
let currentLevel=1;
let selectedLevel=1,selectionCountdown=0;
let poseSamples=0,poseFps=0,lastPoseFpsAt=performance.now();
let gameFrames=0,gameFps=0,lastGameFpsAt=performance.now();
let inputDebug=null,lastFlapLatencyMs=null;
let poseInferenceScheduled=false;
function showBodyLesson() { $('bodyLesson').hidden=true; }
function lessonStep() {}
function startBodyLesson(){beginRound('body',true);}
let bodyLesson=null;

function makeMotion() {
  return {lean:0, leanAt:null, raised:false, open:false,
    escapeAt:null, hand:null, activeHand:null, handStatus:'', candidate:null, candidateAt:0,
    handSeenAt:-Infinity, handSampleAt:-Infinity, handCrop:null,
    lastGrabAt:-Infinity,poseAt:null,
    steerDirection:0,leanCandidate:0,leanCandidateAt:0,selectionArmed:true,
    flapPeak:null,flapLow:null,flapStartedAt:null,lastFlapAt:-Infinity,currentAction:'等待动作'};
}

function createInputDebug(){
  if(!document.body?.appendChild)return;
  const toggle=document.createElement('button');
  toggle.type='button';toggle.textContent='INPUT DEBUG';toggle.hidden=true;
  toggle.style.cssText='position:fixed;right:10px;bottom:10px;z-index:20;padding:7px 10px;border:1px solid #8af0d0;border-radius:8px;background:#102b42;color:#fff;font:700 11px system-ui;cursor:pointer';
  const panel=document.createElement('aside');
  panel.hidden=true;
  panel.style.cssText='position:fixed;right:10px;bottom:48px;z-index:20;width:min(300px,calc(100vw - 20px));padding:12px;border:1px solid #8af0d0;border-radius:10px;background:#102b42ee;color:#fff;font:12px/1.5 system-ui;white-space:pre-line;pointer-events:auto';
  const heading=document.createElement('div');
  heading.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:#8af0d0;font-weight:800';
  const title=document.createElement('span');title.textContent='BODY INPUT DEBUG';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close debug panel');
  close.style.cssText='border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer';
  const data=document.createElement('div');
  heading.append(title,close);panel.append(heading,data);document.body.append(toggle,panel);
  toggle.onclick=()=>{panel.hidden=!panel.hidden;};
  close.onclick=()=>{panel.hidden=true;};
  inputDebug={toggle,panel,data,opened:new URLSearchParams(window.location.search).get('debug')==='1',
    lastRenderAt:0};
  panel.hidden=!inputDebug.opened;
}

function updateInputDebug(now){
  if(!inputDebug)return;
  inputDebug.toggle.hidden=mode!=='body'||!stream;
  if(now-inputDebug.lastRenderAt<100)return;
  inputDebug.lastRenderAt=now;
  const actualX=Number.isFinite(game.x)?Math.round(game.x):0;
  const actualHeight=Math.round(game.flightHeight||0);
  const lane=game.laneTarget<0?'LEFT':'RIGHT';
  const level=['LOW','MID','HIGH'][game.heightLevel??1]||'MID';
  inputDebug.data.textContent=[
    `Game FPS: ${gameFps}`,
    `Pose FPS: ${poseFps}`,
    `Action: ${motion.currentAction||'—'}`,
    `Position: x ${actualX}, h ${actualHeight} → ${lane}/${level}`,
    `Flap trigger delay: ${lastFlapLatencyMs===null?'—':Math.round(lastFlapLatencyMs)+' ms'}`
  ].join('\\n');
}

function cue(title,detail = '') {
  if ($('cueText').textContent !== title) $('cueText').textContent = title;
  if ($('cueDetail').textContent !== detail) $('cueDetail').textContent = detail;
}

function setPhase(phase) {
  if (phase !== 'grab' && phase !== 'chase') $('grabImpact').hidden = true;
  motion.escapeAt=null;
  motion.raised=false; motion.candidate=null;
  if(phase!=='handPractice')practice=null;
  $('handSchool').hidden=phase!=='handPractice';
  $('repeatPractice').hidden=phase!=='levelSelect'||mode!=='body';
  game.phase = phase;
  game.elapsed = 0;
  stage.dataset.phase = phase;
  $('welcome').hidden = phase !== 'welcome';
  $('setup').hidden = phase !== 'setup';
  $('calibrationScreen').hidden=phase!=='calibrating';
  $('levelSelect').hidden=phase!=='levelSelect';
  $('levelCountdown').hidden=true;
  $('hud').hidden = ['welcome','setup','calibrating','handPractice','levelSelect','result'].includes(phase);
  $('result').hidden = phase !== 'result';
  $('settings').hidden = !['launch','approach','dive','grab','chase','hit','home','result'].includes(phase);
  $('motionStatus').hidden = true;
}

function updateSelectedCard(){
  $('levelSelect').dataset.selected=String(selectedLevel);
  for(const level of [1,2]){
    const card=$('levelCard'+level);
    card.classList.toggle('selected',level===selectedLevel);
    card.setAttribute('aria-pressed',String(level===selectedLevel));
  }
}

function captureLevelArtwork(){
  const source=$('flight');
  for(const id of ['levelArt1','levelArt2']){
    const canvas=$(id),context=canvas.getContext('2d');
    context.drawImage(source,0,0,source.width,source.height,0,0,canvas.width,canvas.height);
  }
}

function startLevelSelection(newMode){
  mode=newMode;
  selectedLevel=currentLevel=1;
  selectionCountdown=0;
  motion=makeMotion();
  captureLevelArtwork();
  updateSelectedCard();
  $('levelCountdown').hidden=true;
  $('levelSelectHint').hidden=false;
  setPhase('levelSelect');
  refreshCue();
}

function chooseLevel(level,confirm=false){
  if(game.phase!=='levelSelect'||selectionCountdown>0||trackingPaused)return;
  selectedLevel=level===2?2:1;
  updateSelectedCard();
  if(confirm)confirmLevelSelection();
}

function confirmLevelSelection(){
  if(game.phase!=='levelSelect'||selectionCountdown>0||trackingPaused)return;
  selectionCountdown=3;
  $('levelSelectHint').hidden=true;
  $('levelCountdown').hidden=false;
  $('levelCountdown').classList.remove('paused');
  $('countdownPaused').hidden=true;
  countdownBeat(3);
}

function countdownBeat(digit){
  const number=$('countdownDigit');
  number.textContent=digit;
  number.classList.remove('countdown-beat');
  void number.offsetWidth;
  number.classList.add('countdown-beat');
  tone([[digit===1?880:digit===2?660:520,0,.17,'sine']]);
}

function updateLevelSelection(dt){
  if(!selectionCountdown)return;
  $('levelCountdown').classList.toggle('paused',trackingPaused);
  $('countdownPaused').hidden=!trackingPaused;
  if(trackingPaused)return;
  const previous=Math.ceil(selectionCountdown);
  selectionCountdown=Math.max(0,selectionCountdown-dt);
  const digit=Math.ceil(selectionCountdown);
  if(!digit){
    currentLevel=selectedLevel;
    beginRound(mode,true);
  }else if(digit!==previous)countdownBeat(digit);
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

function playWind(intensity = 1) {
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
  const volume=audio.createGain();
  source.buffer = buffer;
  volume.gain.value=limit(intensity,.08,1);
  source.connect(volume).connect(audio.destination);
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
  $('levelLabel').textContent='Level 0'+currentLevel;
  $('capacity').textContent=' / '+MAX_FRIES;
  $('routeProgress').value=limit(game.z/NEST_Z*100,0,100);
  const zone=currentLevel===1?'Flight school / 飞行教学':game.z<800?'Takeoff / 起飞区':game.z<2100?'Tourists / 游客区':game.z<3800?'Picnic / 野餐区':game.z<5600?'Food street / 美食街':'Final escape / 最终逃亡';
  $('zoneLabel').textContent=zone+' · SPEED '+Math.round(worldSpeed(game));
  const wanted=currentLevel===2?Math.min(5,Math.ceil(game.carry/2.4)):0;
  if(wanted>(game.wanted||0))tone([[220+wanted*90,0,.1],[300+wanted*90,.12,.1]]);
  game.wanted=wanted;
  $('wantedLabel').textContent=currentLevel===2?'WANTED / 警戒 '+ '★'.repeat(wanted)+'☆'.repeat(5-wanted):'';
  const npc=game.npcs?.[game.npcIndex];
  $('npcLabel').textContent=npc && ['approach','grab'].includes(game.phase)?npc.name+' · '+npc.stock+' fries / 根':'';
  $('round').textContent = game.round;
  $('score').textContent = game.score;
  $('load').hidden = false;
  const count = String(game.carry);
  if ($('carry').textContent !== count) {
    $('carry').textContent = count;
    $('load').dataset.count = count;
  }
  const notice = $('reaction');
  const call = game.feedback || (game.attack && !game.attack.resolved ? 'HEY!!!' : '');
  if (notice.textContent !== call) notice.textContent = call;
  notice.hidden = !call;
  notice.classList.toggle('success',call === 'TOO SLOW!');
  const warning = game.attack && !game.attack.resolved && ['grab','chase'].includes(game.phase);
  $('attackClock').hidden = $('dangerGlow').hidden = !warning;
  if (warning) {
    const duration = (game.attack?.duration ?? ATTACK_NOTICE + ATTACK_CHARGE);
    const progress = limit(game.attack.elapsed / duration, 0, 1);
    const pulse = (1 + Math.cos(2*Math.PI*(2*progress + 2*progress*progress))) / 2;
    $('dangerGlow').style.opacity = .36 + .20*progress + .40*pulse;
    $('attackSeconds').textContent = (Math.ceil((1-progress)*duration*10)/10).toFixed(1)+' s';
    $('attackFill').style.transform = 'scaleX('+(1-progress)+')';
  }
  $('timePanel').hidden = game.phase !== 'chase' || Boolean(warning);
  if (game.phase === 'chase') {
    $('timeText').textContent = Math.max(0,game.remaining).toFixed(1);
    $('timePanel').classList.toggle('urgent',game.remaining<2);
  }
}

function beginRound(newMode, restart = false) {
  bodyLesson=null;showBodyLesson();
  selectionCountdown=0;
  mode = newMode;
  const level=LEVELS[currentLevel];
  TRAY_Z=level.targets[0].z;NEST_Z=level.end;APPROACH_LIMIT=TRAY_Z-293;MAX_FRIES=level.capacity;
  if (mode === 'keyboard') closeCamera();
  startAudio();
  const round = restart ? 1 : game.round+1;
  const target = round%2 ? -1 : 1;
  game = {round,score:restart ? 0 : game.score,target,blocked:target,x:routeX(target),laneTarget:target,laneFrom:routeX(target),laneElapsed:LANE_TRANSITION_SECONDS,z:50,lean:0,
    elapsed:0,flaps:0,ready:false,carry:0,remaining:ESCAPE_SECONDS,momentum:0,momentumHold:0,clawOpen:false,
    clawSnap:0,flightHeight:FLIGHT_HEIGHTS[1],heightLevel:1,heightFrom:FLIGHT_HEIGHTS[1],
    heightTarget:FLIGHT_HEIGHTS[1],heightElapsed:HEIGHT_TRANSITION_SECONDS,heightDuration:HEIGHT_TRANSITION_SECONDS,heightFlapTimer:0,
    heightDescending:false,lateralVelocity:0,descendInput:false,
    grabPending:0,palmReady:false,grabReady:false,pendingGrab:false,slow:0,flash:0,
    npcIndex:0,npcs:level.targets.map(n=>({...n,stock:n.stock,stolen:0,attack:null,escaped:false,skipped:false})),
    obstacles:level.obstacles.map(o=>({...o,state:'upcoming',passed:false}))};
  game.target=game.npcs[0].lane;game.blocked=game.target;
  Object.assign(view,{x:game.x,z:50,height:game.flightHeight,reach:0,pitch:0,bank:0,lift:0,wings:1,speed:0});
  motion = makeMotion();
  inputLift = keyboardFlap = 0;
  heldKeys.clear();
  inputSpread = 1;
  trackingPaused = false;
  resetGuide();
  setPhase('launch');
  refreshCue();
  updateHUD();
  $('settings').blur();
}

function returnToSetup() {
  bodyLesson=null;showBodyLesson();
  game = {round:1,score:0,x:0,target:-1,blocked:-1,z:50,elapsed:0,carry:0,flash:0};
  Object.assign(view,{x:0,z:50,height:FLIGHT_HEIGHTS[1],reach:0,pitch:0,bank:0,lift:0,wings:1,speed:0});
  calibration = null;
  trackingPaused = false;
  setPhase('setup');
  updateCameraButtons();
}

function refreshCue() {
  const key = mode === 'keyboard';
  const direction = side => side < 0 ? tr('左') : tr('右');
  const sideKey = side => side < 0 ? 'A / ←' : 'D / →';
  if (game.phase === 'launch') {
    cue(tr('拍两下翅膀'), key ? tr('按 W 或空格 · ')+game.flaps+'/2' : tr('张开双臂，上下扑动 · ')+game.flaps+'/2');
  } else if (game.phase === 'approach') {
    const turn = Math.sign(routeX(game.target)-game.x);
    if (!isLinedUp(game)) {
      cue(tr('向')+direction(turn)+tr('倾斜'),key ? sideKey(turn)+tr(' · 飞向薯条盒') : tr('上半身缓慢朝薯条倾斜'));
    } else if (!game.ready) {
      cue(tr('看准薯条'), tr('等薯条盒边缘亮起'));
    } else if(!key){
      cue(game.grabReady?tr('张开手掌'):tr('停止拍翅，自然下降'),
        game.grabReady?tr('张开手掌'):tr('滑翔至低空并对准薯条盒'));
    } else {
      cue(tr('自动接近游客'),tr('对准薯条盒即可自动接近'));
    }
  } else if (game.phase === 'dive') {
    cue(key?tr('自动接近游客'):tr('张开手掌'),key?tr('自动接近薯条盒'):tr('接近期间握拳也会被记住'));
  } else if (game.phase === 'grab') {
    const escape = key ? tr('空格 / W · 向上飞走，躲开游客') : tr('双臂展开，向上逃跑');
    if (game.carry >= MAX_FRIES) cue(tr('展翅逃跑'),escape);
    else if (game.clawOpen) cue(key ? tr('鸟爪抓取中') : tr('握拳抓取'),key ? tr('每按一次 E 抓一根') : motion.handStatus || tr('握紧刚才伸出的那只手'));
    else cue(key ? (game.carry ? tr('再抢一根，还是逃？') : tr('抢薯条！')) : tr('张开手掌'),key
      ? tr('E 抓一根 · ')+escape
      : game.carry ? tr('张开手掌继续抓取，或展翅逃跑')
        : motion.handStatus || tr('把一只手伸到胸前，掌心朝向摄像头'));
  } else if (game.phase === 'chase') {
    if (game.attack && !game.attack.resolved) {
      cue(tr('向上逃跑！'),key ? tr('空格 / W · 拍翅升空') : tr('展开双臂，拍翅升空'));
    } else {
      const obstacle = upcomingObstacle(game);
      if (obstacle && obstacle.z-game.z<=worldSpeed(game)*OBSTACLE_REACTION_SECONDS) {
        if(obstacle.kind==='cart'){
          cue(tr('绕开小车 / 拍翅飞越'),key
            ? tr('A / D 换道，或空格 / W 升至高空')
            : tr('身体侧倾换道，或拍翅升至高空'));
        }else if(!key&&obstacle.kind==='gull'){
          cue(tr('停止拍翅，自然下降'),tr('滑翔到低空避开海鸥'));
        }else{
          cue(OBSTACLE_TYPES[obstacle.kind].action==='flap' ? tr('拍翅！飞过货箱') : tr('避开码头招牌'), key
            ? OBSTACLE_TYPES[obstacle.kind].action==='flap' ? tr('空格 / W · 向上飞') : (obstacle.lane>0 ? tr('A / ← · 飞到左边') : tr('D / → · 飞到右边'))
            : OBSTACLE_TYPES[obstacle.kind].action==='flap' ? tr('拍动双臂，飞越货箱') : tr('身体侧倾，绕开招牌'));
        }
      } else cue(tr('沿栈道飞回巢穴'),key ? tr('空格 / W 拍翅 · A / D 侧倾 · S / ↓ 下降') : tr('拍翅飞翔，侧倾绕开障碍；停止拍翅自然下降'));
    }
  } else if (game.phase === 'hit') {
    cue(tr('薯条掉了！'));
  } else if (game.phase === 'home') {
    cue(tr('落巢！'), '+'+game.deposited+tr(' 根薯条'));
  }
}

function canAct() {
  return mode === 'keyboard' || !trackingPaused;
}

function keyboardHorizontal() {
  return Number(heldKeys.has('KeyD')||heldKeys.has('ArrowRight'))-
    Number(heldKeys.has('KeyA')||heldKeys.has('ArrowLeft'));
}

function updateHorizontal(dt,speed) {
  const direction=mode==='keyboard'?keyboardHorizontal():motion.steerDirection;
  if(Math.abs(direction)>.18){
    const lane=Math.sign(direction);
    if(lane!==game.laneTarget){
      game.laneTarget=lane;
      game.laneFrom=game.x;
      game.laneElapsed=0;
    }
  }
  const previousX=game.x;
  game.laneElapsed=Math.min(LANE_TRANSITION_SECONDS,(game.laneElapsed||0)+dt);
  const progress=game.laneElapsed/LANE_TRANSITION_SECONDS;
  const eased=progress*progress*(3-2*progress);
  game.x=game.laneFrom+(routeX(game.laneTarget)-game.laneFrom)*eased;
  game.lateralVelocity=dt>0?(game.x-previousX)/dt:0;
}

function flap(triggeredAt=performance.now()) {
  if (!canAct()) return;
  if(game.phase==='levelSelect'){
    confirmLevelSelection();
    return;
  }
  if (mode === 'keyboard') keyboardFlap = .31;
  const boost=()=>{
    const tune=FLIGHT_TUNING[currentLevel];
    game.momentum=Math.min(tune.max-tune.base,(game.momentum||0)+tune.flap);
    game.momentumHold=tune.hold;
    applyFlapLift(game);
    confirmArmAction('已识别拍翅');
    if(mode==='body'&&Number.isFinite(motion.flapStartedAt)){
      lastFlapLatencyMs=triggeredAt-motion.flapStartedAt;
      motion.flapStartedAt=null;
      motion.currentAction='拍翅已触发';
    }
    playWind(.18+.42*game.momentum/(tune.max-tune.base));
  };
  if (game.phase === 'launch') {
    boost();
    game.flaps++;
    tone([[game.flaps === 1 ? 540 : 740,0,.14]]);
    if (game.flaps >= 2) {
      motion.lean = 0;
      setPhase('approach');
    }
    refreshCue();
  } else if (game.phase === 'chase') {
    boost();
    tone([[490,0,.12],[570,.075,.14]]);
  } else if (game.phase === 'approach') {
    boost();
  } else if (game.phase === 'grab') {
    boost();
    beginChase();
  }
}

function beginDive() {
  if (!canAct() || game.phase !== 'approach' || !game.ready || !isLinedUp(game)) return;
  setPhase('dive');
  game.diveFrom = game.z;
  setFlightHeight(game,0);
  playWind();
  refreshCue();
}

function beginGrab() {
  const activeHand=motion.activeHand;
  const pendingGrab=Boolean(game.pendingGrab);
  game.x = routeX(game.target);
  motion.escapeAt = null;
  motion.handStatus = '';
  motion.handCrop = null;
  setPhase('grab');
  game.grabReady=false;
  game.pendingGrab=false;
  lessonStep(3);
  if(activeHand){
    openClaw(activeHand.arm??activeHand.side);
    if(pendingGrab)closeClaw(motion.hand);
  }
  refreshCue();
}

function openClaw(hand) {
  if (!canAct() || game.phase !== 'grab' || game.clawOpen || game.carry>=MAX_FRIES || !game.npcs[game.npcIndex].stock) return;
  game.clawOpen = true;
  motion.hand = hand;
  confirmArmAction('已识别张手');
  tone([[560,0,.075]]);
  refreshCue();
}

function closeClaw(hand) {
  if (!canAct() || game.phase !== 'grab' || !game.clawOpen || hand !== motion.hand) return;
  game.clawOpen = false;
  confirmArmAction('已握拳抓取');
  game.clawSnap = .28;
  game.carry++;
  const npc=game.npcs[game.npcIndex];npc.stock--;npc.stolen++;
  if(bodyLesson)lessonStep(4);
  motion.lastGrabAt=performance.now();
  motion.escapeAt=null;
  tone([[740,0,.085],[1050,.06,.11]]);
  if (npc.stolen === npc.trigger) {
    game.attack = npc.attack = {elapsed:0,resolved:false,duration:npc.warning};
    playHey();
  }
  refreshCue();
  updateHUD();
  playGrabImpact();
}

function playGrabImpact() {
  const impact = $('grabImpact');
  const counter = $('load');
  counter.classList.remove('carry-hit');
  impact.hidden = true;
  // Flush once per successful grab so consecutive pickups replay the impact.
  void counter.offsetWidth;
  impact.hidden = false;
  counter.classList.add('carry-hit');
}

$('grabImpact').addEventListener('animationend', event => {
  if (event.target === event.currentTarget) event.currentTarget.hidden = true;
});

function keyboardGrab() {
  if (game.phase!=='grab' || game.grabPending || game.carry>=MAX_FRIES) return;
  openClaw('keyboard');
  game.grabPending = .18;
}

function beginChase(confirmedSpread=false) {
  if (game.phase !== 'grab') return;
  if (mode==='body' && !confirmedSpread && (game.clawOpen || motion.candidate)) return;
  if(confirmedSpread)confirmArmAction('已识别展翅');
  const from={z:game.z,x:game.x,flightHeight:game.flightHeight};
  const routeTime=game.routeTime||0;
  motion.candidate=null;
  game.npcs[game.npcIndex].escaped=true;
  game.z = TRAY_Z+25;
  game.clawOpen = false;
  game.grabReady=false;
  game.palmReady=false;
  game.pendingGrab=false;
  motion.activeHand=null;
  motion.hand=null;
  game.grabPending = 0;
  game.remaining = LEVELS[currentLevel].escape;
  game.flash = .48;
  game.flashColor = '#ffda79';
  setPhase('chase');
  resolveObstacleCrossings(from,{z:game.z,x:game.x,flightHeight:game.flightHeight},routeTime,routeTime);
  lessonStep(5);
  tone([[540,0,.13],[780,.08,.15]]);
  refreshCue();
}

function updateAttack(dt) {
  if (!game.attack || game.attack.resolved) return;
  game.attack.elapsed += dt;
  const escaped = game.phase === 'chase' && game.elapsed>=.16;
  if (game.attack.elapsed < (game.attack.duration ?? ATTACK_NOTICE+ATTACK_CHARGE) && !escaped) return;
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

function resolveObstacleCrossings(from,to,timeFrom,timeTo) {
  for (const obstacle of game.obstacles) {
    if (obstacle.passed) continue;
    if (from.z > obstacle.z+OBSTACLE_DEPTH) {
      obstacle.state='cleared';
      obstacle.passed=true;
      continue;
    }
    if (obstacle.z-game.z <= worldSpeed(game)*OBSTACLE_REACTION_SECONDS) {
      obstacle.state='active';
    }
    if (to.z < obstacle.z-OBSTACLE_DEPTH || from.z > obstacle.z+OBSTACLE_DEPTH) continue;
    if (sweptObstacleCollision(obstacle,game,from,to,timeFrom,timeTo)) {
      obstacle.state='hit';
      obstacle.passed=true;
      game.carry=Math.max(0,game.carry-1);
      game.flash=.55;
      game.flashColor='#f5655c';
      game.slow=.65;
      game.feedback=tr('擦碰！掉了 1 根');
      game.feedbackTime=1.25;
      tone([[140,0,.18,'sawtooth']]);
    } else if (to.z > obstacle.z+OBSTACLE_DEPTH) {
      obstacle.state='cleared';
      obstacle.passed=true;
    }
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
  bodyLesson=null;showBodyLesson();
  game.carry = 0;
  $('resultTitle').textContent = success ? (game.deposited ? tr('偷到了！') : tr('空爪回巢')) : reason;
  $('resultText').textContent = success
    ? tr('这趟带回 ')+game.deposited+tr(' 根。巢里共有 ')+game.score+tr(' 根薯条。')
    : tr('这趟的薯条掉了。巢里还有 ')+game.score+tr(' 根。');
  if (!success) tone([[175,0,.28,'sawtooth'],[120,.11,.24,'triangle']]);
  setPhase('result');
  updateHUD();
  $('nextLevel').hidden=!success || currentLevel!==1;
  $('again').focus({preventScroll:true});
}

function updateFlight(dt) {
  const previousRouteTime=game.routeTime||0;
  const frameFrom={z:game.z,x:game.x,flightHeight:game.flightHeight};
  game.elapsed += dt;
  game.routeTime=(game.routeTime||0)+dt;
  game.flash = Math.max(0,game.flash-dt*1.9);
  game.clawSnap = Math.max(0,game.clawSnap-dt);
  keyboardFlap = Math.max(0,keyboardFlap-dt);
  game.slow = Math.max(0,(game.slow || 0)-dt);
  if (game.momentumHold>0) game.momentumHold=Math.max(0,game.momentumHold-dt);
  else if (game.momentum) game.momentum*=Math.exp(-dt/FLIGHT_TUNING[currentLevel].decay);
  if (game.grabPending>0) {
    game.grabPending = Math.max(0,game.grabPending-dt);
    if (!game.grabPending && game.phase==='grab') closeClaw('keyboard');
  }
  if (game.feedbackTime > 0) {
    game.feedbackTime -= dt;
    if (game.feedbackTime <= 0) game.feedback = '';
  }

  if (game.phase === 'approach') {
    const from=frameFrom;
    const linedUp=isLinedUp(game);
    updateHorizontal(dt,230);
    advanceFlightHeight(game,dt,mode==='keyboard'
      ? heldKeys.has('KeyS')||heldKeys.has('ArrowDown') : false);
    if (linedUp !== isLinedUp(game)) refreshCue();
    game.z = Math.min(APPROACH_LIMIT,game.z+approachSpeed(game)*dt);
    resolveObstacleCrossings(from,{z:game.z,x:game.x,flightHeight:game.flightHeight},previousRouteTime,game.routeTime);
    if (!game.ready && game.z >= TRAY_Z-323) {
      game.ready = true;
      if (isLinedUp(game)) tone([[690,0,.12]]);
      refreshCue();
    }
    const grabReady=mode==='body'&&game.ready&&game.z>=APPROACH_LIMIT-70&&
      isLinedUp(game)&&game.flightHeight<=FLIGHT_HEIGHTS[0]+24;
    if(game.grabReady!==grabReady){
      game.grabReady=grabReady;
      refreshCue();
    }
    if(game.grabReady&&game.palmReady&&game.phase==='approach')beginDive();
    if(currentLevel===2 && game.z>=APPROACH_LIMIT && !isLinedUp(game)){
      game.skipWait=(game.skipWait||0)+dt;
      if(game.skipWait>2){game.npcs[game.npcIndex].skipped=true;setPhase('grab');beginChase(true);}
    }else game.skipWait=0;
    if (mode==='keyboard' && game.ready && isLinedUp(game) && game.z>=APPROACH_LIMIT) beginDive();
  } else if (game.phase === 'dive') {
    const from=frameFrom;
    const progress = limit(game.elapsed/.63,0,1);
    game.z = game.diveFrom+(TRAY_Z-105-game.diveFrom)*progress;
    game.x = smooth(game.x,routeX(game.target),dt,9);
    advanceFlightHeight(game,dt,true);
    resolveObstacleCrossings(from,{z:game.z,x:game.x,flightHeight:game.flightHeight},previousRouteTime,game.routeTime);
    if (progress === 1) beginGrab();
  } else if (game.phase === 'chase') {
    game.remaining -= dt;
    const home = NEST_Z-85;
    const from=frameFrom;
    updateHorizontal(dt,250);
    advanceFlightHeight(game,dt,mode==='keyboard'
      ? heldKeys.has('KeyS')||heldKeys.has('ArrowDown') : game.descendInput);
    game.z = Math.min(home,game.z+flightSpeed(game)*dt);
    resolveObstacleCrossings(from,{z:game.z,x:game.x,flightHeight:game.flightHeight},previousRouteTime,game.routeTime);
    const next=game.npcs[game.npcIndex+1];
    if(next && game.z>=next.z-650){
      game.npcIndex++;game.target=next.lane;game.blocked=next.lane;
      TRAY_Z=next.z;APPROACH_LIMIT=TRAY_Z-293;game.ready=false;game.grabReady=false;
      game.palmReady=false;game.pendingGrab=false;game.attack=null;
      setPhase('approach');refreshCue();
    }
    refreshCue();
    if (game.remaining <= 0) {
      showResult(false,tr('没赶回巢'));
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
  const reach=game.phase==='grab' ? (game.clawOpen ? 1 : .86) : game.carry || game.phase==='hit' ? .57 : 0;
  view.reach=smooth(view.reach,reach,dt,9);
  view.x = game.x;
  const cameraResponse=Math.max(10,flightSpeed(game)/12);
  view.z = smooth(view.z,game.z,dt,dive ? 16 : cameraResponse);
  view.height = game.flightHeight;
  const pitchTarget=low ? -92 : home ? -62 : chase ? -34 : 0;
  const bodyFeedback=mode==='body'&&['launch','approach','chase'].includes(game.phase);
  view.pitch = smooth(view.pitch,pitchTarget+(bodyFeedback?-inputLift*6:0),dt,bodyFeedback?12:5.2);
  const leanBank=game.lean*(bodyFeedback ? .075 : .042);
  view.bank = smooth(view.bank,limit(-(game.lateralVelocity||0)*.00035+leanBank,-.13,.13),dt,bodyFeedback?18:12);
  const lift = keyboardFlap > 0 ? Math.sin((.31-keyboardFlap)*Math.PI/.31) : inputLift;
  view.lift = smooth(view.lift,dive ? -.23 : lift,dt,mode==='body'?20:11);
  const tune=FLIGHT_TUNING[currentLevel];
  const boostRatio=limit((worldSpeed(game)/tune.base-1)/(tune.max/tune.base-1),0,1);
  const speedTarget=dive ? 1 : chase ? .48+.52*boostRatio
    : game.phase==='approach'&&game.z<APPROACH_LIMIT ? .42+.58*boostRatio : 0;
  const wingFlutter=chase ? Math.sin(game.elapsed*22)*(.04+.08*boostRatio) : 0;
  view.speed = smooth(view.speed,speedTarget,dt,5);
  view.wings = smooth(view.wings,low ? .16 : Math.max(.62,inputSpread)-wingFlutter,dt,mode==='body'?20:10);
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
  const shoulderAngle=Math.atan2((right.y-left.y)*orientation,Math.abs(right.x-left.x)*aspect)*180/Math.PI;
  const eyeA=points[2],eyeB=points[5];
  const headVisible=[2,5,0].every(visible);
  const eyeOrientation=Math.sign(eyeA.x-eyeB.x);
  const headAngle=headVisible
    ? Math.atan2((eyeB.y-eyeA.y)*eyeOrientation,Math.abs(eyeB.x-eyeA.x)*aspect)*180/Math.PI
    : null;
  const pose = {x:(1-hipX*.76-shoulderX*.24)*aspect, torso,
    lean:(right.y-left.y)*orientation/shoulders, shoulderAngle,headAngle,shoulderX, shoulderY, hipY, span:null,
    wrists:[15,16].filter(visible).map(arm=>({arm,x:points[arm].x,y:points[arm].y}))};
  if (!visible(13) || !visible(14)) return pose;
  const elbowA = points[13], elbowB = points[14];
  pose.span = Math.abs(elbowA.x-elbowB.x)*aspect/shoulders;
  pose.lift = (shoulderY-(elbowA.y+elbowB.y)*.5)/torso;
  pose.bothOut = Math.min((elbowA.x-shoulderX)*orientation,(shoulderX-elbowB.x)*orientation)*aspect/shoulders;
  return pose;
}

function updateLeanControl(pose,now){
  const shoulder=pose.shoulderAngle-neutral.shoulderAngle;
  const head=Number.isFinite(pose.headAngle)&&Number.isFinite(neutral.headAngle)
    ? pose.headAngle-neutral.headAngle : null;
  let degrees=shoulder;
  if(head!==null){
    if(Math.sign(shoulder)===Math.sign(head)){
      degrees=(shoulder*LEAN_CONTROL.shoulderWeight+head*LEAN_CONTROL.headWeight)*LEAN_CONTROL.sameDirectionBoost;
    }else{
      degrees=shoulder*LEAN_CONTROL.conflictShoulderWeight+
        Math.sign(shoulder)*Math.min(Math.abs(shoulder),Math.abs(head))*(1-LEAN_CONTROL.conflictShoulderWeight);
    }
  }
  const magnitude=Math.abs(degrees);
  const selecting=game.phase==='levelSelect';
  const deadzone=selecting ? LEAN_CONTROL.neutralDegrees : LEAN_CONTROL.flightNeutral;
  const trigger=selecting ? LEAN_CONTROL.triggerDegrees : LEAN_CONTROL.flightTrigger;
  const target=magnitude<=deadzone?0:
    Math.sign(degrees)*limit((magnitude-deadzone)/
      (trigger-deadzone),0,1);
  const elapsed=now-(motion.leanAt??now);
  game.lean=smooth(game.lean,target,Math.min(elapsed,100)/1000,12);
  motion.lean=degrees;
  motion.leanAt=now;
  if(game.phase!=='levelSelect'){
    motion.currentAction=magnitude>LEAN_CONTROL.neutralDegrees
      ? '倾斜 '+(degrees<0?'LEFT':'RIGHT') : '滑翔';
  }
  motion.steerDirection=0;
  if(magnitude<=deadzone){
    motion.leanCandidate=0;
    motion.leanCandidateAt=0;
    motion.selectionArmed=true;
    return 0;
  }
  const direction=Math.sign(degrees);
  if(magnitude>=trigger){
    if(motion.leanCandidate!==direction){
      motion.leanCandidate=direction;
      motion.leanCandidateAt=now;
    }else if(now-motion.leanCandidateAt>=(selecting?LEAN_CONTROL.confirmMs:LEAN_CONTROL.flightConfirmMs)){
      if(!selecting) motion.steerDirection=direction;
      else if(motion.selectionArmed){
        chooseLevel(direction<0?1:2);
        motion.selectionArmed=false;
      }
    }
  }else{
    motion.leanCandidate=0;
    motion.leanCandidateAt=0;
  }
  return degrees;
}

function trackMotion(pose, now) {
  if (motion.poseAt!==null && now-motion.poseAt>120) {
    motion.leanCandidate=0;
    motion.steerDirection=0;
    motion.escapeAt=null;
    motion.raised=false;
    motion.flapPeak=motion.flapLow=null;
    motion.flapStartedAt=null;
  }
  motion.poseAt=now;
  if(game.phase!=='handPractice')updateLeanControl(pose,now);
  if (pose.span === null) {
    game.descendInput=false;
    motion.escapeAt = null;
    motion.raised = false;
    motion.flapPeak=motion.flapLow=null;
    motion.flapStartedAt=null;
    return;
  }
  inputSpread = limit((pose.span-1.06)/.7,0,1);
  const relativeLift=pose.lift-(neutral.lift ?? -.27);
  inputLift = limit(relativeLift*1.6,-1,1);
  game.descendInput=false;
  if(Math.abs(inputLift)>.2)motion.currentAction=inputLift>0?'拍翅上行':'拍翅下行';
  else motion.currentAction='停止拍翅，自然下降';
  if(game.phase==='levelSelect'){
    if(['launch','levelSelect'].includes(game.phase)&&pose.span>BODY_INPUT.flapSpan){
      motion.flapPeak??=pose.lift;
      motion.flapLow??=pose.lift;
      if(!motion.raised){
        motion.flapLow=Math.min(motion.flapLow,pose.lift);
        if(pose.lift-motion.flapLow>=BODY_INPUT.flapTravel||relativeLift>BODY_INPUT.flapTravel){
          motion.raised=true;motion.flapPeak=pose.lift;motion.flapStartedAt=now;
        }
      }else{
        motion.flapPeak=Math.max(motion.flapPeak,pose.lift);
        if(motion.flapPeak-pose.lift>=BODY_INPUT.flapTravel&&now-motion.lastFlapAt>=BODY_INPUT.flapCooldownMs){
          motion.raised=false;motion.flapLow=pose.lift;motion.lastFlapAt=now;
          motion.currentAction='拍翅确认';
          confirmLevelSelection();
          if(selectionCountdown)confirmArmAction('已识别拍翅');
        }
      }
    }
    return;
  }

  const spread = pose.bothOut>.72;
  if (game.phase==='grab') {
    if (now-motion.lastGrabAt<BODY_INPUT.grabGuardMs) {motion.escapeAt=null;return;}
    if (game.carry && pose.bothOut>BODY_INPUT.escapeOut && pose.span>BODY_INPUT.escapeSpan) {
      motion.escapeAt ??= now;
      if (now-motion.escapeAt>=BODY_INPUT.escapeMs) {
        setFlightHeight(game,2);
        beginChase(true);
      }
    } else {
      motion.escapeAt = null;
    }
    return;
  }
  if (['handPractice','launch','approach','chase'].includes(game.phase) && pose.span>BODY_INPUT.flapSpan) {
    motion.flapPeak ??= pose.lift;
    motion.flapLow ??= pose.lift;
    if (!motion.raised) {
      motion.flapLow=Math.min(motion.flapLow,pose.lift);
      if (pose.lift-motion.flapLow>=BODY_INPUT.flapTravel || relativeLift>BODY_INPUT.flapTravel) {
        motion.raised=true; motion.flapPeak=pose.lift;motion.flapStartedAt=now;
      }
    } else {
      motion.flapPeak=Math.max(motion.flapPeak,pose.lift);
      if (motion.flapPeak-pose.lift>=BODY_INPUT.flapTravel && now-motion.lastFlapAt>=BODY_INPUT.flapCooldownMs) {
        motion.raised=false; motion.flapLow=pose.lift;motion.lastFlapAt=now;
        motion.currentAction='拍翅确认';
        if(game.phase==='handPractice')practiceFlap(now);
        else flap(now);
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

const PRACTICE_SUCCESS_MS=1400;
const PRACTICE_CELEBRATION_MS=3000;
const practiceSteps=[
  ['伸一只手到胸前','让整只手入镜','✓ 小爪就位！'],
  ['张开五指','掌心朝向镜头','✓ 瞄准薯条！'],
  ['用同一只手握拳','','✓ 第一根到爪！']
];
let practice=null;

function startHandPractice(){
  mode='body';
  motion=makeMotion();
  selectionCountdown=0;
  practice={step:-1,flaps:0,hand:null,since:null,lastSeen:-Infinity,lastSample:-Infinity,advanceAt:0};
  setPhase('handPractice');
  $('practiceFlightArt').innerHTML=gestureIllustration('flap');
  showPractice();
}

function showPractice(hint=''){
  const {step,advanceAt}=practice;
  const flying=step===-1;
  const [title,detail,success]=flying
    ? ['拍两下翅膀','','✓ 翅膀有劲！']
    : practiceSteps[step];
  $('handSchool').dataset.step=step;
  $('handSchool').dataset.ok=advanceAt?'yes':'no';
  $('skipPractice').hidden=false;
  $('practiceTitle').textContent=tr(advanceAt?success:title);
  const text=advanceAt ? '' : flying && !hint ? practice.flaps+' / 2' : tr(hint||detail);
  if($('practiceHint').textContent!==text)$('practiceHint').textContent=text;
}

function practiceFlap(now){
  if(practice.step!==-1 || practice.advanceAt)return;
  practice.flaps++;
  tone([[practice.flaps===1?540:740,0,.13]]);
  if(practice.flaps===2)practice.advanceAt=now+PRACTICE_SUCCESS_MS;
  showPractice();
}

function finishHandPractice(){
  startLevelSelection('body');
}

function sameTrackedHand(a,b){
  if(!a||!b)return false;
  return a.arm && b.arm ? a.arm===b.arm : Boolean(a.side && a.side===b.side);
}

function samplePractice(hands,now){
  if(!practice||practice.step<0||practice.completed||practice.advanceAt)return;
  const hand=hands.find(h=>h.inFront && (h.arm||h.side) &&
    (!practice.hand || sameTrackedHand(h,practice.hand)));
  if(now-practice.lastSample>TRACKING_GRACE)practice.since=null;
  practice.lastSample=now;
  if(!hand){
    practice.since=null;
    if(now-practice.lastSeen>BODY_INPUT.handGraceMs){practice.step=0;practice.hand=null;}
    showPractice(practice.hand?'请把刚才那只手放回镜头里':'请把一只手抬到胸口前');
    return;
  }
  practice.lastSeen=now;
  practice.hand??=hand;
  const expected=[null,'Open_Palm','Closed_Fist'][practice.step];
  if(expected && hand.shape!==expected){practice.since=null;showPractice();return;}
  practice.since??=now;
  if(now-practice.since<BODY_INPUT.handConfirmMs)return;
  practice.advanceAt=now+PRACTICE_SUCCESS_MS;
  showPractice();
}

function updatePractice(now){
  if(!practice)return;
  if(practice.completed){
    if(now>=practice.leaveAt)finishHandPractice();
    return;
  }
  if(practice.advanceAt && now>=practice.advanceAt){
    if(practice.step===2){
      practice.completed=true;
      $('handSchool').dataset.step='complete';
      $('practiceTitle').textContent=tr('小海鸥，毕业啦！');
      $('practiceHint').textContent=tr('下一站，码头偷薯条。');
      $('skipPractice').hidden=true;
      practice.leaveAt=now+PRACTICE_CELEBRATION_MS;
      tone([[523,0,.18],[659,.14,.18],[784,.28,.32]]);
      return;
    }
    practice.step++;
    practice.lastSeen=now;
    practice.advanceAt=0;practice.since=null;
    showPractice();
  }
  if(!practice.advanceAt && (!latestPose||now-lastValidAt>TRACKING_GRACE)){
    if(practice.step===-1)showPractice('请让两侧手肘入镜，再上下拍动双臂');
    else samplePractice([],now);
  }
}

function trackHand(result, pose, aspect, crop, now) {
  const preparing=game.phase==='approach'&&game.grabReady;
  const diving=game.phase==='dive'&&game.palmReady;
  if (game.phase!=='grab'&&game.phase!=='handPractice'&&!preparing&&!diving) return;
  const distance = (a,b) => Math.hypot((a.x-b.x)*aspect,a.y-b.y);
  const fullFrame = point => ({x:crop.x+point.x*crop.width,y:crop.y+point.y*crop.height});

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

  if(game.phase==='handPractice'){samplePractice(hands,now);return;}
  const hand = diving||game.clawOpen||motion.activeHand
    ? hands.find(candidate=>sameTrackedHand(candidate,motion.activeHand))
    : hands.find(candidate=>candidate.inFront&&candidate.shape==='Open_Palm'&&(candidate.arm||candidate.side));
  if (hand) motion.handSeenAt = now;
  if (!hand && game.clawOpen && now-motion.handSeenAt>BODY_INPUT.handGraceMs) {
    game.clawOpen = false;
    motion.activeHand=null;
  }
  const status = game.clawOpen||diving
    ? (hand ? tr('已识别张手 · 握紧同一只手') : tr('请把刚才那只手放回镜头里'))
    : hands.some(candidate=>candidate.inFront) ? tr('已看到手 · 请张开五指') :
      hands.length ? tr('已看到手 · 请把手抬到胸口前') : tr('还没看到手 · 掌心朝向摄像头');
  if (motion.handStatus!==status) {
    motion.handStatus = status;
    refreshCue();
  }
  if(diving&&game.pendingGrab)return;
  const expected = game.clawOpen||diving ? 'Closed_Fist' : 'Open_Palm';
  if (!hand || hand.shape!==expected) {
    motion.candidate = null;
    return;
  }
  if (!motion.candidate || !sameTrackedHand(hand,motion.candidate) || motion.candidate.shape!==expected) {
    motion.candidate = hand;
    motion.candidateAt = now;
    return;
  }
  if (now-motion.candidateAt<BODY_INPUT.handConfirmMs) return;
  motion.candidate = null;
  motion.handStatus = '';
  if(preparing){
    motion.activeHand = hand;
    game.palmReady=true;
    confirmArmAction('已识别张手');
    motion.currentAction='张开手掌，自动接近';
    beginDive();
  }else if(diving){
    game.pendingGrab=true;
    motion.currentAction='握拳已缓存';
  }else if(game.clawOpen){
    closeClaw(motion.hand);
  }else{
    motion.activeHand=hand;
    openClaw(hand.arm??hand.side);
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

function newCalibration() {
  return {started:null,lastSample:null,count:0,x:0,shoulderY:0,lean:0,shoulderAngle:0,headAngle:0,headCount:0,lift:0};
}

function recordCalibration(pose, now) {
  const bar = $('calibrationProgress');
  const unstable=pose&&calibration.count&&(
    now-calibration.lastSample>TRACKING_GRACE ||
    Math.abs(pose.shoulderY-calibration.shoulderY/calibration.count)>pose.torso*.18 ||
    Math.abs(pose.x-calibration.x/calibration.count)>pose.torso*.24 ||
    Math.abs(pose.shoulderAngle-calibration.shoulderAngle/calibration.count)>8 ||
    Math.abs(pose.lift-calibration.lift/calibration.count)>.14
  );
  if (!pose || pose.span===null || unstable) {
    calibration = newCalibration();
    bar.value = 0;
    $('calibrationHint').textContent=tr(!pose || pose.span===null ? '请后退或调整镜头，让双肩和双肘都入镜。' : '姿势发生变化，请回到舒服的起始姿势。');
    return;
  }
  if(calibration.started===null) $('calibrationHint').textContent=tr('已看到双肩和双肘，请保持不动直到进度条走满。');
  calibration.started ??= now;
  calibration.lastSample=now;
  calibration.shoulderY+=pose.shoulderY;
  calibration.x += pose.x;
  calibration.lean += pose.lean;
  calibration.shoulderAngle+=pose.shoulderAngle;
  calibration.lift+=pose.lift;
  if(Number.isFinite(pose.headAngle)){
    calibration.headAngle+=pose.headAngle;
    calibration.headCount++;
  }
  calibration.count++;
  bar.value = Math.min(1,(now-calibration.started)/CALIBRATION_MS);
  if (bar.value < 1) return;
  neutral = {
    lift:calibration.lift/calibration.count,
    lean:calibration.lean/calibration.count,
    shoulderAngle:calibration.shoulderAngle/calibration.count,
    headAngle:calibration.headCount?calibration.headAngle/calibration.headCount:null
  };
  calibration = null;
  $('calibrationHint').textContent=tr('校准完成，正在进入选关');
  cameraStatus(tr('校准完成。向左右倾斜选关，拍翅确认。'));
  updateCameraButtons();
  startHandPractice();
}

function drawVideoPreview() {
  if (!stream) return;
  drawMirror(video,previewContext,preview.width,preview.height,landmarks,Boolean(latestPose));
}

function drawCalibrationPreview(){
  if(!stream)return;
  const canvas=$('calibrationCanvas'),context=canvas.getContext('2d');
  if(canvas.width!==poseFrame.width||canvas.height!==poseFrame.height){
    canvas.width=poseFrame.width;canvas.height=poseFrame.height;
  }
  drawMirror(video,context,canvas.width,canvas.height,landmarks,Boolean(latestPose));
}

function schedulePoseInference(){
  if(!stream||!tracker||video.readyState<2||poseInferenceScheduled)return;
  poseInferenceScheduled=true;
  setTimeout(()=>{
    try { updatePose(performance.now()); }
    finally { poseInferenceScheduled=false; }
  },0);
}

function updatePose(now) {
  if (!stream || !tracker || video.readyState<2 || video.currentTime===lastVideoTime ||
      now-lastPoseAt<BODY_INPUT_PERF.poseIntervalMs) return;
  lastVideoTime = video.currentTime;
  lastPoseAt = now;
  const aspect = video.videoWidth/video.videoHeight;
  if (poseFrame.width!==BODY_INPUT_PERF.poseWidth || poseFrame.height!==Math.round(BODY_INPUT_PERF.poseWidth/aspect)) {
    poseFrame.width = preview.width = BODY_INPUT_PERF.poseWidth;
    poseFrame.height = preview.height = Math.round(BODY_INPUT_PERF.poseWidth/aspect);
    $('preview').style.aspectRatio = String(aspect);
  }
  poseContext.drawImage(video,0,0,poseFrame.width,poseFrame.height);

  try {
    landmarks = tracker.detectForVideo(poseFrame,now).landmarks[0] || null;
    poseSamples++;
    if(now-lastPoseFpsAt>=1000){
      poseFps=Math.round(poseSamples*1000/(now-lastPoseFpsAt));
      poseSamples=0;
      lastPoseFpsAt=now;
    }
  } catch (error) {
    console.warn('Pose tracking interrupted',error);
    tracker.close();
    handTracker.close();
    tracker = handTracker = modelTask = null;
    closeCamera();
    returnToSetup();
    cameraStatus(tr('姿态识别中断。请重新开启摄像头。'),true);
    return;
  }
  latestPose = readPose(landmarks,aspect);
  if(game.phase==='calibrating'&&calibration)recordCalibration(latestPose,now);
  if (!latestPose) {
    motion.leanCandidate=0;
    motion.steerDirection=0;
    motion.escapeAt=null;
    motion.raised=false;
    motion.candidate=null;
    motion.flapStartedAt=null;
    motion.currentAction='未识别姿态';
    inputLift=0;
    game.descendInput=false;
    return;
  }
  lastValidAt = now;
  if (mode==='body' && neutral && ['handPractice','levelSelect','launch','approach','dive','grab','chase'].includes(game.phase)) {
    if (trackingPaused) {
      trackingPaused = false;
      motion = makeMotion();
      if(game.phase==='levelSelect')motion.selectionArmed=false;
      game.clawOpen = false;
      game.lean = 0;
      refreshCue();
    }
    const learning=game.phase==='handPractice';
    const handPhase=learning&&practice.step>=0&&!practice.completed||game.phase==='grab'||game.phase==='dive'||
      game.phase==='approach'&&game.grabReady;
    if (handPhase && (learning || game.carry<MAX_FRIES) && now-motion.handSampleAt>=BODY_INPUT_PERF.handIntervalMs) {
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
        cameraStatus(tr('手势识别中断。请重新开启摄像头。'),true);
      }
    }
    if(latestPose && (!learning || practice?.step===-1))trackMotion(latestPose,now);
  }
}

function cameraStatus(message,error = false) {
  $('cameraStatus').textContent = message;
  $('cameraStatus').classList.toggle('error',error);
}

function updateCameraButtons() {
  $('cameraButton').disabled = opening;
  $('cameraButton').textContent = stream ? tr('关闭摄像头') : tr('开启摄像头');
  $('calibrate').disabled = true;
  $('bodyStart').disabled = true;
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
  device.replaceChildren(new Option(tr('系统默认摄像头'),''));
  inputs.forEach((input,index) => device.add(new Option(input.label || tr('视频输入 ')+(index+1),input.deviceId)));
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
    cameraStatus(tr('体感请用 Chrome 打开本地试玩网址，再开启摄像头。'),true);
    return;
  }
  const selected = device.value;
  closeCamera();
  const ticket = session;
  opening = true;
  updateCameraButtons();
  cameraStatus(tr('等待相机权限…'));
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
          playbackTimeout = setTimeout(() => reject(new DOMException(tr('相机未输出视频'),'NotReadableError')),8000);
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
      cameraStatus(tr('相机已断开。重新连接后点击开启摄像头。'),true);
    });
    listCameras().catch(() => {});
    opening = false;
    updateCameraButtons();
    cameraStatus(tr('正在加载身体和手势识别…'));
    const model = await getTracker();
    if (session!==ticket) return;
    cameraStatus(model ? (track.label || tr('摄像头已连接'))+tr(' · 调整镜头，让双肩和两侧手肘入镜，再校准；不必拍到髋部。')
      : tr('体感识别加载失败。检查网络后重新开启相机。'),!model);
    if(model){
      calibration=newCalibration();
      neutral=null;
      $('calibrationProgress').value=0;
      $('calibrationHint').textContent=tr('请自然站立，保持双肩与双肘稳定');
      setPhase('calibrating');
      cameraStatus(tr('自动校准中：请让双肩入镜，并保持双肩与双肘稳定。'));
    }
    updateCameraButtons();
  } catch (error) {
    if (session!==ticket) return;
    closeCamera();
    const hints = {
      NotAllowedError:tr('请允许 Chrome 访问摄像头，再点开启。'),
      NotReadableError:tr('相机正被占用或读不到画面。关闭正在使用相机的页面后重试。'),
      NotFoundError:tr('未找到相机。检查 DJI 已进入 Webcam 模式并重新选择。')
    };
    cameraStatus(hints[error.name] || tr('相机启动失败。请重新选择视频输入。'),true);
  }
}

const armMonitor=$('armMonitor'), armDiagram=$('armDiagram'), armCaption=$('armCaption');
const armPen=armDiagram.getContext('2d');
const armPhases=new Set(['levelSelect','launch','approach','dive','grab','chase']);
let lastArmFrame=null, lastArmLabel='';

function confirmArmAction(label){
  if(mode!=='body')return;
  motion.armLabel=label;
  motion.armLabelUntil=performance.now()+700;
}

function renderArmMonitor(now){
  armMonitor.hidden=Boolean(selectionCountdown) || !stream || !(game.phase==='calibrating' || mode==='body' && armPhases.has(game.phase));
  if(armMonitor.hidden){lastArmFrame=null;return;}
  const pose=now-lastPoseAt<=TRACKING_GRACE && latestPose ? landmarks : null;
  const seen=i=>pose && pose[i] && (pose[i].visibility??1)>.49 &&
    pose[i].x>.01 && pose[i].x<.99 && pose[i].y>.02 && pose[i].y<.98;
  const full=seen(13)&&seen(14);
  const recentAction=now<motion.armLabelUntil && full ? motion.armLabel : '';
  const steering=full && ['approach','chase'].includes(game.phase) ? motion.steerDirection : 0;
  const confirmed=Boolean(recentAction || steering);
  const label=tr(!pose?'等待手臂入镜':!full?'请让双肘入镜':recentAction || (steering?
      (steering<0?'已识别左倾':'已识别右倾'):!seen(15)||!seen(16)?'手腕未完全入镜':'手臂追踪中'));
  if(lastArmFrame===pose && lastArmLabel===label && armCaption.textContent===label)return;
  lastArmFrame=pose;lastArmLabel=label;
  if(armCaption.textContent!==label)armCaption.textContent=label;
  armPen.clearRect(0,0,240,128);
  if(!pose)return;
  const cx=(pose[11].x+pose[12].x)/2,cy=(pose[11].y+pose[12].y)/2;
  const aspect=video.videoWidth/video.videoHeight || 1;
  const width=Math.max(.08,Math.abs(pose[11].x-pose[12].x)*aspect);
  const scale=49/width;
  const points=[];
  let fit=1;
  for(let i=11;i<=16;i++){
    if(!seen(i)) continue;
    const x=(cx-pose[i].x)*aspect*scale,y=(pose[i].y-cy)*scale;
    points[i]=[x,y];
    fit=Math.min(fit,111/(Math.abs(x)||1),56/(Math.abs(y)||1));
  }
  armPen.save();
  armPen.translate(120,64);
  armPen.scale(fit,fit);
  armPen.lineCap='round';
  // A quiet body reference makes the shoulder line legible at HUD scale.
  armPen.fillStyle='#75969b';
  armPen.beginPath();armPen.arc(0,-15,8,0,2*Math.PI);armPen.fill();
  armPen.beginPath();armPen.moveTo(-19,4);armPen.lineTo(19,4);
  armPen.lineTo(13,25);armPen.lineTo(-13,25);armPen.closePath();armPen.fill();
  armPen.strokeStyle=confirmed?'#ffd578':'#90e7d5';
  armPen.lineWidth=5/fit;
  for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16]]){
    if(!points[a]||!points[b])continue;
    armPen.beginPath();armPen.moveTo(...points[a]);armPen.lineTo(...points[b]);armPen.stroke();
  }
  armPen.fillStyle='#fff2d1';
  for(const point of points){
    if(!point)continue;
    armPen.beginPath();armPen.arc(...point,4/fit,0,2*Math.PI);armPen.fill();
  }
  armPen.restore();
}

function tick(now) {
  gameFrames++;
  if(now-lastGameFpsAt>=1000){
    gameFps=Math.round(gameFrames*1000/(now-lastGameFpsAt));
    gameFrames=0;
    lastGameFpsAt=now;
  }
  const dt = Math.min(.055,Math.max(0,(now-lastTick)/1000));
  lastTick = now;
  if (game.phase==='setup') updateCameraButtons();
  const active = ['launch','approach','dive','grab','chase','hit','home'].includes(game.phase);
  const trackingPhase=active||game.phase==='levelSelect';
  trackingPaused = mode==='body' && trackingPhase && !['home','hit'].includes(game.phase) && now-lastValidAt>TRACKING_GRACE;
  const elbowsMissing=mode==='body' && ['launch','chase'].includes(game.phase) &&
    latestPose && latestPose.span===null;
  $('wingPrompt').hidden=true;
  $('motionStatus').hidden = !trackingPaused && !elbowsMissing;
  if (trackingPaused || elbowsMissing) $('motionStatus').textContent=!latestPose
    ? tr('请后退或调整镜头，让双肩入镜（只有脸无法识别拍翅）')
    : tr('请让两侧手肘入镜，再上下拍动双臂');
  if(game.phase==='levelSelect'){
    $('levelSelectHint').textContent=trackingPaused?tr('追踪暂停，请回到镜头前继续')
      :selectionCountdown?tr('保持姿势，倒计时中'):tr('左右倾斜切换 · 拍翅确认');
    $('levelSelectHint').hidden=Boolean(selectionCountdown)&&!trackingPaused;
    $('levelCountdown').hidden=!selectionCountdown;
    updateLevelSelection(dt);
  }
  if (active && !trackingPaused) {
    updateFlight(dt);
    updateView(dt);
  }
  if(game.phase==='handPractice')updatePractice(now);
  renderArmMonitor(now);
  if (game.phase==='setup') drawVideoPreview();
  if (game.phase==='calibrating') drawCalibrationPreview();
  if (mode==='body' && stream && ['launch','result'].includes(game.phase)) {
    drawMirror(video,paint,W,H,landmarks,Boolean(latestPose),true);
    if(game.phase==='launch'){
      const beat=(1+Math.sin(now/220))/2;
      paint.save();
      paint.translate(0,-H*.20);
      drawWing(-1,.8,beat,0);
      drawWing(1,.8,beat,0);
      paint.restore();
    }
  } else {
    drawFlight(game,view,now/1000);
  }
  updateGuide(game,now);
  updateInputDebug(now);
  schedulePoseInference();
  requestAnimationFrame(tick);
}

$('enterPier').onclick=()=>{startAudio();setPhase('setup');$('cameraButton').focus();};
$('cameraButton').onclick = () => {
  if (stream) {
    closeCamera();
    cameraStatus(tr('摄像头已关闭。'));
  } else {startAudio();openCamera();}
};
device.onchange = () => { if (stream || opening) openCamera(); };
navigator.mediaDevices?.addEventListener('devicechange',() => listCameras().catch(() => {}));
listCameras().catch(() => {});
$('calibrate').onclick = () => {
  cameraStatus(tr('摄像头连接后会自动校准。'));
};
$('bodyStart').onclick = () => {
  if(neutral)startLevelSelection('body');
};
$('lessonRetry').hidden=true;
$('lessonSkip').textContent=tr('隐藏指引');
$('lessonSkip').onclick=()=>{bodyLesson=null;showBodyLesson();};
$('keyboardStart').onclick = () => {startAudio();startLevelSelection('keyboard');};
$('repeatPractice').onclick=startHandPractice;
$('skipPractice').onclick=finishHandPractice;
$('levelCard1').onclick=()=>chooseLevel(1,true);
$('levelCard2').onclick=()=>chooseLevel(2,true);
$('again').onclick = () => beginRound(mode,true);
$('nextLevel').onclick=()=>{currentLevel=2;beginRound(mode,true);};
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
    $('fullscreen').textContent = tr('用浏览器全屏');
  }
};
createInputDebug();
document.addEventListener('fullscreenchange',() => {
  $('fullscreen').textContent = document.fullscreenElement ? tr('退出全屏') : tr('全屏');
});
window.addEventListener('keydown',event => {
  const {code} = event;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(game.phase==='levelSelect'&&mode==='keyboard'){
    if(['ArrowLeft','KeyA'].includes(code)||['ArrowRight','KeyD'].includes(code)){
      event.preventDefault();
      if(event.repeat)return;
      chooseLevel(['ArrowLeft','KeyA'].includes(code)?1:2);
      return;
    }
    if(code==='Space'){
      event.preventDefault();
      if(!event.repeat)confirmLevelSelection();
      return;
    }
  }
  if (mode!=='keyboard' || ['setup','calibrating','levelSelect','result','home','hit'].includes(game.phase)) return;
  if (event.target instanceof HTMLButtonElement && ['Space','Enter'].includes(code)) return;
  if (['Space','KeyW','ArrowUp','KeyA','ArrowLeft','KeyD','ArrowRight','KeyS','ArrowDown','KeyE','KeyF'].includes(code)) {
    event.preventDefault();
    if (['KeyA','ArrowLeft','KeyD','ArrowRight','KeyS','ArrowDown'].includes(code)) {
      heldKeys.add(code);
      return;
    }
    if (event.repeat) return;
    if (['Space','KeyW','ArrowUp'].includes(code)) flap();
    else if (code==='KeyE') keyboardGrab();
    else if (code==='KeyF') closeClaw('keyboard');
  }
});
window.addEventListener('keyup',event => heldKeys.delete(event.code));
window.addEventListener('pagehide',() => {
  closeCamera();
  if (game.phase!=='setup') returnToSetup();
});
updateCameraButtons();
if (new URLSearchParams(window.location.search).get('mode') === 'keyboard') {
  beginRound('keyboard',true);
}
requestAnimationFrame(tick);
