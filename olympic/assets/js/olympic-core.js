/* AI-CLO OLYMPIC V2 — persistent app shell, soft router, Supabase data layer */
(()=>{
'use strict';

const APP_VERSION='2.0.0';
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=window.AICLO_CONFIG||{};
const db=window.supabase?.createClient?.(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);

let page='home';
let subjectCode='';
let routeSeq=0;
let shellReady=false;

const state={
  user:null,
  profile:null,
  subjects:[],
  subject:null,
  dirty:false,
  cache:{trees:new Map(),lessons:new Map()}
};

const labels={
  home:['Olympic Toán sinh viên','Không gian học tập và luyện thi Olympic'],
  subject:['Tổng quan môn','Nội dung, bài học và luyện tập'],
  contents:['Nội dung cần học','Cây chuyên đề do giảng viên quản lý'],
  lessons:['Bài học','Lý thuyết, ví dụ và bài giảng TeX'],
  practice:['Luyện tập','Bài tập theo chuyên đề'],
  problems:['Ngân hàng bài toán','Bài toán Olympic được tuyển chọn'],
  tests:['Đề luyện','Đề luyện và thi thử'],
  results:['Kết quả','Theo dõi tiến độ học tập'],
  teacher:['Khu vực giảng viên','Biên soạn và quản lý học liệu'],
  teacherContents:['Quản lý nội dung','Thêm, sửa và sắp xếp cây nội dung'],
  teacherLessons:['Soạn bài học','Trình soạn TeX và xem trước trực tiếp'],
  teacherProblems:['Quản lý bài toán','Ngân hàng bài toán Olympic'],
  teacherTests:['Quản lý đề luyện','Tạo đề luyện và thi thử'],
  teacherStudents:['Sinh viên','Theo dõi hoạt động học tập'],
  admin:['Cấu hình Olympic','Phân quyền giảng viên theo môn']
};

const subjFallback={
  algebra:{code:'algebra',name:'Đại số',desc:'Ma trận, đại số tuyến tính, đa thức và các bài toán rời rạc.'},
  calculus:{code:'calculus',name:'Giải tích',desc:'Giới hạn, đạo hàm, tích phân, chuỗi và các bài toán giải tích Olympic.'}
};

const featurePages=new Set(['contents','lessons','practice','problems','tests','results']);
const teacherPages={contents:'teacherContents',lessons:'teacherLessons',problems:'teacherProblems',tests:'teacherTests',students:'teacherStudents'};
const CACHE_TTL=30000;

const role=()=>state.profile?.role||'guest';
const staff=()=>['admin','teacher','lecturer','giangvien'].includes(role());
const admin=()=>role()==='admin';
const subjectUrl=(code=subjectCode)=>`/olympic/${code}/`;
const subjectFeatureUrl=(feature,code=subjectCode)=>`/olympic/${code}/${feature}/`;

function toast(message,bad=false){
  const x=$('#olyToast');
  if(!x)return;
  x.textContent=message;
  x.className='oly-toast show'+(bad?' error':'');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>x.className='oly-toast',2700);
}
function fail(error){console.error(error);toast(error?.message||'Có lỗi xảy ra',true)}

function routeFromPath(pathname=location.pathname){
  let p=pathname.replace(/\/index\.html$/,'/');
  if(!p.endsWith('/'))p+='/';
  if(p==='/olympic/')return {valid:true,page:'home',subjectCode:''};
  if(p==='/olympic/admin/')return {valid:true,page:'admin',subjectCode:''};
  if(p==='/olympic/teacher/')return {valid:true,page:'teacher',subjectCode:''};
  let m=p.match(/^\/olympic\/teacher\/([^/]+)\/$/);
  if(m&&teacherPages[m[1]])return {valid:true,page:teacherPages[m[1]],subjectCode:''};
  m=p.match(/^\/olympic\/(algebra|calculus)\/$/);
  if(m)return {valid:true,page:'subject',subjectCode:m[1]};
  m=p.match(/^\/olympic\/(algebra|calculus)\/([^/]+)\/$/);
  if(m&&featurePages.has(m[2]))return {valid:true,page:m[2],subjectCode:m[1]};
  return {valid:false,page:'home',subjectCode:''};
}

function applyRoute(route){
  page=route.page;
  subjectCode=route.subjectCode;
  document.body.dataset.olympicPage=page;
  if(subjectCode)document.body.dataset.subject=subjectCode;else delete document.body.dataset.subject;
  state.subject=state.subjects.find(x=>x.code===subjectCode)||null;
}

function routeTitle(){
  const label=(labels[page]||labels.home)[0];
  const subjectName=(state.subject||subjFallback[subjectCode])?.name;
  if(subjectCode&&page!=='subject')return `${label} ${subjectName} | AI-CLO OLYMPIC`;
  if(subjectCode)return `${subjectName} | AI-CLO OLYMPIC`;
  return `${label} | AI-CLO OLYMPIC`;
}

function navItems(){
  if(page.startsWith('teacher'))return [
    ['teacher','⌂','Tổng quan','/olympic/teacher/'],
    ['teacherContents','≡','Nội dung','/olympic/teacher/contents/'],
    ['teacherLessons','∑','Bài học','/olympic/teacher/lessons/'],
    ['teacherProblems','?','Bài toán','/olympic/teacher/problems/'],
    ['teacherTests','✎','Đề luyện','/olympic/teacher/tests/'],
    ['teacherStudents','♙','Sinh viên','/olympic/teacher/students/']
  ];
  if(page==='admin')return [['admin','⚙','Cấu hình','/olympic/admin/']];
  if(subjectCode)return [
    ['subject','⌂','Tổng quan',subjectUrl()],
    ['contents','≡','Nội dung học',subjectFeatureUrl('contents')],
    ['lessons','∑','Bài học',subjectFeatureUrl('lessons')],
    ['practice','✓','Luyện tập',subjectFeatureUrl('practice')],
    ['problems','?','Bài toán',subjectFeatureUrl('problems')],
    ['tests','✎','Đề luyện',subjectFeatureUrl('tests')],
    ['results','◫','Kết quả',subjectFeatureUrl('results')]
  ];
  return [['home','⌂','Tổng quan','/olympic/']];
}

function buildShell(){
  if(shellReady)return;
  document.body.innerHTML=`<div class="oly-shell">
    <aside class="oly-sidebar" id="olySide">
      <a class="oly-brand" href="/olympic/"><span class="oly-mark">∑</span><span class="oly-brand-text"><span class="oly-brand-name">AI<span class="clo">-CLO</span></span><span class="oly-brand-sub">OLYMPIC</span></span></a>
      <div id="olySubjectSlot"></div>
      <nav class="oly-nav" id="olyNav"></nav>
      <div class="oly-side-foot"><div class="oly-user" id="olyUser"></div><div class="oly-side-actions" id="olySideActions"></div></div>
    </aside>
    <div class="oly-overlay" id="olyOverlay"></div>
    <main class="oly-main">
      <header class="oly-topbar">
        <button class="oly-menu" id="olyMenu" aria-label="Mở menu">☰</button>
        <div class="oly-crumb"><small id="olyCrumbSmall"></small><h1 id="olyCrumbTitle"></h1></div>
        <div class="oly-top-actions" id="olyTopActions"></div>
      </header>
      <div class="oly-content" id="olyContent" aria-live="polite"></div>
      <footer class="oly-footer"><span>© 2026 AI-CLO OLYMPIC · PTITHCM</span><nav><a href="/">Trang chủ</a><a href="/app.html">AI-CLO</a><a href="/huong-dan.html">Hướng dẫn</a></nav></footer>
    </main>
  </div>
  <dialog class="oly-dialog" id="olyDialog"><div class="oly-dialog-head"><h3 id="olyDialogTitle"></h3><button type="button" id="olyDialogClose">×</button></div><div class="oly-dialog-body" id="olyDialogBody"></div></dialog>
  <div class="oly-toast" id="olyToast"></div>`;
  shellReady=true;
  $('#olyMenu').onclick=()=>{$('#olySide').classList.add('open');$('#olyOverlay').classList.add('show')};
  $('#olyOverlay').onclick=()=>closeMobileNav();
  $('#olyDialogClose').onclick=()=>$('#olyDialog').close();
  updateShell();
}

function closeMobileNav(){
  $('#olySide')?.classList.remove('open');
  $('#olyOverlay')?.classList.remove('show');
}

function updateShell(){
  if(!shellReady)return;
  const title=labels[page]||labels.home;
  const subjectName=(state.subject||subjFallback[subjectCode])?.name||'';
  document.title=routeTitle();
  $('#olySubjectSlot').innerHTML=subjectName?`<div class="oly-subject-pill">Môn hiện tại · <b>${esc(subjectName)}</b></div>`:'';
  $('#olyNav').innerHTML=navItems().map(([id,sym,name,url])=>`<a class="${id===page?'active':''}" href="${url}"><span class="symbol">${sym}</span>${name}</a>`).join('');
  $('#olyCrumbSmall').textContent='AI-CLO OLYMPIC'+(subjectName?' · '+subjectName:'');
  $('#olyCrumbTitle').textContent=title[0];
  $('#olyTopActions').innerHTML=`<a class="hide-mobile" href="/olympic/">Olympic</a>${staff()?'<a class="primary" href="/olympic/teacher/">Giảng viên</a>':''}${admin()?'<a href="/olympic/admin/">Admin</a>':''}`;
  const isAuth=!!state.user;
  $('#olyUser').innerHTML=isAuth?`<b>${esc(state.profile?.full_name||state.user.email)}</b>${esc(state.profile?.role||'')}`:'<b>Chúa đăng nhập</b>Dùng tài ktoản AI-CLO PTDITHCM';
  $('#olySideActions').innerHTML=`<a href="/app.html">AI-CLO</a>${isAuth?'<button id="olyLogout">Đăng xuất</button>':'<button id="olyLoginOpen">Đăng nhập</button>'}`;
  $('#olyLoginOpen')?.addEventListener('click',loginDialog);
  $('#olyLogout')?.addEventListener('click',logout);
}

function dialog(title,html){
  $('#olyDialogTitle').textContent=title;
  $('#olyDialogBody').innerHTML=html;
  $('#olyDialog').showModal();
}

function loginDialog(){
  if(!db)return toast('Không tải được Supabase',true);
  dialog('Đăng nhập AI-CLO OLYMPIC',`<form id="olyLoginForm" class="oly-form-grid">
    <label class="oly-field wide"><span>Email</span><input class="oly-input" name="email" type="email" autocomplete="email" required></label>
    <label class="oly-field wide"><span>Mật khẩu</span><input class="oly-input" name="password" type="password" autocomplete="current-password" required minlength="6"></label>
    <div class="oly-form-actions"><button class="oly-btn primary">Đăng nhập</button></div>
  </form>`);
  $('#olyLoginForm').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const btn=form.querySelector('button');
    btn.disabled=true;
    const v=Object.fromEntries(new FormData(form));
    try{
      const {data,error}=await db.auth.signInWithPassword(v);
      if(error)throw error;
      state.user=data.session?.user||null;
      await loadProfileAndSubjects();
      $('#olyDialog').close();
      updateShell();
      await refreshRoute({scroll:false});
      toast('Đăng nhập thành công');
    }catch(error){fail(error);btn.disabled=false}
  };
}

async function logout(){
  if(!db)return;
  await db.auth.signOut();
  state.user=null;state.profile=null;state.subjects=[];state.subject=null;clearDataCache();
  updateShell();
  await navigateTo('/olympic/',{replace:true,force:true});
}

function authGate(message='Đăng nhập để sử dụng khu vực Olympic.'){return `<div class="oly-login"><span class="oly-kicker">AI-CLO OLYMPIC</span><h2>Đăng nhập hệ thống</h2><p>${esc(message)}</p><button class="oly-btn primary" id="gateLogin">Đăng nhập bằng tài khoản AI-CLO</button></div>`}
function wireGate(){$('#gateLogin')?.addEventListener('click',loginDialog)}

async function loadSession(){
  if(!db)return;
  const {data}=await db.auth.getSession();
  state.user=data.session?.user||null;
}

async function loadProfileAndSubjects(){
  state.profile=null;state.subjects=[];state.subject=null;
  if(!db