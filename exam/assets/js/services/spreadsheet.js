let XLSXPromise;
async function XLSX(){if(!XLSXPromise)XLSXPromise=import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');return XLSXPromise;}

export async function readFirstSheet(file){const xlsx=await XLSX();const buffer=await file.arrayBuffer();const wb=xlsx.read(buffer,{type:'array',cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];return xlsx.utils.sheet_to_json(ws,{defval:'',raw:false});}

export async function downloadXlsx(rows,fileName='export.xlsx',sheetName='Data'){
  const xlsx=await XLSX();const wb=xlsx.utils.book_new();const ws=xlsx.utils.json_to_sheet(rows);xlsx.utils.book_append_sheet(wb,ws,sheetName.slice(0,31));xlsx.writeFile(wb,fileName,{compression:true});
}

export function normalizeHeader(k=''){return String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function pick(row,names){const wanted=new Set(names.map(normalizeHeader));for(const [k,v] of Object.entries(row)){if(wanted.has(normalizeHeader(k)))return v;}return '';}

export async function exportAccessCodes(codes,sessionMap,roomMap,fileName='ma-thi.xlsx'){
  const rows=codes.map((x,i)=>({STT:i+1,MSSV:x.studentCode,'Họ tên':x.fullName,'Lớp':x.className||'','Ca thi':sessionMap.get(x.sessionId)||'','Phòng':roomMap.get(x.roomId)||'','Mã thi':x.accessCode}));
  return downloadXlsx(rows,fileName,'Ma thi');
}

export function printAccessCodes(codes,sessionMap,roomMap,title='Danh sách mã thi'){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const w=window.open('','_blank','noopener,noreferrer');if(!w)throw new Error('Trình duyệt đang chặn cửa sổ in.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#eee}@media print{body{margin:8mm}}</style></head><body><h1>${esc(title)}</h1><table><thead><tr><th>STT</th><th>MSSV</th><th>Họ tên</th><th>Lớp</th><th>Ca</th><th>Phòng</th><th>Mã thi</th></tr></thead><tbody>${codes.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.studentCode)}</td><td>${esc(x.fullName)}</td><td>${esc(x.className||'')}</td><td>${esc(sessionMap.get(x.sessionId)||'')}</td><td>${esc(roomMap.get(x.roomId)||'')}</td><td><strong>${esc(x.accessCode)}</strong></td></tr>`).join('')}</tbody></table><script>onload=()=>setTimeout(()=>print(),200)<\/script></body></html>`);w.document.close();
}
