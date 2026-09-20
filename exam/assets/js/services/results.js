import { invokeFunction } from '../core/supabase.js';
import { downloadXlsx } from './spreadsheet.js';
import { sanitizeHtml } from '../core/sanitize.js';

const call=(action,payload)=>invokeFunction('exam-results',{action,...payload});
export const resultService={
  list:examId=>call('list',{examId}),
  record:(examId,attemptId)=>call('record',{examId,attemptId}),
  detail:examId=>call('export-detail',{examId}),
  async exportSummary(examId,fileName='ket-qua.xlsx'){
    const data=await call('list',{examId});
    const rows=(data.rows||[]).map((x,i)=>({STT:i+1,MSSV:x.studentCode,'Họ tên':x.fullName,'Lớp':x.className||'','Ca':x.sessionName||'','Phòng':x.roomName||'','Trạng thái':x.status,'Bắt đầu':x.startedAt||'','Nộp bài':x.submittedAt||'','Số câu đã trả lời':x.answeredCount??0,'Số câu đúng':x.correctCount??'','Điểm':x.score??''}));
    await downloadXlsx(rows,fileName,'Tong hop');return data;
  },
  async exportDetail(examId,fileName='ket-qua-chi-tiet.xlsx'){
    const data=await call('export-detail',{examId});await downloadXlsx(data.rows||[],fileName,'Chi tiet');return data;
  }
};

function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function assetsHtml(assets=[]){return assets.map(a=>a.kind==='image'?`<img src="${esc(a.url)}" class="asset" alt="Hình">`:a.kind==='audio'?`<div class="audio-note">[Audio: ${esc(a.id)}]</div>`:'').join('');}

export async function printAttemptRecord(record,{grading=false}={}){
  const win=window.open('','_blank');if(!win)throw new Error('Trình duyệt đang chặn cửa sổ in.');win.opener=null;
  let html='',lastGroup=null;
  for(const q of record.questions||[]){
    if(q.group?.id&&q.group.id!==lastGroup){lastGroup=q.group.id;html+=`<section class="group"><div class="part">${esc(q.group.partLabel||'')}</div>${q.group.title?`<h3>${esc(q.group.title)}</h3>`:''}<div>${await sanitizeHtml(q.group.bodyHtml||'')}</div>${await assetsHtml(q.group.assets)}</section>`;}
    const body=await sanitizeHtml(q.bodyHtml||'');
    html+=`<section class="q"><div class="qhead">Câu ${q.displayNo}</div><div>${body}</div>${await assetsHtml(q.assets)}<div class="choices">${(q.choices||[]).map(c=>{const selected=String(c.sourceKey)===String(q.selectedKey),correct=grading&&String(c.sourceKey)===String(q.correctKey);return `<div class="choice ${selected?'selected':''} ${correct?'correct':''}"><span>${esc(c.displayLabel)}.</span><div>${c.html}</div>${selected?'<b>SV chọn</b>':''}${correct?'<b>Đáp án</b>':''}</div>`;}).join('')}</div>${grading?`<div class="grade">${q.selectedKey==null?'Bỏ trống':q.isCorrect?'Đúng':'Sai'} · ${q.isCorrect?q.points:0}/${q.points} điểm</div>`:''}</section>`;
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.student.fullName)} - ${esc(record.exam.name)}</title><style>@page{size:A4;margin:13mm}body{font-family:Arial,sans-serif;color:#111;font-size:12pt;line-height:1.45}header{border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px}h1{font-size:18pt;margin:0 0 7px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px}.q{page-break-inside:avoid;margin:0 0 17px}.qhead{font-weight:700;margin-bottom:5px}.choices{margin:8px 0}.choice{display:grid;grid-template-columns:24px 1fr auto auto;gap:7px;padding:5px;border-radius:5px}.choice.selected{background:#eef4ff}.choice.correct{outline:1px solid #198754}.choice b{font-size:9pt}.group{border:1px solid #aaa;padding:10px;margin:0 0 15px;page-break-inside:avoid}.part{font-weight:700}.asset{max-width:100%;max-height:170mm;display:block;margin:8px auto}.audio-note{font-style:italic;color:#555}.grade{font-weight:700;font-size:10pt}.summary{margin-top:15px;border-top:1px solid #aaa;padding-top:9px}@media print{button{display:none}}</style><script>window.MathJax={tex:{inlineMath:[["\\(","\\)"],["$","$"]],displayMath:[["\\[","\\]"],["$$","$$"]]},svg:{fontCache:"global"}};<\/script><script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"><\/script></head><body><header><h1>${esc(record.exam.name)}</h1><div class="meta"><div><b>MSSV:</b> ${esc(record.student.studentCode)}</div><div><b>Họ tên:</b> ${esc(record.student.fullName)}</div><div><b>Lớp:</b> ${esc(record.student.className||'')}</div><div><b>Phòng:</b> ${esc(record.room.name)}</div><div><b>Ca:</b> ${esc(record.session.name)}</div><div><b>Nộp:</b> ${esc(record.attempt.submittedAt||'')}</div></div></header>${html}<div class="summary"><b>Điểm tổng:</b> ${record.attempt.score??'—'}${grading&&record.attempt.correctCount!=null?` · <b>Số đúng:</b> ${record.attempt.correctCount}`:''}</div><script>window.addEventListener('load',()=>setTimeout(()=>{if(window.MathJax?.typesetPromise){MathJax.typesetPromise().then(()=>setTimeout(()=>print(),300));}else setTimeout(()=>print(),500);},300));<\/script></body></html>`);win.document.close();
}
