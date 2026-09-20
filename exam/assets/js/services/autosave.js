import { studentApi } from './student-api.js';

const prefix='ai-clo-exam:pending:';
const answerPrefix='ai-clo-exam:answers:';

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}

export function createAutosaveQueue(attemptId){
  const pendingKey=prefix+attemptId,answersKey=answerPrefix+attemptId;
  let pending=readJson(pendingKey,[]),answers=readJson(answersKey,{}),flushing=false;
  const persist=()=>{writeJson(pendingKey,pending);writeJson(answersKey,answers);};
  const enqueue=({attemptQuestionId,selectedKey,clientSeq,displayNo})=>{
    answers[displayNo]={attemptQuestionId,selectedKey,clientSeq};
    pending=pending.filter(x=>x.attemptQuestionId!==attemptQuestionId);
    pending.push({attemptQuestionId,selectedKey,clientSeq,displayNo,queuedAt:Date.now()});
    persist();return flush();
  };
  const flush=async()=>{
    if(flushing||!navigator.onLine||!pending.length)return {pending:pending.length};
    flushing=true;
    try{
      while(pending.length&&navigator.onLine){const item=pending[0];try{await studentApi.saveAnswer(item.attemptQuestionId,item.selectedKey,item.clientSeq);pending.shift();persist();}catch(e){break;}}
    }finally{flushing=false;}
    return {pending:pending.length};
  };
  const clear=()=>{pending=[];answers={};try{localStorage.removeItem(pendingKey);localStorage.removeItem(answersKey);}catch{}};
  return {enqueue,flush,clear,getPendingCount:()=>pending.length,getAnswer:displayNo=>answers[displayNo]||null,getAnswers:()=>({...answers})};
}
