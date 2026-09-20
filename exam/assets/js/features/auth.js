import { signInStaff,signOutStaff,getStaffContext } from '../core/supabase.js';
import { studentApi,getDeviceId } from '../services/student-api.js';
import { setState } from '../state.js';
import { navigate } from '../router.js';
import { toast,setBusy,errorMessage,escapeHtml } from '../core/ui.js';

export function renderAuth(root,mode='student'){
  root.innerHTML=`<section class="auth-shell">
    <div class="auth-brand"><div class="brand-mark"><strong>AI-CLO</strong><span>EXAM</span></div><h1>Hệ thống thi trực tuyến</h1><p>Thi giữa kỳ, cuối kỳ và các kỳ thi tập trung. Đề thi, ca thi, phòng thi và bài làm được quản lý tách biệt với AI-CLO chính.</p></div>
    <div class="auth-panel"><div class="auth-card">
      <div class="segmented" style="margin-bottom:20px;width:100%"><button data-mode="student" class="${mode==='student'?'active':''}" style="flex:1">Sinh viên</button><button data-mode="staff" class="${mode==='staff'?'active':''}" style="flex:1">Giảng viên / Khảo thí</button></div>
      <div data-auth-body></div>
    </div></div>
  </section>`;
  root.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>renderAuth(root,btn.dataset.mode)));
  if(mode==='staff') mountStaff(root.querySelector('[data-auth-body]')); else mountStudent(root.querySelector('[data-auth-body]'));
}

function mountStaff(host){
  host.innerHTML=`<div class="stack"><div><h2>Đăng nhập quản trị kỳ thi</h2><p class="muted">Dành cho Admin, Khảo thí, Giảng viên và Giám thị.</p></div><form id="staff-login" class="stack"><div class="field"><label>Email</label><input class="input" name="email" type="email" autocomplete="username" required></div><div class="field"><label>Mật khẩu</label><input class="input" name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary" type="submit">Đăng nhập</button></form><div class="alert">Tài khoản phải được Admin kích hoạt trước khi sử dụng hệ thống thi.</div></div>`;
  host.querySelector('#staff-login').addEventListener('submit',async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button[type=submit]');setBusy(btn,true);try{const fd=new FormData(e.currentTarget);await signInStaff(fd.get('email'),fd.get('password'));const {session,profile}=await getStaffContext();if(!profile?.active){await signOutStaff();throw new Error('Tài khoản chưa được Admin kích hoạt.');}setState({staff:session,profile});navigate('/');}catch(err){toast(errorMessage(err),'error');}finally{setBusy(btn,false);}});
}

function mountStudent(host){
  host.innerHTML=`<div class="stack"><div><h2>Vào phòng thi</h2><p class="muted">Nhập MSSV và mã thi riêng được cấp cho kỳ thi này.</p></div><form id="student-login" class="stack"><div class="field"><label>MSSV</label><input class="input" name="studentCode" autocomplete="off" spellcheck="false" required></div><div class="field"><label>Mã thi</label><input class="input" name="accessCode" autocomplete="one-time-code" spellcheck="false" required></div><button class="btn btn-primary" type="submit">Vào phòng thi</button></form><p class="muted" style="font-size:12px">Mã thi chỉ dùng cho đúng sinh viên và kỳ thi được cấp.</p></div>`;
  host.querySelector('#student-login').addEventListener('submit',async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button[type=submit]');setBusy(btn,true);try{const fd=new FormData(e.currentTarget);const data=await studentApi.login(String(fd.get('studentCode')||''),String(fd.get('accessCode')||''),getDeviceId());if(data.status==='submitted'){host.innerHTML=`<div class="stack"><h2>Đã nộp bài</h2><p><strong>${escapeHtml(data.student?.fullName||'')}</strong></p><p>${escapeHtml(data.exam?.name||'')}</p>${data.scoreVisible?`<div class="stat-value">${escapeHtml(data.score)}</div>`:'<div class="alert">Kết quả chưa được công bố.</div>'}</div>`;return;}setState({studentSession:data});navigate('/student');}catch(err){toast(errorMessage(err),'error');}finally{setBusy(btn,false);}});
}
