/* AI-CLO OLYMPIC v1.4 — repair landing shell when async rendering stalls. */
(()=>{
'use strict';
const page=document.body?.dataset?.olympicPage||'';
if(!['home','subject'].includes(page))return;
const subject=document.body?.dataset?.subject||'';
const isSubject=page==='subject';
const isAlgebra=subject==='algebra';
const subjectName=isAlgebra?'Đại số':'Giải tích';
const subjectSymbol=isAlgebra?'A, λ, P(x)':'f′(x), ∫, ∑';
const base=isSubject?`/olympic/${subject}/`:'/olympic/';

function landingMarkup(){
  if(isSubject){
    return `<section class="oly-hero" data-olympic-repair><span class="oly-kicker">AI-CLO OLYMPIC · ${subjectName}</span><h2>${subjectSymbol}</h2><div class="oly-hero-actions"><a class="oly-btn gold" href="${base}contents/">Nội dung học →</a><a class="oly-btn ghost" href="${base}lessons/">Bài học</a></div></section><div class="oly-section-head"><div><h2>Các chức năng</h2></div></div><div class="oly-grid"><a class="oly-card clickable" href="${base}contents/"><span class="arrow">›</span><div class="math-icon">≡</div><h3>Nội dung học</h3></a><a class="oly-card clickable" href="${base}lessons/"><span class="arrow">›</span><div class="math-icon gold">∑</div><h3>Bài học</h3></a><a class="oly-card clickable" href="${base}practice/"><span class="arrow">›</span><div class="math-icon green">✓</div><h3>Luyện tập</h3></a><a class="oly-card clickable" href="${base}problems/"><span class="arrow">›</span><div class="math-icon">?</div><h3>Bài toán</h3></a><a class="oly-card clickable" href="${base}tests/"><span class="arrow">›</span><div class="math-icon gold">π</div><h3>Đề luyện</h3></a><a class="oly-card clickable" href="${base}results/"><span class="arrow">›</span><div class="math-icon green">↗</div><h3>Kết quả</h3></a></div>`;
  }
  return `<section class="oly-hero" data-olympic-repair><span class="oly-kicker">Mathematics · Training · Competition</span><h2>AI-CLO OLYMPIC</h2><div class="oly-hero-actions"><a class="oly-btn gold" href="/olympic/algebra/">Đại số →</a><a class="oly-btn ghost" href="/olympic/calculus/">Giải tích →</a></div></section><div class="oly-section-head"><div><h2>Chọn môn Olympic</h2></div></div><div class="oly-grid two"><a class="oly-card clickable" href="/olympic/algebra/"><span class="arrow">›</span><div class="math-icon">A</div><h3>Đại số</h3></a><a class="oly-card clickable" href="/olympic/calculus/"><span class="arrow">›</span><div class="math-icon gold">∫</div><h3>Giải tích</h3></a></div>`;
}

function topbarMarkup(){
  const title=isSubject?'Tổng quan môn':'Olympic Toán sinh viên';
  const crumb=isSubject?`AI-CLO OLYMPIC · ${subjectName}`:'AI-CLO OLYMPIC';
  return `<header class="oly-topbar" data-olympic-repair><button class="oly-menu" id="olyRepairMenu" type="button">☰</button><div class="oly-crumb"><small>${crumb}</small><h1>${title}</h1></div><div class="oly-top-actions"><a href="/olympic/">Olympic</a></div></header>`;
}

function footerMarkup(){
  return `<footer class="oly-footer" data-olympic-repair><span>© 2026 AI-CLO OLYMPIC · PTITHCM</span><nav><a href="/">Trang chủ</a><a href="/app.html">AI-CLO</a></nav></footer>`;
}

function bindRepairMenu(){
  const menu=document.querySelector('#olyRepairMenu');
  if(!menu||menu.dataset.bound)return;
  menu.dataset.bound='1';
  menu.addEventListener('click',()=>{
    document.querySelector('#olySide')?.classList.add('open');
    document.querySelector('#olyOverlay')?.classList.add('show');
  });
}

function repair(){
  const shell=document.querySelector('.oly-shell');
  if(!shell)return;

  let main=shell.querySelector('.oly-main');
  if(!main){
    main=document.createElement('main');
    main.className='oly-main';
    shell.appendChild(main);
  }
  main.style.display='flex';
  main.style.flexDirection='column';
  main.style.minWidth='0';
  main.style.minHeight='100vh';
  main.style.visibility='visible';
  main.style.opacity='1';

  let topbar=main.querySelector('.oly-topbar');
  if(!topbar){
    main.insertAdjacentHTML('afterbegin',topbarMarkup());
    topbar=main.querySelector('.oly-topbar');
  }
  if(topbar){
    topbar.style.display='flex';
    topbar.style.visibility='visible';
    topbar.style.opacity='1';
  }

  let content=main.querySelector('#olyContent');
  if(!content){
    content=document.createElement('div');
    content.id='olyContent';
    content.className='oly-content';
    const footer=main.querySelector('.oly-footer');
    footer?main.insertBefore(content,footer):main.appendChild(content);
  }
  content.style.display='block';
  content.style.visibility='visible';
  content.style.opacity='1';
  if(!content.children.length&&!content.textContent.trim())content.innerHTML=landingMarkup();

  if(!main.querySelector('.oly-footer'))main.insertAdjacentHTML('beforeend',footerMarkup());
  bindRepairMenu();
}

function startRepair(){
  repair();
  let count=0;
  const timer=setInterval(()=>{
    repair();
    count+=1;
    const content=document.querySelector('#olyContent');
    const ready=content&&(content.children.length>0||content.textContent.trim().length>0);
    if((ready&&count>=8)||count>=30)clearInterval(timer);
  },250);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRepair,{once:true});
else startRepair();
window.addEventListener('load',repair,{once:true});
window.addEventListener('error',()=>setTimeout(repair,0));
})();
