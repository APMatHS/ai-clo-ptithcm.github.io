import { addQuestion } from '../../services/papers.js';
import { storageService } from '../../services/storage.js';
import { typesetMath } from '../../core/math.js';
import { escapeHtml,openModal,closeModal,toast,setBusy,errorMessage } from '../../core/ui.js';

const KEYS=['A','B','C','D'];
let jsZipLoader=null;

function normalizeClo(value){
  const m=String(value||'').toUpperCase().match(/CLO\s*[:=\-]?\s*(?:CLO\s*)?(\d+)/i);
  return m?`CLO${m[1]}`:'';
}
function extractClo(text){
  const s=String(text||'');
  const patterns=[/\(\s*CLO\s*(\d+)\s*\)/i,/\[\s*CLO\s*(\d+)\s*\]/i,/\bCLO\s*[:=\-]?\s*(?:CLO\s*)?(\d+)\b/i];
  for(const p of patterns){const m=s.match(p);if(m)return `CLO${m[1]}`;}
  return '';
}
function stripClo(text){return String(text||'').replace(/\(\s*CLO\s*\d+\s*\)/ig,'').replace(/\[\s*CLO\s*\d+\s*\]/ig,'').replace(/\bCLO\s*[:=\-]?\s*(?:CLO\s*)?\d+\b/ig,'').replace(/[ \t]+\n/g,'\n').trim();}
function textHtml(text){return escapeHtml(String(text||'')).replace(/\n/g,'<br>');}
function stripAnswerPrefix(text){return String(text||'').replace(/^\s*\\True\s*/,'').replace(/^\s*\*\s*/,'').trim();}

function bracedGroups(source,start){
  const groups=[];let i=start;
  while(i<source.length&&groups.length<4){while(i<source.length&&/\s/.test(source[i]))i++;if(source[i]!=='{')break;let depth=0,begin=i+1,escaped=false,end=-1;
    for(;i<source.length;i++){const ch=source[i];if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){end=i;break;}}}
    if(end<0)break;groups.push(source.slice(begin,end));i=end+1;
  }
  return groups;
}

export function parseTexQuestions(source){
  const text=String(source||'').replace(/\r\n?/g,'\n');
  const blocks=[];const re=/\\begin\{question\}(?:\s*\[([^\]]+)\])?([\s\S]*?)\\end\{question\}/gi;let m;
  while((m=re.exec(text))){blocks.push({option:m[1]||'',body:m[2]||'',sourceNo:blocks.length+1});}
  if(!blocks.length){
    const chunks=text.split(/(?=^\s*(?:Câu|Cau|Question)\s*\d+\s*[\.:)]?)/gim).filter(x=>/\\choice\b/.test(x));
    chunks.forEach((body,i)=>blocks.push({option:'',body,sourceNo:i+1}));
  }
  return blocks.map((b,index)=>{
    const choiceAt=b.body.search(/\\choice\b/i),warnings=[];let stem=b.body,choices=[],correct='';
    if(choiceAt>=0){stem=b.body.slice(0,choiceAt);const groups=bracedGroups(b.body,choiceAt+b.body.slice(choiceAt).match(/\\choice\b/i)[0].length);choices=groups.map((g,i)=>{if(/^\s*\\True\b/.test(g)||/^\s*\*/.test(g))correct=KEYS[i];return {key:KEYS[i],text:stripAnswerPrefix(g)};});}
    if(choices.length!==4)warnings.push(`Nhận được ${choices.length}/4 lựa chọn`);
    if(!correct)warnings.push('Chưa xác định đáp án đúng');
    const clo=normalizeClo(b.option)||extractClo(b.body);if(!clo)warnings.push('Chưa nhận CLO');
    stem=stripClo(stem).replace(/^\s*(?:Câu|Cau|Question)\s*\d+\s*[\.:)]?\s*/i,'').trim();
    return {sourceNo:index+1,body:stem,choices:KEYS.map(k=>choices.find(x=>x.key===k)||{key:k,text:''}),correct,clo,points:1,warnings,format:'tex'};
  });
}

async function ensureJSZip(){
  if(window.JSZip)return window.JSZip;
  if(!jsZipLoader)jsZipLoader=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=()=>resolve(window.JSZip);s.onerror=()=>reject(new Error('Không tải được bộ đọc DOCX.'));document.head.appendChild(s);});
  return jsZipLoader;
}
function xmlText(node){return [...node.getElementsByTagName('*')].filter(x=>x.localName==='t').map(x=>x.textContent||'').join('');}
function paragraphInfo(p){
  const runs=[...p.getElementsByTagName('*')].filter(x=>x.localName==='r');let text='',markedChars=0,totalChars=0;
  for(const r of runs){const rt=xmlText(r);if(!rt)continue;text+=rt;totalChars+=rt.length;const props=[...r.children].find(x=>x.localName==='rPr');let marked=false;if(props){for(const x of props.children){if(x.localName==='b')marked=true;if(x.localName==='u'&&x.getAttribute('w:val')!=='none'&&x.getAttribute('val')!=='none')marked=true;if(x.localName==='color'){const v=x.getAttribute('w:val')||x.getAttribute('val')||'';if(v&&!['auto','000000'].includes(v.toLowerCase()))marked=true;}}}if(marked)markedChars+=rt.length;}
  if(!text)text=xmlText(p);return {text:text.trim(),marked:totalChars>0&&markedChars/totalChars>=0.55};
}

export async function parseDocxQuestions(file){
  const JSZip=await ensureJSZip(),zip=await JSZip.loadAsync(await file.arrayBuffer()),entry=zip.file('word/document.xml');if(!entry)throw new Error('DOCX không có word/document.xml.');
  const xml=await entry.async('text'),doc=new DOMParser().parseFromString(xml,'application/xml');
  const paragraphs=[...doc.getElementsByTagName('*')].filter(x=>x.localName==='p').map(paragraphInfo).filter(x=>x.text);
  const out=[];let current=null,lastChoice=null,explicitAnswer='';
  const finish=()=>{if(!current)return;const marked=current.choices.filter(x=>x.marked).map(x=>x.key);if(explicitAnswer)current.correct=explicitAnswer;else if(marked.length===1)current.correct=marked[0];else if(marked.length>1)current.warnings.push('Có nhiều đáp án được đánh dấu định dạng');if(!current.correct)current.warnings.push('Chưa xác định đáp án đúng');if(!current.clo)current.warnings.push('Chưa nhận CLO');for(const k of KEYS)if(!current.choices.some(x=>x.key===k))current.choices.push({key:k,text:'',marked:false});current.choices.sort((a,b)=>KEYS.indexOf(a.key)-KEYS.indexOf(b.key));if(current.choices.some(x=>!x.text))current.warnings.push('Có lựa chọn trống');out.push(current);current=null;lastChoice=null;explicitAnswer='';};
  for(const p of paragraphs){let s=p.text;const q=s.match(/^\s*(?:Câu|Cau|Question)\s*(\d+)\s*[\.:)]?\s*(.*)$/i);if(q){finish();current={sourceNo:Number(q[1])||out.length+1,body:q[2]||'',choices:[],correct:'',clo:extractClo(s),points:1,warnings:[],format:'docx'};current.body=stripClo(current.body);continue;}if(!current)continue;
    const ans=s.match(/^\s*(?:Đáp\s*án|Dap\s*an|Answer)\s*[:\-]\s*([A-D])\b/i);if(ans){explicitAnswer=ans[1].toUpperCase();continue;}
    const c=s.match(/^\s*([A-D])\s*[\.)\:\-]\s*(.*)$/i);if(c){const key=c[1].toUpperCase(),raw=c[2]||'';current.clo=current.clo||extractClo(raw);current.choices.push({key,text:stripClo(raw),marked:p.marked});lastChoice=current.choices[current.choices.length-1];continue;}
    const clo=extractClo(s);if(clo)current.clo=current.clo||clo;const cleaned=stripClo(s);if(!cleaned)continue;if(lastChoice)lastChoice.text+=`\n${cleaned}`;else current.body+=`${current.body?'\n':''}${cleaned}`;
  }
  finish();
  if(!out.length)throw new Error('Không nhận ra câu hỏi. DOCX cần có dạng “Câu 1.” và các lựa chọn A., B., C., D.');
  return out;
}

function cardHtml(q,index){
  const warn=q.warnings?.length?`<div class="alert alert-warning" data-warnings>${q.warnings.map(escapeHtml).join(' · ')}</div>`:'';
  return `<article class="card import-question" data-index="${index}" style="margin-bottom:12px"><div class="toolbar"><div class="row wrap"><label class="choice-row"><input type="checkbox" data-include checked><strong>Câu ${escapeHtml(q.sourceNo||index+1)}</strong></label><span class="badge ${q.warnings?.length?'badge-warning':'badge-success'}" data-status>${q.warnings?.length?'Cần kiểm tra':'Hợp lệ'}</span></div><div class="row wrap"><div class="field" style="min-width:120px"><label>CLO</label><input class="input" data-clo value="${escapeHtml(q.clo||'')}" placeholder="CLO1"></div><div class="field" style="width:100px"><label>Điểm</label><input class="input" data-points type="number" min="0" step="0.25" value="${Number(q.points||1)}"></div><div class="field" style="width:120px"><label>Đáp án</label><select class="select" data-correct><option value="">-- Chọn --</option>${KEYS.map(k=>`<option value="${k}" ${q.correct===k?'selected':''}>${k}</option>`).join('')}</select></div></div></div>${warn}<div class="field"><label>Nội dung câu hỏi</label><textarea class="input" data-body rows="3">${escapeHtml(q.body||'')}</textarea></div><div class="form-grid">${KEYS.map(k=>{const c=q.choices.find(x=>x.key===k);return `<div class="field"><label>${k}</label><textarea class="input" data-choice="${k}" rows="2">${escapeHtml(c?.text||'')}</textarea></div>`;}).join('')}</div><details><summary>Xem trước công thức</summary><div class="question-card" data-preview style="margin-top:8px"></div></details></article>`;
}
function readCard(card){return {include:card.querySelector('[data-include]').checked,body:card.querySelector('[data-body]').value.trim(),choices:KEYS.map(k=>({key:k,text:card.querySelector(`[data-choice="${k}"]`).value.trim()})),correct:card.querySelector('[data-correct]').value,clo:normalizeClo(card.querySelector('[data-clo]').value),points:Number(card.querySelector('[data-points]').value||1)};}
function currentWarnings(q){const a=[];if(!q.body)a.push('Thiếu nội dung');if(q.choices.some(x=>!x.text))a.push('Có lựa chọn trống');if(!KEYS.includes(q.correct))a.push('Chưa chọn đáp án đúng');if(!q.clo)a.push('Chưa có CLO');return a;}
async function refreshPreview(card){const q=readCard(card),host=card.querySelector('[data-preview]');host.innerHTML=`<div>${textHtml(q.body)}</div><div class="choice-grid" style="margin-top:8px">${q.choices.map(c=>`<div class="choice-row"><span class="choice-key">${c.key}</span><div>${textHtml(c.text)}</div>${q.correct===c.key?'<span class="badge badge-success">Đúng</span>':''}</div>`).join('')}</div>`;await typesetMath(host.querySelectorAll('div'));}
function updateSummary(modal){const cards=[...modal.querySelectorAll('.import-question')],rows=cards.map(readCard).filter(x=>x.include),missing=rows.filter(x=>!x.clo).length,bad=rows.filter(x=>currentWarnings(x).some(w=>w!=='Chưa có CLO')).length,counts={};for(const x of rows)if(x.clo)counts[x.clo]=(counts[x.clo]||0)+1;modal.querySelector('[data-summary]').innerHTML=`Đang chọn <strong>${rows.length}</strong> câu · ${Object.entries(counts).sort().map(([k,v])=>`${escapeHtml(k)}: <strong>${v}</strong>`).join(' · ')||'chưa có CLO'}${missing?` · <span class="text-danger">Thiếu CLO: <strong>${missing}</strong></span>`:''}${bad?` · <span class="text-danger">Cần sửa: <strong>${bad}</strong></span>`:''}`;for(const card of cards){const q=readCard(card),warnings=currentWarnings(q),status=card.querySelector('[data-status]');status.textContent=warnings.length?warnings.join(' · '):'Hợp lệ';status.className=`badge ${warnings.length?'badge-warning':'badge-success'}`;}}

export function openQuestionImporter(ctx,sessionId,ws,onDone){
  if(ws.version?.status!=='draft')return toast('Chỉ nhập hàng loạt vào bản nháp.','error');
  let selectedFile=null,parsed=[];
  openModal({title:'Nhập đề từ DOCX / TEX',wide:true,body:`<div class="stack"><div class="alert">Chọn <strong>.docx</strong> hoặc <strong>.tex</strong>. Hệ thống nhận CLO theo các dạng CLO1, [CLO1], (CLO1), CLO: CLO1. Tất cả câu đều hiện ra để sửa trước khi nhập. Thiếu CLO chỉ cảnh báo, không chặn.</div><div class="field"><label>File đề</label><input class="input" data-import-file type="file" accept=".docx,.tex"></div><div class="row wrap"><button class="btn btn-secondary" type="button" data-filter="all">Tất cả</button><button class="btn btn-secondary" type="button" data-filter="warning">Cần kiểm tra</button><button class="btn btn-secondary" type="button" data-filter="clo">Chưa có CLO</button><span class="muted" data-summary>Chưa đọc file.</span></div><div data-import-state class="muted">DOCX: đáp án có thể được nhận từ gạch chân, in đậm, tô màu hoặc dòng “Đáp án: B”. TEX: nhận \\choice và \\True.</div><div data-import-list style="max-height:58vh;overflow:auto"></div></div>`,footer:'<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-primary" data-import disabled>Nhập các câu đã chọn</button>',onMount(modal){
    const input=modal.querySelector('[data-import-file]'),list=modal.querySelector('[data-import-list]'),state=modal.querySelector('[data-import-state]'),importBtn=modal.querySelector('[data-import]');
    modal.querySelector('[data-cancel]').onclick=closeModal;
    input.onchange=async()=>{selectedFile=input.files?.[0]||null;if(!selectedFile)return;state.textContent='Đang phân tích file…';list.innerHTML='';importBtn.disabled=true;try{const ext=selectedFile.name.toLowerCase().split('.').pop();parsed=ext==='tex'?parseTexQuestions(await selectedFile.text()):ext==='docx'?await parseDocxQuestions(selectedFile):[];if(!parsed.length)throw new Error('Không tìm thấy câu hỏi.');list.innerHTML=parsed.map(cardHtml).join('');state.textContent=`Đã nhận ${parsed.length} câu. Hãy rà soát và sửa trực tiếp trước khi nhập.`;importBtn.disabled=false;list.querySelectorAll('.import-question').forEach(card=>{card.addEventListener('input',()=>updateSummary(modal));card.addEventListener('change',()=>updateSummary(modal));card.querySelector('details').addEventListener('toggle',e=>{if(e.currentTarget.open)refreshPreview(card);});});updateSummary(modal);}catch(e){state.textContent=errorMessage(e);toast(errorMessage(e),'error',6000);}};
    modal.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>{const mode=btn.dataset.filter;for(const card of list.querySelectorAll('.import-question')){const q=readCard(card),warnings=currentWarnings(q);card.style.display=mode==='all'||(mode==='warning'&&warnings.length)||(mode==='clo'&&!q.clo)?'':'none';}});
    importBtn.onclick=async e=>{const rows=[...list.querySelectorAll('.import-question')].map(readCard).filter(x=>x.include);if(!rows.length)return toast('Chưa chọn câu nào để nhập.','error');const blocking=rows.flatMap((x,i)=>currentWarnings(x).filter(w=>w!=='Chưa có CLO').map(w=>`Câu ${i+1}: ${w}`));if(blocking.length)return toast(`Còn ${blocking.length} lỗi cần sửa trước khi nhập.`,'error',6000);const missing=rows.filter(x=>!x.clo).length;if(missing&&!confirm(`Có ${missing} câu chưa có CLO. Vẫn nhập vào đề?`))return;const btn=e.currentTarget;setBusy(btn,true,'Đang nhập…');try{if(selectedFile)await storageService.upload({examId:ctx.exam.id,file:selectedFile,kind:'source',metadata:{purpose:'import_source',session_id:sessionId}});for(let i=0;i<rows.length;i++){const q=rows[i];btn.textContent=`Đang nhập ${i+1}/${rows.length}…`;await addQuestion(ws.paper,ws.version,{code:null,group_id:null,group_version_id:null,body_html:textHtml(q.body),choices:q.choices.map(c=>({key:c.key,html:textHtml(c.text)})),correct_key:q.correct,points:q.points,metadata:{shuffle_choices:true,clo_code:q.clo||null,import_source:selectedFile?.name||null,import_format:selectedFile?.name.toLowerCase().endsWith('.tex')?'tex':'docx'}},ctx.profile.id);}closeModal();toast(`Đã nhập ${rows.length} câu vào đề${missing?` (${missing} câu chưa có CLO)`:''}.`,'success',6000);await onDone?.();}catch(err){toast(errorMessage(err),'error',6500);setBusy(btn,false);}};
  }});
}
