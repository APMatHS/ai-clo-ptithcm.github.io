import { createClient } from "jsr:@supabase/supabase-js@2.116.0";

const URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const ORIGINS=new Set(['https://ai-clo-ptithcm.github.io','https://apmaths.github.io']);
const encoder=new TextEncoder();

function cors(req:Request){
  const origin=req.headers.get('origin')||'';
  const ok=ORIGINS.has(origin)||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin':ok?origin:'https://ai-clo-ptithcm.github.io',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Content-Type':'application/json; charset=utf-8',
    'Vary':'Origin'
  };
}
function out(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)});}
async function sha256(value:string){const data=await crypto.subtle.digest('SHA-256',encoder.encode(value));return [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,'0')).join('');}

async function emptySystem(){
  const [{data:users,error:userError},{count:profiles,error:profileError}]=await Promise.all([
    db.auth.admin.listUsers({page:1,perPage:1}),
    db.from('profiles').select('id',{count:'exact',head:true})
  ]);
  if(userError)throw userError;if(profileError)throw profileError;
  return {empty:(users.users?.length||0)===0&&(profiles||0)===0,userCount:users.users?.length||0,profileCount:profiles||0};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return out(req,{error:'Method not allowed'},405);
  try{
    const body=await req.json().catch(()=>({}));
    const state=await emptySystem();
    if(String(body.action||'')==='status')return out(req,{available:state.empty});
    if(!state.empty)return out(req,{error:'Bootstrap Admin đã đóng vì hệ thống đã có tài khoản.'},409);

    const email=String(body.email||'').trim().toLowerCase();
    const fullName=String(body.fullName||'').trim();
    const password=String(body.password||'');
    const bootstrapCode=String(body.bootstrapCode||'').trim();
    if(!email||!fullName||password.length<12||!bootstrapCode)return out(req,{error:'Vui lòng nhập đủ thông tin; mật khẩu tối thiểu 12 ký tự.'},400);

    const tokenHash=await sha256(bootstrapCode);
    const {data:token,error:tokenError}=await db.from('admin_bootstrap_tokens').select('id,expires_at,used_at').eq('token_hash',tokenHash).is('used_at',null).maybeSingle();
    if(tokenError)throw tokenError;
    if(!token||Date.now()>=Date.parse(token.expires_at))return out(req,{error:'Mã bootstrap không hợp lệ hoặc đã hết hạn.'},403);

    const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName}});
    if(created.error)throw created.error;
    const user=created.data.user;
    try{
      const profile=await db.from('profiles').upsert({id:user.id,email,full_name:fullName,system_role:'admin',active:true},{onConflict:'id'}).select().single();
      if(profile.error)throw profile.error;
      const usedAt=new Date().toISOString();
      const disabled=await db.from('admin_bootstrap_tokens').update({used_at:usedAt}).is('used_at',null);
      if(disabled.error)throw disabled.error;
      await db.from('audit_logs').insert({actor_user_id:user.id,action:'first_admin_bootstrap',entity_type:'profile',entity_id:user.id,payload:{email}});
      return out(req,{ok:true,email,fullName,role:'admin'});
    }catch(error){
      await db.auth.admin.deleteUser(user.id).catch(()=>{});
      throw error;
    }
  }catch(error){
    console.error(error);
    return out(req,{error:'Không thể khởi tạo Admin đầu tiên.'},500);
  }
});
