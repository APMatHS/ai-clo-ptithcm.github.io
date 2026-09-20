import { invokeFunction } from '../core/supabase.js';

export const runPreflight=examId=>invokeFunction('exam-preflight',{examId});
