async function renderTeacherLessons(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  let qs=new URLSearchParams(location.search),code=qs.get('subject')||'algebra',editId=qs.get('edit');
  const sel=await teacherSubjectSelect(code);
  if(!sel.allowed.length){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  if(!sel.allowed.some(x=>x.code===code))code=sel.allowed[0].code;
  const s=sel.allowed.find(x=>x.code===code),tree=await loadTree(code);
  if(editId==='new'||editId){
    let lesson=null;
    if(editId!=='new'){
      const q=await db.from('olympic_lessons').select('*').eq('id',editId).eq('subject_id',s.id).maybeSingle();
      if(q.error)throw q.error;lesson=q.data;
      if(!lesson){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy bài học trong môn đã chọn.</b></div>';return}
    }
    return lessonEditor(c,s,tree.topics,lesson,code);
  }
  const r=await db.from('olympic_lessons').select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(title)').eq('subject_id',s.id).order('updated_at',{ascending:false});
  if(r.error)throw r.error;const list=r.data||[];
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div><a class="oly-btn primary" href="?subject=${encodeURIComponent(code)}&edit=new">+ Bài học</a></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Bài học</th><th>Mục nội dung</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody>${list.length?list.map(x=>`<tr><td><b>${esc(x.title)}</b><br><span style="color:#829ab1">${esc(x.summary||'')}</span></td><td>${esc(x.topic?.title||'—')}</td><td><span class="oly-badge ${x.status}">${statusLabel(x.status)}</span></td><td>${new Date(x.updated_at).toLocaleDateString('vi-VN')}</td><td><a class="oly-btn small" href="?subject=${encodeURIComponent(code)}&edit=${x.id}">Sửa</a></td></tr>`).join(''):'<tr><td colspan="5"><div class="oly-empty"><b>Chưa có bài học</b></div></td></tr>'}</tbody></table></div>`;
  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(`?subject=${encodeURIComponent(e.target.value)}`);
}
