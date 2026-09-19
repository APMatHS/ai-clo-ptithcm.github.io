/* AI-CLO OLYMPIC: keep lesson detail routes inside their current subject. */
(()=>{
  'use strict';
  const page=document.body?.dataset?.olympicPage;
  const subjectCode=document.body?.dataset?.subject;
  const lessonId=new URLSearchParams(location.search).get('id');
  if(page!=='lessons'||!subjectCode||!lessonId)return;

  async function findContent(){
    for(let i=0;i<80;i++){
      const node=document.querySelector('#olyContent');
      if(node)return node;
      await new Promise(r=>setTimeout(r,25));
    }
    return null;
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      const cfg=window.AICLO_CONFIG||{};
      if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
      const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
      const subject=await db.from('olympic_subjects').select('id').eq('code',subjectCode).maybeSingle();
      if(subject.error||!subject.data)return;
      const lesson=await db.from('olympic_lessons').select('id').eq('id',lessonId).eq('subject_id',subject.data.id).maybeSingle();
      if(lesson.error||lesson.data)return;
      const node=await findContent();
      if(!node)return;
      node.innerHTML='<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Không tìm thấy bài học trong môn này.</b><span>Liên kết bài học không thuộc đúng môn hiện tại hoặc đã bị ẩn.</span></div>';
    }catch(e){
      console.warn('Olympic lesson subject guard:',e);
    }
  });
})();
