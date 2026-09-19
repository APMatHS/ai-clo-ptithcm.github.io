async function renderLessons(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!state.subject){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy môn Olympic.</b></div>';return}
  const qs=new URLSearchParams(location.search),id=qs.get('id'),topicFilter=qs.get('topic')||'';
  if(id){
    let canManage=false;
    if(staff()){
      const mr=await db.rpc('olympic_can_manage_subject',{p_subject_id:state.subject.id});
      if(!mr.error)canManage=!!mr.data;
    }
    let q=db.from('olympic_lessons').select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(id,title)').eq('id',id).eq('subject_id',state.subject.id);
    if(!canManage)q=q.eq('is_visible',true).eq('status','published');
    const r=await q.maybeSingle();
    if(r.error)throw r.error;
    if(!r.data){c.innerHTML='<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Không tìm thấy bài học trong môn này.</b><span>Liên kết bài học không thuộc đúng môn hiện tại hoặc đã bị ẩn.</span></div>';return}
    const x=r.data;
    let tq=db.from('olympic_tests').select('id,title,description,status').eq('subject_id',state.subject.id).eq('lesson_id',x.id);
    if(!canManage)tq=tq.eq('is_visible',true).eq('status','published');
    const tr=await tq.order('order_index').limit(1).maybeSingle();
    if(tr.error)console.warn('Olympic lesson test:',tr.error);
    const test=tr.data;
    const back=canManage?teacherUrl('lessons',subjectCode):subjectFeatureUrl('lessons');
    c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="${back}">← ${canManage?'Danh sách quản lý':'Danh sách bài học'}</a>${canManage?`<div class="grow"></div><a class="oly-btn primary" href="${teacherUrl('lessons',subjectCode)}&edit=${encodeURIComponent(x.id)}">Sửa bài học</a><button class="oly-btn danger" id="deleteLesson">Xóa</button>`:''}</div><article class="oly-panel"><div class="meta"><span class="oly-badge ${x.status}">${statusLabel(x.status)}</span>${x.is_visible===false?'<span class="oly-badge draft">Đang ẩn</span>':''}</div><h2 style="font-family:Cambria Math,Georgia,serif;font-size:30px;margin-bottom:6px">${esc(x.title)}</h2><p style="color:#627d98">${esc(x.summary||'')}</p>${x.topic?.title?`<div class="meta"><span class="oly-badge">${esc(x.topic.title)}</span></div>`:''}<div class="oly-preview" style="border:0;padding:10px 0 0;min-height:0" id="lessonBody">${renderTex(x.content_tex)}</div>${test?`<section class="oly-card" style="margin-top:22px"><div class="math-icon green">π</div><h3>Đề luyện cuối bài</h3><p>${esc(test.description||'Củng cố ngay các kỹ thuật vừa học.')}</p><div class="meta"><span class="oly-badge">Lộ trình</span>${canManage?`<span class="oly-badge ${esc(test.status)}">${statusLabel(test.status)}</span>`:''}</div><a class="oly-btn primary" style="margin-top:10px" href="${subjectFeatureUrl('tests')}?id=${encodeURIComponent(test.id)}">${canManage?'Xem đề luyện':'Làm đề luyện'} →</a></section>`:''}</article>`;
    if(canManage)$('#deleteLesson').onclick=()=>deleteLessonFromStudentView(x,subjectCode);
    return;
  }
  let list=await loadPublishedLessons();
  if(topicFilter)list=list.filter(x=>x.topic_id===topicFilter);
  const tree=topicFilter?await loadTree():null,currentTopic=topicFilter?tree.topics.find(x=>x.id===topicFilter):null;
  c.innerHTML=`<div class="oly-section-head"><div><h2>Bài học ${esc(state.subject.name)}</h2><p>${currentTopic?`Đang lọc theo mục: ${esc(currentTopic.title)}.`:'Bài giảng toán học do giảng viên xuất bản.'}</p></div>${staff()?`<a class="oly-btn primary" href="${teacherUrl('lessons',subjectCode)}${topicFilter?`&topic=${encodeURIComponent(topicFilter)}`:''}">Quản lý bài học</a>`:''}</div>${currentTopic?`<div class="oly-toolbar"><a class="oly-btn small" href="${subjectFeatureUrl('contents')}">← Nội dung</a><a class="oly-btn small" href="${subjectFeatureUrl('lessons')}">Xem tất cả bài học</a></div>`:''}<div class="oly-grid">${list.length?list.map(x=>`<a class="oly-card clickable" href="?id=${x.id}"><span class="arrow">→</span><div class="math-icon">∑</div><h3>${esc(x.title)}</h3><p>${esc(x.summary||'')}</p><div class="meta">${x.topic?.title?`<span class="oly-badge">${esc(x.topic.title)}</span>`:''}<span class="oly-badge published">Đã xuất bản</span></div></a>`).join(''):`<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Chưa có bài học được xuất bản</b><span>${currentTopic?'Mục này chưa có bài học được xuất bản.':'Giảng viên có thể tạo bài bằng trình soạn TeX.'}</span></div>`}</div>`;
}

async function renderTests(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!state.subject){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy môn Olympic.</b></div>';return}
  const qs=new URLSearchParams(location.search),id=qs.get('id'),tab=qs.get('tab')||'roadmap';
  if(id){
    let q=db.from('olympic_tests').select('*,topic:olympic_topics(title),lesson:olympic_lessons(title)').eq('id',id).eq('subject_id',state.subject.id).eq('is_visible',true);
    if(!staff())q=q.eq('status','published');
    const r=await q.maybeSingle();
    if(r.error)throw r.error;
    if(!r.data){c.innerHTML='<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Không tìm thấy đề luyện.</b></div>';return}
    const x=r.data;
    const backTab=x.test_type==='lesson'?'roadmap':'general';
    c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="${subjectFeatureUrl('tests')}?tab=${backTab}">← Đề luyện</a>${x.lesson?.title?`<a class="oly-btn" href="${subjectFeatureUrl('lessons')}?id=${encodeURIComponent(x.lesson_id)}">↗ Bài học</a>`:''}</div><article class="oly-panel"><span class="oly-badge ${x.test_type==='lesson'?'required':'recommended'}">${x.test_type==='lesson'?'Lộ trình':'Tổng hợp'}</span><h2 style="font-family:Cambria Math,Georgia,serif;font-size:30px;margin-bottom:6px">${esc(x.title)}</h2><p style="color:#627d98">${esc(x.description||'')}</p><div class="meta">${x.topic?.title?`<span class="oly-badge">${esc(x.topic.title)}</span>`:''}${x.lesson?.title?`<span class="oly-badge">Sau bài: ${esc(x.lesson.title)}</span>`:''}</div><div class="oly-preview" style="border:0;padding:10px 0 0;min-height:0">${renderTex(x.content_tex)}</div></article>`;
    return;
  }
  let q=db.from('olympic_tests').select('id,title,description,test_type,status,order_index,topic:olympic_topics(title),lesson:olympic_lessons(title)').eq('subject_id',state.subject.id).eq('is_visible',true).order('order_index');
  if(!staff())q=q.eq('status','published');
  const r=await q;
  if(r.error)throw r.error;
  const all=r.data||[];
  const list=tab==='general'?all.filter(x=>x.test_type!=='lesson'):all.filter(x=>x.test_type==='lesson');
  c.innerHTML=`<div class="oly-section-head"><div><h2>π Đề luyện ${esc(state.subject.name)}</h2><p>Đề cuối bài được xếp theo lộ trình học; đề tổng hợp được tách riêng để luyện nhiều chuyên đề.</p></div></div><div class="oly-toolbar" style="margin-bottom:16px"><a class="oly-btn ${tab==='roadmap'?'primary':''}" href="?tab=roadmap">Lộ trình</a><a class="oly-btn ${tab==='general'?'primary':''}" href="?tab=general">Đề tổng hợp</a></div><div class="oly-grid">${list.length?list.map(x=>`<a class="oly-card clickable" href="?id=${x.id}"><span class="arrow">→</span><div class="math-icon ${x.test_type==='lesson'?'green':'gold'}">π</div><h3>${esc(x.title)}</h3><p>${esc(x.description||'')}</p><div class="meta">${x.topic?.title?`<span class="oly-badge">${esc(x.topic.title)}</span>`:''}${x.lesson?.title?`<span class="oly-badge">${esc(x.lesson.title)}</span>`:''}${staff()?`<span class="oly-badge ${esc(x.status)}">${statusLabel(x.status)}</span>`:''}</div></a>`).join(''):`<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>${tab==='general'?'Chưa có đề tổng hợp':'Chưa có đề luyện theo lộ trình'}</b><span>${tab==='general'?'Có thể bổ sung đề theo chủ đề, đề mô phỏng hoặc đề thi thử sau.':'Đề cuối bài sẽ tự xuất hiện tại đây khi được liên kết với bài học.'}</span></div>`}</div>`;
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
  return {allowed,html:`<label class="oly-field" style="max-width:280px"><span>Môn Olympic đang quản lý</span><select id="teacherSubject" class="oly-select">${allowed.map(s=>`<option value="${s.code}" ${s.code===selected?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`};
}
