const renderers={
  home:renderHome,
  subject:renderSubject,
  contents:renderContents,
  lessons:renderLessons,
  practice:c=>renderComing(c,'practice'),
  problems:c=>renderComing(c,'problems'),
  tests:renderTests,
  results:c=>renderComing(c,'results'),
  teacher:renderTeacher,
  teacherContents:renderTeacherContents,
  teacherLessons:renderTeacherLessons,
  teacherProblems:c=>renderTeacherPlaceholder(c,'teacherProblems'),
  teacherTests:c=>renderTeacherPlaceholder(c,'teacherTests'),
  teacherStudents:c=>renderTeacherPlaceholder(c,'teacherStudents'),
  admin:renderAdmin
};

async function renderRoute({scroll=true}={}){
  const route=routeFromPath();
  if(!route.valid){
    const c=$('#olyContent');
    if(c)c.innerHTML='<div class="oly-panel oly-empty"><b>Đường dẫn Olympic không hợp lệ.</b></div>';
    return;
  }
  const token=++routeSeq;
  applyRoute(route);
  updateShell();
  const old=$('#olyContent');
  if(!old)return;
  const c=old.cloneNode(false);
  c.innerHTML='';
  old.replaceWith(c);
  c.setAttribute('aria-busy','true');
  try{
    const fn=renderers[page]||renderHome;
    await fn(c);
    if(token!==routeSeq)return;
    await typeset(c);
    if(scroll)window.scrollTo({top:0,left:0,behavior:'auto'});
  }catch(e){
    if(token!==routeSeq)return;
    fail(e);
    c.innerHTML=`<div class="oly-panel"><b>Không thể tải trang Olympic.</b><p>${esc(e.message||e)}</p></div>`;
  }finally{
    if(token===routeSeq)c.removeAttribute('aria-busy');
  }
}
