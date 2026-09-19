function lessonEditor(c,subject,topics,x,code){
  const defaultTex=`# ${x?.title||'Tên bài học'}\n\nGiới thiệu ngắn về nội dung bài học. Có thể nhập công thức như $A^n$ hoặc $$\\det(A-\\lambda I)=0.$$\n\n\\begin{theorem}\nPhát biểu định lý tại đây.\n\\end{theorem}\n\n\\begin{example}\nVí dụ minh họa.\n\\end{example}\n\n\\begin{proof}\nTrình bày chứng minh.\n\\end{proof}`;
  c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="?subject=${encodeURIComponent(code)}">← Danh sách</a><span class="oly-badge required">Môn · ${esc(subject.name)}</span><div class="grow"></div><button class="oly-btn primary" id="saveLesson">Lưu bài học</button></div><div class="oly-panel"><div class="oly-form-grid"><label class="oly-field wide"><span>Tiêu đề</span><input id="lessonTitle" class="oly-input" value="${esc(x?.title||'')}"></label><label class="oly-field wide"><span>Mô tả ngắn</span><input id="lessonSummary" class="oly-input" value="${esc(x?.summary||'')}"></label><label class="oly-field"><span>Mục nội dung</span><select id="lessonTopic" class="oly-select"><option value="">Chưa gắn mục</option>${topics.map(t=>`<option value="${t.id}" ${x?.topic_id===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label><label class="oly-field"><span>Trạng thái</span><select id="lessonStatus" class="oly-select"><option value="draft" ${!x||x.status==='draft'?'selected':''}>Nháp</option><option value="published" ${x?.status==='published'?'selected':''}>Xuất bản</option><option value="archived" ${x?.status==='archived'?'selected':''}>Lưu trữ</option></select></label></div><div class="oly-section-head"><div><h3>Trình soạn toán học</h3><p>Hỗ trợ LaTeX trong $...$, $$...$$, các môi trường theorem, lemma, definition, example, proof, note, exercise và liên kết tài liệu ngoài.</p></div></div><div class="oly-editor"><div class="oly-editor-pane"><div class="oly-editor-toolbar" id="texToolbar"><button data-snippet="# Tiêu đề\n">H1</button><button data-snippet="## Mục nhỏ\n">H2</button><button data-env="definition">Định nghĩa</button><button data-env="theorem">Định lý</button><button data-env="lemma">Bổ đề</button><button data-env="example">Ví dụ</button><button data-env="proof">Chứng minh</button><button data-env="note">Chú ý</button><button data-env="exercise">Bài tập</button><button data-snippet="$$\n\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$">Ma trận</button><button data-action="external-link">↗ Liên kết</button></div><textarea id="lessonTex" class="oly-textarea">${esc(x?.content_tex||defaultTex)}</textarea></div><div class="oly-editor-pane"><div class="oly-preview" id="lessonPreview"></div></div></div></div>`;
  const ta=$('#lessonTex'),preview=$('#lessonPreview');let timer;
  const markDirty=()=>{state.dirty=true};
  const draw=()=>{preview.innerHTML=renderTex(ta.value);clearTimeout(timer);timer=setTimeout(()=>typeset(preview),180)};
  draw();
  [ta,$('#lessonTitle'),$('#lessonSummary'),$('#lessonTopic'),$('#lessonStatus')].forEach(el=>el?.addEventListener('input',markDirty));
  ta.addEventListener('input',draw);
  $('#texToolbar').onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.action==='external-link')return externalLinkDialog(ta);
    let sn=b.dataset.snippet||'',env=b.dataset.env;
    if(env)sn=`\\begin{${env}}\nNội dung ${env}.\n\\end{${env}}`;
    insertAtCursor(ta,sn);draw();state.dirty=true;
  };
  $('#saveLesson').onclick=async()=>{
    const title=$('#lessonTitle').value.trim();if(!title)return toast('Nhập tiêu đề bài học',true);
    const status=$('#lessonStatus').value;
    const v={subject_id:subject.id,topic_id:$('#lessonTopic').value||null,title,summary:$('#lessonSummary').value.trim(),content_tex:ta.value,status,is_visible:true,updated_by:state.user.id,published_at:status==='published'?(x?.published_at||new Date().toISOString()):x?.published_at||null};
    if(!x)v.created_by=state.user.id;
    const r=x?await db.from('olympic_lessons').update(v).eq('id',x.id).select('id').single():await db.from('olympic_lessons').insert(v).select('id').single();
    if(r.error)return fail(r.error);
    state.dirty=false;clearDataCache(code);toast('Đã lưu bài học');
    navigateTo(`?subject=${encodeURIComponent(code)}&edit=${r.data.id}`,{force:true});
  };
}

function externalLinkDialog(ta){
  const selected=ta.value.slice(ta.selectionStart??0,ta.selectionEnd??0).trim().replace(/[\[\]\n\r]/g,' ');
  dialog('Chèn liên kết ngoài',`<form id="externalLinkForm" class="oly-form-grid"><label class="oly-field wide"><span>Tên nút / tài liệu</span><input class="oly-input" name="label" value="${esc(selected||'Mở tài liệu')}"></label><label class="oly-field wide"><span>Đường dẫn (https://...)</span><input class="oly-input" name="url" type="url" inputmode="url" placeholder="https://..." required autofocus></label><div class="oly-form-actions"><button type="button" class="oly-btn" id="cancelExternalLink">Hủy</button><button class="oly-btn primary">Chèn liên kết ↗</button></div></form>`);
  $('#cancelExternalLink').onclick=()=>$('#olyDialog').close();
  $('#externalLinkForm').onsubmit=e=>{
    e.preventDefault();
    const v=Object.fromEntries(new FormData(e.currentTarget));
    let u;
    try{u=new URL(String(v.url||'').trim())}catch{return toast('Đường dẫn không hợp lệ',true)}
    if(!['http:','https:'].includes(u.protocol))return toast('Chỉ dùng liên kết http hoặc https',true);
    const label=String(v.label||'Mở tài liệu').trim().replace(/[\[\]\n\r]/g,' ')||'Mở tài liệu';
    insertAtCursor(ta,`[${label}](${u.href})`);
    $('#olyDialog').close();
    toast('Đã chèn liên kết; khi xem bài sẽ mở ở tab mới');
  };
}

function insertAtCursor(ta,text){
  const a=ta.selectionStart??ta.value.length,b=ta.selectionEnd??a;
  ta.value=ta.value.slice(0,a)+text+ta.value.slice(b);ta.focus();ta.selectionStart=ta.selectionEnd=a+text.length;ta.dispatchEvent(new Event('input'));
}

function renderExternalLinks(html=''){
  return html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi,(_,label,url)=>`<a class="oly-btn small" href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`);
}

function renderTex(raw=''){
  let text=esc(raw),blocks=[];
  const envs={theorem:'Định lý',lemma:'Bổ đề',definition:'Định nghĩa',example:'Ví dụ',proof:'Chứng minh',note:'Chú ý',exercise:'Bài tập'};
  for(const [env,label] of Object.entries(envs)){
    const re=new RegExp('\\\\begin\\{'+env+'\\}([\\s\\S]*?)\\\\end\\{'+env+'\\}','gi');
    text=text.replace(re,(_,body)=>{const i=blocks.length,cls=['definition','example','proof','note','exercise'].includes(env)?env:'';blocks.push(`<div class="oly-theorem ${cls}"><div class="oly-theorem-title">${label}</div>${body.trim().replace(/\n/g,'<br>')}</div>`);return `@@OLYBLOCK${i}@@`});
  }
  const parts=text.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).map(p=>{
    const m=p.match(/^@@OLYBLOCK(\d+)@@$/);if(m)return blocks[Number(m[1])];
    if(/^###\s+/.test(p))return `<h3>${p.replace(/^###\s+/,'')}</h3>`;
    if(/^##\s+/.test(p))return `<h2>${p.replace(/^##\s+/,'')}</h2>`;
    if(/^#\s+/.test(p))return `<h1>${p.replace(/^#\s+/,'')}</h1>`;
    return `<p>${p.replace(/\n/g,'<br>')}</p>`;
  }).join('');
  return renderExternalLinks(parts.replace(/@@OLYBLOCK(\d+)@@/g,(_,i)=>blocks[Number(i)]||''));
}
