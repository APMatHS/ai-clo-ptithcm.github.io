#!/usr/bin/env node
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const PROD_REF='rraooqedkpyhokattwdz';
const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const anon=process.env.SUPABASE_ANON_KEY||'';
const examId=process.env.EXAM_ID||'';
const usersFile=process.env.USERS_FILE||'./test-users.json';
const levels=(process.env.LOAD_LEVELS||'50,100,150,200,250').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0);
const doSubmit=(process.env.SUBMIT||'true').toLowerCase()!=='false';
const confirm=process.env.CONFIRM_NON_PRODUCTION||'';

if(!url||!anon||!examId) throw new Error('Thiếu SUPABASE_URL, SUPABASE_ANON_KEY hoặc EXAM_ID.');
if(url.includes(PROD_REF)) throw new Error('BỊ CHẶN: công cụ load-test không được chạy vào project production AI-CLO.');
if(confirm!=='I_UNDERSTAND_THIS_IS_STAGING') throw new Error('Đặt CONFIRM_NON_PRODUCTION=I_UNDERSTAND_THIS_IS_STAGING để xác nhận đây là môi trường thử nghiệm.');
if(!levels.length) throw new Error('LOAD_LEVELS không hợp lệ.');

const users=JSON.parse(fs.readFileSync(usersFile,'utf8'));
if(!Array.isArray(users)||!users.length) throw new Error('USERS_FILE phải là mảng JSON [{email,password}, ...].');
const maxLevel=Math.max(...levels);
if(users.length<maxLevel) throw new Error(`Cần ít nhất ${maxLevel} tài khoản thử nghiệm; hiện có ${users.length}.`);

async function request(path,{token,body}={}){
  const res=await fetch(`${url}${path}`,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:anon,...(token?{Authorization:`Bearer ${token}`}:{})},
    body:JSON.stringify(body||{}),
  });
  const text=await res.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok) throw new Error(`${res.status} ${typeof data==='string'?data:(data?.message||data?.error_description||JSON.stringify(data))}`);
  return data;
}

async function signIn(user){
  const data=await request('/auth/v1/token?grant_type=password',{body:{email:user.email,password:user.password}});
  if(!data?.access_token) throw new Error(`Không đăng nhập được ${user.email}`);
  return {email:user.email,token:data.access_token};
}

const rpc=(session,name,body)=>request(`/rest/v1/rpc/${name}`,{token:session.token,body});
const percentile=(xs,p)=>{if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]};
const fmt=n=>n==null?'—':`${n.toFixed(0)} ms`;

async function measured(task){
  const t0=performance.now();
  try{return {ok:true,value:await task(),ms:performance.now()-t0}}
  catch(error){return {ok:false,error:error?.message||String(error),ms:performance.now()-t0}}
}

async function parallelMap(items,fn){return Promise.all(items.map(item=>measured(()=>fn(item))))}

function printMetrics(label,rows){
  const ok=rows.filter(r=>r.ok),bad=rows.filter(r=>!r.ok),times=ok.map(r=>r.ms);
  console.log(`${label}: ${ok.length}/${rows.length} OK | p50 ${fmt(percentile(times,.50))} | p95 ${fmt(percentile(times,.95))} | max ${fmt(times.length?Math.max(...times):null)}`);
  if(bad.length) console.log('  lỗi mẫu:',bad.slice(0,3).map(x=>x.error));
}

console.log(`Đăng nhập ${maxLevel} tài khoản staging...`);
const loginResults=await parallelMap(users.slice(0,maxLevel),signIn);
printMetrics('AUTH',loginResults);
const sessions=loginResults.filter(r=>r.ok).map(r=>r.value);
if(sessions.length<maxLevel) throw new Error('Không đủ phiên đăng nhập để chạy mức tải lớn nhất.');

for(const level of levels){
  console.log(`\n=== ${level} sinh viên đồng thời ===`);
  const batch=sessions.slice(0,level);

  const starts=await parallelMap(batch,s=>rpc(s,'start_exam_attempt',{p_exam_id:examId}));
  printMetrics('START',starts);

  const started=batch.map((session,i)=>({session,start:starts[i]})).filter(x=>x.start.ok&&x.start.value?.attempt_id);
  const payloads=await parallelMap(started,x=>rpc(x.session,'get_exam_attempt_payload',{p_attempt_id:x.start.value.attempt_id}));
  printMetrics('PAYLOAD',payloads);

  if(doSubmit){
    const submissions=[];
    for(let i=0;i<started.length;i++){
      if(!payloads[i]?.ok) continue;
      const questions=Array.isArray(payloads[i].value?.questions)?payloads[i].value.questions:[];
      const answers=Object.fromEntries(questions.map((q,j)=>[q.id,['A','B','C','D'][j%4]]));
      submissions.push({session:started[i].session,attemptId:started[i].start.value.attempt_id,answers});
    }
    const submitted=await parallelMap(submissions,x=>rpc(x.session,'submit_exam_attempt',{p_attempt_id:x.attemptId,p_answers:x.answers}));
    printMetrics('SUBMIT',submitted);
  }
}

console.log('\nHoàn tất. Chỉ dùng kết quả này để so sánh staging theo các mốc 50→100→150→200→250; không chạy vào production.');
