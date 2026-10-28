import {mountMap} from './map.js?v=6f8b49917bc4';
import {navigate} from './transition.js?v=6f8b49917bc4';
const map=mountMap(document.querySelector('#map-stage'),{onEnter:()=>navigate('tree-study.html?form=7&flow=1')});
document.querySelector('#replay').addEventListener('click',()=>map.replay());
window.journeyMap=map;
window.addEventListener('pagehide',()=>map.pause());
