async function run(){
  try{
    const initial=routeFromPath();
    if(!initial.valid)return;
    applyRoute(initial);
    await loadSession();
    buildShell();
    const c=$('#olyContent');
    if(c)c.innerHTML='<div class="oly-panel oly-empty"><b>Đang tải không gian Olympic…</b></div>';
    await loadProfileAndSubjects();
    applyRoute(routeFromPath());
    updateShell();
    installRouter();
    await renderRoute({scroll:false});
  }catch(e){
    console.error(e);buildShell();fail(e);
    const c=$('#olyContent');if(c)c.innerHTML=`<div class="oly-panel"><b>Không thể khởi tạo AI-CLO OLYMPIC.</b><p>${esc(e.message||e)}</p></div>`;
  }
}

window.OlympicApp={version:APP_VERSION,navigate:navigateTo,refresh:refreshRoute,invalidate:clearDataCache,get state(){return state},get route(){return {page,subjectCode}},supabase:db};
document.addEventListener('DOMContentLoaded',run,{once:true});
