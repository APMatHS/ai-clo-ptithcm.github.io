export const OWNER_PERMISSIONS=new Set(['view_exam','manage_exam','manage_members','manage_sessions','manage_roster','manage_paper','manage_live','view_results','export_results','view_correct_answers','manage_assets']);

export function isSystemAdmin(profile){return !!profile?.active&&profile.system_role==='admin';}
export function hasPermission(profile,membership,permission){
  if(isSystemAdmin(profile)) return true;
  if(!profile?.active||!membership) return false;
  if(membership.exam_role==='owner') return true;
  return Array.isArray(membership.permissions)&&membership.permissions.includes(permission);
}
export function canCreateExam(profile){return !!profile?.active&&['admin','exam_officer','teacher'].includes(profile.system_role);}
export function roleLabel(role){return ({admin:'Admin',exam_officer:'Khảo thí',teacher:'Giảng viên',proctor:'Giám thị'})[role]||role||'—';}
export function examRoleLabel(role){return ({owner:'Chủ kỳ thi',manager:'Đồng quản lý',author:'Ra đề',proctor:'Giám thị',viewer:'Chỉ xem'})[role]||role||'—';}
