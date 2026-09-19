function internalOlympicUrl(raw){
  try{
    const url=new URL(raw,location.href);
    if(url.origin!==location.origin)return null;
    if(!url.pathname.startsWith('/olympic/'))return null;
    const route=routeFromPath(url.pathname);
    return route.valid?url:null;
  }catch{return null}
}

function closeRouteDialog(){
  const d=$('#olyDialog');
  if(d?.open)d.close();
}

async function navigateTo(raw,{replace=false,force=false}={}){
  const url=new URL(raw,location.href);
  const route=internalOlympicUrl(url.href);
  if(!route){location.href=url.href;return}
  if(state.dirty&&!force&&url.href!==location.href&&!confirm('Bài học đang có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?'))return;
  state.dirty=false;
  closeRouteDialog();
  if(url.href===location.href&&!replace)return;
  history[replace?'replaceState':'pushState']({olympic:true},'',url.href);
  closeMobileNav();
  await renderRoute({scroll:true});
}

async function refreshRoute({scroll=false}={}){await renderRoute({scroll})}

function warmRoute(url){
  if(!state.user)return;
  const r=routeFromPath(url.pathname);
  if(!r.valid||!r.subjectCode)return;
  if(['subject','contents'].includes(r.page))loadTree(r.subjectCode).catch(()=>{});
  if(r.page==='lessons')loadPublishedLessons(r.subjectCode).catch(()=>{});
}

function installRouter(){
  document.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest('a[href]');
    if(!a||a.hasAttribute('download')||a.target&&a.target!=='_self'||a.dataset.hardNav!==undefined)return;
    const url=internalOlympicUrl(a.href);
    if(!url)return;
    e.preventDefault();navigateTo(url.href);
  });
  document.addEventListener('pointerover',e=>{
    const a=e.target.closest?.('a[href]');if(!a)return;
    const url=internalOlympicUrl(a.href);if(url)warmRoute(url);
  },{passive:true});
  window.addEventListener('popstate',()=>{state.dirty=false;closeRouteDialog();renderRoute({scroll:true})});
  window.addEventListener('beforeunload',e=>{if(!state.dirty)return;e.preventDefault();e.returnValue=''});
}
