// Browser regression harness. Inject after the two original inline scripts; no camera needed.
(() => {
  const results = [];
  const assert = (ok, detail) => { if (!ok) throw Error(detail); };
  const test = (name, fn) => {
    try { fn(); results.push({name,pass:true}); }
    catch (error) { results.push({name,pass:false,error:error.stack}); }
  };
  muted = true;
  const key = (code, shiftKey=false, repeat=false) => window.dispatchEvent(new KeyboardEvent('keydown',{code,shiftKey,repeat,bubbles:true,cancelable:true}));
  const up = code => window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
  const tap = (code,shift=false) => { key(code,shift); up(code); };
  const advance = seconds => { for (let t=0;t<seconds-1e-8;t+=.01) updateFlight(Math.min(.01,seconds-t)); };
  const fresh = () => beginRound('keyboard',true);
  const grab = () => { fresh(); tap('KeyW'); tap('Space'); tap('KeyA'); advance(1.7); tap('KeyS'); advance(.65); assert(game.phase==='grab','must reach GRAB'); };
  const fry = () => { tap('KeyE'); tap('KeyF'); };
  const attackTime = P0.attack.notice+P0.attack.charge;
  const two = () => { grab(); fry(); advance(.2); fry(); };
  const safe = () => { tap('KeyW'); tap('KeyD'); advance(1.5); };
  test('W / Space: two distinct presses launch',()=>{ fresh(); tap('KeyW'); assert(game.flaps===1,'one'); tap('Space'); assert(game.phase==='approach','two'); });
  test('held W / repeat cannot launch twice',()=>{ fresh(); key('KeyW'); key('KeyW',false,true); key('KeyW'); assert(game.flaps===1,'repeat counted'); up('KeyW'); });
  test('A / D steering; S rejected before target ready',()=>{ fresh(); tap('KeyW');tap('KeyW'); tap('KeyS'); assert(game.phase==='approach','early dive'); tap('KeyA'); assert(game.x===-124,'left');tap('KeyD');assert(game.x===124,'right'); });
  test('S aligned dive reaches GRAB',grab);
  test('E / F: one grab one fry and HUD',()=>{grab();fry();assert(game.carry===1 && !game.clawOpen && $('carry').textContent==='1' && game.clawSnap>0,'HUD/count/claw');});
  test('sustained F cannot repeat count',()=>{grab(); tap('KeyE');key('KeyF');advance(.3);key('KeyF',false,true);key('KeyF');assert(game.carry===1,'repeat F');up('KeyF');});
  test('short grab cooldown rejects rapid E/F',()=>{grab();fry();fry();assert(game.carry===1,'cooldown');advance(.2);fry();assert(game.carry===2,'rearmed');});
  test('same hand required; grab only in GRAB',()=>{grab();openClaw('Left');closeClaw('Right');assert(game.carry===0 && game.clawOpen,'cross hand');closeClaw('Left');tap('KeyW');openClaw('Left');closeClaw('Left');assert(game.carry===1 && !game.clawOpen,'outside grab');});
  test('second fry alerts exactly once; max three',()=>{two();const attack=game.attack;assert(attack && attack.stage==='notice','alert');advance(.2);fry();for(let i=0;i<6;i++){fry();}assert(game.carry===3 && game.attack===attack,'cap/duplicate alert');});
  test('notice / charge / impact; stationary bird BONK and drops',()=>{two();advance(P0.attack.notice+.01);assert(game.attack.stage==='charge','charge');advance(P0.attack.charge+.01);assert(game.phase==='hit' && game.carry===0 && game.dropped===2 && game.attack.resolved && game.attack.stage==='impact','hit');});
  test('late CHASE entry has no immunity / no teleport',()=>{two();advance(attackTime-.25);const z=game.z;tap('KeyW');assert(game.z===z,'teleport');advance(.26);assert(game.phase==='hit','late chase auto escaped');});
  test('timely forward escape without dodge succeeds',()=>{two();tap('KeyW');advance(attackTime+.01);assert(game.phase==='chase' && game.feedback==='TOO SLOW!' && !game.dodged,'forward position');});
  test('lateral A/D escape succeeds without dodge',()=>{two();advance(attackTime-.35);tap('KeyW');tap('KeyD');advance(.36);assert(game.feedback==='TOO SLOW!' && !game.dodged,'lateral');});
  test('Shift+D dodge from GRAB, one use per attack',()=>{two();advance(attackTime-.35);tap('KeyD',true);const x=game.x;tap('KeyA',true);assert(game.dodged && game.x===x,'dodge duplicate');advance(.36);assert(game.feedback==='TOO SLOW!','dodge did not escape');});
  test('Shift+A dodge in CHASE works in mirrored round',()=>{two();game.x=124;game.attack.x=124;advance(attackTime-.35);tap('KeyW');tap('KeyA',true);assert(game.x===-32 && game.dodged,'left dodge');advance(.36);assert(game.feedback==='TOO SLOW!','left miss');});
  test('wrong-way dodge still hits (no invulnerability)',()=>{two();advance(attackTime-.25);tap('KeyA',true);advance(.26);assert(game.phase==='hit' && game.dodged,'dodge flag immunity');});
  test('collision inclusive boundary and just outside',()=>{two();game.x=game.attack.x+106;updateAttack(attackTime+.001);assert(game.phase==='hit','boundary');two();game.x=game.attack.x+106.1;updateAttack(attackTime+.001);assert(game.feedback==='TOO SLOW!','outside');});
  test('resolved attack cannot execute twice',()=>{two();safe();advance(attackTime);const carry=game.carry;game.x=game.attack.x;game.z=game.attack.z;updateAttack(99);assert(game.carry===carry && game.phase==='chase','double hit');});
  for (const count of [1,2,3]) test(`carry ${count}: escape, HOME, result, restart`,()=>{grab();for(let i=0;i<count;i++){advance(.2);fry();}safe();advance(8);assert(game.phase==='result' && game.score===count && game.deposited===count,'home count');$('again').click();assert(game.phase==='launch' && !game.attack && game.carry===0 && !game.clawOpen && game.clock===0 && motion.candidate===null,'restart');});
  test('failure result and restart clear all pending state',()=>{two();advance(attackTime+.9);assert(game.phase==='result','fail result');$('again').click();assert(game.phase==='launch' && !game.attack && !game.dodged && game.grabReadyAt===0 && game.dodgeReadyAt===0,'reset');});

  let now;
  const pose = {lean:0,span:1.75,lift:-.65,bothOut:.9,shoulderX:.5,shoulderY:.3,hipY:.7,torso:.4};
  const bodyGrab = () => {grab();mode='body';neutral={lean:0};motion=makeMotion();motion.validSince=0;now=1000;};
  const result = (shape='Open_Palm',side='Left',score=.95) => ({landmarks:[Array.from({length:21},()=>({x:.5,y:.45}))],gestures:[[{categoryName:shape,score}]],handedness:[[{categoryName:side}]]});
  const hand = (shape,side='Left',score=.95,n=5) => {for(let i=0;i<n;i++){now+=60;game.clock+=.06;trackHand(result(shape,side,score),pose,1,now);}};
  test('body: continuous fist never scores',()=>{bodyGrab();hand('Closed_Fist','Left',.95,30);assert(game.carry===0,'fist alone');});
  test('body: stable open/fist, 1 / 2 / 3 then cap',()=>{bodyGrab();for(let i=1;i<=3;i++){hand('Open_Palm');hand('Closed_Fist');assert(game.carry===i,'sequence '+i);}hand('Open_Palm');hand('Closed_Fist');assert(game.carry===3,'cap');});
  test('body: left open / right fist rejected',()=>{bodyGrab();hand('Open_Palm');hand('Closed_Fist','Right');assert(game.carry===0,'cross-hand');});
  test('body: low confidence fluctuation / held fist cannot duplicate',()=>{bodyGrab();hand('Open_Palm');hand('Closed_Fist','Left',.55,1);hand('Closed_Fist','Left',.4,1);assert(game.carry===0,'early score');hand('Closed_Fist');hand('Closed_Fist','Left',.4,2);hand('Closed_Fist','Left',.95,20);assert(game.carry===1,'fist duplicated');});
  test('body: long hand loss cancels; returning fist needs new open',()=>{bodyGrab();hand('Open_Palm');for(let i=0;i<17;i++){now+=60;game.clock+=.06;trackHand({landmarks:[],gestures:[]},pose,1,now);}hand('Closed_Fist');assert(game.carry===0 && !game.clawOpen,'missing hand');hand('Open_Palm');hand('Closed_Fist');assert(game.carry===1,'recovery');});
  test('body: frozen hand sample gap cancels old open',()=>{bodyGrab();hand('Open_Palm');now+=1000;hand('Closed_Fist');assert(game.carry===0,'sample gap');});
  test('body: too-fast open/fist rejected',()=>{bodyGrab();for(let i=0;i<10;i++){hand('Open_Palm','Left',.95,1);hand('Closed_Fist','Left',.95,1);}assert(game.carry===0,'too fast');});
  test('body: null / missing landmarks safely rejected',()=>{assert(readPose(null,1)===null && readPose([],1)===null,'null pose');});
  const samples = (p,ms=350) => {for(let i=0;i<Math.ceil(ms/42);i++){now+=42;game.clock+=.042;trackMotion({...pose,...p},now);}};
  const bodyLaunch = () => {fresh();mode='body';neutral={lean:0};now=1000;};
  test('body: two full low/high/low cycles launch; held low no repeats',()=>{bodyLaunch();samples({});samples({lift:.25});samples({});assert(game.flaps===1,'cycle 1');samples({},600);assert(game.flaps===1,'held low');samples({lift:.25});samples({});assert(game.phase==='approach','cycle 2');});
  test('body: one arm cannot complete launch flap',()=>{bodyLaunch();samples({bothOut:.3});samples({bothOut:.3,lift:.25});samples({bothOut:.3});assert(game.flaps===0,'one arm flap');});
  test('body: first downstroke counts; small jitter does not repeat',()=>{bodyLaunch();samples({lift:.2});samples({});assert(game.flaps===1,'first downstroke lost');for(let i=0;i<15;i++)samples({lift:i%2?-.30:-.24},42);assert(game.flaps===1,'jitter');});
  test('body: tuck confirmed only within ready/aligned approach',()=>{bodyLaunch();setPhase('approach');game.ready=false;game.x=-124;samples({span:1.05,bothOut:.35},600);assert(game.phase==='approach','not ready');game.ready=true;game.x=124;samples({span:1.05},300);assert(game.phase==='approach','misaligned');game.x=-124;samples({span:1.05},250);assert(game.phase==='dive','valid tuck');});
  test('body: one hand reach does not escape; two arms confirm CHASE',()=>{bodyGrab();samples({span:1.1,bothOut:.3});hand('Open_Palm');samples({span:1.6,bothOut:.35});assert(game.phase==='grab','one arm');samples({span:1.9,bothOut:.95,wingsOut:true},170);assert(game.phase==='grab','open claw must block spread');hand('Closed_Fist');samples({span:1.1,bothOut:.3},250);samples({span:1.9,bothOut:.95,wingsOut:true},600);assert(game.phase==='chase' && !game.clawOpen,'spread');});
  test('body: slow lean steers only; fast sustained lean dodges',()=>{two();tap('KeyW');mode='body';neutral={lean:0};now=1000;for(let i=0;i<25;i++)samples({lean:i*.012},42);assert(!game.dodged && game.lean>0,'slow lean dodge');samples({lean:0},600);samples({lean:.6},210);assert(game.dodged,'quick flick');});
  test('body: losing evidence cancels grab and raised flap',()=>{bodyGrab();hand('Open_Palm');resetRecognition();hand('Closed_Fist');assert(game.carry===0,'old grab');bodyLaunch();samples({});samples({lift:.25});resetRecognition();samples({});assert(game.flaps===0,'old flap');});
  test('urgent: moderate confidence and wider reach still grabs three',()=>{bodyGrab();for(let i=1;i<=3;i++){for(const shape of ['Open_Palm','Closed_Fist'])for(let j=0;j<3;j++){now+=70;game.clock+=.07;const r=result(shape,'Left',.55);r.landmarks[0][9]={x:.77,y:.22};r.handedness[0][0].score=.58;trackHand(r,pose,1,now);}assert(game.carry===i && $('carry').textContent===String(i) && game.clawSnap>0,'count '+i);}});
  test('urgent: short missing hand retains confirmed open and needs real fist',()=>{bodyGrab();hand('Open_Palm');for(let i=0;i<5;i++){now+=60;trackHand({landmarks:[]},pose,1,now);}assert(game.clawOpen && game.carry===0,'lost open');hand('Closed_Fist');assert(game.carry===1,'recovered fist');});
  test('urgent: 400ms hand sampling stall does not discard open',()=>{bodyGrab();hand('Open_Palm');now+=400;hand('Closed_Fist');assert(game.carry===1,'short stall cancelled grab');});
  test('urgent: ambiguous frame between positive fist samples is tolerated',()=>{bodyGrab();hand('Open_Palm');hand('Closed_Fist','Left',.55,1);hand('None','Left',.2,1);hand('Closed_Fist','Left',.55,1);assert(game.carry===1,'candidate jitter');});
  test('urgent: empty body claw cannot enter CHASE even with wide elbows',()=>{bodyGrab();samples({span:1.1,bothOut:.3});samples({span:2,bothOut:.95,wingsOut:true},900);beginChase();assert(game.phase==='grab','empty auto escape');});
  test('urgent: grab input wins over apparent wing spread in same frame',()=>{bodyGrab();for(let i=1;i<=3;i++){for(const shape of ['Open_Palm','Closed_Fist'])for(let j=0;j<4;j++){now+=60;game.clock+=.06;trackHand(result(shape),pose,1,now);trackMotion({...pose,span:1.9,bothOut:.95,wingsOut:false},now);}assert(game.phase==='grab' && game.carry===i,'escape or missed grab '+i);}});
  test('urgent: short body gap preserves open while resetting motion evidence',()=>{bodyGrab();hand('Open_Palm');resetRecognition(true);motion.validSince=now-100;hand('Closed_Fist');assert(game.carry===1,'body gap');});
  for(const hz of [10,15,30]) test(`urgent: two modest flaps at ${hz}Hz with elbows moving inward`,()=>{bodyLaunch();const sample=(p,n)=>{for(let i=0;i<n;i++){now+=1000/hz;trackMotion({...pose,...p},now);}};sample({lift:-.1,span:1.2,bothOut:.6},3);sample({lift:-.43,span:.95,bothOut:.46},3);assert(game.flaps===1,'first');sample({lift:-.1,span:1.2,bothOut:.6},3);sample({lift:-.43,span:.95,bothOut:.46},3);assert(game.phase==='approach','second');});
  test('urgent: only one elbow moving cannot count',()=>{bodyLaunch();samples({leftLift:0,rightLift:0});samples({leftLift:-.5,rightLift:0});assert(game.flaps===0,'single elbow');});
  test('urgent: wrist evidence distinguishes spread from elbows wide at chest',()=>{const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));points[11]={x:.65,y:.3};points[12]={x:.35,y:.3};points[23]={x:.6,y:.7};points[24]={x:.4,y:.7};points[13]={x:.8,y:.4};points[14]={x:.2,y:.4};points[15]={x:.52,y:.45};points[16]={x:.48,y:.45};assert(readPose(points,1).wingsOut===false,'chest hands');points[15].x=.9;points[16].x=.1;assert(readPose(points,1).wingsOut===true,'spread wrists');});
  test('urgent: brief elbow occlusion retains cycle but never counts absence',()=>{bodyLaunch();samples({lift:-.1,span:1.2,bothOut:.6},170);samples({span:null},84);assert(game.flaps===0,'absence counted');samples({lift:-.43,span:.95,bothOut:.46},126);assert(game.flaps===1,'brief occlusion lost flap');});
  test('timing: confirmed open followed by one clear fist scores immediately',()=>{bodyGrab();for(let i=0;i<2;i++){now+=42;game.clock+=.042;trackHand(result('Open_Palm'),pose,1,now);}assert(game.clawOpen,'open');now+=42;game.clock+=.042;trackHand(result('Closed_Fist'),pose,1,now);assert(game.carry===1 && game.clawSnap>0 && !game.clawOpen,'instant edge');hand('Closed_Fist');assert(game.carry===1,'held fist');});
  test('timing: open may rearm during cooldown, no rapid duplicate score',()=>{grab();fry();tap('KeyE');assert(game.clawOpen,'open rejected by cooldown');tap('KeyF');assert(game.carry===1,'cooldown duplicate');advance(.11);tap('KeyF');assert(game.carry===2,'rearmed grab');});
  for(const count of [1,2,3]) test(`timing: real game-clock body grabs ${count}, spreads then wins`,()=>{bodyGrab();const frame=(p,shape,dt=.084)=>{now+=dt*1000;trackHand(shape?result(shape):{landmarks:[]},{...pose,...p},1,now);trackMotion({...pose,...p},now);advance(dt);};const chest={span:1.65,bothOut:.8,wingsOut:false};for(let i=1;i<=count;i++){// Approx 1.2s per grab with transition pauses, and actual attack clock running.
    for(let j=0;j<5;j++)frame(chest,'Open_Palm');for(let j=0;j<3;j++)frame(chest,'None');for(let j=0;j<3;j++)frame(chest,'Closed_Fist');for(let j=0;j<3;j++)frame(chest,'None');assert(game.phase==='grab' && game.carry===i,'grab '+i);
  }for(let j=0;j<6;j++)frame({span:1.9,bothOut:.95,wingsOut:true},null);assert(game.phase==='chase','spread blocked');for(let j=0;j<120 && game.phase!=='result';j++){now+=84;trackMotion({...pose,span:1.9,bothOut:.95,wingsOut:true},now);advance(.084);}assert(game.phase==='result' && game.deposited===count && game.score===count,'body win');});
  test('phase transition clears gesture candidates',()=>{bodyGrab();hand('Open_Palm');setPhase('chase');assert(!game.clawOpen && motion.hand===null && motion.candidate===null && motion.validSince===null,'transition');});
  // Exercise original Canvas functions across all game states, not DOM stubs.
  test('Canvas draws setup / launch / approach / dive / grab / chase / hit / home / result',()=>{fresh();for(const phase of ['setup','launch','approach','dive','grab','chase','hit','home','result']){game.phase=phase;game.elapsed=.2;game.dropped=2;game.carry=2;game.attack={elapsed:.5,x:-124,z:615,resolved:phase==='hit'};drawFlight(game,view,1);} });
  fresh();
  const report = {uncaughtErrors:window.P0_ERRORS,passed:results.filter(r=>r.pass).length,total:results.length,results};
  window.P0_TEST_RESULTS = report;
  const output = document.createElement('pre');output.id='p0-test-results';output.textContent=JSON.stringify(report,null,2);document.body.append(output);
  setTimeout(()=>{report.uncaughtErrors=window.P0_ERRORS;output.textContent=JSON.stringify(report,null,2);},150);
})();
