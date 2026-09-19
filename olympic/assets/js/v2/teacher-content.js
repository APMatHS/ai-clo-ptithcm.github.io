async function renderTeacher(c){
  if(!state.user){c.innerHTML=authGate('Đăng nhập bằng tài khoản giảng viên hoặc quản trị viên.');return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Bạn không có quyền giảng viên.</b></div>';return}
  c.innerHTML=`<section class="oly-hero"><span class="oly-kicker">Teacher workspace</span><h2>Biên soạn Olympic</h2><p>Quản lý nội dung theo môn, soạn bài học TeX và chuẩn bị ngân hàng luyện tập. Lộ trình học không bị khóa theo số tuần.</p></section><div class="oly-section-head"><div><h2>Công cụ giảng viên</h2></div></div><div class="oly-grid"><a class="oly-card clickable" href="/olympic/teacher/contents/"><div class="math-icon">≡</div><h3>Nội dung</h3><p>Nhóm kiến thức và các mục cần học.</p></a><a class="oly-card clickable" href="/olympic/teacher/lessons/"><div class="math-icon gold">TeX</div><h3>Bài học</h3><p>Soạn và xuất bản bài giảng toán học.</p></a><a class="oly-card clickable" href="/olympic/teacher/problems/"><div class="math-icon">?</div><h3>Bài toán</h3><p>Ngân hàng bài toán và trắc nghiệm.</p></a><a class="oly-card clickable" href="/olympic/teacher/tests/"><div class="math-icon green">π</div><h3>Đề luyện</h3><p>Cấu hình đề luyện và thi thử.</p></a><a class="oly-card clickable" href="/olympic/teacher/students/"><div class="math-icon">♙</div><h3>Sinh viên</h3><p>Theo dõi tiến độ và kết quả.</p></a></div>`;
}

async function renderTeacherContents(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  let qs=new URLSearchParams(location.search),code=qs.get('subject')||'algebra';
  const sel=await teacherSubjectSelect(code);
  if(!sel.allowed.length){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  if(!sel.allowed.some(x=>x.code===code))code=sel.allowed[0].code;
  const s=sel.allowed.find(x=>x.code===code),tree=await loadTree(code);
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div><button class="oly-btn" id="addSection">+ Nhóm nội dung</button><button class="oly-btn primary" id="addTopic">+ Mục nội dung</button></div><div class="oly-content-tree" id="manageTree">${tree.sections.map((sec,i)=>{const tt=tree.topics.filter(t=>t.section_id===sec.id);return `<section class="oly-content-group"><header><span class="group-index">${String(i+1).padStart(2,'0')}</span><div style="flex:1"><h3>${esc(sec.name)}</h3><p>${esc(sec.description||'')}</p></div><div class="oly-topic-actions"><button class="oly-btn small" data-edit-section="${sec.id}">Sửa nhóm</button></div></header><div class="oly-topic-list">${tt.length?tt.map(t=>`<div class="oly-topic"><div><h4>${esc(t.title)}</h4><p>${esc(t.description||'')}</p></div><div class="oly-topic-actions"><span class="oly-badge ${t.importance}">${importanceLabel(t.importance)}</span><span class="oly-badge ${t.status}">${statusLabel(t.status)}</span><button class="oly-btn small" data-edit-topic="${t.id}">Sửa</button><button class="oly-btn small danger" data-del-topic="${t.id}">Xóa</button></div></div>`).join(''):`<div class="oly-empty"><b>Chưa có mục nội dung</b></div>`}</div></section>`}).join('')}</div>`;
  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(`?subject=${encodeURIComponent(e.target.value)}`);
  $('#addSection').onclick=()=>sectionForm(s,null,code);
  $('#addTopic').onclick=()=>topicForm(s,tree.sections,null,code);
  $('#manageTree').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.editSection)sectionForm(s,tree.sections.find(x=>x.id===b.dataset.editSection),code);if(b.dataset.editTopic)topicForm(s,tree.sections,tree.topics.find(x=>x.id===b.dataset.editTopic),code);if(b.dataset.delTopic)deleteTopic(b.dataset.delTopic,code)};
}
