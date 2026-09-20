import { CONFIG } from '../config.js';

const tokenKey='ai-clo-exam:student-token';

function endpoint(){return `${CONFIG.supabaseUrl}/functions/v1/${CONFIG.studentFunction}`;}
function getToken(){try{return sessionStorage.getItem(tokenKey)||'';}catch{return '';}}
function setToken(token){try{token?sessionStorage.setItem(tokenKey,token):sessionStorage.removeItem(tokenKey);}catch{}}

async function request(action,payload={},withToken=true){
  const headers={'Content-Type':'application/json','apikey':CONFIG.supabasePublishableKey};
  const token=getToken();
  if(withToken&&token) headers['X-Exam-Token']=token;
  const res=await fetch(endpoint(),{method:'POST',headers,body:JSON.stringify({action,...payload})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data?.error) throw new Error(data?.error||`API ${res.status}`);
  if(data?.token) setToken(data.token);
  return data;
}

export const studentApi={
  login:(studentCode,accessCode,deviceId)=>request('login',{studentCode,accessCode,deviceId},false),
  resume:()=>request('resume'),
  start:()=>request('start'),
  getQuestion:(displayNo)=>request('question',{displayNo}),
  saveAnswer:(attemptQuestionId,selectedKey,clientSeq)=>request('save-answer',{attemptQuestionId,selectedKey,clientSeq}),
  heartbeat:(eventPayload={})=>request('heartbeat',{eventPayload}),
  event:(eventType,payload={})=>request('event',{eventType,payload}),
  submit:()=>request('submit'),
  logout:()=>{setToken('');return Promise.resolve();},
  hasToken:()=>!!getToken()
};

export function getDeviceId(){
  const key='ai-clo-exam:device-id';
  try{let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return crypto.randomUUID();}
}
