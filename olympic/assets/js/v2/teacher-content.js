async function teacherSubjectSelect(selected=preferredTeacherSubjectCode()){
  let allowed=state.subjects;
  if(!admin()){
    const r=await db.from('olympic_teacher_subjects').select('subject_id').eq('profile_id',state.user.id);
    if(!r.error){const ids=new Set((r.data||[]).map(x=>x.subject_id));allowed=state.subjects.filter(x=>ids.has(x.id))}
  }
  return {allowed,html:`<label class="oly-field" style="max-width:280px"><span>Môn Olympic đang quản lý</span><select id="teacherSubject" class="oly-select">${allowed.map(s=>`<option value="${s.code}" ${s.code===selected?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`};
}

async function resolveTeacherSubject(requested=preferredTeacherSubjectCode()){
  const sel=await teacherSubjectSelect(requested);
  if(!sel.allowed.length)return {sel,code:'',subject:null};
  const code=sel.allowed.some(x=>x.code===requested)?requested:sel.allowed[0].code;
  const subject=sel.allowed.find(x=>x.code===code);
  rememberTeacherSubject(code);state.subject=subject;updateShell();
  return {sel,code,subject};
}

async function renderTeacher(c){
  if(!state.user){c.innerHTML=authGate('Đăng nhập bằng tài khoản giảng viên hoặc quản trị viên.');return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Bạn không có quyền giảng viên.</b></div>';return}
  const {sel,code,subject}=await resolveTeacherSubject();
  if(!subject){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div><span class="oly-badge required">Môn · ${esc(subject.name)}</span></div><section class="oly-hero"><span class="oly-kicker">Teacher workspace · ${esc(subject.name)}</span><h2>Biên soạn Olympic</h2><p>Quản lý nội dung theo môn, soạn bài học TeX và chuẩn bị ngân hàng luyện tập. Lộ trình học không bị khóa theo số tuần.</p></section><div class="oly-section-head"><div><h2>Công cụ giảng viên</h2></div></div><div class="oly-grid"><a class="oly-card clickable" href="${teacherUrl('contents',code)}"><div class="math-icon">≡</div><h3>Nội dung</h3><p>Nhóm kiến thức và các mục cần học.</p></a><a class="oly-card clickable" href="${teacherUrl('lessons',code)}"><div class="math-icon gold">TeX</div><h3>Bài học</h3><p>Soạn và xuất bản bài giảng toán học.</p></a><a class="oly-card clickable" href="${teacherUrl('problems',code)}"><div class="math-icon">?</div><h3>Bài toán</h3><p>Ngân hàng bài toán và trắc nghiệm.</p></a><a class="oly-card clickable" href="${teacherUrl('tests',code)}"><div class="math-icon green">π</div><h3>Đề luyện</h3><p>Cấu hình đề luyện và thi thử.</p></a><a class="oly-card clickable" href="${teacherUrl('students',code)}"><div class="math-icon">♙</div><h3>Sinh viên</h3><p>Danh sách sinh viên Olympic của môn và tiến độ học.</p></a></div>`;
  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(teacherUrl('',e.target.value));
}

async function loadTeacherContentMeta(subjectId){
  const [l,t]=await Promise.all([
    db.from('olympic_lessons').select('id,topic_id,status,is_visible').eq('subject_id',subjectId),
    db.from('olympic_tests').select('id,topic_id,lesson_id,status,is_visible').eq('subject_id',subjectId)
  ]);
  if(l.error)throw l.error;if(t.error)throw t.error;
  const lessonByTopic=new Map(),testByTopic=new Map();
  for(const x of l.data||[])lessonByTopic.set(x.topic_id,(lessonByTopic.get(x.topic_id)||0)+1);
  for(const x of t.data||[])if(x.topic_id)testByTopic.set(x.topic_id,(testByTopic.get(x.topic_id)||0)+1);
  return {lessons:l.data||[],tests:t.data||[],lessonByTopic,testByTopic};
}

function contentMatrixHtml(tree,meta){
  const totalLessons=meta.lessons.length,totalTests=meta.tests.length;
  return `<section class="oly-panel" style="margin-bottom:16px"><div class="oly-section-head" style="margin:0 0 14px"><div><h2>Ma trận nội dung</h2><p>Xem nhanh Nhóm → Mục → số bài học và đề luyện. Bấm một mục để đi đến cây quản lý bên dưới.</p></div><div class="meta"><span class="oly-badge required">${tree.sections.length} nhóm</span><span class="oly-badge">${tree.topics.length} mục</span><span class="oly-badge published">${totalLessons} bài</span><span class="oly-badge recommended">${totalTests} đề</span></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">${tree.sections.map(sec=>{const tt=tree.topics.filter(t=>t.section_id===sec.id).sort((a,b)=>a.order_index-b.order_index||a.title.localeCompare(b.title,'vi'));const lc=tt.reduce((n,t)=>n+(meta.lessonByTopic.get(t.id)||0),0),tc=tt.reduce((n,t)=>n+(meta.testByTopic.get(t.id)||0),0);return `<div style="border:1px solid var(--oly-line);border-radius:14px;padding:13px;background:#fbfdff"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px"><b>${esc(sec.name)}</b><span class="oly-badge">${tt.length} mục · ${lc} bài · ${tc} đề</span></div><div style="display:grid;gap:6px">${tt.map(t=>`<button class="oly-btn small" data-matrix-jump="${t.id}" data-matrix-section="${sec.id}" style="justify-content:space-between;text-align:left;width:100%"><span>${esc(t.title)}</span><span style="color:#627d98;font-weight:700;white-space:nowrap">${meta.lessonByTopic.get(t.id)||0} bài · ${meta.testByTopic.get(t.id)||0} đề</span></button>`).join('')||'<span style="color:#829ab1;font-size:12px">Chưa có mục.</span>'}</div></div>`}).join('')}</div></section>`;
}

async function renderTeacherContents(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  const qs=new URLSearchParams(location.search),requested=qs.get('subject')||preferredTeacherSubjectCode();
  const {sel,code,subject:s}=await resolveTeacherSubject(requested);
  if(!s){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  const [tree,meta]=await Promise.all([loadTree(code,{force:true}),loadTeacherContentMeta(s.id)]);
  const countFor=t=>({lessons:meta.lessonByTopic.get(t.id)||0,tests:meta.testByTopic.get(t.id)||0});
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div><span class="oly-badge required">Môn · ${esc(s.name)}</span><button class="oly-btn" id="addSection">+ Nhóm nội dung</button><button class="oly-btn primary" id="addTopic">+ Mục nội dung</button></div>${contentMatrixHtml(tree,meta)}<section class="oly-panel" style="margin-bottom:14px"><div class="oly-toolbar" style="margin-bottom:0"><div class="grow"><input class="oly-input" id="contentSearch" placeholder="Tìm nhóm, mục hoặc mô tả… (có thể gõ không dấu)"></div><select class="oly-select" id="contentGroup" style="width:auto;min-width:190px"><option value="all">Tất cả nhóm</option>${tree.sections.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><select class="oly-select" id="contentImportance" style="width:auto"><option value="all">Tất cả mức</option><option value="required">Bắt buộc</option><option value="recommended">Khuyến nghị</option><option value="advanced">Nâng cao</option></select><select class="oly-select" id="contentStatus" style="width:auto"><option value="all">Tất cả trạng thái</option><option value="draft">Nháp</option><option value="editing">Đang biên soạn</option><option value="approved">Đã duyệt</option><option value="teaching">Đang dạy</option></select><select class="oly-select" id="contentSort" style="width:auto"><option value="order">Thứ tự hiện tại</option><option value="az">A → Z</option><option value="za">Z → A</option></select><button class="oly-btn small" id="expandAll">Mở tất cả</button><button class="oly-btn small" id="collapseAll">Thu gọn</button></div></section><div class="oly-content-tree" id="manageTree"></div>`;

  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(teacherUrl('contents',e.target.value));
  $('#addSection').onclick=()=>sectionForm(s,null,code);
  $('#addTopic').onclick=()=>topicForm(s,tree.sections,null,code);

  const draw=()=>{
    const query=normalizeText($('#contentSearch').value),group=$('#contentGroup').value,importance=$('#contentImportance').value,status=$('#contentStatus').value,sort=$('#contentSort').value;
    let sections=[...tree.sections];
    if(group!=='all')sections=sections.filter(x=>x.id===group);
    const sortRows=(rows,label)=>{
      if(sort==='az')return rows.sort((a,b)=>String(a[label]).localeCompare(String(b[label]),'vi'));
      if(sort==='za')return rows.sort((a,b)=>String(b[label]).localeCompare(String(a[label]),'vi'));
      return rows.sort((a,b)=>a.order_index-b.order_index||String(a[label]).localeCompare(String(b[label]),'vi'));
    };
    sortRows(sections,'name');
    const actualSections=[...tree.sections].sort((a,b)=>a.order_index-b.order_index||a.name.localeCompare(b.name,'vi'));
    const html=[];
    for(const sec of sections){
      const secText=normalizeText(`${sec.name} ${sec.description||''}`),secQueryMatch=!query||secText.includes(query);
      let topics=tree.topics.filter(t=>t.section_id===sec.id);
      topics=topics.filter(t=>(importance==='all'||t.importance===importance)&&(status==='all'||t.status===status));
      if(query&&!secQueryMatch)topics=topics.filter(t=>normalizeText(`${t.title} ${t.description||''}`).includes(query));
      sortRows(topics,'title');
      if(query&&!secQueryMatch&&!topics.length)continue;
      if((importance!=='all'||status!=='all')&&!topics.length)continue;
      const actualTopics=tree.topics.filter(t=>t.section_id===sec.id).sort((a,b)=>a.order_index-b.order_index||a.title.localeCompare(b.title,'vi'));
      const secPos=actualSections.findIndex(x=>x.id===sec.id),collapsed=state.ui.collapsedSections.has(sec.id);
      const totalL=actualTopics.reduce((n,t)=>n+countFor(t).lessons,0),totalT=actualTopics.reduce((n,t)=>n+countFor(t).tests,0);
      html.push(`<section class="oly-content-group" id="section-${sec.id}"><header><button class="oly-btn small" data-collapse-section="${sec.id}" title="${collapsed?'Mở nhóm':'Thu gọn nhóm'}">${collapsed?'▸':'▾'}</button><span class="group-index">${String(secPos+1).padStart(2,'0')}</span><div style="flex:1;min-width:0"><h3>${esc(sec.name)}</h3><p>${esc(sec.description||'')} · ${actualTopics.length} mục · ${totalL} bài · ${totalT} đề ${sec.is_visible===false?'· Đang ẩn':''}</p></div><div class="oly-topic-actions"><button class="oly-btn small" data-move-section="${sec.id}" data-dir="-1" ${sort!=='order'||secPos===0?'disabled':''} title="Đưa nhóm lên">↑</button><button class="oly-btn small" data-move-section="${sec.id}" data-dir="1" ${sort!=='order'||secPos===actualSections.length-1?'disabled':''} title="Đưa nhóm xuống">↓</button><button class="oly-btn small" data-edit-section="${sec.id}">Sửa nhóm</button></div></header><div class="oly-topic-list" style="${collapsed?'display:none':''}">${topics.length?topics.map(t=>{const pos=actualTopics.findIndex(x=>x.id===t.id),cnt=countFor(t),hasChildren=cnt.lessons+cnt.tests>0;return `<div class="oly-topic" id="topic-${t.id}"><div><h4>${esc(t.title)}</h4><p>${esc(t.description||'')}</p></div><div class="oly-topic-actions"><span class="oly-badge">${cnt.lessons} bài · ${cnt.tests} đề</span><span class="oly-badge ${t.importance}">${importanceLabel(t.importance)}</span><span class="oly-badge ${t.status}">${statusLabel(t.status)}</span>${t.is_visible===false?'<span class="oly-badge draft">Đang ẩn</span>':''}<button class="oly-btn small" data-move-topic="${t.id}" data-dir="-1" ${sort!=='order'||pos===0?'disabled':''}>↑</button><button class="oly-btn small" data-move-topic="${t.id}" data-dir="1" ${sort!=='order'||pos===actualTopics.length-1?'disabled':''}>↓</button><button class="oly-btn small" data-edit-topic="${t.id}">Sửa</button>${hasChildren?`<button class="oly-btn small ${t.is_visible===false?'':'danger'}" data-toggle-topic="${t.id}" data-visible="${t.is_visible===false?'true':'false'}">${t.is_visible===false?'Hiện':'Ẩn'}</button>`:`<button class="oly-btn small danger" data-del-topic="${t.id}">Xóa</button>`}</div></div>`}).join(''):`<div class="oly-empty"><b>Không có mục phù hợp bộ lọc</b></div>`}</div></section>`);
    }
    const ungrouped=tree.topics.filter(t=>!t.section_id);
    if(group==='all'&&ungrouped.length&&!query)html.push(`<section class="oly-content-group"><header><span class="group-index">∅</span><div style="flex:1"><h3>Chưa phân nhóm</h3><p>${ungrouped.length} mục</p></div></header><div class="oly-topic-list">${ungrouped.map(t=>`<div class="oly-topic"><div><h4>${esc(t.title)}</h4><p>${esc(t.description||'')}</p></div><div class="oly-topic-actions"><button class="oly-btn small" data-edit-topic="${t.id}">Sửa</button></div></div>`).join('')}</div></section>`);
    $('#manageTree').innerHTML=html.join('')||'<div class="oly-panel oly-empty"><b>Không tìm thấy nội dung phù hợp.</b></div>';
  };
  draw();

  ['contentSearch','contentGroup','contentImportance','contentStatus','contentSort'].forEach(id=>$('#'+id).addEventListener(id==='contentSearch'?'input':'change',draw));
  $('#expandAll').onclick=()=>{state.ui.collapsedSections.clear();draw()};
  $('#collapseAll').onclick=()=>{tree.sections.forEach(x=>state.ui.collapsedSections.add(x.id));draw()};
  $('[data-matrix-jump]')?.focus?.({preventScroll:true});
  c.addEventListener('click',e=>{
    const jump=e.target.closest('[data-matrix-jump]');
    if(jump){state.ui.collapsedSections.delete(jump.dataset.matrixSection);draw();requestAnimationFrame(()=>document.getElementById('topic-'+jump.dataset.matrixJump)?.scrollIntoView({behavior:'smooth',block:'center'}));return}
    const b=e.target.closest('#manageTree button');if(!b)return;
    if(b.dataset.collapseSection){const id=b.dataset.collapseSection;state.ui.collapsedSections.has(id)?state.ui.collapsedSections.delete(id):state.ui.collapsedSections.add(id);draw();return}
    if(b.dataset.moveSection)return moveSection(b.dataset.moveSection,Number(b.dataset.dir),code,tree.sections);
    if(b.dataset.moveTopic)return moveTopic(b.dataset.moveTopic,Number(b.dataset.dir),code,tree.topics);
    if(b.dataset.editSection)return sectionForm(s,tree.sections.find(x=>x.id===b.dataset.editSection),code);
    if(b.dataset.editTopic)return topicForm(s,tree.sections,tree.topics.find(x=>x.id===b.dataset.editTopic),code);
    if(b.dataset.toggleTopic)return toggleTopicVisibility(b.dataset.toggleTopic,b.dataset.visible==='true',code);
    if(b.dataset.delTopic)return deleteTopic(b.dataset.delTopic,code);
  });
}
