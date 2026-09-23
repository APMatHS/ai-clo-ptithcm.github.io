import { createClient } from "jsr:@supabase/supabase-js@2.116.0";

const URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const ORIGINS=new Set(['https://ai-clo-ptithcm.github.io','https://apmaths.github.io']);

function cors(req:Request){const o=req.headers.get('origin')||'';const ok=ORIGINS.has(o)||o.startsWith('http://localhost:')||o.startsWith('http://127.0.0.1:');return {'Access-Control-Allow-Origin':ok?o:'https://ai-clo-ptithcm.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Vary':'Origin'};}
function out(req:Request,body:any,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)});}

async function actor(req:Request){const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)throw Object.assign(new Error('Chưa đăng nhập.'),{status:401});const {data,error}=await db.auth.getUser(jwt);if(error||!data.user)throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'),{status:401});const {data:p,error:pe}=await db.from('profiles').select('*').eq('id',data.user.id).maybeSingle();if(pe)throw pe;if(!p?.active)throw Object.assign(new Error('Tài khoản chưa được kích hoạt.'),{status:403});return {user:data.user,profile:p};}
async function canManageSession(a:any,examId:string,sessionId:string){if(a.profile.system_role==='admin')return true;const {data,error}=await db.from('exam_members').select('exam_role,permissions').eq('exam_id',examId).eq('user_id',a.user.id).maybeSingle();if(error)throw error;if(!data)return false;return data.exam_role==='owner'||(data.permissions||[]).includes('manage_paper')||(data.permissions||[]).includes(`manage_paper@${sessionId}`);}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return out(req,{error:'Method not allowed'},405);
  try{
    const b=await req.json().catch(()=>({}));
    const examId=String(b.examId||''),questionId=String(b.questionId||''),newQuestionVersionId=String(b.newQuestionVersionId||''),newPaperVersionId=String(b.newPaperVersionId||'');
    const a=await actor(req);
    const qv=await db.from('question_versions').select('id,question_id').eq('id',newQuestionVersionId).single();if(qv.error)throw qv.error;if(qv.data.question_id!==questionId)return out(req,{error:'Phiên bản câu hỏi không khớp.'},400);
    const pv=await db.from('exam_paper_versions').select('id,paper_id,version_no').eq('id',newPaperVersionId).single();if(pv.error)throw pv.error;
    const paper=await db.from('exam_papers').select('id,session_id').eq('id',pv.data.paper_id).single();if(paper.error)throw paper.error;
    const session=await db.from('exam_sessions').select('id,exam_id').eq('id',paper.data.session_id).single();if(session.error)throw session.error;if(session.data.exam_id!==examId)return out(req,{error:'Đề không thuộc kỳ thi.'},400);
    if(!await canManageSession(a,examId,session.data.id))return out(req,{error:'Bạn không có quyền sửa đề của ca này.'},403);
    const ready=await db.from('exam_attempts').select('id').eq('session_id',session.data.id).eq('status','ready');if(ready.error)throw ready.error;
    if(ready.data?.length){const u=await db.from('exam_attempts').update({paper_version_id:newPaperVersionId}).in('id',ready.data.map(x=>x.id));if(u.error)throw u.error;}
    const active=await db.from('exam_attempts').select('id').eq('session_id',session.data.id).in('status',['in_progress','locked']);if(active.error)throw active.error;
    let seen=0,updated=0;
    if(active.data?.length){const qs=await db.from('attempt_questions').select('id,first_seen_at').eq('question_id',questionId).in('attempt_id',active.data.map(x=>x.id));if(qs.error)throw qs.error;seen=(qs.data||[]).filter(x=>x.first_seen_at).length;const unseen=(qs.data||[]).filter(x=>!x.first_seen_at).map(x=>x.id);if(unseen.length){const u=await db.from('attempt_questions').update({question_version_id:newQuestionVersionId}).in('id',unseen);if(u.error)throw u.error;updated=unseen.length;}}
    await db.from('audit_logs').insert({actor_user_id:a.user.id,exam_id:examId,action:'paper_hotfix',entity_type:'question',entity_id:questionId,payload:{sessionId:session.data.id,newQuestionVersionId,newPaperVersionId,readyAttemptsUpdated:ready.data?.length||0,unseenAttemptsUpdated:updated,alreadySeenKeptOld:seen}});
    return out(req,{ok:true,readyAttemptsUpdated:ready.data?.length||0,unseenAttemptsUpdated:updated,alreadySeenKeptOld:seen});
  }catch(e){console.error(e);const status=Number((e as any)?.status||500);return out(req,{error:status>=500?'Máy chủ đang gặp lỗi.':String((e as any)?.message||'Có lỗi xảy ra.')},status);}
});