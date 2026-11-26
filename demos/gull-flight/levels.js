'use strict';
const LEVELS={
 1:{end:3500,capacity:3,escape:20,targets:[
  {name:'Tourist / 普通游客',z:720,lane:-1,stock:3,trigger:2,warning:2.8}
 ],obstacles:[{z:1450,kind:'crates',lane:0},{z:2200,kind:'sign',lane:1},{z:2900,kind:'crates',lane:0}]},
 2:{end:8000,capacity:12,escape:28,targets:[
  {name:'Tourist / 普通游客',z:1050,lane:-1,stock:3,trigger:2,warning:2.8},
  {name:'Watchful tourist / 警觉游客',z:3100,lane:1,stock:4,trigger:1,warning:2.4},
  {name:'Fry chef / 薯条店老板',z:4800,lane:-1,stock:6,trigger:2,warning:2.2}
 ],obstacles:[
  {z:1850,kind:'crates',lane:0},{z:2600,kind:'sign',lane:-1},
  {z:3450,kind:'umbrella',lane:-1},{z:4250,kind:'cart',lane:1},
  {z:5350,kind:'highCrates',lane:0},{z:6150,kind:'restaurant',lane:-1},
  {z:6950,kind:'gull',lane:1},{z:7750,kind:'sign',lane:-1}
 ]}
};
