export const OWNER_PERMISSIONS=new Set(['view_exam','manage_exam','manage_members','manage_sessions','manage_roster','manage_paper','manage_live','view_results','export_results','view_correct_answers','manage_assets']);

export function isSystemAdmin(profile){return !!profile?.active&&profile.system_role==='admin';}
export function hasPermission(profile,membership,permission){
  if(isSystemAdmin(profile)) return true;
  if(!profile?.active||!membership) return false;
  if(membership.exam_role==='owner') return true;
  return Array.isArray(membership.permissions)&&membership.permissions.includes(permission);
}
export function hasSessionPermission(profile,membership,sessionId,permission){
  if(isSystemAdmin(profile)) return true;
  if(!profile?.active||!membership||!sessionId) return false;
  if(membership.exam_role==='owner') return true;
  const perms=Array.isArray(membership.permissions)?membership.permissions:[];
  return perms.includes(permission)||perms.includes(`${permission}@${sessionId}`);
}
export function hasAnyPermission(profile,membership,permission){
  if(isSystemAdmin(profile)) return true;
  if(!profile?.active||!membership) return false;
  if(membership.exam_role==='owner') return true;
  const perms=Array.isArray(membership.permissions)?membership.permissions:[];
  return perms.includes(permission)||perms.some(x=>String(x).startsWith(`${permission}@`));
}
export function scopedPermission(permission,sessionId){return `${permission}@${sessionId}`;}
export function canCreateExam(profile){return isSystemAdmin(profile);}
export function roleLabel(role){return ({admin:'Admin',exam_officer:'Khảo thí',teacher:'Giảng viên (thời vụ)',proctor:'Giám thị (thời vụ)'})[role]||role||'—';}
export function examRoleLabel(role){return ({owner:'Chủ kỳ thi',manager:'Khảo thí / quản lý',author:'Giảng viên / ra đề',proctor:'Giám thị',viewer:'Chỉ xem'})[role]||role||'—';}
