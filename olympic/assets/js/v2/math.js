function sectionCards(sections){
  return sections.length?sections.map((x,i)=>`<div class="oly-card"><span class="arrow">→</span><div class="math-icon">${['A','λ','P','Σ','∫'][i%5]}</div><h3>${esc(x.name)}</h3><p>${esc(x.description||'Nội dung đang được giảng viên biên soạn.')}</p></div>`).join(''):`<div class="oly-panel oly-empty"><span class="symbol">∅</span><b>Chưa có nội dung</b><span>Giảng viên sẽ bổ sung các mục cần học.</span></div>`;
}

function ensureMathJax(){
  if(window.MathJax?.typesetPromise)return Promise.resolve(window.MathJax);
  if(document.querySelector('script[data-olympic-mathjax]'))return new Promise(resolve=>window.addEventListener('olympic-math-ready',()=>resolve(window.MathJax),{once:true}));
  window.MathJax={tex:{inlineMath:[['\\(','\\)'],['$','$']],displayMath:[['\\[','\\]'],['$$','$$']],processEscapes:true},options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']}};
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
    s.defer=true;
    s.dataset.olympicMathjax='1';
    s.onload=()=>{window.dispatchEvent(new Event('olympic-math-ready'));resolve(window.MathJax)};
    s.onerror=reject;
    document.head.appendChild(s);
  });
}
async function typeset(node=document.body){
  try{await ensureMathJax();await window.MathJax?.typesetPromise?.([node])}
  catch(e){console.warn('MathJax:',e)}
}
