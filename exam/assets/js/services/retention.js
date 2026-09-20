import { invokeFunction } from '../core/supabase.js';

const call=(action,payload={})=>invokeFunction('exam-retention',{action,...payload});
export const retentionService={
  preview:(examId)=>call('preview',{examId}),
  purge:(examId,confirmCode,archiveConfirmed)=>call('purge',{examId,confirmCode,archiveConfirmed})
};
