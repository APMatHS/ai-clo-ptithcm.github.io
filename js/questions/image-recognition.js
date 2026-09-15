/* AI-CLO PTITHCM V12.6.53 — recognize one multiple-choice question from an image. */
(()=>{
'use strict';

const ACCEPTED_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const MAX_BYTES=8*1024*1024;
let activeForm=null;
let selectedFile=null;
let previewUrl='';

function imagePanel(form){
 let panel=form.querySelector('#questionImageRecognition');
 if(panel)return panel;
 panel=document.createElement('section');
 panel.id='questionImageRecognition';
 panel.className='question-image-recognition wide';
 panel.hidden=true;
 panel.innerHTML=`
  <div class="question-image-heading">
   <div><b>Nhận dạng câu hỏi từ ảnh</b><p>Dán ảnh hoặc chọn một ảnh có nội dung câu hỏi và bốn phương án A–D.</p></div>
   <span class="badge">Gemini</span>
  </div>
  <div id="questionImageDropzone" class="question-image-dropzone" tabindex="0" role="button" aria-label="Chọn hoặc dán ảnh câu hỏi">
   <input id="questionImageFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
   <div id="questionImageEmpty"><b>Ctrl+V để dán ảnh</b><span>hoặc kéo thả / chọn ảnh PNG, JPG, WEBP tối đa 8 MB</span><button id="chooseQuestionImage" type="button" class="secondary">Chọn ảnh</button></div>
   <div id="questionImagePreviewWrap" class="question-image-preview-wrap" hidden><img id="questionImagePreview" alt="Ảnh câu hỏi đã chọn"><div><b id="questionImageName"></b><span id="questionImageSize"></span><button id="replaceQuestionImage" type="button" class="secondary">Đổi ảnh</button></div></div>
  </div>
  <div class="question-image-actions"><p id="questionImageStatus" class="hint">AI sẽ đọc nội dung, giải câu hỏi và điền vào các ô bên dưới để giảng viên kiểm tra.</p><button id="recognizeQuestionImage" type="button" class="ai-btn" disabled>✦ AI nhận dạng câu hỏi</button></div>`;
 form.querySelector('#questionCreateMode')?.insertAdjacentElement('afterend',panel);
 bindPanel(form,panel);
 return panel;
}

function setActiveButton(form,id){
 form.querySelectorAll('#questionCreateMode .question-create-mode-btn').forEach(button=>{
  const selected=button.id===id;
  button.classList.toggle('active',selected);
  button.setAttribute('aria-pressed',String(selected));
 });
}

function activate(form=activeForm){
 if(!form)return;
 activeForm=form;
 imagePanel(form).hidden=false;
 setActiveButton(form,'questionImageCreateMode');
 requestAnimationFrame(()=>form.querySelector('#questionImageDropzone')?.focus());
}

function deactivate(form=activeForm){
 if(!form)return;
 imagePanel(form).hidden=true;
 setActiveButton(form,'questionSingleCreateMode');
}

function clearPreviewUrl(){
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
}

function formatBytes(bytes){
 return bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
}

function selectImage(file,panel){
 if(!file)return;
 if(!ACCEPTED_TYPES.has(file.type))return window.toast?.('Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP.',true);
 if(file.size>MAX_BYTES)return window.toast?.('Ảnh vượt quá giới hạn 8 MB.',true);
 selectedFile=file;
 clearPreviewUrl();
 previewUrl=URL.createObjectURL(file);
 panel.querySelector('#questionImagePreview').src=previewUrl;
 panel.querySelector('#questionImageName').textContent=file.name||'Ảnh đã dán';
 panel.querySelector('#questionImageSize').textContent=`${file.type.replace('image/','').toUpperCase()} · ${formatBytes(file.size)}`;
 panel.querySelector('#questionImageEmpty').hidden=true;
 panel.querySelector('#questionImagePreviewWrap').hidden=false;
 panel.querySelector('#recognizeQuestionImage').disabled=false;
 panel.querySelector('#questionImageStatus').textContent='Ảnh đã sẵn sàng. Nhấn “AI nhận dạng câu hỏi” để xử lý.';
}

function bindPanel(form,panel){
 const input=panel.querySelector('#questionImageFile');
 const choose=()=>input.click();
 panel.querySelector('#chooseQuestionImage').onclick=choose;
 panel.querySelector('#replaceQuestionImage').onclick=choose;
 input.onchange=()=>selectImage(input.files?.[0],panel);
 const dropzone=panel.querySelector('#questionImageDropzone');
 dropzone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose()}});
 dropzone.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('dragging')});
 dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('dragging'));
 dropzone.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('dragging');selectImage([...event.dataTransfer.files].find(file=>ACCEPTED_TYPES.has(file.type)),panel)});
 panel.querySelector('#recognizeQuestionImage').onclick=()=>recognize(form,panel);
}

function fileBase64(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
  reader.onerror=()=>reject(new Error('Không đọc được ảnh đã chọn.'));
  reader.readAsDataURL(file);
 });
}

function functionError(error,fallback){
 return (async()=>{
  let detail;
  try{detail=await error?.context?.json()}catch{}
  return new Error(detail?.error||error?.message||fallback);
 })();
}

function setValue(field,value){
 if(!field)return;
 field.value=String(value||'').trim();
 field.dispatchEvent(new Event('input',{bubbles:true}));
 field.dispatchEvent(new Event('change',{bubbles:true}));
}

function markAiOrigin(form){
 const select=form.querySelector('select[name="origin_type"]');
 if(!select)return;
 if(![...select.options].some(option=>option.value==='gemini'))select.add(new Option('AI hỗ trợ','gemini'));
 select.disabled=false;
 setValue(select,'gemini');
 form.querySelector('input[type="hidden"][name="origin_type"]')?.remove();
}

function fillQuestion(form,question){
 setValue(form.elements.namedItem('content'),question.content);
 for(const key of ['A','B','C','D'])setValue(form.elements.namedItem('opt_'+key),question.options?.[key]);
 setValue(form.elements.namedItem('correct_answer'),question.correct_answer||'A');
 setValue(form.elements.namedItem('explanation'),question.explanation);
 markAiOrigin(form);
 window.AICLO_FORM_PERSISTENCE?.flush?.(form);
 window.renderMath?.(form);
}

async function recognize(form,panel){
 if(!selectedFile)return window.toast?.('Hãy chọn hoặc dán một ảnh câu hỏi.',true);
 const button=panel.querySelector('#recognizeQuestionImage');
 const status=panel.querySelector('#questionImageStatus');
 const old=button.textContent;
 button.disabled=true;button.textContent='✦ Gemini đang nhận dạng…';status.textContent='Đang đọc câu hỏi, bốn phương án và kiểm tra đáp án đúng…';
 try{
  const imageBase64=await fileBase64(selectedFile);
  const {data,error}=await db.functions.invoke('recognize-question-image',{body:{subject_id:state.subjectId,mime_type:selectedFile.type,image_base64:imageBase64}});
  if(error)throw await functionError(error,'Không thể gọi chức năng nhận dạng ảnh.');
  if(!data?.success||!data?.question)throw new Error(data?.error||'Gemini chưa nhận dạng được câu hỏi.');
  fillQuestion(form,data.question);
  status.textContent=`Đã điền kết quả từ ${data.model||'Gemini'}. Hãy kiểm tra kỹ nội dung, đáp án và lời giải trước khi lưu.`;
  window.toast?.('Đã nhận dạng và điền câu hỏi. Vui lòng kiểm tra trước khi lưu.');
 }catch(error){
  status.textContent=error?.message||'Không thể nhận dạng ảnh.';
  if(typeof err==='function')err(error);
 }finally{button.disabled=false;button.textContent=old}
}

document.addEventListener('paste',event=>{
 const form=activeForm;
 if(!form||!document.body.contains(form)||form.querySelector('#questionImageRecognition')?.hidden)return;
 const file=[...(event.clipboardData?.files||[])].find(item=>ACCEPTED_TYPES.has(item.type))||
  [...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&ACCEPTED_TYPES.has(item.type))?.getAsFile();
 if(file){event.preventDefault();selectImage(file,imagePanel(form))}
});

window.addEventListener('beforeunload',clearPreviewUrl);
window.AICLO_QUESTION_IMAGE=Object.freeze({activate,deactivate});
})();

