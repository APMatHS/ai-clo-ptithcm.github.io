import { supabase } from '../core/supabase.js';

const fail=(error)=>{if(error) throw error;};

export async function listExams(){
  const {data,error}=await supabase.from('exams').select('*').order('created_at',{ascending:false});
  fail(error);return data||[];
}

export async function createExam(payload,userId){
  const row={
    code:payload.code.trim().toUpperCase(),name:payload.name.trim(),subject_group:payload.subject_group,
    subject_name:payload.subject_name.trim(),exam_type:payload.exam_type,academic_year:payload.academic_year?.trim()||null,
    semester:payload.semester?.trim()||null,score_visibility:payload.score_visibility||'hidden',
    retention_days:Number(payload.retention_days||30),created_by:userId
  };
  const {data,error}=await supabase.from('exams').insert(row).select().single();
  fail(error);return data;
}

export async function getExam(examId){
  const [{data:exam,error:examError},{data:member,error:memberError}]=await Promise.all([
    supabase.from('exams').select('*').eq('id',examId).single(),
    supabase.from('exam_members').select('*,profiles:user_id(id,full_name,email,system_role)').eq('exam_id',examId)
  ]);
  fail(examError);fail(memberError);
  return {exam,members:member||[]};
}

export async function listSessions(examId){
  const {data,error}=await supabase.from('exam_sessions').select('*,exam_rooms(id,name,capacity,location_note)').eq('exam_id',examId).order('starts_at');
  fail(error);return data||[];
}

export async function createSession(examId,payload){
  const start=new Date(payload.starts_at);const end=new Date(payload.ends_at);
  const duration=Math.max(1,Number(payload.duration_minutes||Math.round((end-start)/60000)));
  const {data,error}=await supabase.from('exam_sessions').insert({exam_id:examId,name:payload.name.trim(),starts_at:start.toISOString(),ends_at:end.toISOString(),duration_minutes:duration,status:'draft',instructions_html:payload.instructions_html||null}).select().single();
  fail(error);return data;
}

export async function createRoom(sessionId,payload){
  const {data,error}=await supabase.from('exam_rooms').insert({session_id:sessionId,name:payload.name.trim(),capacity:payload.capacity?Number(payload.capacity):null,location_note:payload.location_note?.trim()||null}).select().single();
  fail(error);return data;
}

export async function getMembership(examId,userId){
  if(!userId) return null;
  const {data,error}=await supabase.from('exam_members').select('*').eq('exam_id',examId).eq('user_id',userId).maybeSingle();
  fail(error);return data;
}

export async function listRoster(examId){
  const {data,error}=await supabase.from('exam_students').select('*,exam_rooms(name),exam_sessions(name,starts_at)').eq('exam_id',examId).order('student_code');
  fail(error);return data||[];
}

export async function getLiveAttempts(examId){
  const {data:sessions,error:sError}=await supabase.from('exam_sessions').select('id').eq('exam_id',examId);
  fail(sError);const ids=(sessions||[]).map(x=>x.id);if(!ids.length)return [];
  const {data,error}=await supabase.from('exam_attempts').select('id,status,answered_count,last_saved_at,started_at,deadline_at,locked_reason,room_id,exam_students!inner(student_code,full_name,class_name),exam_rooms(name)').in('session_id',ids).order('last_saved_at',{ascending:false,nullsFirst:false});
  fail(error);return data||[];
}

export async function setAttemptStatus(attemptId,status,reason=null){
  const patch={status};
  if(status==='locked'){patch.locked_at=new Date().toISOString();patch.locked_reason=reason||'Giám thị khóa bài';}
  if(status==='in_progress'){patch.locked_at=null;patch.locked_reason=null;}
  const {data,error}=await supabase.from('exam_attempts').update(patch).eq('id',attemptId).select().single();
  fail(error);return data;
}
