'use strict';
const signArt=new Image();signArt.src='assets/no-seagulls.svg';
const OBSTACLE_TYPES={
 crates:{action:'flap',width:430},highCrates:{action:'flap',width:430},
 sign:{action:'lean',width:104},umbrella:{action:'lean',width:150},
 bunting:{action:'lean',width:180},restaurant:{action:'lean',width:125},
 cart:{action:'lean',width:100},gull:{action:'lean',width:100}
};
const FLIGHT_TUNING={
  1:{base:130,flap:35,max:300,hold:.6,decay:1.5},
  2:{base:145,flap:40,max:360,hold:.6,decay:1.5}
};
const FLIGHT_HEIGHTS=[65,155,215];
const HEIGHT_TRANSITION_SECONDS=.3;
const LANE_TRANSITION_SECONDS=.75;
const HEIGHT_GLIDE_SECONDS=1.5;
const OBSTACLE_REACTION_SECONDS=3;
const OBSTACLE_DEPTH=58;
const CART_TRAVERSE_DISTANCE=FLIGHT_TUNING[2].max*3.5;
function cartProgress(o,playerZ){
 const linear=limit((playerZ-(o.z-CART_TRAVERSE_DISTANCE))/CART_TRAVERSE_DISTANCE,0,1);
 return linear*linear*(3-2*linear);
}
function cartDirection(o){return -Math.sign(o.lane||-1);}
function obstacleX(o,time,playerZ=0){
 if(o.kind!=='cart')return routeX(o.lane);
 const progress=cartProgress(o,playerZ);
 const start=routeX(o.lane),end=routeX(cartDirection(o));
 return start+(end-start)*progress;
}
function obstacleCollision(o,g,time){
 const type=OBSTACLE_TYPES[o.kind];
 const height=g.flightHeight??g.height??105;
 const dx=g.x-obstacleX(o,time,g.z);
 if(type.action==='flap')return height<(o.kind==='highCrates'?190:145);
 if(o.kind==='gull')return Math.abs(dx)<type.width/2+16&&height>82&&height<205;
 if(o.kind==='cart'&&height>=FLIGHT_HEIGHTS[2]-25)return false;
 if(o.kind==='sign')return Math.hypot(dx,height-200)<70 || (Math.abs(dx)<24 && height<160);
 return Math.abs(dx)<type.width/2+16;
}
function flightSpeed(g){
 const tune=FLIGHT_TUNING[currentLevel];
 const speed=limit(tune.base+(g.momentum||0),tune.base,tune.max);
 return speed*(g.slow?0.62:1);
}
function approachSpeed(g){
 const distance=Math.max(0,APPROACH_LIMIT-g.z);
 const closeIn=distance<220?.7+.3*distance/220:1;
 return flightSpeed(g)*closeIn;
}
function setFlightHeight(g,level){
 const next=limit(level,0,FLIGHT_HEIGHTS.length-1);
 if(next===g.heightLevel)return;
 g.heightLevel=next;
 g.heightFrom=g.flightHeight??FLIGHT_HEIGHTS[1];
 g.heightDuration=Math.max(HEIGHT_TRANSITION_SECONDS,
  Math.abs(FLIGHT_HEIGHTS[next]-g.heightFrom)/90*HEIGHT_TRANSITION_SECONDS);
 g.heightElapsed=0;
 g.heightTarget=FLIGHT_HEIGHTS[next];
}
function advanceFlightHeight(g,dt,descending=false){
 g.heightLevel??=1;
 g.flightHeight??=FLIGHT_HEIGHTS[g.heightLevel];
 g.heightTarget??=FLIGHT_HEIGHTS[g.heightLevel];
 if(descending&&!g.heightDescending)setFlightHeight(g,g.heightLevel-1);
 g.heightDescending=descending;
 if(descending)g.heightFlapTimer=0;
 else{
 g.heightFlapTimer=(g.heightFlapTimer||0)+dt;
 if(g.heightFlapTimer>=HEIGHT_GLIDE_SECONDS&&g.heightLevel>0){
  setFlightHeight(g,g.heightLevel-1);
  g.heightFlapTimer=0;
 }
 }
 g.heightDuration??=HEIGHT_TRANSITION_SECONDS;
 g.heightElapsed=Math.min(g.heightDuration,(g.heightElapsed||0)+dt);
 const progress=g.heightElapsed/g.heightDuration;
 const eased=progress*progress*(3-2*progress);
 g.flightHeight=(g.heightFrom??g.flightHeight)+((g.heightTarget??g.flightHeight)-(g.heightFrom??g.flightHeight))*eased;
 if(progress>=1)g.flightHeight=g.heightTarget;
}
function applyFlapLift(g){
 g.heightFlapTimer=0;
 setFlightHeight(g,(g.heightLevel??1)+1);
}
function worldSpeed(g){
 if(g.phase==='approach')return approachSpeed(g);
 if(g.phase==='chase')return flightSpeed(g);
 if(g.phase==='dive')return Math.max(0,(TRAY_Z-105-(g.diveFrom||g.z))/.63);
 if(g.phase==='home')return 75;
 return 0;
}
function upcomingObstacle(g){
 return g.obstacles?.filter(o=>!o.passed && o.z>=g.z-OBSTACLE_DEPTH)
  .sort((a,b)=>a.z-b.z)
  .find(o=>Math.max(0,o.z-g.z)/Math.max(1,worldSpeed(g))<=OBSTACLE_REACTION_SECONDS);
}
function sweptObstacleCollision(o,g,from,to,timeFrom,timeTo){
 const start=Math.max(from.z,o.z-OBSTACLE_DEPTH);
 const end=Math.min(to.z,o.z+OBSTACLE_DEPTH);
 if(end<start)return false;
 const heightDelta=Math.abs((to.flightHeight??105)-(from.flightHeight??105));
 const samples=Math.max(5,Math.ceil(Math.abs(to.x-from.x)/20),Math.ceil(heightDelta/15));
 for(let i=0;i<samples;i++){
  const z=start+(end-start)*i/(samples-1);
  const progress=to.z===from.z?i/(samples-1):(z-from.z)/(to.z-from.z);
  const sampleTime=timeFrom+(timeTo-timeFrom)*progress;
  const sample={...g,
   z,
   x:from.x+(to.x-from.x)*progress,
   flightHeight:(from.flightHeight??105)+((to.flightHeight??105)-(from.flightHeight??105))*progress};
  if(obstacleCollision(o,sample,sampleTime))return true;
 }
 return false;
}
