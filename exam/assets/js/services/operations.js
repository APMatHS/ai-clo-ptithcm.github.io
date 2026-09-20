import { invokeFunction } from '../core/supabase.js';

const FN='exam-operations';
const call=(action,payload={})=>invokeFunction(FN,{action,...payload});

export const operations={
  importRoster:(examId,rows)=>call('import-roster',{examId,rows}),
  generateCodes:(examId,studentIds=[])=>call('generate-codes',{examId,studentIds}),
  transferDevice:(attemptId)=>call('transfer-device',{attemptId}),
  lockAttempt:(attemptId,reason='')=>call('lock-attempt',{attemptId,reason}),
  unlockAttempt:(attemptId)=>call('unlock-attempt',{attemptId}),
  reopenAttempt:(attemptId,extraMinutes=5)=>call('reopen-attempt',{attemptId,extraMinutes})
};
