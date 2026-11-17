const map = {
    sea: ['#b0ecdb', '#65c4ce'], plank: '#eeb982',
    nest: [108, 468],
    food: [[192, 230], [397, 215], [609, 293], [789, 431], [947, 209], [235, 446]],
    guards: [[319, 258], [704, 281], [886, 373]],
    land: [
      [[68, 165], [500, 165], [500, 237], [848, 237], [848, 141], [1034, 141], [1034, 237],
        [1044, 237], [1044, 475], [721, 475], [721, 351], [500, 351], [500, 306], [276, 306], [276, 526], [68, 526]]
    ],
    sign: ['NO SEAGULLS', 314, 192], props: [['⛵', 431, 431], ['🐟', 577, 500], ['🛟', 1088, 359]]
  };

function tone(f,d=.12,w='triangle',v=.065,slide=1,delay=0){if(muted||!audio)return;try{const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=w;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(50,f*slide),t+d);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+d+.025)}catch(e){}}
function sound(k){if(k==='steal'){tone(680,.12,'square',.035,1.5);tone(1100,.11,'sine',.05,1.05,.08)}else if(k==='deposit'){[510,680,900].forEach((f,i)=>tone(f,.16,'triangle',.065,1.07,i*.1))}else if(k==='bonk'){tone(260,.32,'sawtooth',.12,.21);tone(130,.18,'square',.065,1.8,.11)}else if(k==='finish'){[392,520,650,800].forEach((f,i)=>tone(f,.22,'triangle',.065,1.04,i*.12))}else if(k==='start'){[380,520,720].forEach((f,i)=>tone(f,.19,'triangle',.065,1.14,i*.12))}}
function sparkle(x,y,color='#fff4a1',n=12){for(let i=0;i<n;i++)effects.push({x,y,vx:rand(-145,145),vy:rand(-190,90),life:rand(.3,.7),color,r:rand(2.5,6)})}
function oval(x, y, rx, ry, color, stroke = null, width = 2, surface = ctx) {
  surface.beginPath();
  surface.ellipse(x, y, rx, ry, 0, 0, TAU);
  surface.fillStyle = color;
  surface.fill();
  if (stroke) {
    surface.strokeStyle = stroke;
    surface.lineWidth = width;
    surface.stroke();
  }
}

function rr(x, y, w, h, radius, color, stroke = null, width = 2, surface = ctx) {
  surface.beginPath();
  surface.roundRect(x, y, w, h, radius);
  surface.fillStyle = color;
  surface.fill();
  if (stroke) {
    surface.strokeStyle = stroke;
    surface.lineWidth = width;
    surface.stroke();
  }
}
function ln(x,y,xx,yy,color='#243d52',lw=3){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.lineWidth=lw;ctx.lineCap='round';ctx.strokeStyle=color;ctx.stroke()}
function label(text,x,y,size=14,color='#263c4f',align='center'){ctx.font=`900 ${size}px ui-rounded,system-ui,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y)}
function polygon(poly,color,stroke='#385265',lw=4){ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}


function insideGuardCircle(player, attack) {
  return dist(player.x, player.y + 28, attack.x, attack.y) <= GUARD_RADIUS;
}

function warningTime(attack) {
  return (Math.ceil(Math.max(0, attack.strikeAt - time) * 10) / 10).toFixed(1);
}

function beginGuardWarning(tray, player) {
  const alreadyWarned = guardAttacks.some(attack => !attack.fired && attack.tray === tray &&
    insideGuardCircle(player, attack));
  if (alreadyWarned) return;

  const guard = guards.reduce((nearest, candidate) =>
    dist(candidate.x, candidate.y, tray.x, tray.y) < dist(nearest.x, nearest.y, tray.x, tray.y)
      ? candidate : nearest);
  // Nearby visitors defend their own position. Distant visitors aim toward the gull.
  const targetY = player.y + 28;
  const reach = dist(guard.x, guard.y, player.x, targetY);
  const shift = reach > 92 ? 1 - 92 / reach : 0;
  const x = guard.x + (player.x - guard.x) * shift;
  const y = guard.y + (targetY - guard.y) * shift;
  guardAttacks.push({guard, tray, x, y,
    strikeAt:time + GUARD_WARNING_SECONDS, fired:false});
  announce('⚠️ 游客发现了偷薯条的海鸥！倒计时结束前飞出红圈。');
  tone(470, .11, 'square', .045, 1.28);
  tone(685, .15, 'square', .035, .85, .11);
  updateHUD();
}

function updateGuardAttacks() {
  for (const attack of guardAttacks) {
    if (attack.fired || time < attack.strikeAt) continue;
    attack.fired = true;
    sparkle(attack.x, attack.y, '#fff0bd', 16);
    tone(175, .23, 'sawtooth', .07, .52);
    if (insideGuardCircle(player, attack)) hit(player);
  }
  guardAttacks = guardAttacks.filter(attack => time < attack.strikeAt + GUARD_IMPACT_SECONDS);
}

function drawSea(now) {
  const {sea:colors} = map;
  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, colors[0]);
  sea.addColorStop(1, colors[1]);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, W, H);

  ctx.beginPath();
  ctx.strokeStyle = '#ffffff5c';
  ctx.lineWidth = 2.7;
  for (let i = 0; i < 48; i++) {
    const x = ((i * 151 + now * 11 * (i % 2 ? 1 : -1)) % (W + 80) + W + 80) % (W + 80) - 40;
    const y = 50 + (i * 73) % 540;
    const radius = 11 + (i % 3) * 6;
    ctx.moveTo(x + radius * Math.cos(.2), y + radius * Math.sin(.2));
    ctx.arc(x, y, radius, .2, 2.4);
  }
  ctx.stroke();
}

function drawTerrain() {
  for (const poly of map.bridges || []) polygon(poly, '#a37d65', '#364b56', 3);
  for (const poly of map.land) {
    ctx.save();
    ctx.translate(0, 8);
    polygon(poly, '#2d648055', '#2d648055', 3);
    ctx.restore();
    polygon(poly, map.plank, '#293e52', 5);
    ctx.save();
    ctx.clip();
    for (let y = 75; y < H; y += 29) ln(0, y, W, y, '#fff0cb69', 2);
    for (let x = 35; x < W; x += 93) {
      ln(x, 70, x, H, '#9b705a88', 1.4);
      for (let y = 117; y < H; y += 68) oval(x + 8, y, 2.5, 2.5, '#9d745d');
    }
    ctx.restore();
  }
  label(...map.sign, 17, '#67463b');
  for (const [symbol, x, y] of map.props) label(symbol, x, y, 29);
}

function drawNest(p) {
  const [x, y] = map.nest;
  const accent = p.id === 0 ? '#ffd265' : '#8cc7ef';
  oval(x, y + 9, 50, 40, '#f9e9bb', '#334b5d', 3);
  oval(x, y + 13, 40, 27, '#c18a59', '#75543f', 3);
  for (let j = 0; j < 12; j++) {
    const a = j * TAU / 12;
    ln(x + Math.cos(a) * 24, y + 12 + Math.sin(a) * 17,
      x + Math.cos(a) * 45, y + 12 + Math.sin(a) * 27, '#e7b477', 3);
  }
  rr(x - 48, y + 49, 96, 25, 7, accent, '#294157', 2);
  label(p.id === 0 ? 'P1 巢穴' : 'P2 巢穴', x, y + 61, 14);
}

function drawFood(f, x = f.x, y = f.y) {
  ctx.save();
  ctx.translate(x, y);
  oval(0, 23, 28, 6, '#58443844');
  for (let j = 0; j < f.count; j++) {
    rr(-17 + j * 9, -33 - j % 2 * 7, 8, 36, 2, '#ffe47b', '#ac8443', 1);
  }
  polygon([[-26,-14],[27,-14],[19,25],[-18,25]], '#ef7869', '#294357', 2.7);
  label(f.count ? 'FRIES' : '···', 1, 4, f.count ? 11 : 19, '#fff6da');
  ctx.restore();
}
function drawGuardZone(attack) {
  const {x, y, guard, strikeAt, fired} = attack;
  if (fired) {
    const progress = clamp((time - strikeAt) / GUARD_IMPACT_SECONDS, 0, 1);
    const wave = GUARD_RADIUS * (.35 + .65 * progress);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    oval(x, y, GUARD_RADIUS, GUARD_RADIUS, '#f5464770', '#a82332', 6);
    oval(x, y, wave, wave, '#ffc37527', '#fff1cc', 6);
    ctx.restore();
    return;
  }

  if (dist(guard.x, guard.y, x, y) > 20) {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ln(guard.x, guard.y, x, y, '#8f2332b0', 3);
    ctx.restore();
  }
  const elapsed = clamp(1 - (strikeAt - time) / GUARD_WARNING_SECONDS, 0, 1);
  const fill = 'rgba(218,41,54,' + (.17 + elapsed * .16) + ')';
  oval(x, y, GUARD_RADIUS, GUARD_RADIUS, fill, '#fff1db', 8);
  oval(x, y, GUARD_RADIUS, GUARD_RADIUS, 'transparent', '#b52539', 4.5);
  ctx.beginPath();
  ctx.arc(x, y, GUARD_RADIUS - 7, -TAU / 4, -TAU / 4 + elapsed * TAU);
  ctx.strokeStyle = '#d82e42';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawGuardCue(attack) {
  const {x, y, guard, strikeAt, fired} = attack;
  if (!fired && strikeAt - time < .25 && dist(guard.x, guard.y, x, y) > 28) {
    const progress = clamp(1 - (strikeAt - time) / .25, 0, 1);
    const fromY = guard.y - 34;
    const propX = guard.x + (x - guard.x) * progress;
    const propY = fromY + (y - fromY) * progress - Math.sin(progress * Math.PI) * 29;
    label(guard.id % 2 ? '💦' : '☂️', propX, propY, 26);
  }
  const badgeX = clamp(x, 90, W - 90);
  const badgeY = clamp(y - GUARD_RADIUS + 26, 29, H - 23);
  rr(badgeX - 69, badgeY - 14, 138, 28, 8, '#9b2636', '#fff0d5', 2.3);
  label(fired ? '游客攻击！' : '飞出红圈 ' + warningTime(attack) + 's', badgeX, badgeY, 15, '#fff7e9');
}

function drawGuard(g) {
  const {x, y} = g;
  const alert = guardAttacks.some(attack => attack.guard === g);
  ctx.save();
  ctx.translate(x, y);
  oval(0, 23, 30, 9, '#6953454f');
  ln(-13, 14, -15, 32, '#38485b', 5);
  ln(12, 14, 15, 32, '#38485b', 5);
  rr(-25, -4, 50, 31, 10, g.id % 2 ? '#72c8bf' : '#f2907b', '#2c4456', 2.5);
  oval(0, -22, 22, 24, '#ffdab8', '#2c4456', 3);
  oval(-8, -25, 2.7, 3.5, '#2c4456');
  oval(9, -25, 2.7, 3.5, '#2c4456');
  ln(-6, -11, 8, -11, '#a55e52', 2);
  if (g.id % 2) {
    label('💦', 35, -20, 27);
  } else {
    ln(19, -8, 41, -45, '#41526a', 4);
    oval(42, -48, 31, 13, '#f47774', '#253d55', 3);
  }
  if (alert) {
    oval(0, -57, 13, 13, '#b52539', '#fff0db', 2.5);
    label('!', 0, -56, 20, '#fff7e9');
  }
  ctx.restore();
}

function traceGullFaceWindow(surface) {
  const {centerX, centerY, radiusX, radiusY} = GULL_FACE;
  surface.beginPath();
  surface.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, TAU);
}

function traceGullBrows(surface, diving = false) {
  surface.beginPath();
  GULL_FACE.brows.forEach(([x, y], i) => {
    const tilt = (i === 0 ? 1 : -1) * (diving ? -4 : 1.5);
    surface.moveTo(x - 7.5, y + tilt);
    surface.lineTo(x + 7.5, y - tilt);
  });
}

function traceGullBeak(surface) {
  surface.beginPath();
  GULL_FACE.beak.forEach(([x, y], i) => {
    if (i === 0) surface.moveTo(x, y);
    else surface.lineTo(x, y);
  });
  surface.closePath();
}

function drawGullFace(surface, p, diving = false) {
  const blue = p.id === 1;
  const outline = '#284354';
  const {left, top, size, centerX, centerY} = GULL_FACE;
  oval(centerX, centerY, 31, 32, blue ? '#e6f4ff' : '#fffdf4', outline, 3, surface);
  surface.save();
  traceGullFaceWindow(surface);
  surface.clip();
  if (p.avatar) surface.drawImage(p.avatar, left, top, size, size);
  else {
    oval(-8, -28, 4.8, 6.5, '#324256', null, 2, surface);
    oval(14, -28, 4.8, 6.5, '#324256', null, 2, surface);
    oval(-13, -18, 5, 3, '#ffb3b2', null, 2, surface);
    oval(19, -18, 5, 3, '#ffb3b2', null, 2, surface);
  }
  surface.restore();
  surface.save();
  surface.lineCap = 'round';
  surface.lineJoin = 'round';
  surface.strokeStyle = outline;
  surface.lineWidth = 4;
  traceGullBrows(surface, diving);
  surface.stroke();
  traceGullBeak(surface);
  surface.fillStyle = blue ? '#ffad70' : '#ffcf50';
  surface.fill();
  surface.lineWidth = 2.4;
  surface.stroke();
  if (!blue) {
    rr(-22, -71, 41, 17, 6, '#f5ac3f', outline, 2.6, surface);
    rr(-27, -59, 57, 9, 4, '#ffd26b', outline, 2.6, surface);
  }
  surface.restore();
}

function drawBird(p, now) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.stun > 0 ? Math.sin(now * 30) * .25 : 0);
  if (p.invuln > 0) ctx.globalAlpha = .7 + .3 * Math.sin(now * 26);
  const blue = p.id === 1;
  const feathers = blue ? '#accdeb' : '#fff0c9';
  const outline = '#284354';
  const flap = Math.sin(now * 19 + p.id) * .45;
  const talonY = p.grip ? 47 : 40;

  oval(0, 51, 41, 9, '#29425644');
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (.3 - flap));
    oval(side * 34, -3, 30, 12, feathers, outline, 2.4);
    ctx.restore();
    ln(side * 12, 30, side * 14, talonY, outline, 7);
    ln(side * 12, 30, side * 14, talonY, '#ffb557', 4);
  }

  // Individual fries stay with the bird and sit between its toes.
  for (let i = 0; i < p.carry; i++) {
    ctx.save();
    ctx.translate(i % 2 ? 13 : -13, talonY + 6 + (i >= 2 ? 4 : 0));
    ctx.rotate((i % 2 ? .55 : -.62) + (i >= 2 ? .46 : 0) + Math.sin(now * 10) * .08);
    rr(-5 + (i >= 2 ? 7 : 0), -12, 10, 32, 2, '#ffe460', '#8a4f29', 2);
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    for (const toe of [-1, 0, 1]) {
      ln(side * 14, talonY - 3, side * 14 + toe * 5, talonY + 2, outline, 4.5);
      ln(side * 14, talonY - 3, side * 14 + toe * 5, talonY + 2, '#ffb557', 2.6);
    }
  }

  oval(0, 6, 33, 32, feathers, outline, 3);
  if (blue) {
    polygon([[-22,7],[-39,17],[-54,10],[-48,21],[-56,28],[-35,28],[-17,17]], '#3980be', outline, 2);
    rr(-30, 0, 58, 12, 5, '#3980be', outline, 2);
  }
  drawGullFace(ctx, p, p.grip);
  ctx.restore();

  const chip = blue ? '#b8dcf8' : '#ffdd7b';
  rr(p.x - 17, p.y - 94, 34, 18, 5, chip, outline, 1.7);
  label(p.stun > 0 ? '💫' : 'P' + (p.id + 1), p.x, p.y - 84, 11);
}
