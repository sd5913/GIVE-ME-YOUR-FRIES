'use strict';

const canvas = document.getElementById('flight');
const paint = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const TAU = Math.PI * 2;
const ink = '#243e52';
const routeX = side => side * 124;
const TRAY_Z = 720, NEST_Z = 1985;
const APPROACH_LIMIT = TRAY_Z-293;
const limit = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (value, target, dt, response = 8) => value + (target - value) * (1 - Math.exp(-response * dt));
const isLinedUp = game => Math.abs(routeX(game.target)-game.x)<=53;

function oval(x, y, rx, ry, color, stroke, width = 2) {
  paint.beginPath();
  paint.ellipse(x, y, rx, ry, 0, 0, TAU);
  paint.fillStyle = color;
  paint.fill();
  if (stroke) {
    paint.strokeStyle = stroke;
    paint.lineWidth = width;
    paint.stroke();
  }
}

function shape(points, color, stroke, width = 2) {
  paint.beginPath();
  points.forEach(([x,y], index) => index ? paint.lineTo(x,y) : paint.moveTo(x,y));
  paint.closePath();
  paint.fillStyle = color;
  paint.fill();
  if (stroke) {
    paint.strokeStyle = stroke;
    paint.lineWidth = width;
    paint.stroke();
  }
}

function line(points, color, width) {
  paint.beginPath();
  points.forEach(([x,y], index) => index ? paint.lineTo(x,y) : paint.moveTo(x,y));
  paint.strokeStyle = color;
  paint.lineWidth = width;
  paint.lineCap = 'round';
  paint.lineJoin = 'round';
  paint.stroke();
}

function textAt(text, x, y, size, color, align = 'center') {
  paint.font = '900 ' + size + 'px system-ui, sans-serif';
  paint.textAlign = align;
  paint.textBaseline = 'middle';
  paint.fillStyle = color;
  paint.fillText(text,x,y);
}

function rounded(x,y,w,h,r,color,stroke,width = 2) {
  paint.beginPath();
  paint.roundRect(x,y,w,h,r);
  paint.fillStyle = color;
  paint.fill();
  if (stroke) {
    paint.strokeStyle = stroke;
    paint.lineWidth = width;
    paint.stroke();
  }
}

function mixGradient(y1, y2, first, last) {
  const gradient = paint.createLinearGradient(0,y1,0,y2);
  gradient.addColorStop(0,first);
  gradient.addColorStop(1,last);
  return gradient;
}

function drawCoast(horizon, cameraX, now) {
  paint.fillStyle = mixGradient(0,horizon,'#73c7df','#daede5');
  paint.fillRect(0,0,W,H);
  const sunX = 960 - cameraX * .18;
  oval(sunX,106,74,74,'#ffefbf3e');
  oval(sunX,106,49,49,'#fff1b9');
  for (const [x,y,s] of [[162,105,1.16],[460,65,.64],[771,147,.72],[1160,123,.82]]) {
    const drift = cameraX * -.13;
    oval(x+drift,y,62*s,12*s,'#fff9e2ad');
    oval(x-15*s+drift,y-9*s,29*s,16*s,'#fff9e2d1');
    oval(x+21*s+drift,y-7*s,24*s,14*s,'#fff9e2a6');
  }
  const shift = cameraX * .20;
  shape([[-30,horizon-15],[180-shift,horizon-64],[248-shift,horizon-73],[443-shift,horizon-14],
    [735-shift,horizon-23],[1030-shift,horizon-78],[1280,horizon-32],[1310,horizon+8],[-30,horizon+8]],
    '#a5c9bd');
  shape([[-30,horizon+5],[119-shift,horizon-32],[221-shift,horizon-32],[388-shift,horizon+1],
    [797-shift,horizon+1],[982-shift,horizon-33],[1083-shift,horizon-24],[1310,horizon+3]],'#6d9b96');
  const lightHouseX = 1050 - shift;
  shape([[lightHouseX-9,horizon-24],[lightHouseX-6,horizon-78],[lightHouseX+5,horizon-78],
    [lightHouseX+9,horizon-24]],'#fff3d3',ink,1.5);
  shape([[lightHouseX-6,horizon-47],[lightHouseX-5,horizon-59],[lightHouseX+6,horizon-59],
    [lightHouseX+7,horizon-47]],'#e48166');
  shape([[lightHouseX-10,horizon-78],[lightHouseX,horizon-90],[lightHouseX+10,horizon-78]],'#c05b58',ink,1.5);
  paint.fillStyle = mixGradient(horizon,H,'#79c9c6','#3696a5');
  paint.fillRect(0,horizon,W,H-horizon);
  for (let n=0;n<53;n++) {
    const depth = ((n * 59) % 327) / 327;
    const y = horizon + 9 + depth ** 1.85 * (H - horizon);
    const drift = (n % 2 ? 1 : -1) * now * (5 + depth * 6);
    const x = ((n * 151 + drift - cameraX * depth) % (W+72) + W+72) % (W+72) - 36;
    const length = 5 + depth * 31;
    line([[x-length,y],[x,y+1],[x+length*.55,y]],n%4 ? '#f2ffee55' : '#dcfff0a0',1 + depth * 2);
  }
  const sailX = 243 - shift, sailY = horizon + 42;
  shape([[sailX-15,sailY],[sailX+17,sailY],[sailX+10,sailY+7],[sailX-11,sailY+7]],'#ba5a47',ink,1.5);
  shape([[sailX-2,sailY-4],[sailX-2,sailY-30],[sailX+13,sailY-4]],'#fff3cf',ink,1.2);
  shape([[sailX-5,sailY-4],[sailX-5,sailY-22],[sailX-15,sailY-4]],'#ffe0a2');
}

function projection(view, horizontalScale) {
  const horizon = 267 + view.pitch;
  return (x, y, z) => {
    const scale = 680 / Math.max(44,z - view.z);
    return [W/2 + (x-view.x)*scale*horizontalScale, horizon + (view.height-y)*scale, scale];
  };
}

function drawPier(view, project) {
  const start = Math.max(0,view.z + 45);
  const end = NEST_Z + 135;
  const deck = (left,right,near,far,y=0) => [
    project(left,y,near),project(left,y,far),project(right,y,far),project(right,y,near)
  ];
  if (start >= end) return;
  shape(deck(-252,252,start,end,-12),'#275d70a8');
  shape(deck(-248,248,start,end),mixGradient(265,H,'#f6cc99','#d99965'),ink,4);
  for (let z = end-32; z > start; z -= 52) {
    const [a,b] = [project(-245,0,z),project(245,0,z)];
    line([a,b], '#91634c8d',limit(a[2]*1.15,.55,3));
    if (z-5 > start) line([project(-244,1,z-5),project(244,1,z-5)],'#ffe5b694',limit(a[2],.45,2.5));
    for (const x of [-206,207]) {
      const [sx,sy,s] = project(x,1,z+12);
      oval(sx,sy,limit(s*2.4,.5,4),limit(s*1.45,.4,2.5),'#714e45ac');
    }
  }
  for (const x of [-240,-92,94,240]) line([project(x,1,start),project(x,1,end)],'#9e654b5b',2);
  for (let z = end-35; z > start + 32; z -= 155) {
    for (const x of [-241,241]) {
      const [sx,base,s] = project(x,0,z);
      if (s > 6) continue;
      rounded(sx-6*s,base-42*s,12*s,47*s,3*s,'#806251',ink,limit(s*1.8,.6,4));
      oval(sx,base-40*s,7*s,3.1*s,'#dcb381',ink,limit(s*1.25,.5,3));
      line([[sx-4*s,base-27*s],[sx+5*s,base-27*s]],'#f2d08c',limit(s*2,.65,4));
    }
  }
}

function paintFries(x,y,s,count = 5) {
  paint.save();
  paint.translate(x,y);
  paint.scale(s,s);
  oval(0,26,28,7,'#43322944');
  for (let j=0;j<count;j++) {
    const fry = (j - (count-1)/2) * 9;
    rounded(fry-4,-38-(j%2)*6,8,35,2,'#ffe184','#ba813e',1.5);
  }
  shape([[-28,-16],[28,-16],[19,26],[-19,26]],'#e66b54',ink,3);
  shape([[-22,-12],[22,-12],[16,-3],[-16,-3]],'#faad68');
  textAt('FRIES',0,8,12,'#fff4cf');
  paint.restore();
}

function drawTarget(game, project, now) {
  if (!['setup','launch','approach','dive','grab','hit'].includes(game.phase)) return;
  const [x,y,s] = project(routeX(game.target),22,TRAY_Z);
  const ready = (game.phase === 'approach' && game.ready && isLinedUp(game)) || game.clawOpen;
  if (ready) {
    const pulse = 1 + .05*Math.sin(now*7);
    const r = Math.max(34,43*s)*pulse;
    oval(x,y-6*s,r,r*.8,'#ffdb6c38','#253f4e',8);
    oval(x,y-6*s,r,r*.8,'transparent','#ffe68e',4);
  }
  const taken = game.phase==='hit' ? game.dropped : game.carry;
  paintFries(x,y,s,5-(taken || 0));
  if (game.phase === 'approach' && !isLinedUp(game)) {
    paintArrow(x,y-Math.max(57,69*s),Math.sign(routeX(game.target)-game.x),1,'#ffe193');
  }
}

function drawVisitor(x,y,s,angry) {
  oval(x,y+2*s,31*s,7*s,'#56524a50');
  rounded(x-22*s,y-50*s,44*s,48*s,10*s,angry ? '#e48768' : '#6cbdb2',ink,3*s);
  oval(x,y-57*s,23*s,25*s,'#ffe0ba',ink,3*s);
  oval(x-7*s,y-60*s,2.6*s,4*s,ink);
  oval(x+7*s,y-60*s,2.6*s,4*s,ink);
  if (angry) {
    line([[x-12*s,y-69*s],[x-4*s,y-66*s]],ink,2*s);
    line([[x+12*s,y-69*s],[x+4*s,y-66*s]],ink,2*s);
    oval(x,y-49*s,5*s,3.6*s,'#a6534a');
  } else {
    line([[x-5*s,y-48*s],[x+6*s,y-47*s]],'#9d6257',1.8*s);
  }
}

function drawUmbrella(x,y,s,hit) {
  paint.save();
  paint.translate(x,y);
  paint.rotate(hit ? .41 : -.15);
  line([[0,2*s],[0,57*s],[12*s,60*s]],ink,4*s);
  paint.beginPath();
  paint.moveTo(-54*s,0);
  paint.quadraticCurveTo(-45*s,-34*s,0,-39*s);
  paint.quadraticCurveTo(45*s,-34*s,54*s,0);
  paint.quadraticCurveTo(36*s,-8*s,19*s,0);
  paint.quadraticCurveTo(0,-9*s,-19*s,0);
  paint.quadraticCurveTo(-37*s,-7*s,-54*s,0);
  paint.fillStyle = '#f37869';
  paint.fill();
  paint.lineWidth = 3*s;
  paint.strokeStyle = ink;
  paint.stroke();
  line([[-52*s,0],[-29*s,-24*s],[0,-39*s],[25*s,-27*s],[53*s,0]],'#ffd6a0',1.6*s);
  line([[0,-39*s],[0,-3*s]],'#b73c47',2*s);
  paint.restore();
}

function paintArrow(x,y,side,s,color) {
  paint.save();
  paint.translate(x,y);
  paint.scale(side*s,s);
  shape([[-25,-8],[3,-8],[3,-21],[30,0],[3,21],[3,8],[-25,8]],color,ink,3);
  paint.restore();
}

function drawDanger(game,inset) {
  if (!game.attack || (game.attack.resolved && game.phase!=='hit')) return;
  const hit = game.phase==='hit';
  const entry = limit(game.attack.elapsed/ATTACK_NOTICE,0,1);
  const charge = limit((game.attack.elapsed-ATTACK_NOTICE)/ATTACK_CHARGE,0,1);
  const edge = W-inset;
  const x = edge-103+(1-entry)*135-(hit ? 41 : 0);
  const y = 390;
  const scale = 1.53;
  paint.save();
  paint.globalAlpha = hit ? limit(1-game.elapsed*.7,.35,1) : 1;
  drawVisitor(x,y,scale,true);
  drawUmbrella(x-31,y-117-(hit ? -24 : 32*charge),scale,hit);
  paint.restore();
  if (!hit) {
    paintArrow(edge-58,216,1,1.16,'#ff554b');
    if (entry >= 1) {
      const radius = 150-110*charge;
      oval(x-40,y-70,radius,radius*.77,'#ed535b22','#ffe6be',8);
      oval(x-40,y-70,radius,radius*.77,'transparent','#ee494e',5);
    }
  }
}

function drawNest(game,project,now) {
  if (game.z > NEST_Z-70) return;
  const [x,y,s] = project(routeX(-game.blocked),0,NEST_Z);
  if (game.phase === 'chase') {
    const pulse = 1 + .14*Math.sin(now*6);
    oval(x,y,66*s*pulse,23*s*pulse,'#fbe08a66','#fff0a5',4);
  }
  oval(x,y+3*s,47*s,16*s,'#e3ad68',ink,Math.max(1,s*2));
  oval(x,y-1*s,36*s,10*s,'#9a614b','#6f5246',Math.max(1,s*1.5));
  for (let j=0;j<12;j++) {
    const a = j*TAU/12;
    line([[x+28*s*Math.cos(a),y+8*s*Math.sin(a)],
      [x+44*s*Math.cos(a+.12),y+14*s*Math.sin(a+.12)]],'#ffe0a1',Math.max(.7,s*1.6));
  }
  if (game.phase === 'chase') {
    rounded(x-30,y-Math.max(35,31*s),60,25,7,'#18394a','#fbe08a',2);
    textAt('巢穴',x,y-Math.max(22,31*s-13),15,'#fff2bb');
  }
}

function drawWing(side, spread, lift, inset) {
  paint.save();
  paint.translate(side < 0 ? 26+inset : W-26-inset,H-146);
  paint.scale(-side*(1-inset/W),1);
  paint.translate(-105*(1-spread),72*(1-spread));
  paint.rotate(.19-.38*lift+.2*(1-spread));
  paint.beginPath();
  paint.moveTo(-165,205);
  paint.bezierCurveTo(-120,29,11,-46,162,-67);
  paint.bezierCurveTo(202,-75,228,-74,220,-60);
  paint.bezierCurveTo(207,-40,159,-11,136,5);
  paint.quadraticCurveTo(194,-11,186,6);
  paint.quadraticCurveTo(180,19,125,41);
  paint.quadraticCurveTo(162,31,154,47);
  paint.quadraticCurveTo(146,60,96,75);
  paint.quadraticCurveTo(120,74,111,87);
  paint.quadraticCurveTo(92,109,32,132);
  paint.lineTo(-96,216);
  paint.closePath();
  paint.fillStyle = mixGradient(-76,150,'#fff8d6','#e7bb85');
  paint.fill();
  paint.lineWidth = 5;
  paint.strokeStyle = ink;
  paint.stroke();
  line([[86,29],[132,4],[159,-24]],'#bd855a',3);
  line([[71,58],[113,41],[143,21]],'#bd855a',3);
  line([[48,93],[83,78],[119,55]],'#bd855a',3);
  paint.restore();
}

function drawTalons(game, now) {
  const x = W/2;
  const y = H-211+Math.sin(now*8)*3+(game.clawSnap>.13 ? -11 : 0);
  line([[x-12,y+65],[x,y+4],[x+3,y-12]],ink,24);
  line([[x-12,y+65],[x,y+4],[x+3,y-12]],'#ee9c57',16);
  for (const toe of [-1,0,1]) {
    const bend = game.clawOpen ? toe*39 : toe*16;
    const tipY = game.clawOpen ? y-46+Math.abs(toe)*10 : y-19;
    const toePath = [[x+2,y-9],[x+bend,y-38],[x+bend*.77,tipY]];
    line(toePath,ink,12);
    line(toePath,'#ffc875',7);
  }
  const falling = game.phase==='hit';
  const count = falling ? game.dropped : game.carry;
  if (count) {
    for (let j=0;j<count;j++) {
      const offset = j-(count-1)/2;
      paint.save();
      paint.translate(x+offset*(falling ? 26+game.elapsed*90 : 24),
        y-22+(falling ? game.elapsed**2*435 : 0));
      paint.rotate(offset*.46-.28+(falling ? game.elapsed*(1+j)*2 : 0));
      rounded(-7,-8,13,62,4,'#ffe078','#a76a3f',2.5);
      paint.restore();
    }
  }
}

function drawFlight(game, view, now) {
  const visibleWidth = Math.min(W,H*canvas.clientWidth/(canvas.clientHeight || H));
  const inset = (W-visibleWidth)/2;
  const project = projection(view,limit(visibleWidth/W*1.14,.42,1));
  drawCoast(267+view.pitch,view.x,now);
  paint.save();
  if (game.phase==='hit') {
    const hitShake = Math.max(0,1-game.elapsed/.54);
    paint.translate(Math.sin(game.elapsed*72)*25*hitShake,Math.cos(game.elapsed*58)*13*hitShake);
  }
  paint.translate(W/2,H/2);
  paint.rotate(view.bank);
  paint.translate(-W/2,-H/2);
  drawPier(view,project);
  drawNest(game,project,now);
  if (game.z < TRAY_Z-76) {
    const [x,y,s] = project(routeX(game.target)*.28,0,TRAY_Z+34);
    drawVisitor(x,y,s,false);
  }
  drawTarget(game,project,now);
  paint.restore();
  drawDanger(game,inset);

  if (view.speed > .26) {
    const alpha = limit(view.speed*.5,0,.38);
    paint.globalAlpha = alpha;
    for (let j=0;j<14;j++) {
      const p = (now*1.8 + j*.271) % 1;
      const side = j%2 ? 1 : -1;
      const x = W/2 + side*(285+p*320);
      const y = 300 + p*(j%3-1)*230;
      line([[x,y],[x+side*(15+p*48),y+(j%3-1)*p*28]],'#fff4ca',2);
    }
    paint.globalAlpha = 1;
  }
  drawWing(-1,view.wings,view.lift,inset);
  drawWing(1,view.wings,view.lift,inset);
  if (game.clawOpen || game.carry || game.phase==='hit') drawTalons(game,now);
  if (game.flash > 0) {
    paint.fillStyle = game.flashColor;
    paint.globalAlpha = limit(game.flash,0,1)*.44;
    paint.fillRect(0,0,W,H);
    paint.globalAlpha = 1;
  }
}

function drawMirror(video, context, width, height, landmarks, valid, hat = false) {
  if (video.readyState < 2 || !video.videoWidth) return;
  const scale = Math.max(width/video.videoWidth,height/video.videoHeight);
  const w = scale*video.videoWidth, h = scale*video.videoHeight;
  const left = (width-w)/2, top = (height-h)/2;
  context.save();
  context.translate(width,0);
  context.scale(-1,1);
  context.drawImage(video,left,top,w,h);
  context.restore();
  if (!landmarks?.length) return;
  const point = index => [(1-landmarks[index].x)*w+left, landmarks[index].y*h+top];
  if (hat && (landmarks[0].visibility ?? 1) > .46) {
    const [x,y] = point(0);
    const shoulder = Math.abs(point(11)[0]-point(12)[0]);
    const s = limit(shoulder*.38,18,75);
    oval(x,y-s*.82,s*.83,s*.14,'#ffdd75',ink,3);
    rounded(x-s*.55,y-s*1.48,s*1.1,s*.65,s*.17,'#f7b852',ink,3);
    rounded(x-s*.83,y-s*.94,s*1.66,s*.24,s*.11,'#ffe189',ink,2.5);
    return;
  }
  if (hat) return;
  const joints = [[11,12],[11,13],[12,14],[11,23],[12,24],[23,24]];
  context.beginPath();
  for (const [a,b] of joints) {
    if (Math.min(landmarks[a].visibility ?? 1,landmarks[b].visibility ?? 1)<.45) continue;
    context.moveTo(...point(a));
    context.lineTo(...point(b));
  }
  context.lineWidth = Math.max(2,width/190);
  context.strokeStyle = valid ? '#a3f3be' : '#ffd093';
  context.lineCap = 'round';
  context.stroke();
}
