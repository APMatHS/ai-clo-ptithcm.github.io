import { invokeFunction } from '../core/supabase.js';

export const setExamStatus=(examId,status)=>invokeFunction('exam-lifecycle',{action:'set-status',examId,status});
