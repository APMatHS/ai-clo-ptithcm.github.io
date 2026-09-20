import { supabase } from '../core/supabase.js';

const fail=e=>{if(e)throw e;};
export async function listStaff(){const {data,error}=await supabase.from('profiles').select('id,email,full_name,system_role,active').eq('active',true).order('full_name');fail(error);return data||[];}
export async function saveExamMember(examId,userId,examRole,permissions=[]){const safe=[...new Set(['view_exam',...permissions])];const {data,error}=await supabase.from('exam_members').upsert({exam_id:examId,user_id:userId,exam_role:examRole,permissions:safe},{onConflict:'exam_id,user_id'}).select().single();fail(error);return data;}
export async function removeExamMember(id){const {error}=await supabase.from('exam_members').delete().eq('id',id);fail(error);}
export async function assignRoomStaff(roomId,userId,settings={}){const row={room_id:roomId,user_id:userId,can_lock:settings.can_lock??true,can_reopen:settings.can_reopen??true,can_transfer_device:settings.can_transfer_device??true};const {data,error}=await supabase.from('exam_room_staff').upsert(row,{onConflict:'room_id,user_id'}).select().single();fail(error);return data;}
export async function removeRoomStaff(roomId,userId){const {error}=await supabase.from('exam_room_staff').delete().eq('room_id',roomId).eq('user_id',userId);fail(error);}
export async function listRoomStaff(roomIds=[]){if(!roomIds.length)return[];const {data,error}=await supabase.from('exam_room_staff').select('*,profiles:user_id(id,full_name,email,system_role)').in('room_id',roomIds);fail(error);return data||[];}
