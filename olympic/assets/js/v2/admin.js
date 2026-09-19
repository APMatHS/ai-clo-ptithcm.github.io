async function renderTeacherPlaceholder(c,kind){
  if(kind==='teacherStudents')return renderTeacherStudents(c);
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  const requested=new URLSearchParams(location.search).get('subject')||preferredTeacherSubjectCode();
  const {sel,code,subject}=await resolveTeacherSubject(requested);
  if(!subject){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  const m={teacherProblems:['Ngân hàng bài toán','?','Trang này sẽ nối câu trắc nghiệm, điền đáp số, tự luận, gợi ý và lời giải.','problems'],teacherTests:['Đề luyện','π','Trang cấu hình đề luyện/thi thử sẽ dùng dữ liệu Olympic riêng, không ảnh hưởng ngân hàng CLO hiện tại.','tests']}[kind];
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div><span class="oly-badge required">Môn · ${esc(subject.name)}</span></div><section class="oly-hero"><span class="oly-kicker">Teacher workspace · ${esc(subject.name)}</span><h2>${m[1]} ${m[0]}</h2><p>${m[2]}</p></section><div class="oly-section-head"><div><h2>Trang con đã được tách riêng</h2><p>Có thể phát triển độc lập mà không làm phình một file Olympic duy nhất.</p></div></div>`;
  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(teacherUrl(m[3],e.target.value));
}

async function renderTeacherStudents(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  const requested=new URLSearchParams(location.search).get('subject')||preferredTeacherSubjectCode();
  const {sel,code,subject:s}=await resolveTeacherSubject(requested);
  if(!s){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  const mr=await db.from('olympic_student_subjects').select('profile_id,created_at').eq('subject_id',s.id).order('created_at');
  if(mr.error)throw mr.error;
  const ids=(mr.data||[]).map(x=>x.profile_id);
  let profiles=[];
  if(ids.length){const pr=await db.from('profiles').select('id,full_name,email,mssv,role,is_active').in('id',ids).order('full_name');if(pr.error)throw pr.error;profiles=pr.data||[]}
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div><span class="oly-badge required">Môn · ${esc(s.name)}</span>${admin()?'<a class="oly-btn" href="/olympic/admin/?tab=students">Quản lý danh sách →</a>':''}</div><div class="oly-grid" style="margin-bottom:16px"><div class="oly-card"><div class="math-icon">♙</div><h3>${profiles.length}</h3><p>Sinh viên Olympic đã được gán vào ${esc(s.name)}.</p></div><div class="oly-card"><div class="math-icon green">✓</div><h3>${profiles.filter(x=>x.is_active!==false).length}</h3><p>Tài khoản đang hoạt động.</p></div><div class="oly-card"><div class="math-icon gold">∑</div><h3>Tiến độ</h3><p>Sẽ nối điểm luyện và kết quả theo chuyên đề ở bước sau.</p></div></div><div class="oly-toolbar"><div class="grow"><input class="oly-input" id="studentSearch" placeholder="Tìm họ tên, email hoặc MSSV…"></div></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Sinh viên</th><th>Email</th><th>MSSV</th><th>Trạng thái</th></tr></thead><tbody id="studentRows"></tbody></table></div>`;
  $('#teacherSubject').value=code;
  $('#teacherSubject').onchange=e=>navigateTo(teacherUrl('students',e.target.value));
  const draw=()=>{const q=normalizeText($('#studentSearch').value);const list=profiles.filter(x=>!q||normalizeText(`${x.full_name} ${x.email} ${x.mssv||''}`).includes(q));$('#studentRows').innerHTML=list.length?list.map(x=>`<tr><td><b>${esc(x.full_name||'—')}</b></td><td>${esc(x.email||'—')}</td><td>${esc(x.mssv||'—')}</td><td><span class="oly-badge ${x.is_active===false?'draft':'published'}">${x.is_active===false?'Đã khóa':'Hoạt động'}</span></td></tr>`).join(''):'<tr><td colspan="4"><div class="oly-empty"><b>Chưa có sinh viên phù hợp.</b></div></td></tr>'};
  draw();$('#studentSearch').oninput=draw;
}

async function renderAdmin(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!admin()){c.innerHTML='<div class="oly-panel oly-empty"><b>Chỉ Admin được truy cập.</b></div>';return}
  const tab=new URLSearchParams(location.search).get('tab')==='students'?'students':'teachers';
  c.innerHTML=`<div class="oly-section-head"><div><h2>Cấu hình Olympic</h2><p>Phân quyền giảng viên và quản lý sinh viên tham gia từng môn.</p></div></div><div class="oly-toolbar" style="margin-bottom:18px"><a class="oly-btn ${tab==='teachers'?'primary':''}" href="?tab=teachers">Giảng viên & phân quyền</a><a class="oly-btn ${tab==='students'?'primary':''}" href="?tab=students">Sinh viên Olympic</a></div><div id="adminTabBody"></div>`;
  if(tab==='students')return renderAdminStudents($('#adminTabBody'));
  return renderAdminTeachers($('#adminTabBody'));
}

async function renderAdminTeachers(c){
  const [p,a]=await Promise.all([
    db.from('profiles').select('id,full_name,email,role,is_active').in('role',['admin','teacher','lecturer','giangvien']).order('full_name'),
    db.from('olympic_teacher_subjects').select('*')
  ]);
  if(p.error)throw p.error;if(a.error)throw a.error;const assignments=a.data||[];
  c.innerHTML=`<div class="oly-section-head" style="margin-top:0"><div><h2>Phân quyền giảng viên theo môn</h2><p>Giảng viên chỉ quản lý môn được cấp; Admin quản lý cả hai môn.</p></div></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Giảng viên</th>${state.subjects.map(s=>`<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${(p.data||[]).map(u=>`<tr><td><b>${esc(u.full_name)}</b><br><span style="color:#829ab1">${esc(u.email)} · ${esc(u.role)}</span></td>${state.subjects.map(s=>{const yes=u.role==='admin'||assignments.some(x=>x.profile_id===u.id&&x.subject_id===s.id);return `<td>${u.role==='admin'?'<span class="oly-badge approved">Toàn quyền</span>':`<label><input type="checkbox" data-assign-profile="${u.id}" data-assign-subject="${s.id}" ${yes?'checked':''}> Quản lý</label>`}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
  $$('[data-assign-profile]',c).forEach(ch=>ch.onchange=async()=>{
    const profile_id=ch.dataset.assignProfile,subject_id=ch.dataset.assignSubject;
    if(ch.checked){const r=await db.from('olympic_teacher_subjects').upsert({profile_id,subject_id,created_by:state.user.id},{onConflict:'subject_id,profile_id'});if(r.error){ch.checked=false;return fail(r.error)}}
    else{const r=await db.from('olympic_teacher_subjects').delete().eq('profile_id',profile_id).eq('subject_id',subject_id);if(r.error){ch.checked=true;return fail(r.error)}}
    toast('Đã cập nhật phân quyền');
  });
}

async function renderAdminStudents(c){
  const [p,m]=await Promise.all([
    db.from('profiles').select('id,full_name,email,mssv,role,is_active').eq('role','student').order('full_name'),
    db.from('olympic_student_subjects').select('*')
  ]);
  if(p.error)throw p.error;if(m.error)throw m.error;
  const profiles=p.data||[],memberships=m.data||[];
  const subjectCount=sid=>memberships.filter(x=>x.subject_id===sid).length;
  c.innerHTML=`<div class="oly-grid" style="margin-bottom:16px"><div class="oly-card"><div class="math-icon">♙</div><h3>${profiles.length}</h3><p>Tài khoản sinh viên hiện có trong AI-CLO.</p></div>${state.subjects.map(s=>`<div class="oly-card"><div class="math-icon ${s.code==='calculus'?'gold':'green'}">${s.code==='calculus'?'∫':'A'}</div><h3>${subjectCount(s.id)}</h3><p>Sinh viên được gán vào ${esc(s.name)}.</p></div>`).join('')}</div><div class="oly-panel" style="margin-bottom:14px"><p style="margin:0;color:#486581;font-size:12px"><b>Nguyên tắc:</b> Olympic dùng chung tài khoản AI-CLO. Tại đây Admin chỉ gán/bỏ sinh viên theo môn; nếu cần tạo tài khoản mới hoặc nhập CSV, dùng trang Người dùng của AI-CLO chính.</p><div style="margin-top:10px"><a class="oly-btn small" href="/app.html">Mở AI-CLO → Người dùng</a></div></div><div class="oly-toolbar"><div class="grow"><input class="oly-input" id="adminStudentSearch" placeholder="Tìm theo họ tên, email hoặc MSSV…"></div><select class="oly-select" id="adminStudentFilter" style="width:auto"><option value="all">Tất cả sinh viên</option>${state.subjects.flatMap(s=>[`<option value="in:${s.id}">Đã gán · ${esc(s.name)}</option>`,`<option value="out:${s.id}">Chưa gán · ${esc(s.name)}</option>`]).join('')}</select><select class="oly-select" id="adminStudentStatus" style="width:auto"><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Sinh viên</th><th>Email / MSSV</th><th>Trạng thái</th>${state.subjects.map(s=>`<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody id="adminStudentRows"></tbody></table></div>`;
  const has=(uid,sid)=>memberships.some(x=>x.profile_id===uid&&x.subject_id===sid);
  const draw=()=>{
    const q=normalizeText($('#adminStudentSearch').value),f=$('#adminStudentFilter').value,status=$('#adminStudentStatus').value;
    let list=profiles.filter(x=>!q||normalizeText(`${x.full_name} ${x.email} ${x.mssv||''}`).includes(q)).filter(x=>status==='all'||(status==='active'?x.is_active!==false:x.is_active===false));
    if(f!=='all'){const [mode,sid]=f.split(':');list=list.filter(x=>mode==='in'?has(x.id,sid):!has(x.id,sid))}
    $('#adminStudentRows').innerHTML=list.length?list.map(u=>`<tr><td><b>${esc(u.full_name||'—')}</b></td><td>${esc(u.email||'—')}<br><span style="color:#829ab1">${esc(u.mssv||'')}</span></td><td><span class="oly-badge ${u.is_active===false?'draft':'published'}">${u.is_active===false?'Đã khóa':'Hoạt động'}</span></td>${state.subjects.map(s=>`<td><label><input type="checkbox" data-student-profile="${u.id}" data-student-subject="${s.id}" ${has(u.id,s.id)?'checked':''}> Tham gia</label></td>`).join('')}</tr>`).join(''):`<tr><td colspan="${3+state.subjects.length}"><div class="oly-empty"><b>Không có sinh viên phù hợp.</b></div></td></tr>`;
  };
  draw();$('#adminStudentSearch').oninput=draw;$('#adminStudentFilter').onchange=draw;$('#adminStudentStatus').onchange=draw;
  $('#adminStudentRows').addEventListener('change',async e=>{
    const ch=e.target.closest('[data-student-profile]');if(!ch)return;
    const profile_id=ch.dataset.studentProfile,subject_id=ch.dataset.studentSubject;
    if(ch.checked){const r=await db.from('olympic_student_subjects').upsert({profile_id,subject_id,created_by:state.user.id},{onConflict:'subject_id,profile_id'});if(r.error){ch.checked=false;return fail(r.error)};memberships.push({profile_id,subject_id,created_by:state.user.id})}
    else{const r=await db.from('olympic_student_subjects').delete().eq('profile_id',profile_id).eq('subject_id',subject_id);if(r.error){ch.checked=true;return fail(r.error)};const i=memberships.findIndex(x=>x.profile_id===profile_id&&x.subject_id===subject_id);if(i>=0)memberships.splice(i,1)}
    toast('Đã cập nhật sinh viên Olympic');
  });
}
