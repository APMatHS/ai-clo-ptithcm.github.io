function lessonEditor(c,subject,topics,x,code){
  const defaultTex=`# ${x?.title||'Tên bài học'}\n\nGiới thiệu ngắn về nội dung bài học. Có thể nhập công thức như $A^n$ hoặc $$\\det(A-\\lambda I)=0.$$\n\n\\begin{theorem}\nPhát biểu định lý tại đây.\n\\end{theorem}\n\n\\begin{example}\nVí dụ minh họa.\n\\end{example}\n\n\\begin{proof}\nTrình bày chứng minh.\n\\end{proof}`;
  c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="${teacherUrl('lessons',code)}">← Danh sách</a>${x?`<a class="oly-btn" href="${subjectFeatureUrl('lessons',code)}?id=${encodeURIComponent(x.id)}">Xem như sinh viên</a>`:''}<div class="grow"></div><button class="oly-btn primary" id="saveLesson">Lưu bài học</button></div><div class="oly-panel"><div class="oly-form-grid"><label class="oly-field wide"><span>Tiêu đề</span><input id="lessonTitle" class="oly-input" value="${esc(x?.title||'')}"></label><label class="oly-field wide"><span>Mô tả ngắn</span><input id="lessonSummary" class="oly-input" value="${esc(x?.summary||'')}"></label><label class="oly-field"><span>Mục nội dung</span><select id="lessonTopic" class="oly-select"><option value="">Chưa gắn mục</option>${topics.map(t=>`<option value="${t.id}" ${x?.topic_id===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label><label class="oly-field"><span>Trạng thái</span><select id="lessonStatus" class="oly-select"><option value="draft" ${!x||x.status==='draft'?'selected':''}>Nháp</option><option value="published" ${x?.status==='published'?'selected':''}>Xuất bản</option><option value="archived" ${x?.status==='archived'?'selected':''}>Lưu trữ</option></select></label></div><div class="oly-section-head"><div><h3>Trình soạn toán học</h3><p>Soạn văn bản định dạng, ảnh minh họa và LaTeX. Công thức dùng $...$ hoặc $$...$$.</p></div></div><div class="oly-editor"><div class="oly-editor-pane"><div class="oly-editor-toolbar" id="texToolbar"><button data-format="bold" title="In đậm"><b>B</b></button><button data-format="italic" title="In nghiêng"><i>I</i></button><button data-format="underline" title="Gạch chân"><u>U</u></button><button data-action="text-color">Màu chữ</button><button data-action="font-size">Cỡ chữ</button><button data-snippet="# Tiêu đề\n">H1</button><button data-snippet="## Mục nhỏ\n">H2</button><button data-env="definition">Định nghĩa</button><button data-env="theorem">Định lý</button><button data-env="lemma">Bổ đề</button><button data-env="example">Ví dụ</button><button data-env="proof">Chứng minh</button><button data-env="note">Chú ý</button><button data-env="exercise">Bài tập</button><button data-snippet="$$\n\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$">Ma trận</button><button data-action="image">🖼 Ảnh</button><button data-action="external-link">↗ Liên kết</button></div><textarea id="lessonTex" class="oly-textarea">${esc(x?.content_tex||defaultTex)}</textarea></div><div class="oly-editor-pane"><div class="oly-preview" id="lessonPreview"></div></div></div></div>`;
  const ta=$('#lessonTex'),preview=$('#lessonPreview');let timer;
  const oldContent=x?.content_tex||'';
  const markDirty=()=>{state.dirty=true};
  const draw=()=>{preview.innerHTML=renderTex(ta.value);clearTimeout(timer);timer=setTimeout(()=>typeset(preview),180)};
  draw();
  [ta,$('#lessonTitle'),$('#lessonSummary'),$('#lessonTopic'),$('#lessonStatus')].forEach(el=>el?.addEventListener('input',markDirty));
  ta.addEventListener('input',draw);
  $('#texToolbar').onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.action==='external-link')return externalLinkDialog(ta);
    if(b.dataset.action==='image')return imageUploadDialog(ta,subject);
    if(b.dataset.action==='text-color')return textColorDialog(ta);
    if(b.dataset.action==='font-size')return fontSizeDialog(ta);
    if(b.dataset.format==='bold')return wrapSelection(ta,'**','**','văn bản đậm');
    if(b.dataset.format==='italic')return wrapSelection(ta,'*','*','văn bản nghiêng');
    if(b.dataset.format==='underline')return wrapSelection(ta,'[u]','[/u]','văn bản gạch chân');
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
    await cleanupRemovedLessonImages(oldContent,ta.value);
    state.dirty=false;clearDataCache(code);toast('Đã lưu bài học');
    navigateTo(`${subjectFeatureUrl('lessons',code)}?id=${encodeURIComponent(r.data.id)}`,{force:true});
  };
}

function selectedText(ta,fallback='văn bản'){
  const a=ta.selectionStart??0,b=ta.selectionEnd??a;
  return ta.value.slice(a,b)||fallback;
}

function wrapSelection(ta,before,after,fallback='văn bản'){
  const a=ta.selectionStart??0,b=ta.selectionEnd??a,text=ta.value.slice(a,b)||fallback;
  ta.value=ta.value.slice(0,a)+before+text+after+ta.value.slice(b);
  ta.focus();ta.selectionStart=a+before.length;ta.selectionEnd=a+before.length+text.length;
  ta.dispatchEvent(new Event('input'));
}

function textColorDialog(ta){
  dialog('Màu chữ',`<form id="textColorForm" class="oly-form-grid"><label class="oly-field wide"><span>Chọn màu</span><input name="color" type="color" value="#0b5cab" style="width:100%;height:46px;border:1px solid #cbd7e2;border-radius:10px;background:#fff"></label><div class="oly-form-actions"><button type="button" class="oly-btn" id="cancelTextColor">Hủy</button><button class="oly-btn primary">Áp dụng</button></div></form>`);
  $('#cancelTextColor').onclick=()=>$('#olyDialog').close();
  $('#textColorForm').onsubmit=e=>{e.preventDefault();const color=new FormData(e.currentTarget).get('color')||'#0b5cab';wrapSelection(ta,`[color=${color}]`,'[/color]','văn bản màu');$('#olyDialog').close()};
}

function fontSizeDialog(ta){
  dialog('Cỡ chữ',`<form id="fontSizeForm" class="oly-form-grid"><label class="oly-field wide"><span>Cỡ chữ</span><select class="oly-select" name="size"><option value="small">Nhỏ</option><option value="normal" selected>Thường</option><option value="large">Lớn</option><option value="xlarge">Rất lớn</option></select></label><div class="oly-form-actions"><button type="button" class="oly-btn" id="cancelFontSize">Hủy</button><button class="oly-btn primary">Áp dụng</button></div></form>`);
  $('#cancelFontSize').onclick=()=>$('#olyDialog').close();
  $('#fontSizeForm').onsubmit=e=>{e.preventDefault();const size=new FormData(e.currentTarget).get('size')||'normal';wrapSelection(ta,`[size=${size}]`,'[/size]','văn bản');$('#olyDialog').close()};
}

function externalLinkDialog(ta){
  const selected=selectedText(ta,'Mở tài liệu').trim().replace(/[\[\]\n\r]/g,' ');
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
    $('#olyDialog').close();toast('Đã chèn liên kết');
  };
}

function imageUploadDialog(ta,subject){
  dialog('Chèn ảnh',`<form id="lessonImageForm" class="oly-form-grid"><label class="oly-field wide"><span>Ảnh PNG, JPG hoặc WebP · tối đa 8 MB</span><input class="oly-input" name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label><label class="oly-field wide"><span>Chú thích ảnh</span><input class="oly-input" name="caption" placeholder="Ví dụ: Minh họa đồ thị của hàm số"></label><label class="oly-field"><span>Kích thước</span><select class="oly-select" name="size"><option value="small">Nhỏ</option><option value="medium" selected>Vừa</option><option value="large">Lớn</option><option value="full">Toàn chiều rộng</option></select></label><label class="oly-field"><span>Căn ảnh</span><select class="oly-select" name="align"><option value="left">Trái</option><option value="center" selected>Giữa</option><option value="right">Phải</option></select></label><div class="oly-form-actions"><button type="button" class="oly-btn" id="cancelLessonImage">Hủy</button><button class="oly-btn primary" id="uploadLessonImage">Tải ảnh và chèn</button></div></form>`);
  $('#cancelLessonImage').onclick=()=>$('#olyDialog').close();
  $('#lessonImageForm').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget,fd=new FormData(form),file=fd.get('file'),btn=$('#uploadLessonImage');
    if(!(file instanceof File)||!file.size)return toast('Chọn ảnh cần tải lên',true);
    const allowed={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
    const ext=allowed[file.type];if(!ext)return toast('Chỉ hỗ trợ PNG, JPG hoặc WebP',true);
    if(file.size>8*1024*1024)return toast('Ảnh vượt quá 8 MB',true);
    btn.disabled=true;btn.textContent='Đang tải ảnh…';
    try{
      const uid=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path=`${subject.id}/${state.user.id}/${uid}.${ext}`;
      const up=await db.storage.from('olympic-content').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(up.error)throw up.error;
      const pub=db.storage.from('olympic-content').getPublicUrl(path);
      const url=pub.data?.publicUrl;if(!url)throw new Error('Không lấy được đường dẫn ảnh');
      const caption=String(fd.get('caption')||'').trim().replace(/[|\]\n\r]/g,' ');
      const size=String(fd.get('size')||'medium'),align=String(fd.get('align')||'center');
      const token=`\n\n[[image|${encodeURIComponent(url)}|${encodeURIComponent(caption)}|${size}|${align}|${encodeURIComponent(path)}]]\n\n`;
      insertAtCursor(ta,token);$('#olyDialog').close();toast('Đã chèn ảnh');
    }catch(err){fail(err);btn.disabled=false;btn.textContent='Tải ảnh và chèn'}
  };
}

function insertAtCursor(ta,text){
  const a=ta.selectionStart??ta.value.length,b=ta.selectionEnd??a;
  ta.value=ta.value.slice(0,a)+text+ta.value.slice(b);ta.focus();ta.selectionStart=ta.selectionEnd=a+text.length;ta.dispatchEvent(new Event('input'));
}

function safeDecode(v){try{return decodeURIComponent(v)}catch{return String(v||'')}}
function safeHttps(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}}

function extractLessonImagePaths(raw=''){
  const out=[];String(raw).replace(/\[\[image\|[^|]+\|[^|]*\|(small|medium|large|full)\|(left|center|right)\|([^\]]*)\]\]/gi,(_,s,a,path)=>{const p=safeDecode(path);if(p)out.push(p);return _});return [...new Set(out)];
}

async function cleanupRemovedLessonImages(oldRaw='',newRaw=''){
  const oldPaths=extractLessonImagePaths(oldRaw),keep=new Set(extractLessonImagePaths(newRaw)),removed=oldPaths.filter(x=>!keep.has(x));
  if(!removed.length)return;
  const r=await db.storage.from('olympic-content').remove(removed);
  if(r.error)console.warn('Không dọn được một số ảnh cũ:',r.error);
}

function renderExternalLinks(html=''){
  return html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi,(_,label,url)=>`<a class="oly-btn small" href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`);
}

function renderRichInline(html=''){
  let out=html;
  out=out.replace(/\[color=(#[0-9a-fA-F]{6})\]([\s\S]*?)\[\/color\]/gi,(_,color,body)=>`<span style="color:${color}">${body}</span>`);
  out=out.replace(/\[size=(small|normal|large|xlarge)\]([\s\S]*?)\[\/size\]/gi,(_,size,body)=>`<span style="font-size:${({small:'.86em',normal:'1em',large:'1.25em',xlarge:'1.55em'})[size]}">${body}</span>`);
  out=out.replace(/\[u\]([\s\S]*?)\[\/u\]/gi,'<u>$1</u>');
  out=out.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  out=out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
  return renderExternalLinks(out);
}

function imageBlock(urlEncoded,captionEncoded,size,align,pathEncoded){
  const url=safeHttps(safeDecode(urlEncoded));if(!url)return '<div class="oly-empty"><b>Ảnh không hợp lệ</b></div>';
  const caption=safeDecode(captionEncoded),path=safeDecode(pathEncoded);
  const width={small:'320px',medium:'560px',large:'800px',full:'100%'}[size]||'560px';
  const margin=align==='left'?'18px auto 18px 0':align==='right'?'18px 0 18px auto':'18px auto';
  const textAlign=align==='left'?'left':align==='right'?'right':'center';
  return `<figure data-storage-path="${esc(path)}" style="max-width:${width};margin:${margin};text-align:${textAlign}"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="${esc(caption)}" loading="lazy" style="display:block;width:100%;height:auto;max-width:100%;border-radius:12px;border:1px solid #d9e2ec"></a>${caption?`<figcaption style="margin-top:7px;color:#627d98;font-size:12px;line-height:1.5">${esc(caption)}</figcaption>`:''}</figure>`;
}

function renderTex(raw=''){
  const blocks=[];
  let source=String(raw||'').replace(/\[\[image\|([^|]+)\|([^|]*)\|(small|medium|large|full)\|(left|center|right)\|([^\]]*)\]\]/gi,(_,url,caption,size,align,path)=>{const i=blocks.length;blocks.push(imageBlock(url,caption,size,align,path));return `@@OLYBLOCK${i}@@`});
  let text=esc(source);
  const envs={theorem:'Định lý',lemma:'Bổ đề',definition:'Định nghĩa',example:'Ví dụ',proof:'Chứng minh',note:'Chú ý',exercise:'Bài tập'};
  for(const [env,label] of Object.entries(envs)){
    const re=new RegExp('\\\\begin\\{'+env+'\\}([\\s\\S]*?)\\\\end\\{'+env+'\\}','gi');
    text=text.replace(re,(_,body)=>{const i=blocks.length,cls=['definition','example','proof','note','exercise'].includes(env)?env:'';blocks.push(`<div class="oly-theorem ${cls}"><div class="oly-theorem-title">${label}</div>${renderRichInline(body.trim().replace(/\n/g,'<br>'))}</div>`);return `@@OLYBLOCK${i}@@`});
  }
  return text.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).map(p=>{
    const m=p.match(/^@@OLYBLOCK(\d+)@@$/);if(m)return blocks[Number(m[1])]||'';
    if(/^###\s+/.test(p))return `<h3>${renderRichInline(p.replace(/^###\s+/,''))}</h3>`;
    if(/^##\s+/.test(p))return `<h2>${renderRichInline(p.replace(/^##\s+/,''))}</h2>`;
    if(/^#\s+/.test(p))return `<h1>${renderRichInline(p.replace(/^#\s+/,''))}</h1>`;
    return `<p>${renderRichInline(p.replace(/\n/g,'<br>'))}</p>`;
  }).join('').replace(/@@OLYBLOCK(\d+)@@/g,(_,i)=>blocks[Number(i)]||'');
}
