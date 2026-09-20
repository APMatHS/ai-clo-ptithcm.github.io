import { createClient } from "jsr:@supabase/supabase-js@2.116.0";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const ALLOWED_ORIGINS=new Set([
  'https://ai-clo-ptithcm.github.io',
  'https://apmaths.github.io'
]);
const EVENT_TYPES=new Set(['tab_hidden','focus_lost','reload','offline','online','warning_ack','device_change']);
const textEncoder=new TextEncoder();

function cors(req:Request){
  const origin=req.headers.get('origin')||'';
  const allow=ALLOWED_ORIGINS.has(origin)||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin':allow?origin:'https://ai-clo-ptithcm.github.io',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-exam-token',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Vary':'Origin',
    'Content-Type':'application/json; charset=utf-8'
  };
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)});}
function normalize(v:unknown){return String(v??'').trim().toUpperCase();}
async function sha256(value:string){const data=await crypto.subtle.digest('SHA-256',textEncoder.encode(value));return [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function shuffle<T>(items:T[]){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function safeIp(req:Request){return (req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();}

async function loginRateKey(req:Request,studentCode:string){return sha256(`${safeIp(req)}|${studentCode}`);}
async function enforceLoginRate(req:Request,studentCode:string){
  const key=await loginRateKey(req,studentCode);const since=new Date(Date.now()-10*60_000).toISOString();
  const {count}=await supabase.from('student_login_failures').select('id',{count:'exact',head:true}).eq('key_hash',key).gte('created_at',since);
  if((count||0)>=10) throw Object.assign(new Error('Có quá nhiều lần đăng nhập sai. Vui lòng liên hệ giám thị.'),{status:429});
  return key;
}
async function markLoginFailure(key:string){await supabase.from('student_login_failures').insert({key_hash:key});}
async function clearLoginFailures(key:string){await supabase.from('student_login_failures').delete().eq('key_hash',key);}

async function findPaperVersion(sessionId:string){
  const {data:paper,error:pErr}=await supabase.from('exam_papers').select('*').eq('session_id',sessionId).maybeSingle();
  if(pErr) throw pErr;if(!paper) return null;
  const {data:versions,error:vErr}=await supabase.from('exam_paper_versions').select('*').eq('paper_id',paper.id).in('status',['locked','hotfix']).order('version_no',{ascending:false}).limit(1);
  if(vErr) throw vErr;return versions?.[0]?{paper,version:versions[0]}:null;
}

async function contextFromAttempt(attempt:any){
  const {data:student,error:sErr}=await supabase.from('exam_students').select('*').eq('id',attempt.exam_student_id).single();if(sErr)throw sErr;
  const [{data:session,error:seErr},{data:exam,error:eErr},{data:room,error:rErr}]=await Promise.all([
    supabase.from('exam_sessions').select('*').eq('id',attempt.session_id).single(),
    supabase.from('exams').select('*').eq('id',student.exam_id).single(),
    supabase.from('exam_rooms').select('*').eq('id',attempt.room_id).single()
  ]);if(seErr)throw seErr;if(eErr)throw eErr;if(rErr)throw rErr;
  return {student,session,exam,room};
}

async function issueAttemptToken(attemptId:string,deviceId:string,userAgent:string){
  const raw=randomToken(),hash=await sha256(raw);
  const {error}=await supabase.from('attempt_sessions').insert({attempt_id:attemptId,token_hash:hash,device_id:deviceId||null,user_agent:userAgent||null});
  if(error)throw error;return raw;
}

async function authenticate(req:Request){
  const raw=req.headers.get('x-exam-token')||'';if(!raw) throw Object.assign(new Error('Phiên thi không hợp lệ.'),{status:401});
  const hash=await sha256(raw);
  const {data:session,error}=await supabase.from('attempt_sessions').select('*').eq('token_hash',hash).is('revoked_at',null).maybeSingle();
  if(error)throw error;if(!session)throw Object.assign(new Error('Phiên thi đã hết hiệu lực.'),{status:401});
  const {data:attempt,error:aErr}=await supabase.from('exam_attempts').select('*').eq('id',session.attempt_id).single();if(aErr)throw aErr;
  await supabase.from('attempt_sessions').update({last_seen_at:new Date().toISOString()}).eq('id',session.id);
  return {attempt,attemptSession:session};
}

async function login(req:Request,body:any){
  const studentCode=normalize(body.studentCode),accessCode=normalize(body.accessCode),deviceId=String(body.deviceId||'');
  if(!studentCode||!accessCode) return json(req,{error:'Vui lòng nhập MSSV và mã thi.'},400);
  const rateKey=await enforceLoginRate(req,studentCode);
  const {data:candidates,error}=await supabase.from('exam_students').select('*').eq('student_code',studentCode).eq('active',true);
  if(error)throw error;
  if(!candidates?.length){await markLoginFailure(rateKey);return json(req,{error:'MSSV hoặc mã thi không đúng.'},401);}
  const ids=candidates.map(x=>x.id);const inputHash=await sha256(accessCode);
  const {data:codes,error:cErr}=await supabase.from('exam_student_codes').select('*').in('exam_student_id',ids);if(cErr)throw cErr;
  const matched=codes?.find(c=>c.code_hash===inputHash);const student=candidates.find(x=>x.id===matched?.exam_student_id);
  if(!student){await markLoginFailure(rateKey);return json(req,{error:'MSSV hoặc mã thi không đúng.'},401);}
  await clearLoginFailures(rateKey);
  if(student.locked) return json(req,{error:student.locked_reason||'Tài khoản dự thi đang bị khóa. Vui lòng liên hệ giám thị.'},423);
  const [{data:exam,error:eErr},{data:session,error:sErr},{data:room,error:rErr}]=await Promise.all([
    supabase.from('exams').select('*').eq('id',student.exam_id).single(),
    supabase.from('exam_sessions').select('*').eq('id',student.session_id).single(),
    supabase.from('exam_rooms').select('*').eq('id',student.room_id).single()
  ]);if(eErr)throw eErr;if(sErr)throw sErr;if(rErr)throw rErr;
  if(exam.status==='archived')return json(req,{error:'Kỳ thi đã lưu trữ.'},410);
  const paperInfo=await findPaperVersion(session.id);if(!paperInfo)return json(req,{error:'Đề thi chưa sẵn sàng. Vui lòng báo giám thị.'},409);
  const {data:attempts,error:aErr}=await supabase.from('exam_attempts').select('*').eq('exam_student_id',student.id).order('created_at',{ascending:false}).limit(1);if(aErr)throw aErr;
  let attempt=attempts?.[0]||null;
  if(attempt?.status==='submitted'){
    const show=exam.score_visibility==='immediate'||(exam.score_visibility==='after_close'&&exam.status==='closed');
    return json(req,{status:'submitted',student:{studentCode:student.student_code,fullName:student.full_name},exam:{name:exam.name,subjectName:exam.subject_name},score:show?attempt.score:null,scoreVisible:show});
  }
  if(!attempt){
    const {data:newAttempt,error:newErr}=await supabase.from('exam_attempts').insert({exam_student_id:student.id,session_id:session.id,room_id:room.id,paper_version_id:paperInfo.version.id,status:'ready'}).select().single();if(newErr)throw newErr;attempt=newAttempt;
  }
  const {data:activeSessions,error:asErr}=await supabase.from('attempt_sessions').select('*').eq('attempt_id',attempt.id).is('revoked_at',null);if(asErr)throw asErr;
  const otherDevice=(activeSessions||[]).find(x=>x.device_id&&deviceId&&x.device_id!==deviceId);
  if(otherDevice&&attempt.status==='in_progress'){
    await supabase.from('attempt_events').insert({attempt_id:attempt.id,event_type:'device_change',payload:{blocked:true}});
    return json(req,{error:'Bài thi đang hoạt động trên thiết bị khác. Hãy báo giám thị để được chuyển máy.',code:'DEVICE_TRANSFER_REQUIRED'},409);
  }
  if(activeSessions?.length) await supabase.from('attempt_sessions').update({revoked_at:new Date().toISOString()}).in('id',activeSessions.map(x=>x.id));
  const token=await issueAttemptToken(attempt.id,deviceId,req.headers.get('user-agent')||'');
  return json(req,{token,status:attempt.status,student:{studentCode:student.student_code,fullName:student.full_name,className:student.class_name},exam:{id:exam.id,name:exam.name,subjectName:exam.subject_name,type:exam.exam_type,scoreVisibility:exam.score_visibility},session:{id:session.id,name:session.name,startsAt:session.starts_at,endsAt:session.ends_at,durationMinutes:session.duration_minutes},room:{id:room.id,name:room.name},attempt:{id:attempt.id,status:attempt.status,startedAt:attempt.started_at,deadlineAt:attempt.deadline_at,answeredCount:attempt.answered_count}});
}

async function ensureAttemptQuestions(attempt:any){
  const {count,error:cErr}=await supabase.from('attempt_questions').select('id',{count:'exact',head:true}).eq('attempt_id',attempt.id);if(cErr)throw cErr;if((count||0)>0)return;
  const {data:version,error:vErr}=await supabase.from('exam_paper_versions').select('*').eq('id',attempt.paper_version_id).single();if(vErr)throw vErr;
  const {data:paper,error:pErr}=await supabase.from('exam_papers').select('*').eq('id',version.paper_id).single();if(pErr)throw pErr;
  const {data:links,error:lErr}=await supabase.from('paper_version_questions').select('*').eq('paper_version_id',version.id).order('order_no');if(lErr)throw lErr;if(!links?.length)throw new Error('Đề thi chưa có câu hỏi.');
  const qVersionIds=links.map(x=>x.question_version_id);
  const {data:qVersions,error:qErr}=await supabase.from('question_versions').select('id,choices,metadata').in('id',qVersionIds);if(qErr)throw qErr;
  const qvMap=new Map((qVersions||[]).map(x=>[x.id,x]));
  let ordered=[...links];
  if(paper.structure_mode==='generic'&&paper.shuffle_questions) ordered=shuffle(ordered);
  if(paper.structure_mode==='english'){
    const gvIds=[...new Set(ordered.map(x=>x.group_version_id).filter(Boolean))] as string[];
    if(gvIds.length){
      const {data:gvs}=await supabase.from('question_group_versions').select('id,group_id').in('id',gvIds);
      const gids=[...new Set((gvs||[]).map(x=>x.group_id))] as string[];
      const {data:groups}=gids.length?await supabase.from('question_groups').select('id,shuffle_policy').in('id',gids):{data:[] as any[]};
      const gMap=new Map((groups||[]).map(x=>[x.id,x]));const gvMap=new Map((gvs||[]).map(x=>[x.id,gMap.get(x.group_id)]));
      const chunks:any[][]=[];for(const item of ordered){const last=chunks[chunks.length-1];if(last&&last[0]?.group_version_id&&last[0].group_version_id===item.group_version_id)last.push(item);else chunks.push([item]);}
      ordered=chunks.flatMap(chunk=>chunk[0]?.group_version_id&&gvMap.get(chunk[0].group_version_id)?.shuffle_policy==='within_group'?shuffle(chunk):chunk);
    }
  }
  const rows=ordered.map((item,index)=>{const qv=qvMap.get(item.question_version_id);const keys=Array.isArray(qv?.choices)?qv.choices.map((c:any)=>String(c.key)):[];const allow=paper.shuffle_choices&&qv?.metadata?.shuffle_choices!==false;return {attempt_id:attempt.id,question_id:item.question_id,question_version_id:item.question_version_id,group_version_id:item.group_version_id,display_no:index+1,choice_order:allow?shuffle(keys):keys};});
  const {error:iErr}=await supabase.from('attempt_questions').insert(rows);if(iErr)throw iErr;
}

async function start(req:Request){
  const {attempt}=await authenticate(req);if(!['ready','in_progress'].includes(attempt.status))return json(req,{error:'Bài thi hiện không thể bắt đầu.'},409);
  const ctx=await contextFromAttempt(attempt);const now=Date.now(),start=Date.parse(ctx.session.starts_at),end=Date.parse(ctx.session.ends_at);
  if(now<start)return json(req,{error:'Chưa đến giờ thi.',serverNow:new Date(now).toISOString(),startsAt:ctx.session.starts_at},425);
  if(now>=end)return json(req,{error:'Ca thi đã kết thúc.'},410);
  let current=attempt;
  if(attempt.status==='ready'){
    await ensureAttemptQuestions(attempt);
    const deadline=new Date(Math.min(end,now+ctx.session.duration_minutes*60_000)).toISOString();
    const {data,error}=await supabase.from('exam_attempts').update({status:'in_progress',started_at:new Date(now).toISOString(),deadline_at:deadline}).eq('id',attempt.id).eq('status','ready').select().single();if(error)throw error;current=data;
    await supabase.from('attempt_events').insert({attempt_id:attempt.id,event_type:'started',payload:{}});
  }
  const {count}=await supabase.from('attempt_questions').select('id',{count:'exact',head:true}).eq('attempt_id',attempt.id);
  return json(req,{status:current.status,attempt:{id:current.id,startedAt:current.started_at,deadlineAt:current.deadline_at,answeredCount:current.answered_count,totalQuestions:count||0},serverNow:new Date().toISOString()});
}

async function assetUrls(metadata:any){
  const ids=Array.isArray(metadata?.asset_ids)?metadata.asset_ids.filter(Boolean):[];if(!ids.length)return [];
  const {data:assets,error}=await supabase.from('exam_assets').select('*').in('id',ids).is('deleted_at',null);if(error)throw error;
  const out=[];for(const asset of assets||[]){if(asset.provider!=='supabase')continue;const {data:signed}=await supabase.storage.from(asset.bucket).createSignedUrl(asset.object_path,600);if(signed?.signedUrl)out.push({id:asset.id,kind:asset.kind,mimeType:asset.mime_type,url:signed.signedUrl});}return out;
}

async function question(req:Request,body:any){
  const {attempt}=await authenticate(req);if(attempt.status!=='in_progress')return json(req,{error:'Bài thi chưa ở trạng thái làm bài.'},409);
  if(attempt.deadline_at&&Date.now()>Date.parse(attempt.deadline_at))return submit(req,true);
  const displayNo=Number(body.displayNo);const {data:aq,error}=await supabase.from('attempt_questions').select('*').eq('attempt_id',attempt.id).eq('display_no',displayNo).maybeSingle();if(error)throw error;if(!aq)return json(req,{error:'Không tìm thấy câu hỏi.'},404);
  if(!aq.first_seen_at)await supabase.from('attempt_questions').update({first_seen_at:new Date().toISOString()}).eq('id',aq.id).is('first_seen_at',null);
  const {data:qv,error:qErr}=await supabase.from('question_versions').select('id,body_html,choices,metadata,points').eq('id',aq.question_version_id).single();if(qErr)throw qErr;
  const byKey=new Map((qv.choices||[]).map((c:any)=>[String(c.key),c]));const choices=(aq.choice_order||[]).map((k:string)=>byKey.get(String(k))).filter(Boolean);
  let group=null;if(aq.group_version_id){const {data:gv}=await supabase.from('question_group_versions').select('id,part_label,title,body_html,metadata').eq('id',aq.group_version_id).single();if(gv)group={...gv,assets:await assetUrls(gv.metadata)};}
  const {data:answer}=await supabase.from('attempt_answers').select('selected_key,client_seq').eq('attempt_question_id',aq.id).maybeSingle();
  return json(req,{question:{attemptQuestionId:aq.id,displayNo:aq.display_no,bodyHtml:qv.body_html,choices,assets:await assetUrls(qv.metadata),selectedKey:answer?.selected_key||null,clientSeq:answer?.client_seq||0},group,deadlineAt:attempt.deadline_at,serverNow:new Date().toISOString()});
}

async function saveAnswer(req:Request,body:any){
  const {attempt}=await authenticate(req);if(attempt.status!=='in_progress')return json(req,{error:'Bài thi không ở trạng thái cho phép lưu.'},409);if(attempt.deadline_at&&Date.now()>Date.parse(attempt.deadline_at))return json(req,{error:'Đã hết thời gian làm bài.'},410);
  const aqId=String(body.attemptQuestionId||''),selectedKey=body.selectedKey==null?null:String(body.selectedKey),clientSeq=Math.max(0,Number(body.clientSeq||0));
  const {data:aq,error}=await supabase.from('attempt_questions').select('*').eq('id',aqId).eq('attempt_id',attempt.id).maybeSingle();if(error)throw error;if(!aq)return json(req,{error:'Câu hỏi không thuộc bài thi.'},403);
  if(selectedKey!==null){const {data:qv}=await supabase.from('question_versions').select('choices').eq('id',aq.question_version_id).single();const keys=(qv?.choices||[]).map((x:any)=>String(x.key));if(!keys.includes(selectedKey))return json(req,{error:'Lựa chọn không hợp lệ.'},400);}
  const {data:old}=await supabase.from('attempt_answers').select('*').eq('attempt_question_id',aq.id).maybeSingle();if(old&&Number(old.client_seq)>clientSeq)return json(req,{ok:true,ignored:true,savedAt:old.saved_at});
  const {data,error:upErr}=await supabase.from('attempt_answers').upsert({attempt_question_id:aq.id,selected_key:selectedKey,client_seq:clientSeq,saved_at:new Date().toISOString()},{onConflict:'attempt_question_id'}).select().single();if(upErr)throw upErr;
  return json(req,{ok:true,savedAt:data.saved_at,clientSeq:data.client_seq});
}

async function heartbeat(req:Request,body:any){
  const {attempt}=await authenticate(req);if(attempt.status==='in_progress'&&attempt.deadline_at&&Date.now()>Date.parse(attempt.deadline_at))return submit(req,true);
  if(body.eventPayload&&typeof body.eventPayload==='object'&&Object.keys(body.eventPayload).length){await supabase.from('attempt_events').insert({attempt_id:attempt.id,event_type:'heartbeat_note',payload:body.eventPayload});}
  return json(req,{ok:true,status:attempt.status,deadlineAt:attempt.deadline_at,serverNow:new Date().toISOString()});
}

async function recordEvent(req:Request,body:any){
  const {attempt}=await authenticate(req);const eventType=String(body.eventType||'');if(!EVENT_TYPES.has(eventType))return json(req,{error:'Loại sự kiện không hợp lệ.'},400);
  const payload=body.payload&&typeof body.payload==='object'?body.payload:{};await supabase.from('attempt_events').insert({attempt_id:attempt.id,event_type:eventType,payload});return json(req,{ok:true});
}

async function submit(req:Request,auto=false){
  const {attempt}=await authenticate(req);if(attempt.status==='submitted')return json(req,{status:'submitted',score:attempt.score});if(!['in_progress','locked','expired'].includes(attempt.status))return json(req,{error:'Bài thi chưa thể nộp.'},409);
  const {data:aqs,error:qErr}=await supabase.from('attempt_questions').select('id,question_version_id').eq('attempt_id',attempt.id);if(qErr)throw qErr;
  const ids=(aqs||[]).map(x=>x.id),qvIds=(aqs||[]).map(x=>x.question_version_id);
  const [{data:answers,error:aErr},{data:qvs,error:vErr}]=await Promise.all([
    ids.length?supabase.from('attempt_answers').select('*').in('attempt_question_id',ids):Promise.resolve({data:[],error:null} as any),
    qvIds.length?supabase.from('question_versions').select('id,correct_key,points').in('id',qvIds):Promise.resolve({data:[],error:null} as any)
  ]);if(aErr)throw aErr;if(vErr)throw vErr;
  const ansMap=new Map((answers||[]).map((x:any)=>[x.attempt_question_id,x.selected_key]));const qvMap=new Map((qvs||[]).map((x:any)=>[x.id,x]));let score=0,correct=0,answered=0;
  for(const aq of aqs||[]){const selected=ansMap.get(aq.id);if(selected!=null)answered++;const qv=qvMap.get(aq.question_version_id);if(qv&&selected===qv.correct_key){correct++;score+=Number(qv.points||0);}}
  const status='submitted',submittedAt=new Date().toISOString();const {data:done,error:dErr}=await supabase.from('exam_attempts').update({status,submitted_at:submittedAt,score,correct_count:correct,answered_count:answered}).eq('id',attempt.id).select().single();if(dErr)throw dErr;
  await supabase.from('attempt_events').insert({attempt_id:attempt.id,event_type:auto?'auto_submitted':'submitted',payload:{score,correct,answered}});
  await supabase.from('attempt_sessions').update({revoked_at:submittedAt}).eq('attempt_id',attempt.id).is('revoked_at',null);
  const ctx=await contextFromAttempt(done);const show=ctx.exam.score_visibility==='immediate'||(ctx.exam.score_visibility==='after_close'&&ctx.exam.status==='closed');
  return json(req,{status:'submitted',score:show?score:null,scoreVisible:show,correctCount:show?correct:null,answeredCount:answered,submittedAt});
}

async function resume(req:Request){
  const {attempt}=await authenticate(req);const ctx=await contextFromAttempt(attempt);const {count}=await supabase.from('attempt_questions').select('id',{count:'exact',head:true}).eq('attempt_id',attempt.id);
  const show=attempt.status==='submitted'&&(ctx.exam.score_visibility==='immediate'||(ctx.exam.score_visibility==='after_close'&&ctx.exam.status==='closed'));
  return json(req,{status:attempt.status,student:{studentCode:ctx.student.student_code,fullName:ctx.student.full_name,className:ctx.student.class_name},exam:{id:ctx.exam.id,name:ctx.exam.name,subjectName:ctx.exam.subject_name,type:ctx.exam.exam_type},session:{id:ctx.session.id,name:ctx.session.name,startsAt:ctx.session.starts_at,endsAt:ctx.session.ends_at,durationMinutes:ctx.session.duration_minutes},room:{id:ctx.room.id,name:ctx.room.name},attempt:{id:attempt.id,status:attempt.status,startedAt:attempt.started_at,deadlineAt:attempt.deadline_at,answeredCount:attempt.answered_count,totalQuestions:count||0,score:show?attempt.score:null},serverNow:new Date().toISOString()});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  try{
    const body=await req.json().catch(()=>({}));const action=String(body.action||'');
    if(action==='login')return login(req,body);
    if(action==='resume')return resume(req);
    if(action==='start')return start(req);
    if(action==='question')return question(req,body);
    if(action==='save-answer')return saveAnswer(req,body);
    if(action==='heartbeat')return heartbeat(req,body);
    if(action==='event')return recordEvent(req,body);
    if(action==='submit')return submit(req,false);
    return json(req,{error:'Action không hợp lệ.'},400);
  }catch(error){console.error(error);const status=Number((error as any)?.status||500);return json(req,{error:status>=500?'Máy chủ đang gặp lỗi. Vui lòng báo giám thị.':String((error as any)?.message||'Có lỗi xảy ra.')},status);}
});
