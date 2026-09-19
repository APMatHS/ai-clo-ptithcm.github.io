async function renderLessons(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!state.subject){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy môn Olympic.</b></div>';return}
  const id=new URLSearchParams(location.search).get('id');
  if(id){
    let q=db.from('olympic_lessons')
      .select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(title)')
      .eq('id',id).eq('subject_id',state.subject.id).eq('is_visible',true);
    if(!staff())q=q.eq('status','published');
    const r=await q.maybeSingle();
    if(r.error)throw r.error;
    if(!r.data){c.innerHTML='<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Không tìm thấy bài học trong môn này.</b><span>Liên kết bài học không thuộc đúng môn hiện tại hoặc đã bị ẩn.</span></div>';return}
    const x=r.data;
    c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="${subjectFeatureUrl('lessons')}">← Danh sách bài học</a></div><article class="oly-panel"><span class="oly-badge published">${statusLabel(x.status)}</span><h2 style="font-family:Cambria Math,Georgia,serif;font-size:30px;margin-bottom:6px">${esc(x.title)}</h2><p style="color:#627d98">${esc(x.summary||'')}</p>${x.topic?.title?`<div class="meta"><span class="oly-badge">${esc(x.topic.title)}</span></div>`:''}<div class="oly-preview" style="border:0;padding:10px 0 0;min-height:0" id="lessonBody">${renderTex(x.content_tex)}</div></article>`;
    return;
  }
  const list=await loadPublishedLessons();
  c.innerHTML=`<div class="oly-section-head"><div><h2>Bài học ${esc(state.subject.name)}</h2><p>Bài giảng toán học do giảng viên xuất bản.</p></div>${staff()?'<a class="oly-btn primary" href="/olympic/teacher/lessons/">Soạn bài học</a>':''}</div><div class="oly-grid">${list.length?list.map(x=>`<a class="oly-card clickable" href="?id=${x.id}"><span class="arrow">→</span><div class="math-icon">∑</div><h3>${esc(x.title)}</h3><p>${esc(x.summary||'')}</p><div class="meta">${x.topic?.title?`<span class="oly-badge">${esc(x.topic.title)}</span>`:''}<span class="oly-badge published">Đã xuất bản</span></div></a>`).join(''):`<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Chưa có bài học được xuất bản</b><span>Giảng viên có thể tạo bài bằng trình soạn TeX.</span></div>`}</div>`;
}

function renderComing(c,kind){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  const m={practice:['Luyện tập trắc nghiệm','✓','Trang này dành cho trắc nghiệm, điền đáp số và bài luyện theo chuyên đề.'],problems:['Ngân hàng bài toán','?','Kho bài toán Olympic với gợi ý, lời giải và nguồn bài.'],tests:['Đề luyện & thi thử','π','Tạo đề tổng hợp từ ngân hàng bài toán và theo dõi lượt làm.'],results:['Kết quả học tập','↗','Theo dõi tiến độ, điểm luyện và các chuyên đề đã hoàn thành.']}[kind];
  c.innerHTML=`<section class="oly-hero"><span class="oly-kicker">${esc(state.subject?.name||'Olympic')}</span><h2>${m[1]} ${m[0]}</h2><p>${m[2]}</p></section><div class="oly-section-head"><div><h2>Khung chức năng đã sẵn sàng</h2><p>V2 ưu tiên nền tảng ổn định; dữ liệu ${m[0].toLowerCase()} sẽ được nối ở bước tiếp theo.</p></div></div><div class="oly-grid"><div class="oly-card"><div class="math-icon">1</div><h3>Theo chuyên đề</h3><p>Lọc và tổ chức theo cây nội dung của từng môn.</p></div><div class="oly-card"><div class="math-icon gold">2</div><h3>Phân quyền</h3><p>Giảng viên quản lý môn được cấp quyền; sinh viên chỉ dùng nội dung đã công bố.</p></div><div class="oly-card"><div class="math-icon green">3</div><h3>Không khóa lộ trình</h3><p>Giảng viên tự xác nhận thứ tự học sau, không cố định theo tuần trong mã nguồn.</p></div></div>`;
}

async function teacherSubjectSelect(selected){
  let allowed=state.subjects;
  if(!admin()){
    const r=await db.from('olympic_teacher_subjects').select('subject_id').eq('profile_id',state.user.id);
    if(!r.error){const ids=new Set((r.data||[]).map(x=>x.subject_id));allowed=state.subjects.filter(x=>ids.has(x.id))}
  }
  return {allowed,html:`<select id="teacherSubject" class="oly-select">${allowed.map(s=>`<option value="${s.code}" ${s.code===selected?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`};
}
