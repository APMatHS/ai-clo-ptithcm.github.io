import { CONFIG } from '../config.js';

const supabaseBrowser=globalThis.supabase;
if(!supabaseBrowser?.createClient){
  throw new Error('Thư viện Supabase chưa được tải. Hãy tải lại trang hoặc kiểm tra kết nối CDN.');
}

export const supabase = supabaseBrowser.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  realtime:{params:{eventsPerSecond:4}},
  global:{headers:{'X-Client-Info':'ai-clo-exam/1.0'}}
});

export async function getStaffContext(){
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError) throw sessionError;
  if(!session) return {session:null,profile:null};
  const {data:profile,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(error) throw error;
  return {session,profile};
}

export async function signInStaff(email,password){
  const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  if(error) throw error;
  return data;
}

export async function signOutStaff(){
  const {error}=await supabase.auth.signOut();
  if(error) throw error;
}

export async function invokeFunction(name,body,options={}){
  const {data,error}=await supabase.functions.invoke(name,{body,...options});
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data;
}
