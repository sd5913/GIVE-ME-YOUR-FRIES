const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..');
const noop=()=>{};const ctx=new Proxy({}, {get:()=>noop,set:()=>true});
const elements=new Map();const el=()=>({hidden:false,style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>ctx,addEventListener:noop,setAttribute:noop,blur:noop,focus:noop,options:[],appendChild:noop});
const sandbox={tr:x=>x,console,performance:{now:()=>10000},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)},createElement:el,addEventListener:noop},window:{addEventListener:noop,location:{search:''}},navigator:{},requestAnimationFrame:noop,Path2D:function(){},matchMedia:()=>({matches:true,addEventListener:noop}),URLSearchParams,setTimeout,clearTimeout,Image:function(){}};
vm.createContext(sandbox);
for(const file of ['scene.js','levels.js','guide.js','flight.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
vm.runInContext('tr=x=>x;startAudio=()=>{};closeCamera=()=>{};playGrabImpact=()=>{};playHey=()=>{};playWind=()=>{};',sandbox);
const run=s=>vm.runInContext(s,sandbox);
for(const level of [1,2]){
 run(`currentLevel=${level};beginRound('keyboard',true);flap();flap();`);
 assert.equal(run('game.phase'),'approach');
 let frames=0,grabs=0;
 while(run('game.phase')!=='result' && frames++<10000){
  run(`if(game.phase==='approach')steer(game.target);
   if(game.phase==='grab'){
    if(!game.npcs[game.npcIndex].stolen){openClaw('keyboard');closeClaw('keyboard');}
    else beginChase();
   }
   if(game.phase==='chase'){game.climb=2;const o=game.obstacles.find(o=>!o.passed&&o.z>game.z);if(o)game.x=routeX(o.lane===1?-1:1);}
   updateFlight(.04);updateGuide(game,performance.now());`);
 }
 assert(frames<10000,'level must finish');assert.equal(run('game.score'),level===1?1:3);assert.equal(run('game.deposited'),level===1?1:3);
}
run("currentLevel=2;beginRound('keyboard',true);setPhase('grab');openClaw('keyboard');closeClaw('keyboard');openClaw('keyboard');closeClaw('keyboard');");assert.equal(run('game.carry'),2);assert.equal(run('game.attack.duration'),2.8);run('updateAttack(3)');assert.equal(run('game.carry'),0);
run("beginRound('keyboard',true);flap();flap();game.x=routeX(1);for(let i=0;i<400;i++)updateFlight(.04)");assert.equal(run('game.npcs[0].skipped'),true);
console.log('PASS: both levels finish; cumulative stealing, attack loss, skip, reset, live guide updates.');
