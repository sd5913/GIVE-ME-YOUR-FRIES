'use strict';
const signArt=new Image();signArt.src='assets/no-seagulls.svg';
const OBSTACLE_TYPES={
 crates:{action:'flap',width:430},highCrates:{action:'flap',width:430},
 sign:{action:'lean',width:104},umbrella:{action:'lean',width:150},
 bunting:{action:'lean',width:180},restaurant:{action:'lean',width:125},
 cart:{action:'lean',width:100},gull:{action:'lean',width:100}
};
function obstacleX(o,time){return routeX(o.lane)+(o.kind==='cart'?Math.sin(time*.65)*65:0);}
function obstacleCollision(o,g,time){
 const type=OBSTACLE_TYPES[o.kind];
 if(type.action==='flap')return g.climb<=0;
 const dx=g.x-obstacleX(o,time),height=g.climb>0?200:105;
 if(o.kind==='sign')return Math.hypot(dx,height-200)<70 || (Math.abs(dx)<24 && height<160);
 return Math.abs(dx)<type.width/2+16;
}
function flightSpeed(g){return currentLevel===2?(g.slow?55:g.z<5600?(g.boost?110:75):(g.boost?125:95)):(g.slow?130:g.boost?310:235);}
function upcomingObstacle(g){return g.obstacles?.find(o=>!o.passed && o.z>g.z && (o.z-g.z)/flightSpeed(g)<=3);}
