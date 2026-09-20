import { storageService } from '../../services/storage.js';
import { hasPermission } from '../../core/permissions.js';
import { escapeHtml,formatDateTime,toast,errorMessage,confirmDialog } from '../../core/ui.js';

function size(bytes){const n=Number(bytes||0);if(!n)return '—';const u=['B','KB','MB','GB'];let x=n,i=0;while(x>=1024&&i<u.length-1){x/=1024;i++;}return `${x.toFixed(i?1:0)} ${u[i]}`;}

export async function renderSources(ctx){
  const {host,exam,profile,membership}=ctx;
  const can=hasPermission(profile,membership,'manage_assets');
  let rows=[];
  try{rows=await storageService.list(exam.id,'source');}catch(e){host.innerHTML=`<div class="alert alert-danger">${escapeHtml(errorMessage(e))}</div>`;return;}
  const canDelete=can&&['draft','ready'].includes(exam.status);
  host.innerHTML=`<div class="card"><div class="toolbar"><div><div class="card-title">Tài liệu đề gốc</div><div class="muted">Lưu Word/PDF do giảng viên hoặc khảo thí cung cấp để đối chiếu với bản thi đã biên tập.</div></div>${can?'<label class="btn btn-primary source-upload"><span data-upload-label>+ Tải Word/PDF</span><input data-source-file type="file" accept=".docx,.pdf" hidden></label>':''}</div>
  ${rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Tệp</th><th>Loại</th><th>Dung lượng</th><th>Ngày lưu</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${escapeHtml(r.original_name||r.object_path.split('/').pop())}</strong></td><td>${escapeHtml(r.mime_type||'—')}</td><td>${size(r.size_bytes)}</td><td>${escapeHtml(formatDateTime(r.created_at))}</td><td class="nowrap"><button class="btn btn-secondary" data-open="${r.id}">Mở / tải</button>${canDelete?` <button class="btn btn-danger" data-remove="${r.id}">Xóa</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Chưa lưu Word/PDF gốc.</div>'}
  ${!canDelete&&rows.length?'<div class="alert alert-warning source-retention-note">Kỳ thi đã ở trạng thái chạy/đóng; tài liệu gốc không được xóa trực tiếp tại đây để giữ hồ sơ đối chiếu.</div>':''}</div>`;

  const input=host.querySelector('[data-source-file]');
  input?.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;const label=host.querySelector('[data-upload-label]');input.disabled=true;if(label)label.textContent='Đang tải…';try{await storageService.upload({examId:exam.id,file,kind:'source',metadata:{purpose:'original_exam_source'}});toast('Đã lưu tài liệu gốc.','success');await renderSources(ctx);}catch(e){toast(errorMessage(e),'error');input.disabled=false;if(label)label.textContent='+ Tải Word/PDF';}});
  host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',async()=>{const w=window.open('','_blank');try{const url=await storageService.signedUrl(b.dataset.open,600);if(w)w.location=url;else window.location.href=url;}catch(e){w?.close();toast(errorMessage(e),'error');}}));
  host.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',async()=>{const row=rows.find(x=>x.id===b.dataset.remove);if(!await confirmDialog({title:'Xóa tài liệu gốc',message:`Xóa “${row?.original_name||'tệp này'}”? Chỉ nên xóa khi tải nhầm trước kỳ thi.`,confirmText:'Xóa',danger:true}))return;try{await storageService.remove(b.dataset.remove);toast('Đã xóa tài liệu.','success');await renderSources(ctx);}catch(e){toast(errorMessage(e),'error');}}));
}
