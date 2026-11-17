'use strict';
const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height, TAU = Math.PI * 2;
const GULL_FACE = {
  centerX:3, centerY:-25, radiusX:27.5, radiusY:28,
  brows:[[-10.5,-40],[17.5,-40]],
  beak:[[-14,-17],[21,-17],[34,-9],[7,-3],[-12,-8]]
};
const MAX_FRIES = 4, GUARD_RADIUS = 150;
const GUARD_WARNING_SECONDS = 1.65, GUARD_IMPACT_SECONDS = .42;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist = (x, y, xx, yy) => Math.hypot(x - xx, y - yy);
const rand = (min, max) => min + Math.random() * (max - min);
const announce = message => { $('message').textContent = message; };

const player = {id:0};
const guards = map.guards.map(([x,y], id) => ({x,y,id}));
let phase = 'setup', controlMode = 'keyboard';
let food = [], effects = [], guardAttacks = [];
let remain = 60, time = 0, last = performance.now();
let audio = null, muted = false;
const keys = new Set();
const movementKeys = ['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyF'];

function startGame(mode) {
  phase = 'playing';
  controlMode = mode;
  if (mode === 'keyboard') closeCamera();
  keys.clear();
  resetBodyInput();
  const [x,y] = map.nest;
  Object.assign(player, {x,y,carry:0,score:0,grip:false,auto:false,stun:0,invuln:0,stealClock:0});
  food = map.food.map(([x,y]) => ({x,y,count:MAX_FRIES,regen:0}));
  effects = [];
  guardAttacks = [];
  remain = 60;
  time = 0;
  $('setup').hidden = true;
  $('game').hidden = false;
  $('setupButton').hidden = false;
  $('inGameHint').textContent = mode === 'body'
    ? '侧移转向 · 双臂控制升降 · 半蹲抓取 · 站直回巢'
    : 'WASD / 方向键飞行 · 按住 F 抓取 · 松开 F 回巢';
  setTrackingPause('');
  announce('抓薯条，避开红圈，带回巢计分。');
  try {
    audio ??= new AudioContext();
    audio.resume().catch(() => {});
  } catch {
    muted = true;
  }
  sound('start');
  updateHUD();
}

function endGame() {
  phase = 'result';
  keys.clear();
  releaseGrip();
  $('resultText').textContent = '本局带回巢的薯条：' + player.score + ' 根。';
  $('result').showModal();
  sound('finish');
}

function returnToSetup() {
  phase = 'setup';
  keys.clear();
  releaseGrip();
  resetBodyInput();
  $('result').close();
  $('setup').hidden = false;
  $('game').hidden = true;
  $('setupButton').hidden = true;
  updateSetup();
}

function releaseGrip(returnHome = false) {
  const wasGripping = player.grip;
  player.grip = false;
  player.stealClock = 0;
  if (returnHome && wasGripping && player.carry > 0) player.auto = true;
}

function hit(p) {
  const dropped = p.carry;
  p.carry = 0;
  releaseGrip();
  p.auto = false;
  p.stun = .75;
  p.invuln = .75;
  sparkle(p.x, p.y, '#ff7775', 22);
  sound('bonk');
  announce(dropped ? '被游客击中，掉了 ' + dropped + ' 根薯条。' : '被游客击中。');
}

function nearestTray(p) {
  let closest = null;
  let distance = 68;
  for (const tray of food) {
    if (!tray.count) continue;
    const gap = dist(p.x, p.y + 28, tray.x, tray.y);
    if (gap < distance) {
      closest = tray;
      distance = gap;
    }
  }
  return closest;
}

function keyboardInput() {
  return {
    horizontal:Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    vertical:Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')),
    crouching:keys.has('KeyF')
  };
}

function updatePlayer(dt) {
  const p = player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.stun = Math.max(0, p.stun - dt);
  if (p.stun > 0) return;

  const [homeX, homeY] = map.nest;
  if (p.auto) {
    const distance = dist(p.x, p.y, homeX, homeY);
    const step = distance > 0 ? Math.min(1, 640 * dt / distance) : 1;
    p.x += (homeX - p.x) * step;
    p.y += (homeY - p.y) * step;
  } else {
    const input = controlMode === 'body' ? currentInput : keyboardInput();
    p.grip = input.crouching;
    p.x = clamp(p.x + input.horizontal * 460 * dt, 40, W - 40);
    p.y = clamp(p.y + input.vertical * 410 * dt, 100, H - 45);
  }

  if (!p.grip && p.carry > 0 && dist(p.x, p.y, homeX, homeY) < 23) {
    p.score += p.carry;
    announce('带回 ' + p.carry + ' 根薯条！');
    p.carry = 0;
    sparkle(p.x, p.y, '#ffe190', 18);
    sound('deposit');
    p.auto = false;
  }

  const tray = p.grip && p.carry < MAX_FRIES ? nearestTray(p) : null;
  if (!tray) {
    p.stealClock = 0;
    return;
  }
  p.stealClock += dt;
  if (p.stealClock < .44) return;
  p.stealClock = 0;
  p.carry++;
  tray.count--;
  if (tray.count === 0) tray.regen = 4;
  sparkle(p.x, p.y + 37, '#ffe39a', 8);
  sound('steal');
  beginGuardWarning(tray, p);
  if (p.carry === MAX_FRIES) announce('薯条抓满了。' + (controlMode === 'body' ? '站直' : '松开 F') + '回巢！');
}

function updateHUD() {
  $('clockText').textContent = Math.ceil(remain) + ' 秒';
  $('carry1').textContent = player.carry;
  $('score1').textContent = player.score;
  const warning = guardAttacks.find(attack => !attack.fired && insideGuardCircle(player, attack));
  $('action1').textContent = warning ? '飞出红圈 · ' + warningTime(warning) + 's' :
    player.stun > 0 ? '被击晕' : player.auto ? '回巢交货' : player.grip ? '正在抓取' : '飞行';
  $('action1').classList.toggle('danger', Boolean(warning));
}

function updateGame(dt) {
  time += dt;
  remain = Math.max(0, remain - dt);
  if (remain === 0) {
    updateHUD();
    endGame();
    return;
  }
  updatePlayer(dt);
  if (guardAttacks.length) updateGuardAttacks();
  for (const tray of food) {
    if (tray.count > 0) continue;
    tray.regen -= dt;
    if (tray.regen <= 0) tray.count = MAX_FRIES;
  }
  effects = effects.filter(effect => {
    effect.life -= dt;
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    effect.vy += 270 * dt;
    return effect.life > 0;
  });
  updateHUD();
}

const terrain = document.createElement('canvas');
terrain.width = W;
terrain.height = H;
drawTerrain();
drawNest(player);
terrain.getContext('2d').drawImage(canvas, 0, 0);

function render(now) {
  drawSea(now);
  ctx.drawImage(terrain, 0, 0);
  guardAttacks.forEach(drawGuardZone);
  food.forEach(tray => drawFood(tray));
  guards.forEach(drawGuard);
  drawBird(player, now);
  effects.forEach(effect => oval(effect.x, effect.y, effect.r, effect.r * .9, effect.color));
  guardAttacks.forEach(drawGuardCue);
}

const device = $('device');
const preview = $('poseCanvas');
const previewCtx = preview.getContext('2d');
const video = document.createElement('video');
video.muted = true;
video.playsInline = true;
const sampleFrame = document.createElement('canvas');
const sampleCtx = sampleFrame.getContext('2d');
const VISION_ROOTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.21'
];
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let stream = null, session = 0, opening = false, modelTask = null, tracker = null;
let calibrating = false, calibration = createCalibration(), controller = createBodyController();
let currentInput = null, lastPoseAt = -Infinity, lastValidAt = -Infinity, lastVideoTime = -1;

function cameraStatus(message, error = false) {
  $('cameraStatus').textContent = message;
  $('cameraStatus').classList.toggle('error', error);
}

function updateSetup() {
  const ready = Boolean(stream && tracker && calibration.baseline);
  $('calibrate').disabled = !stream || !tracker || calibrating;
  $('startBody').disabled = !ready || calibrating;
  $('cameraButton').disabled = opening;
  $('cameraButton').textContent = stream ? '关闭摄像头' : '开启摄像头';
  $('cameraEmpty').hidden = Boolean(stream);
  preview.hidden = !stream;
  $('cameraMeta').hidden = !stream;
  $('progress').hidden = !calibrating;
}

function setTrackingPause(message) {
  const notice = $('trackingPause');
  if (notice.textContent === message) return;
  notice.textContent = message;
  notice.hidden = !message;
}

function resetBodyInput() {
  controller = createBodyController();
  currentInput = null;
  lastValidAt = -Infinity;
}

function closeCamera() {
  session++;
  opening = false;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  lastVideoTime = -1;
  calibrating = false;
  calibration = createCalibration();
  resetBodyInput();
  updateSetup();
}

async function listCameras(currentId) {
  const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(item => item.kind === 'videoinput');
  if (!stream || stream.getVideoTracks()[0].getSettings().deviceId !== currentId) return;
  device.replaceChildren(new Option('系统默认摄像头', ''));
  for (const [i, camera] of cameras.entries()) {
    if (camera.deviceId) device.add(new Option(camera.label || '视频输入 ' + (i + 1), camera.deviceId));
  }
  device.value = cameras.some(camera => camera.deviceId && camera.deviceId === currentId) ? currentId : '';
  device.disabled = !cameras.some(camera => camera.deviceId);
}

function startPoseModel(root) {
  let expired = false;
  let timer;
  const load = (async () => {
    const vision = await import(root + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(root + '/wasm');
    if (expired) return null;
    const model = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions:{modelAssetPath:POSE_MODEL, delegate:'CPU'},
      runningMode:'VIDEO', numPoses:1,
      minPoseDetectionConfidence:.55, minPosePresenceConfidence:.55, minTrackingConfidence:.55
    });
    if (expired) {
      model.close();
      return null;
    }
    return model;
  })();
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { expired = true; reject(new Error('姿态模型载入超时')); }, 18000);
  });
  return Promise.race([load, deadline]).finally(() => clearTimeout(timer));
}

async function loadPoseModel() {
  if (tracker) return tracker;
  if (!modelTask) {
    modelTask = (async () => {
      for (const root of VISION_ROOTS) {
        try {
          return await startPoseModel(root);
        } catch (error) {
          console.warn('Pose model CDN unavailable', error);
        }
      }
      return null;
    })();
  }
  tracker = await modelTask;
  if (!tracker) modelTask = null;
  return tracker;
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus('请用 Chrome 打开 localhost 或 HTTPS 页面，再开启摄像头。', true);
    return;
  }
  const selected = device.value;
  closeCamera();
  const token = session;
  opening = true;
  updateSetup();
  cameraStatus('等待摄像头权限…');
  let candidate;
  try {
    candidate = await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30,max:30},
        ...(selected ? {deviceId:{exact:selected}} : {})}
    });
    if (session !== token) {
      candidate.getTracks().forEach(track => track.stop());
      return;
    }
    stream = candidate;
    const track = stream.getVideoTracks()[0];
    video.srcObject = stream;
    await video.play();
    if (session !== token) return;
    track.addEventListener('ended', () => {
      if (stream !== candidate) return;
      closeCamera();
      cameraStatus('摄像头已断开，请重新连接后开启。', true);
      if (phase === 'playing') returnToSetup();
    });
    $('cameraMeta').textContent = (track.label || '当前摄像头') + ' · ' +
      video.videoWidth + ' × ' + video.videoHeight;
    listCameras(track.getSettings().deviceId).catch(() => {});
    opening = false;
    updateSetup();
    cameraStatus('正在加载全身姿态模型…');
    const model = await loadPoseModel();
    if (session !== token) return;
    cameraStatus(model ? '站进画面，让头、手、双脚入镜，然后校准站姿。' :
      '模型加载失败。检查网络后关闭并重新开启摄像头，或用键盘试玩。', !model);
    updateSetup();
  } catch (error) {
    if (session !== token) return;
    closeCamera();
    const message = error.name === 'NotAllowedError' ? '摄像头权限未开启。请在浏览器允许后重试。' :
      '无法打开这个视频输入。检查相机是否在 Webcam 模式，或选择另一个摄像头。';
    cameraStatus(message, true);
  }
}

function drawPreview(landmarks, valid) {
  const {width, height} = preview;
  previewCtx.save();
  previewCtx.translate(width, 0);
  previewCtx.scale(-1, 1);
  previewCtx.drawImage(sampleFrame, 0, 0, width, height);
  previewCtx.restore();
  previewCtx.lineCap = 'round';
  previewCtx.lineJoin = 'round';
  previewCtx.setLineDash([7, 8]);
  previewCtx.strokeStyle = '#fff3bb';
  previewCtx.lineWidth = 2;
  previewCtx.strokeRect(width * .09, height * .04, width * .82, height * .92);
  previewCtx.setLineDash([]);
  if (!landmarks) return;

  const visible = index => (landmarks[index]?.visibility ?? 0) >= .52;
  previewCtx.beginPath();
  for (const [a,b] of BODY_BONES) {
    if (!visible(a) || !visible(b)) continue;
    previewCtx.moveTo((1 - landmarks[a].x) * width, landmarks[a].y * height);
    previewCtx.lineTo((1 - landmarks[b].x) * width, landmarks[b].y * height);
  }
  previewCtx.strokeStyle = '#15333f';
  previewCtx.lineWidth = 6;
  previewCtx.stroke();
  previewCtx.strokeStyle = valid ? '#97f3b1' : '#ffcc78';
  previewCtx.lineWidth = 3.1;
  previewCtx.stroke();
  previewCtx.fillStyle = previewCtx.strokeStyle;
  for (const i of BODY_JOINTS) {
    if (!visible(i)) continue;
    previewCtx.beginPath();
    previewCtx.arc((1 - landmarks[i].x) * width, landmarks[i].y * height, 4, 0, TAU);
    previewCtx.fill();
  }
}

function handlePose(landmarks, now) {
  const aspect = sampleFrame.width / sampleFrame.height;
  const sample = readBody(landmarks, aspect);
  if (phase === 'setup') {
    drawPreview(landmarks, sample);
    if (calibrating) {
      const progress = addCalibrationSample(calibration, sample, now);
      $('progress').value = progress;
      if (progress === 1) {
        calibrating = false;
        updateSetup();
        cameraStatus('站姿校准完成。展开双臂，准备开始。');
      }
    }
    return;
  }

  if (!sample) {
    if (currentInput) {
      resetBodyInput();
      releaseGrip();
      player.auto = false;
    }
    return;
  }
  lastValidAt = now;
  currentInput = bodyInput(controller, sample, calibration.baseline, now);
  if (currentInput.released) releaseGrip(true);
}

function readCamera(now) {
  if (!stream || (phase !== 'setup' && (phase !== 'playing' || controlMode !== 'body'))) return;
  if (video.readyState < 2 || video.currentTime === lastVideoTime || now - lastPoseAt < 42) return;
  lastPoseAt = now;
  lastVideoTime = video.currentTime;
  const scale = Math.min(1, 640 / video.videoWidth);
  const width = Math.round(video.videoWidth * scale), height = Math.round(video.videoHeight * scale);
  if (sampleFrame.width !== width || sampleFrame.height !== height) {
    sampleFrame.width = preview.width = width;
    sampleFrame.height = preview.height = height;
    $('cameraView').style.aspectRatio = width + ' / ' + height;
  }
  sampleCtx.drawImage(video, 0, 0, width, height);
  if (!tracker) {
    if (phase === 'setup') drawPreview(null, false);
    return;
  }
  try {
    const result = tracker.detectForVideo(sampleFrame, now);
    handlePose(result.landmarks[0], now);
  } catch (error) {
    console.warn('Pose inference failed', error);
    tracker.close();
    tracker = null;
    modelTask = null;
    closeCamera();
    returnToSetup();
    cameraStatus('姿态识别中断，请重新开启摄像头，或用键盘试玩。', true);
  }
}

function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  readCamera(now);
  if (phase === 'playing') {
    const ready = controlMode === 'keyboard' || (currentInput && now - lastValidAt <= TRACKING_MAX_AGE);
    if (ready) {
      setTrackingPause('');
      updateGame(dt);
    } else {
      resetBodyInput();
      releaseGrip();
      player.auto = false;
      setTrackingPause('已暂停 · 让头、双手和双脚重新入镜');
    }
  }
  if (!$('game').hidden) render(now / 1000);
  requestAnimationFrame(tick);
}

$('cameraButton').onclick = () => {
  if (stream) {
    closeCamera();
    cameraStatus('摄像头已关闭。');
  } else openCamera();
};
device.onchange = openCamera;
navigator.mediaDevices?.addEventListener('devicechange', () => {
  if (stream) listCameras(stream.getVideoTracks()[0].getSettings().deviceId).catch(() => {});
});
$('calibrate').onclick = () => {
  calibrating = true;
  calibration = createCalibration();
  $('progress').value = 0;
  updateSetup();
  cameraStatus('站在活动区中央，双腿站直并保持约 1 秒。');
};
$('startBody').onclick = () => startGame('body');
$('startKeyboard').onclick = () => startGame('keyboard');
$('setupButton').onclick = returnToSetup;
$('resultSetup').onclick = returnToSetup;
$('result').addEventListener('cancel', event => {
  event.preventDefault();
  returnToSetup();
});
$('again').onclick = () => {
  $('result').close();
  startGame(controlMode);
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('fullscreen').textContent = '请使用浏览器全屏';
  }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
});
window.addEventListener('keydown', event => {
  if (phase !== 'playing' || controlMode !== 'keyboard' || !movementKeys.includes(event.code)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener('keyup', event => {
  keys.delete(event.code);
  if (phase === 'playing' && controlMode === 'keyboard' && event.code === 'KeyF') releaseGrip(true);
});
window.addEventListener('blur', () => {
  keys.clear();
  releaseGrip();
  resetBodyInput();
});
window.addEventListener('pagehide', () => {
  closeCamera();
  if (phase !== 'setup') returnToSetup();
});
requestAnimationFrame(tick);
