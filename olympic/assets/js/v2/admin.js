async function renderTeacherPlaceholder(c,kind){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  const m={teacherProblems:['Ngân hàng bài toán','?','V2 đã tách trang riêng. Bước tiếp theo sẽ nối câu trắc nghiệm, điền đáp số, tự luận, gợi ý và lời giải.'],teacherTests:['Đề luyện','π','Trang cấu hình đề luyện/thi thử sẽ dùng dữ liệu Olympic riêng, không ảnh hưởng ngân hàng CLO hiện tại.'],teacherStudents:['Theo dõi sinh viên','♙','Trang này sẽ tổng hợp tiến độ học, lượt luyện và kết quả theo chuyên đề.']}[kind];
  c.innerHTML=`<section class="oly-hero"><span class="oly-kicker">Teacher workspace</span><h2>${m[1]} ${m[0]}</h2><p>${m[2]}</p></section><div class="oly-section-head"><div><h2>Trang con đã được tách riêng</h2><p>Có thể phát triển độc lập mà không làm phình một file Olympic duy nhất.</p></div></div>`;
}

async function renderAdmin(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!admin()){c.innerHTML='<div class="oly-panel oly-empty"><b>Chỉ Admin được truy cập.</b></div>';return}
  const [p,a]=await Promise.all([
    db.from('profiles').select('id,full_name,email,role,is_active').in('role',['admin','teacher','lecturer','giangvien']).order('full_name'),
    db.from('olympic_teacher_subjects').select('*')
  ]);
  if(p.error)throw p.error;if(a.error)throw a.error;const assignments=a.data||[];
  c.innerHTML=`<div class="oly-section-head"><div><h2>Phân quyền giảng viên theo môn</h2><p>Giảng viên chỉ quản lý môn được cấp; Admin quản lý cả hai môn.</p></div></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Giảng viên</th>${state.subjects.map(s=>`<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${(p.data||[]).map(u=>`<tr><td><b>${esc(u.full_name)}</b><br><span style="color:#829ab1">${esc(u.email)} · ${esc(u.role)}</span></td>${state.subjects.map(s=>{const yes=u.role==='admin'||assignments.some(x=>x.profile_id===u.id&&x.subject_id===s.id);return `<td>${u.role==='admin'?'<span class="oly-badge approved">Toàn quyền</span>':`<label><input type="checkbox" data-assign-profile="${u.id}" data-assign-subject="${s.id}" ${yes?'checked':''}> Quản lý</label>`}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
  $$('[data-assign-profile]').forEach(ch=>ch.onchange=async()=>{
    const profile_id=ch.dataset.assignProfile,subject_id=ch.dataset.assignSubject;
    if(ch.checked){const r=await db.from('olympic_teacher_subjects').upsert({profile_id,subject_id,created_by:state.user.id},{onConflict:'subject_id,profile_id'});if(r.error){ch.checked=false;return fail(r.error)}}
    else{const r=await db.from('olympic_teacher_subjects').delete().eq('profile_id',profile_id).eq('subject_id',subject_id);if(r.error){ch.checked=true;return fail(r.error)}}
    toast('Đã cập nhật phân quyền');
  });
}
