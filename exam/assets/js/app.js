import { getStaffContext,signOutStaff,supabase } from './core/supabase.js';
import { startRouter,navigate } from './router.js';
import { getState,setState,resetStaffState } from './state.js';
import { renderAuth } from './features/auth.js';
import { renderDashboard } from './features/dashboard.js';
import { renderExamList } from './features/exams/list.js';
import { renderExamDetail } from './features/exams/detail.js';
import { renderLive } from './features/live.js';
import { renderResults } from './features/results.js';
import { renderStudent } from './features/student.js';
import { toast,escapeHtml,errorMessage } from './core/ui.js';

const root=document.getElementById('app');
let routeSeq=0;

async function bootstrap(){
  try{const {session,profile}=await getStaffContext();setState({staff:session,profile});}catch(e){console.warn('Staff context unavailable',e);resetStaffState();}
  document.addEventListener('click',async e=>{const btn=e.target.closest?.('#staff-logout,#staff-logout-mobile');if(!btn)return;e.preventDefault();try{await signOutStaff();}catch{}resetStaffState();navigate('/staff');});
  supabase.auth.onAuthStateChange((_event,session)=>{if(!session&&getState().staff){resetStaffState();if(location.hash!=='#/student')navigate('/staff');}});
  startRouter(renderRoute);
}

async function renderRoute(route){
  const seq=++routeSeq;
  try{
    if(route.name==='student'){await renderStudent(root);return;}
    let {profile}=getState();
    if(route.name==='staff'&&!profile){renderAuth(root,'staff');return;}
    if(!profile){
      if(route.name==='home')renderAuth(root,'student');else renderAuth(root,'staff');
      return;
    }
    if(!profile.active){renderAuth(root,'staff');return;}
    if(route.name==='staff'){navigate('/');return;}
    if(route.name==='home')await renderDashboard(root,profile);
    else if(route.name==='exams')await renderExamList(root,profile);
    else if(route.name==='exam')await renderExamDetail(root,profile,route.params.examId);
    else if(route.name==='live')await renderLive(root,profile,route.params.examId);
    else if(route.name==='results')await renderResults(root,profile,route.params.examId);
    else renderNotFound();
  }catch(error){if(seq!==routeSeq)return;console.error(error);const message=errorMessage(error);root.innerHTML=`<div class="boot-screen"><div class="brand-mark"><strong>AI-CLO</strong><span>EXAM</span></div><h2>Không thể mở trang</h2><p>${escapeHtml(message)}</p><div class="row"><a class="btn btn-secondary" href="#/">Tổng quan</a><button class="btn btn-secondary" data-retry>Thử lại</button></div></div>`;root.querySelector('[data-retry]')?.addEventListener('click',()=>renderRoute(route));toast(message,'error',5000);}
}

function renderNotFound(){root.innerHTML=`<div class="boot-screen"><div class="brand-mark"><strong>AI-CLO</strong><span>EXAM</span></div><h2>Không tìm thấy trang</h2><a class="btn btn-secondary" href="#/">Về Tổng quan</a></div>`;}

bootstrap();
