async function renderTeacherLessons(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  const qs=new URLSearchParams(location.search),requested=qs.get('subject')||preferredTeacherSubjectCode(),editId=qs.get('edit'),topicFilter=qs.get('topic')||'';
  const {sel,code,subject:s}=await resolveTeacherSubject(requested);
  if(!s){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  const tree=await loadTree(code);
  if(editId==='new'||editId){
    let lesson=null;
    if(editId!=='new'){
      const q=await db.from('olympic_lessons').select('*').eq('id',editId).eq('subject_id',s.id).maybeSingle();
      if(q.error)throw q.error;lesson=q.data;
      if(!lesson){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy bài học trong môn đã chọn.</b></div>';return}
    }
    return lessonEditor(c,s,tree.topics,lesson,code);
  }
  const r=await db.from('olympic_lessons').select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(id,title,section_id,order_index)').eq('subject_id',s.id).order('order_index');
  if(r.error)throw r.error;
  let list=r.data||[];
  if(topicFilter)list=list.filter(x=>x.topic_id===topicFilter);
  const sectionById=new Map(tree.sections.map(x=>[x.id,x]));
  const topicById=new Map(tree.topics.map(x=>[x.id,x]));
  list.sort((a,b)=>{
    const ta=topicById.get(a.topic_id),tb=topicById.get(b.topic_id),sa=sectionById.get(ta?.section_id),sb=sectionById.get(tb?.section_id);
    return (sa?.order_index??9999)-(sb?.order_index??9999)||(ta?.order_index??9999)-(tb?.order_index??9999)||(a.order_index??9999)-(b.order_index??9999)||String(a.title).localeCompare(String(b.title),'vi');
  });
  const currentTopic=topicFilter?topicById.get(topicFilter):null;
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div>${currentTopic?`<span class="oly-badge required">Mục · ${esc(currentTopic.title)}</span><a class="oly-btn small" href="${teacherUrl('lessons',code)}">Bỏ lọc</a>`:''}<a class="oly-btn primary" href="?subject=${encodeURIComponent(code)}&edit=new">+ Bài học</a></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Bài học</th><th>Nhóm</th><th>Mục nội dung</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody>${list.length?list.map(x=>{const t=topicById.get(x.topic_id),sec=sectionById.get(t?.section_id);return `<tr><td><b>${esc(x.title)}</b><br><span style="color:#829ab1">${esc(x.summary||'')}</span></td><td>${esc(sec?.name||'—')}</td><td>${esc(t?.title||x.topic?.title||'—')}</td><td><span class="oly-badge ${x.status}">${statusLabel(x.status)}</span></td><td>${new Date(x.updated_at).toLocaleDateString('vi-VN')}</td><td><a class="oly-btn small" href="${subjectFeatureUrl('lessons',code)}?id=${encodeURIComponent(x.id)}">Xem</a></td></tr>`}).join(''):'<tr><td colspan="6"><div class="oly-empty"><b>Chưa có bài học phù hợp</b></div></td></tr>'}</tbody></table></div>`;
  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(teacherUrl('lessons',e.target.value));
}

async function deleteLessonFromStudentView(lesson,code){
  if(!lesson?.id)return;
  const tr=await db.from('olympic_tests').select('id',{count:'exact',head:true}).eq('lesson_id',lesson.id);
  if(tr.error)return fail(tr.error);
  const n=tr.count||0;
  const extra=n?`\n\nBài học đang có ${n} đề luyện liên kết. Xóa bài học sẽ xóa luôn ${n} đề này.`:'';
  if(!confirm(`Xóa vĩnh viễn bài học “${lesson.title}”?${extra}\n\nThao tác này không thể hoàn tác.`))return;
  const imagePaths=extractLessonImagePaths(lesson.content_tex||'');
  const r=await db.from('olympic_lessons').delete().eq('id',lesson.id).eq('subject_id',lesson.subject_id);
  if(r.error)return fail(r.error);
  if(imagePaths.length){
    const sr=await db.storage.from('olympic-content').remove(imagePaths);
    if(sr.error)console.warn('Không xóa được một số ảnh Olympic:',sr.error);
  }
  clearDataCache(code);toast('Đã xóa bài học');
  navigateTo(teacherUrl('lessons',code),{force:true});
}
