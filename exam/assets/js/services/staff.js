import { supabase,invokeFunction } from '../core/supabase.js';

export async function listAllStaff(){const {data,error}=await supabase.from('profiles').select('*').order('created_at',{ascending:true});if(error)throw error;return data||[];}
export const staffAdmin={
  create:(email,fullName,role)=>invokeFunction('staff-admin',{action:'create',email,fullName,role}),
  update:(userId,role,active)=>invokeFunction('staff-admin',{action:'update',userId,role,active}),
  resetPassword:userId=>invokeFunction('staff-admin',{action:'reset-password',userId})
};
