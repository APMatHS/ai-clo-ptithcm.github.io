import { supabase } from '../core/supabase.js';

const fail=e=>{if(e)throw e;};

export async function getPaperWorkspace(sessionId){
  const {data:paper,error:pErr}=await supabase.from('exam_papers').select('*').eq('session_id',sessionId).maybeSingle();fail(pErr);if(!paper)return {paper:null,version:null,items:[],groups:[]};
  const {data:versions,error:vErr}=await supabase.from('exam_paper_versions').select('*').eq('paper_id',paper.id).order('version_no',{ascending:false});fail(vErr);const version=versions?.[0]||null;if(!version)return {paper,version:null,items:[],groups:[]};
  const {data:links,error:lErr}=await supabase.from('paper_version_questions').select('*').eq('paper_version_id',version.id).order('order_no');fail(lErr);
  const qvIds=(links||[]).map(x=>x.question_version_id),qIds=(links||[]).map(x=>x.question_id),gvIds=[...new Set((links||[]).map(x=>x.group_version_id).filter(Boolean))];
  const [qvRes,qRes,gvRes,gRes]=await Promise.all([
    qvIds.length?supabase.from('question_versions').select('*').in('id',qvIds):Promise.resolve({data:[],error:null}),
    qIds.length?supabase.from('questions').select('*').in('id',qIds):Promise.resolve({data:[],error:null}),
    gvIds.length?supabase.from('question_group_versions').select('*').in('id',gvIds):Promise.resolve({data:[],error:null}),
    supabase.from('question_groups').select('*').eq('paper_id',paper.id).order('created_at')
  ]);fail(qvRes.error);fail(qRes.error);fail(gvRes.error);fail(gRes.error);
  const qvMap=new Map((qvRes.data||[]).map(x=>[x.id,x])),qMap=new Map((qRes.data||[]).map(x=>[x.id,x])),gvMap=new Map((gvRes.data||[]).map(x=>[x.id,x]));
  const items=(links||[]).map(l=>({...l,question:qMap.get(l.question_id),questionVersion:qvMap.get(l.question_version_id),groupVersion:l.group_version_id?gvMap.get(l.group_version_id):null}));
  const groups=[];for(const g of gRes.data||[]){const {data:latest}=await supabase.from('question_group_versions').select('*').eq('group_id',g.id).order('version_no',{ascending:false}).limit(1).maybeSingle();groups.push({...g,latestVersion:latest||null});}
  return {paper,versions:versions||[],version,items,groups};
}

export async function createPaper(sessionId,{title,structureMode='generic'},userId){
  const {data:paper,error}=await supabase.from('exam_papers').insert({session_id:sessionId,title,structure_mode:structureMode,shuffle_questions:true,shuffle_choices:true,created_by:userId}).select().single();fail(error);
  const {data:version,error:vErr}=await supabase.from('exam_paper_versions').insert({paper_id:paper.id,version_no:1,status:'draft',change_note:'Bản khởi tạo',created_by:userId}).select().single();fail(vErr);return {paper,version};
}

export async function addGroup(paperId,payload,userId){
  const {data:g,error}=await supabase.from('question_groups').insert({paper_id:paperId,code:payload.code||null,group_type:payload.group_type||'part',shuffle_policy:payload.shuffle_policy||'fixed'}).select().single();fail(error);
  const {data:gv,error:ve}=await supabase.from('question_group_versions').insert({group_id:g.id,version_no:1,part_label:payload.part_label||null,title:payload.title||null,body_html:payload.body_html||null,metadata:payload.metadata||{},created_by:userId}).select().single();fail(ve);return {...g,latestVersion:gv};
}

export async function addQuestion(paper,version,payload,userId){
  if(version.status!=='draft')throw new Error('Chỉ thêm trực tiếp câu hỏi vào bản nháp. Hãy tạo hotfix/version mới.');
  const {data:q,error:qErr}=await supabase.from('questions').insert({paper_id:paper.id,group_id:payload.group_id||null,code:payload.code||null}).select().single();fail(qErr);
  const {data:qv,error:vErr}=await supabase.from('question_versions').insert({question_id:q.id,version_no:1,body_html:payload.body_html,choices:payload.choices,correct_key:payload.correct_key,points:Number(payload.points||1),metadata:payload.metadata||{},created_by:userId}).select().single();fail(vErr);
  const {data:last}=await supabase.from('paper_version_questions').select('order_no').eq('paper_version_id',version.id).order('order_no',{ascending:false}).limit(1).maybeSingle();
  const {data:link,error:lErr}=await supabase.from('paper_version_questions').insert({paper_version_id:version.id,question_id:q.id,question_version_id:qv.id,group_version_id:payload.group_version_id||null,order_no:Number(last?.order_no||0)+1}).select().single();fail(lErr);return {question:q,questionVersion:qv,link};
}

export async function updateDraftQuestion(link,payload,userId){
  const {data:current,error:cErr}=await supabase.from('question_versions').select('*').eq('id',link.question_version_id).single();fail(cErr);
  const {data:qv,error:vErr}=await supabase.from('question_versions').insert({question_id:current.question_id,version_no:Number(current.version_no)+1,body_html:payload.body_html,choices:payload.choices,correct_key:payload.correct_key,points:Number(payload.points||1),metadata:payload.metadata||{},created_by:userId}).select().single();fail(vErr);
  const {error:lErr}=await supabase.from('paper_version_questions').update({question_version_id:qv.id,group_version_id:payload.group_version_id||null}).eq('id',link.id);fail(lErr);return qv;
}

export async function lockPaperVersion(versionId){const {data,error}=await supabase.from('exam_paper_versions').update({status:'locked'}).eq('id',versionId).select().single();fail(error);return data;}

export async function cloneVersionForHotfix(paperId,currentVersion,userId,note='Hotfix'){
  const next=Number(currentVersion.version_no)+1;const {data:newVersion,error}=await supabase.from('exam_paper_versions').insert({paper_id:paperId,version_no:next,status:'hotfix',change_note:note,created_by:userId}).select().single();fail(error);
  const {data:links,error:lErr}=await supabase.from('paper_version_questions').select('*').eq('paper_version_id',currentVersion.id).order('order_no');fail(lErr);
  if(links?.length){const rows=links.map(x=>({paper_version_id:newVersion.id,question_id:x.question_id,question_version_id:x.question_version_id,group_version_id:x.group_version_id,order_no:x.order_no}));const {error:iErr}=await supabase.from('paper_version_questions').insert(rows);fail(iErr);}return newVersion;
}

export async function setPaperShuffle(paperId,{shuffleQuestions,shuffleChoices}){const {data,error}=await supabase.from('exam_papers').update({shuffle_questions:!!shuffleQuestions,shuffle_choices:!!shuffleChoices}).eq('id',paperId).select().single();fail(error);return data;}
