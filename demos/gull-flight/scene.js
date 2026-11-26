'use strict';

const canvas = document.getElementById('flight');
const paint = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const TAU = Math.PI * 2;
const ink = '#243e52';
const routeX = side => side * 124;
const TRAY_Z = 720, NEST_Z = 3500;
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
  // Low-contrast breakers follow the distant shore, with a few sunlit facets.
  for(let j=0;j<13;j++){
    const x=(j*109+38-shift*.65+W)%W;
    const y=horizon+10+(j%4)*4;
    line([[x-17,y],[x-4,y+1],[x+16,y]],'#d5ece088',1.5);
  }
  for(let j=0;j<7;j++){
    const y=horizon+18+j*9, x=sunX+Math.sin(j*2.1+now*.45)*(6+j*3);
    line([[x-8-j,y],[x+7+j,y]],'#ffe3a88a',2);
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
  // Keep every joint and grain mark attached to its plank as the camera moves.
  const washes = ['#fff0c326','#b8795019','#ffd7a12e','#a5654210'];
  for (let row=0,z=end; z>start; row++,z-=52) {
    const near=Math.max(start,z-52);
    const scale=project(0,0,z)[2];
    shape(deck(-246,246,near,z),washes[row%4]);
    line([project(-246,0,z),project(246,0,z)],'#92664f99',limit(scale*1.3,.5,3));
    if (scale<.52 || near>=z-16) continue;
    line([project(-245,0,z-3),project(245,0,z-3)],'#ffe4b694',limit(scale,.5,2.6));
    const joint=[-63,105,-135,45][row%4];
    line([project(joint,0,near),project(joint,0,z)],'#94684e80',limit(scale,.6,2.3));
    const grainX=(row*83)%290-145;
    if (near<z-33) {
      line([project(grainX-34,0,z-27),project(grainX-9,0,z-30),project(grainX+6,0,z-27),project(grainX+27,0,z-28)],'#ab785344',limit(scale,.65,2));
    }
    for (const x of [-211,211]) {
      const [sx,sy]=project(x,0,z-12);
      oval(sx,sy,limit(scale*1.8,.55,4),limit(scale,.4,2),'#805d48aa');
    }
  }
  for (const side of [-1,1]) {
    shape(deck(side*231,side*246,start,end),'#ac774f65');
    line([project(side*231,0,start),project(side*231,0,end)],'#eec79a',2);
  }
  for (let z=end-35; z>start; z-=155) {
    for (const x of [-241,241]) {
      const [sx,base,s]=project(x,0,z);
      if (z+155<=end && s<7) {
        const far=project(x,29,z+155), near=project(x,29,z);
        const sag=project(x,16,z+77);
        paint.beginPath();
        paint.moveTo(far[0],far[1]);
        paint.quadraticCurveTo(sag[0],sag[1],near[0],near[1]);
        paint.lineWidth=limit(s*2.8,.7,6);
        paint.strokeStyle='#79634e';
        paint.stroke();
        paint.lineWidth=limit(s*1.4,.4,3);
        paint.strokeStyle='#e9c893';
        paint.stroke();
      }
      if (s>7) continue;
      rounded(sx-6*s,base-42*s,12*s,45*s,3*s,'#916d54',ink,limit(s*1.6,.6,4));
      line([[sx-3*s,base-23*s],[sx-3*s,base-5*s]],'#c99a6b',limit(s,.5,3));
      oval(sx,base-40*s,7*s,3.1*s,'#ebc591',ink,limit(s*1.25,.5,3));
      for (const band of [28,31]) line([[sx-5*s,base-band*s],[sx+5*s,base-(band-1)*s]],'#efd4a0',limit(s*1.8,.6,4));
    }
  }
}

const reducedGrabMotion = matchMedia('(prefers-reduced-motion: reduce)');

const cartonFront = new Path2D('M-28 -16 Q-27 -18 -25 -17 C-10 -6 10 -6 25 -17 Q28 -19 28 -15 L20 23 Q19 26 16 26 L-16 26 Q-19 26 -20 23 Z');
const cartonHem = new Path2D('M-20 18 Q0 22 20 18 L19 23 Q18 26 16 26 L-16 26 Q-19 26 -20 23 Z');
const frySlots = [[-16,-39,-.15],[4,-46,.08],[17,-37,.17],[-6,-42,-.06],[9,-35,.12]];

function paintFries(x,y,s,count = 5, highlighted = false) {
  paint.save();
  paint.translate(x,y);
  paint.scale(s,s);
  paint.lineJoin='round';
  oval(0,27,24,4,'#43322933');
  shape([[-28,-16],[-23,-23],[21,-23],[28,-16],[20,5],[-20,5]],'#ae5140',ink,1.8);
  for (let j=0;j<count;j++) {
    const [fx,top,angle]=frySlots[j];
    paint.save();
    paint.translate(fx,top);
    paint.rotate(angle);
    rounded(-3.7,0,7.4,40,1.6,'#f6bb53','#ad7038',1.25);
    rounded(-2.7,1,4.5,38,1,'#ffe28a');
    line([[-1.7,2],[1.5,2]],'#fff0b2',1.2);
    paint.restore();
  }
  paint.fillStyle='#d85c48';
  paint.fill(cartonFront);
  paint.save();
  paint.clip(cartonFront);
  shape([[-28,-18],[-20,-10],[-14,26],[-21,26]],'#eb805c');
  shape([[27,-18],[17,-10],[13,26],[22,26]],'#b3483d');
  paint.fillStyle='#ffe1a4';
  paint.fill(cartonHem);
  for(let stripe=-26;stripe<23;stripe+=8) {
    shape([[stripe,18],[stripe+4,18],[stripe+1,27],[stripe-3,27]],'#eb9872');
  }
  paint.restore();
  if (highlighted) {
    paint.strokeStyle='#fffaed';
    paint.lineWidth=5;
    paint.stroke(cartonFront);
  }
  paint.strokeStyle=ink;
  paint.lineWidth=2.3;
  paint.stroke(cartonFront);
  // A small gull above the original wordmark ties the print to the pier signage.
  shape([[-7,-4],[-3,-4],[0,-2],[4,-4],[7,-4],[3,-2],[0,.3],[-3,-2]],'#ffdea2');
  textAt('FRIES',0,8,11,'#fff1ce');
  paint.restore();
}

function drawTarget(game, project, now) {
  if (!['setup','launch','approach','dive','grab','hit','chase'].includes(game.phase)) return;
  const [x,y,s] = project(routeX(game.target),22,TRAY_Z);
  const ready = (game.phase === 'approach' && game.ready && isLinedUp(game)) || game.phase==='grab';
  const progress = 1-limit((game.clawSnap || 0)/.28,0,1);
  const bounce = ready && !reducedGrabMotion.matches ? .22*Math.sin(progress*Math.PI*2)*(1-progress) : 0;
  const taken = game.phase==='hit' ? game.dropped : game.carry;
  const side = -game.target;
  const size = s*.82;
  paintFries(x-side*25*size*bounce,y+5*size*bounce,size*(1+bounce),5-(taken || 0),ready);
  if (game.phase === 'approach' && !isLinedUp(game)) {
    paintArrow(x,y-Math.max(57,69*s),Math.sign(routeX(game.target)-game.x),1,'#ffe193');
  }
}

const visitorShirt = new Path2D('M-8 -44 Q-19 -44 -24 -35 L-16 -29 L-13 -32 Q-18 -20 -16 -13 Q0 -8 18 -14 Q20 -23 14 -33 L19 -30 L24 -36 Q18 -44 9 -44 Z');
// One silhouette from sleeve to fingertips avoids a joint across the wrist.
// Forearm crosses the chest; fingertips curl around the near face of the carton.
const visitorNearArm = new Path2D('M17 -35 Q22 -36 24 -31 L24 -23 Q24 -18 18 -18 L2 -21 Q-1 -20 -5 -22 L-9 -24 Q-11 -26 -9 -28 Q-11 -30 -8 -31 L-4 -30 Q-5 -33 -3 -33 Q0 -33 2 -28 L17 -26 Z');
const visitorCuff = new Path2D('M13 -43 Q19 -43 24 -36 L21 -31 Q17 -31 13 -34 L10 -37');
const visitorHat = new Path2D('M-17 -75 L-15 -86 C-12 -90 9 -90 13 -86 L17 -75 Q0 -70 -17 -75 Z');
const hatBrim = new Path2D('M-25 -75 Q-16 -78 2 -77 Q18 -77 24 -74 Q27 -72 21 -71 Q3 -68 -20 -71 Q-29 -72 -25 -75 Z');
const deckShoe = new Path2D('M-3 -3 Q0 -1 4 -4 L6 -1 L6 3 Q2 5 -9 4 Q-12 3 -11 1 Q-10 -1 -6 -1 Z');
const visitorMoustache = new Path2D('M-3 -56 Q-7 -60 -12 -55 Q-16 -51 -18 -54 Q-16 -45 -5 -51 L-2 -53 Q5 -46 12 -51 Q15 -53 14 -56 Q11 -53 7 -56 Q1 -60 -3 -56 Z');

function drawVisitor(x,y,s,anger,side,surprised,recoil) {
  paint.save();
  paint.translate(x,y);
  paint.scale(side*s,s);
  paint.lineJoin='round';
  oval(0,2,28,5,'#56524a45');
  for (const foot of [-8,10]) {
    paint.save();
    paint.translate(foot,foot<0 ? 0 : -1);
    rounded(-3,-12,7,13,2,'#efb68d',ink,1.4);
    paint.fillStyle='#477477';
    paint.fill(deckShoe);
    paint.strokeStyle=ink;
    paint.lineWidth=1.5;
    paint.stroke(deckShoe);
    line([[-9,2],[0,2.6],[4.5,2]],'#f9dfaa',1.4);
    line([[-5,-.8],[-3,.2]],'#f9dfaa',1);
    paint.restore();
  }
  rounded(-16,-20,34,13,5,'#35566a',ink,2);
  paint.lineWidth=2;
  paint.strokeStyle=ink;
  paint.fillStyle='#ffd1a3';

  paint.fillStyle='#fff1cd';
  paint.fill(visitorShirt);
  paint.save();
  paint.clip(visitorShirt);
  paint.fillStyle='#277b7d';
  for(let stripe=-40;stripe<-9;stripe+=8) paint.fillRect(-25,stripe,50,3.5);
  paint.restore();
  paint.strokeStyle=ink;
  paint.lineWidth=2;
  paint.stroke(visitorShirt);
  // A folded neckerchief with an off-centre knot and two distinct tails.
  shape([[-12,-46],[9,-46],[13,-43],[5,-38],[-3,-36],[-11,-41]],'#cb5543',ink,1.4);
  line([[-9,-43],[-3,-40],[3,-41]],'#ffbd85',1.4);
  shape([[4,-40],[8,-40],[14,-35],[10,-35],[9,-32]],'#e87652',ink,1.2);
  shape([[4,-40],[8,-39],[6,-31],[2,-29],[2,-35]],'#e87652',ink,1.2);
  rounded(2,-42,6,5,2,'#ffa067',ink,1.2);

  // Tilt the head towards the stolen fries as the warning builds.
  paint.save();
  paint.translate(0,-48);
  paint.rotate(-.045-anger*.10+recoil*.23);
  paint.translate(0,44);
  const skin='rgb(255,'+Math.round(209-65*anger)+','+Math.round(163-50*anger)+')';
  oval(0,-61,20,20,skin,ink,2.3);
  paint.beginPath();
  paint.moveTo(17,-64);
  paint.bezierCurveTo(23,-68,24,-60,19,-58);
  paint.quadraticCurveTo(17,-57,17,-60);
  paint.fillStyle=skin;
  paint.fill();
  paint.strokeStyle=ink;
  paint.lineWidth=1.4;
  paint.stroke();
  line([[18.6,-61],[20,-62]],'#bc8067',1);
  oval(-13,-57,4,2.3,'#eb9580');
  oval(10,-57,4,2.3,'#eb9580');
  if (surprised || anger>0) {
    for(const ex of [-9,5]) {
      oval(ex,-63,3.8,surprised?4.9:3.4,'#fff8e7',ink,1);
      oval(ex-1,-63,1.6,2,ink);
    }
    const innerY=surprised?-70:-65;
    line([[-14,-70],[-6,innerY]],ink,2.2);
    line([[1,innerY],[10,-70]],ink,2.2);
    oval(-3,-49,surprised?2.8:5,surprised?4:3.2,'#853e35',ink,1);
  } else {
    oval(-9,-63,1.8,2.5,ink);
    oval(5,-63,1.8,2.5,ink);
    line([[-13,-68],[-7,-69]],ink,1.6);
    line([[2,-69],[9,-68]],ink,1.6);
  }
  oval(-3,-59,4,3,'#e39a70');
  paint.fillStyle='#694538';
  paint.fill(visitorMoustache);
  paint.fillStyle='#f2ca76';
  paint.fill(visitorHat);
  paint.strokeStyle=ink;
  paint.lineWidth=2.2;
  paint.stroke(visitorHat);
  line([[-13,-85],[-4,-86],[7,-86]],'#ffe1a1',1.4);
  shape([[-16,-80],[0,-78],[15,-80],[16,-75],[0,-73],[-17,-75]],'#a74e3c');
  paint.fillStyle='#e8bb73';
  paint.fill(hatBrim);
  paint.strokeStyle=ink;
  paint.lineWidth=1.8;
  paint.stroke(hatBrim);
  line([[-20,-74],[-9,-74],[4,-73.5]],'#ffe4af',1.1);
  paint.restore();
  paint.restore();
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

function drawOwner(game,project,now) {
  if (!['setup','launch','approach','dive','grab','hit','chase'].includes(game.phase)) return;
  if (game.phase==='chase' && game.elapsed>.8) return;
  const [fx,fy,scale] = project(routeX(game.target),22,TRAY_Z);
  const side = -game.target;
  const s = scale*1.03;
  const x = fx+side*18*s;
  const y = fy+26*s;
  const charge = game.attack ? limit(game.attack.elapsed/(ATTACK_NOTICE+ATTACK_CHARGE),0,1) : 0;
  const anger = game.carry ? Math.max(.23,charge) : game.phase==='hit' ? 1 : 0;
  paint.save();
  if (game.phase==='chase') paint.globalAlpha = Math.max(0,1-game.elapsed/.8);
  const recoil = !reducedGrabMotion.matches && game.carry ? Math.sin(Math.PI*limit(game.clawSnap/.28,0,1)) : 0;
  paint.translate(side*recoil*s*.9,-recoil*s*.6);
  drawVisitor(x,y,s,anger,side,game.carry===1,recoil);
  drawTarget(game,project,now);
  paint.translate(x,y);
  paint.scale(side*s,s);
  paint.fillStyle='#ffd1a3';
  paint.fill(visitorNearArm);
  paint.strokeStyle=ink;
  paint.lineWidth=1.7;
  paint.stroke(visitorNearArm);
  line([[-8,-27],[-4,-26]],'#ba8264',1);
  paint.fillStyle='#fff1cd';
  paint.fill(visitorCuff);
  paint.stroke(visitorCuff);
  line([[15,-40],[20,-38]],'#277b7d',2);
  paint.restore();
}

function drawObstacles(game,project) {
  for (const obstacle of [...(game.obstacles || [])].reverse()) {
    if (obstacle.passed || obstacle.z<game.z+44) continue;
    const distance = obstacle.z-game.z;
    if (obstacle.kind==='crates') {
      const [lx,y,s] = project(-215,0,obstacle.z);
      const [rx] = project(215,0,obstacle.z);
      paint.save();
      paint.translate(lx,y);
      paint.scale((rx-lx)/3,s);
      // Each shipping crate has its own boards, raised frame and corner nails.
      for (let i=0;i<3;i++) {
        paint.save();
        paint.translate(i,0);
        paint.scale(1/140,1);
        rounded(1,-136,138,136,4,i===1?'#b77750':'#c38757',ink,3);
        for (const seam of [-101,-68,-35]) {
          line([[7,seam],[133,seam]],'#996644',2);
          line([[7,seam+2],[133,seam+2]],'#d79c68',1.2);
        }
        shape([[7,-16],[122,-129],[134,-122],[18,-8]],'#ecc18a','#875e45',2);
        for (const rail of [-135,-14]) {
          rounded(3,rail,134,12,2,'#dba571','#835d48',2);
          for (const bolt of [10,130]) oval(bolt,rail+6,2.2,2.2,ink);
        }
        paint.restore();
      }
      paint.restore();
      if (distance<800) {
        textAt(tr('↑ 拍翅飞越'), (lx+rx)/2,y-155*s,limit(23*s,20,45),'#fff1b9');
      }
    } else {
      const [x,y,s] = project(routeX(obstacle.lane),0,obstacle.z);
      rounded(x-6*s,y-260*s,12*s,260*s,2*s,'#567581',ink,2*s);
      rounded(x-82*s,y-235*s,164*s,205*s,8*s,'#e66b54',ink,3*s);
      rounded(x-74*s,y-227*s,148*s,189*s,5*s,'#d96751','#ffe3af',2*s);
      for (const peg of [-65,65]) {
        for (const h of [-217,-48]) oval(x+peg*s,y+h*s,2.6*s,2.6*s,ink);
      }
      // A gull silhouette reads even before the lettering comes into range.
      shape([[-37,-205],[-17,-202],[0,-191],[19,-202],[37,-205],[17,-196],[1,-183],[-18,-196]].map(([dx,dy])=>[x+dx*s,y+dy*s]),'#fff0cb');
      textAt('NO',x,y-161*s,30*s,'#fff2cf');
      textAt('GULLS',x,y-125*s,25*s,'#fff2cf');
      if (distance<800) paintArrow(x,y-265*s,-obstacle.lane,limit(s,1,1.8),'#ffe193');
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
  paint.save();
  paint.translate(x,y);
  paint.scale(s,s);
  oval(0,7,50,8,'#5e48384a');
  shape([[-48,-5],[-39,-11],[-25,-10],[-13,-15],[4,-12],[22,-15],[37,-10],[49,-7],[40,4],[25,11],[4,14],[-18,12],[-36,6]],'#c7945b',ink,2.5);
  oval(0,-5,36,7,'#825b41');
  for(let j=0;j<9;j++) {
    const dx=-39+j*9, dy=6-9*(dx/42)**2;
    line([[dx-5,dy-5],[dx+4,dy],[dx+14,dy-3]],j%2?'#f1cb8b':'#a56d48',2.5);
  }
  line([[-34,0],[-45,-7],[-51,-8]],'#8b6547',2);
  line([[31,2],[44,-8],[48,-14]],'#8b6547',2);
  shape([[42,-6],[45,-17],[49,-19],[47,-10]],'#779782',ink,1);
  paint.restore();
  if (game.phase === 'chase') {
    rounded(x-30,y-Math.max(35,31*s),60,25,7,'#18394a','#fbe08a',2);
    textAt(tr('巢穴'),x,y-Math.max(22,31*s-13),15,'#fff2bb');
  }
}

const gullWing = new Path2D('M-165 205 C-118 31 -22 -38 78 -44 Q119 -48 164 -72 Q194 -87 222 -88 Q209 -68 153 -23 Q180 -39 197 -42 Q190 -24 134 13 Q157 3 169 1 Q163 20 110 48 Q131 42 142 40 Q135 58 89 80 Q103 78 112 76 Q98 97 48 119 L-96 216 Z');
const wingMantle = new Path2D('M-168 130 Q-113 14 13 -35 Q71 -54 122 -60 L165 -56 Q104 0 57 16 Q72 5 74 -2 Q43 17 8 25 Q21 16 23 10 Q-40 34 -91 87 Z');
const wingTips = new Path2D('M74 -43 Q147 -62 172 -94 L231 -99 L232 -14 L150 44 L96 65 Q128 40 139 20 Q121 31 102 36 Q139 7 150 -12 Q124 6 98 15 Q148 -26 161 -46 Q125 -25 94 -18 Q112 -31 117 -38 Z');
const wingCoverts = new Path2D('M-72 86 Q-25 51 19 43 Q13 52 -2 62 M-17 81 Q30 56 69 44 Q60 56 43 65 M19 91 Q53 73 81 62');
const wingMirrors = [[204,-77,8,3],[179,-31,6,2.5],[152,12,5,2.3]];

function drawWing(side, spread, lift, inset) {
  paint.save();
  const width=W-2*inset;
  const open=limit(spread,0,1);
  paint.translate(W/2+side*width*(.27+.07*open),H+30+28*(1-open));
  paint.scale(side*(.68+.42*open)*width/W,1-.16*lift);
  paint.rotate(-.19-.28*lift+.48*(1-open));
  paint.fillStyle='#fffefa';
  paint.fill(gullWing);
  paint.save();
  paint.clip(gullWing);
  // A silver mantle tapers into the dark primaries and their white mirrors.
  paint.fillStyle='#edf2ee';
  paint.fill(wingMantle);
  paint.fillStyle='#718b93';
  paint.save();
  paint.translate(45,-17);
  paint.fill(wingTips);
  paint.restore();
  for (const [x,y,rx,ry] of wingMirrors) {
    paint.save();
    paint.translate(x,y);
    paint.rotate(-.47);
    oval(0,0,rx,ry,'#fff5dc');
    paint.restore();
  }
  paint.strokeStyle='#80989e';
  paint.lineWidth=2;
  paint.stroke(wingCoverts);
  paint.restore();
  paint.strokeStyle=ink;
  paint.lineWidth=4.5;
  paint.stroke(gullWing);
  paint.restore();
}

function drawTail(reach, lift) {
  paint.save();
  paint.translate(W/2,H+28-9*reach+3*lift);
  for(const tilt of [-.33,0,.33]) {
    paint.save();
    paint.rotate(tilt);
    oval(0,-18,11,28,'#f6f6ec',ink,2);
    paint.restore();
  }
  oval(0,12,55,37,'#fffdf2',ink,2.5);
  paint.restore();
}

function drawTalons(game, now, reach) {
  const x=W*.55, y=H+42-228*reach+Math.sin(now*6)*1.5*reach;
  const leg=[[W*.52,H+26],[x-24,(H+y)/2+14],[x,y]];
  line(leg,ink,18);
  line(leg,'#e9a46b',12);
  for(const toe of [-1,0,1]) {
    const bend=game.clawOpen ? toe*28 : toe*15;
    paint.beginPath();
    paint.moveTo(x,y);
    paint.quadraticCurveTo(x+bend*.6,y-22,x+bend,y-24);
    paint.quadraticCurveTo(x+bend+3,y-23,x+bend*.86,y-(game.clawOpen?27:13));
    paint.strokeStyle=ink;paint.lineWidth=9;paint.stroke();
    paint.strokeStyle='#ffcc87';paint.lineWidth=5;paint.stroke();
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
  drawObstacles(game,project);
  drawOwner(game,project,now);
  paint.restore();

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
  if (view.reach>.01) drawTalons(game,now,view.reach);
  drawTail(view.reach || 0,view.lift);
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
    if (Math.min(landmarks[9]?.visibility ?? 0,landmarks[10]?.visibility ?? 0)>.46) {
      const a=point(9),b=point(10);
      const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
      const size=limit(Math.hypot(a[0]-b[0],a[1]-b[1])*1.8,12,s*.85);
      context.save();
      context.translate(mx,my);
      context.rotate(Math.atan2(b[1]-a[1],Math.abs(b[0]-a[0])));
      context.beginPath();
      context.moveTo(-size,-size*.32);
      context.quadraticCurveTo(size*.25,-size*.55,size*1.35,size*.12);
      context.lineTo(size*.15,size*.52);
      context.quadraticCurveTo(-size,size*.45,-size,-size*.32);
      context.fillStyle='#ffd578';context.strokeStyle=ink;context.lineWidth=3;
      context.fill();context.stroke();
      context.beginPath();context.moveTo(-size,size*.05);context.lineTo(size*1.35,size*.12);context.stroke();
      context.restore();
    }
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
