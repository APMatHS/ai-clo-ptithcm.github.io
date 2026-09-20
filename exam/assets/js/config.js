export const CONFIG = Object.freeze({
  appName:'AI-CLO EXAM',
  supabaseUrl:'https://unpqmttdkmmbnmmcfqbj.supabase.co',
  supabasePublishableKey:'sb_publishable_wHA6FYHcS47A5dC9iWfvuw_KBZsQBJk',
  supabaseJsVersion:'2.116.0',
  storageBucket:'exam-files',
  studentFunction:'student-exam',
  heartbeatMs:15000,
  liveRefreshMs:5000,
  autosaveDebounceMs:350,
  defaultRetentionDays:30,
  allowedStaffRoles:['admin','exam_officer','teacher','proctor'],
  permissions:[
    'view_exam','manage_exam','manage_members','manage_sessions','manage_roster','manage_paper',
    'manage_live','view_results','export_results','view_correct_answers','manage_assets'
  ]
});
