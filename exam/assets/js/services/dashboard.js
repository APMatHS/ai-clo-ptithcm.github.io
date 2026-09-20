import { supabase } from '../core/supabase.js';

export async function dashboardData(){
  const now=new Date().toISOString();
  const [examsRes,sessionsRes,attemptsRes]=await Promise.all([
    supabase.from('exams').select('id,status,exam_type,subject_group,name,subject_name,created_at').order('created_at',{ascending:false}),
    supabase.from('exam_sessions').select('id,exam_id,name,starts_at,ends_at,status,exams(name,subject_name)').gte('ends_at',now).order('starts_at').limit(8),
    supabase.from('exam_attempts').select('id,status',{count:'exact'})
  ]);
  if(examsRes.error)throw examsRes.error;if(sessionsRes.error)throw sessionsRes.error;if(attemptsRes.error)throw attemptsRes.error;
  const exams=examsRes.data||[],attempts=attemptsRes.data||[];
  return {exams,upcoming:sessionsRes.data||[],stats:{exams:exams.length,live:exams.filter(x=>x.status==='live').length,upcoming:(sessionsRes.data||[]).length,attempts:attempts.length}};
}
