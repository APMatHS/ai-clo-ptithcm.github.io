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

function shellSubject(){
  if(page.startsWith('teacher')){
    const code=preferredTeacherSubjectCode();
    return state.subjects.find(x=>x.code===code)||subjFallback[code]||null;
  }
  if(state.subject)return state.subject;
  if(subjectCode)return state.subjects.find(x=>x.code===subjectCode)||subjFallback[subjectCode]||null;
  return null;
}

function topArea(){
  if(page==='admin')return 'admin';
  if(page.startsWith('teacher'))return 'teacher';
  return 'olympic';
}

function updateShell(){
  if(!shellReady)return;
  const title=labels[page]||labels.home;
  const contextSubject=shellSubject();
  const subjectName=contextSubject?.name||'';
  document.title=routeTitle();
  $('#olySubjectSlot').innerHTML=subjectName?`<div class="oly-subject-pill">Môn hiện tại · <b>${esc(subjectName)}</b></div>`:'';
  $('#olyNav').innerHTML=navItems().map(([id,sym,name,url])=>`<a class="${id===page?'active':''}" href="${url}" ${id===page?'aria-current="page"':''}><span class="symbol">${sym}</span>${name}</a>`).join('');
  $('#olyCrumbSmall').textContent='AI-CLO OLYMPIC'+(subjectName?' · '+subjectName:'');
  $('#olyCrumbTitle').textContent=title[0];
  const area=topArea();
  const currentTeacherCode=subjectCode||preferredTeacherSubjectCode();
  const topLink=(name,url,key,visible=true,extra='')=>visible?`<a class="${[area===key?'primary':'',extra].filter(Boolean).join(' ')}" href="${url}" ${area===key?'aria-current="page"':''}>${name}</a>`:'';
  $('#olyTopActions').innerHTML=`${topLink('Olympic','/olympic/','olympic',true,'hide-mobile')}${topLink('Giảng viên',teacherUrl('',currentTeacherCode),'teacher',staff())}${topLink('Admin','/olympic/admin/','admin',admin())}`;
  const isAuth=!!state.user;
  $('#olyUser').innerHTML=isAuth?`<b>${esc(state.profile?.full_name||state.user.email)}</b>${esc(state.profile?.role||'')}`:'<b>Chưa đăng nhập</b>Dùng tài khoản AI-CLO PTITHCM';
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
    try{
      const values=Object.fromEntries(new FormData(form));
      const {data,error}=await db.auth.signInWithPassword(values);
      if(error)throw error;
      state.user=data.user||data.session?.user||null;
      await loadProfileAndSubjects();
      $('#olyDialog').close();
      updateShell();
      await refreshRoute({scroll:false});
      toast('Đăng nhập thành công');
    }catch(err){fail(err)}finally{btn.disabled=false}
  };
}

async function logout(){
  try{await db?.auth.signOut()}catch(e){console.warn(e)}
  state.user=null;state.profile=null;state.subjects=[];state.subject=null;clearDataCache();
  updateShell();
  navigateTo('/olympic/',{replace:true,force:true});
}

function authGate(message='Đăng nhập để sử dụng khu vực Olympic.'){
  return `<div class="oly-login"><span class="oly-kicker">AI-CLO OLYMPIC</span><h2>Đăng nhập hệ thống</h2><p>${esc(message)}</p><button class="oly-btn primary" id="gateLogin">Đăng nhập bằng tài khoản AI-CLO</button></div>`;
}
function wireGate(){ $('#gateLogin')?.addEventListener('click',loginDialog) }
