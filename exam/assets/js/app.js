import { getStaffContext,signOutStaff,supabase } from './core/supabase.js';
import { startRouter,navigate } from './router.js';
import { getState,setState,resetStaffState } from './state.js';
import { toast,escapeHtml,errorMessage } from './core/ui.js?v=1.0.1';

const root=document.getElementById('app');
let routeSeq=0;

const featureLoaders={
  auth:()=>import('./features/auth.js'),
  dashboard:()=>import('./features/dashboard.js'),
  exams:()=>import('./features/exams/list.js'),
  exam:()=>import('./features/exams/detail.js'),
  live:()=>import('./features/live.js'),
  results:()=>import('./features/results.js'),
  student:()=>import('./features/student.js'),
  accounts:()=>import('./features/accounts.js')
};

async function renderAuth(mode='student'){
  const mod=await featureLoaders.auth();
  return mod.renderAuth(root,mode);
}

async function bootstrap(){
  try{
    try{
      const {session,profile}=await getStaffContext();
      setState({staff:session,profile});
    }catch(error){
      console.warn('Staff context unavailable',error);
      resetStaffState();
    }

    document.addEventListener('click',async event=>{
      const btn=event.target.closest?.('#staff-logout,#staff-logout-mobile');
      if(!btn)return;
      event.preventDefault();
      try{await signOutStaff();}catch{}
      resetStaffState();
      navigate('/staff');
    });

    supabase.auth.onAuthStateChange((_event,session)=>{
      if(!session&&getState().staff){
        resetStaffState();
        if(location.hash!=='#/student')navigate('/staff');
      }
    });

    startRouter(renderRoute);
    globalThis.__examBootReady?.();
  }catch(error){
    console.error('Exam bootstrap failed',error);
    globalThis.__examBootFail?.(errorMessage(error));
  }
}

async function renderRoute(route){
  const seq=++routeSeq;
  try{
    if(route.name==='student'){
      const {renderStudent}=await featureLoaders.student();
      await renderStudent(root);
      return;
    }

    const {profile}=getState();
    if(route.name==='staff'&&!profile){await renderAuth('staff');return;}
    if(!profile){await renderAuth(route.name==='home'?'student':'staff');return;}
    if(!profile.active){await renderAuth('staff');return;}
    if(route.name==='staff'){navigate('/');return;}

    if(route.name==='home'){
      const {renderDashboard}=await featureLoaders.dashboard();
      await renderDashboard(root,profile);
    }else if(route.name==='exams'){
      const {renderExamList}=await featureLoaders.exams();
      await renderExamList(root,profile);
    }else if(route.name==='accounts'){
      const {renderAccounts}=await featureLoaders.accounts();
      await renderAccounts(root,profile);
    }else if(route.name==='exam'){
      const {renderExamDetail}=await featureLoaders.exam();
      await renderExamDetail(root,profile,route.params.examId);
    }else if(route.name==='live'){
      const {renderLive}=await featureLoaders.live();
      await renderLive(root,profile,route.params.examId);
    }else if(route.name==='results'){
      const {renderResults}=await featureLoaders.results();
      await renderResults(root,profile,route.params.examId);
    }else{
      renderNotFound();
    }
  }catch(error){
    if(seq!==routeSeq)return;
    console.error(error);
    const message=errorMessage(error);
    root.innerHTML=`<div class="boot-screen"><div class="brand-mark"><strong>AI-CLO</strong><span>EXAM</span></div><h2>Không thể mở trang</h2><p>${escapeHtml(message)}</p><div class="row"><a class="btn btn-secondary" href="#/">Tổng quan</a><button class="btn btn-secondary" data-retry>Thử lại</button></div></div>`;
    root.querySelector('[data-retry]')?.addEventListener('click',()=>renderRoute(route));
    toast(message,'error',5000);
  }
}

function renderNotFound(){
  root.innerHTML=`<div class="boot-screen"><div class="brand-mark"><strong>AI-CLO</strong><span>EXAM</span></div><h2>Không tìm thấy trang</h2><a class="btn btn-secondary" href="#/">Về Tổng quan</a></div>`;
}

bootstrap();
