import { setState } from './state.js';

const routes=[
  {re:/^#\/?$/,name:'home'},
  {re:/^#\/exams$/,name:'exams'},
  {re:/^#\/exam\/([0-9a-f-]+)$/,name:'exam',keys:['examId']},
  {re:/^#\/exam\/([0-9a-f-]+)\/live$/,name:'live',keys:['examId']},
  {re:/^#\/exam\/([0-9a-f-]+)\/results$/,name:'results',keys:['examId']},
  {re:/^#\/student$/,name:'student'},
  {re:/^#\/staff$/,name:'staff'}
];

export function parseRoute(hash=location.hash||'#/'){
  for(const route of routes){
    const match=hash.match(route.re);
    if(match){const params={};(route.keys||[]).forEach((k,i)=>params[k]=match[i+1]);return {name:route.name,params};}
  }
  return {name:'not-found',params:{}};
}

export function navigate(path){location.hash=path.startsWith('#')?path:`#${path}`;}

export function startRouter(onRoute){
  const run=()=>{const route=parseRoute();setState({route:route.name,routeParams:route.params});onRoute(route);};
  window.addEventListener('hashchange',run);
  run();
  return()=>window.removeEventListener('hashchange',run);
}
