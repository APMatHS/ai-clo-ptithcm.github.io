/* AI-CLO OLYMPIC v1.3 — resilient landing-page fallback. */
(()=>{
'use strict';
const page=document.body?.dataset?.olympicPage||'';
if(!['home','subject'].includes(page))return;
const subject=document.body?.dataset?.subject||'';

function landingMarkup(){
  if(page==='subject'){
    const algebra=subject==='algebra';
    const name=algebra?'Đại số':'Giải tích';
    const symbol=algebra?'A, λ, P(x)':'f′(x), ∫, ∑';
    const base=`/olympic/${subject}/`;
    return `<section class="oly-hero" data-olympic-fallback><h2>${symbol}</h2><div class="oly-hero-actions"><a class="oly-btn gold" href="${base}contents/">Nội dung học →</a><a class="oly-btn ghost" href="${base}lessons/">Bài học</a></div></section><div class="oly-section-head"><div><h2>${name}</h2></div></div><div class="oly-grid"><a class="oly-card clickable" href="${base}contents/"><span class="arrow">›</span><div class="math-icon">≡</div><h3>Nội dung học</h3></a><a class="oly-card clickable" href="${base}lessons/"><span class="arrow">›</span><div class="math-icon gold">∑</div><h3>Bài học</h3></a><a class="oly-card clickable" href="${base}practice/"><span class="arrow">›</span><div class="math-icon green">✓</div><h3>Luyện tập</h3></a><a class="oly-card clickable" href="${base}problems/"><span class="arrow">›</span><div class="math-icon">?</div><h3>Bài toán</h3></a><a class="oly-card clickable" href="${base}tests/"><span class="arrow">›</span><div class="math-icon gold">π</div><h3>Đề luyện</h3></a><a class="oly-card clickable" href="${base}results/"><span class="arrow">›</span><div class="math-icon green">↗</div><h3>Kết quả</h3></a></div>`;
  }
  return `<section class="oly-hero" data-olympic-fallback><h2>AI-CLO OLYMPIC</h2><div class="oly-hero-actions"><a class="oly-btn gold" href="/olympic/algebra/">Đại số →</a><a class="oly-btn ghost" href="/olympic/calculus/">Giải tích →</a></div></section><div class="oly-section-head"><div><h2>Chọn môn Olympic</h2></div></div><div class="oly-grid two"><a class="oly-card clickable" href="/olympic/algebra/"><span class="arrow">›</span><div class="math-icon">A</div><h3>Đại số</h3></a><a class="oly-card clickable" href="/olympic/calculus/"><span class="arrow">›</span><div class="math-icon gold">∫</div><h3>Giải tích</h3></a></div>`;
}

function ensureLanding(){
  const content=document.querySelector('#olyContent');
  if(content){
    const hasRealContent=content.children.length>0 || content.textContent.trim().length>0;
    if(!hasRealContent)content.innerHTML=landingMarkup();
    return;
  }
  if(!document.body.textContent.trim()){
    document.body.innerHTML=`<main class="oly-content">${landingMarkup()}</main>`;
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(ensureLanding,900);
  setTimeout(ensureLanding,2600);
});
})();
