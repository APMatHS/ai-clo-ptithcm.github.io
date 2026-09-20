import { supabase } from '../core/supabase.js';
import { getLiveAttempts } from './exams.js';

export async function loadLiveExam(examId){
  const attempts=await getLiveAttempts(examId);
  const ids=attempts.map(x=>x.id);
  let events=[];
  if(ids.length){
    const since=new Date(Date.now()-30*60_000).toISOString();
    const {data,error}=await supabase.from('attempt_events').select('id,attempt_id,event_type,payload,created_at').in('attempt_id',ids).gte('created_at',since).order('created_at',{ascending:false}).limit(500);
    if(error)throw error;events=data||[];
  }
  const eventCount=new Map();
  for(const ev of events){if(['tab_hidden','focus_lost','reload','device_change','offline'].includes(ev.event_type))eventCount.set(ev.attempt_id,(eventCount.get(ev.attempt_id)||0)+1);}
  return {attempts:attempts.map(a=>({...a,warningCount:eventCount.get(a.id)||0})),events};
}

export async function getAttemptEvents(attemptId,limit=80){
  const {data,error}=await supabase.from('attempt_events').select('*').eq('attempt_id',attemptId).order('created_at',{ascending:false}).limit(limit);
  if(error)throw error;return data||[];
}
