import { updateExam } from '../../services/exams.js';
import { runPreflight } from '../../services/preflight.js';
import { setExamStatus } from '../../services/lifecycle.js';
import { retentionService } from '../../services/retention.js';
import { hasPermission } from '../../core/permissions.js';
import { escapeHtml,badge,formatDateTime,toast,errorMessage,confirmDialog,openModal,closeModal,setBusy } from '../../core/ui.js';

const STATUS_LABEL={draft:'Nháp',ready:'Sẵn sàng',live:'Đang thi',closed:'Đã đóng',archived:'Lưu trữ'};
const SCORE_LABEL={hidden:'Không hiện',immediate:'Hiện ngay sau nộp',after_close:'Hiện sau khi kỳ thi đóng'};
function formatBytes(n=0){let x=Number(n||0),i=0;const u=['B','KB','MB','GB'];while(x>=1024&&i<u.length-1){x/=1024;i++;}return `${x.toFixed(i?1:0)} ${u[i]}`;}

export async function renderOverview(ctx){
  const {host,exam,sessions,members,profile,membership,reload}=ctx;
  const rooms=sessions.reduce((n,s)=>n+(s.exam_rooms?.length||0),0);
  const can=hasPermission(profile,membership,'manage_exam');
  const canPurge=profile?.system_role==='admin'&&['closed','archived'].includes(exam.status);
  host.innerHTML=`<div class="page-grid"><div class="card col-3 stat-card"><div class="stat-value">${sessions.length}</div><div class="stat-label">Ca thi</div></div><div class="card col-3 stat-card"><div class="stat-value">${rooms}</div><div class="stat-label">Phòng thi</div></div><div class="card col-3 stat-card"><div class="stat-value">${members.length}</div><div class="stat-label">Nhân sự</div></div><div class="card col-3 stat-card"><div class="stat-value">${exam.retention_days}</div><div class="stat-label">Ngày giữ hồ sơ</div></div>
  <div class="card col-6"><div class="card-title">Thông tin kỳ thi</div><div class="stack"><div><span class="muted">Mã:</span> <strong>${escapeHtml(exam.code)}</strong></div><div><span class="muted">Môn:</span> ${escapeHtml(exam.subject_name)}</div><div><span class="muted">Năm học / học kỳ:</span> ${escapeHtml(exam.academic_year||'—')} / ${escapeHtml(exam.semester||'—')}</div><div><span class="muted">Trạng thái:</span> ${badge(STATUS_LABEL[exam.status]||exam.status,exam.status==='live'?'success':exam.status==='ready'?'info':exam.status==='closed'?'warning':'')}</div><div><span class="muted">Hiện điểm:</span> ${escapeHtml(SCORE_LABEL[exam.score_visibility]||exam.score_visibility)}</div><div><span class="muted">Tạo:</span> ${formatDateTime(exam.created_at)}</div>${exam.retention_until?`<div><span class="muted">Đủ thời gian lưu trữ:</span> ${escapeHtml(formatDateTime(exam.retention_until))}</div>`:''}</div></div>
  <div class="card col-6"><div class="card-title">Nguyên tắc vận hành</div><div class="stack"><div class="alert">Mỗi ca dùng một đề; hệ thống sinh thứ tự câu và đáp án riêng cho từng sinh viên.</div><div class="alert">Sinh viên dùng MSSV + mã thi; không dùng tài khoản AI-CLO chính.</div><div class="alert">Hồ sơ bài thi được giữ mặc định ${exam.retention_days} ngày và không tự xóa khi hết hạn.</div></div></div>
  ${can?`<div class="card col-12"><div class="card-title">Điều hành kỳ thi</div><div class="form-grid overview-controls"><div class="field"><label>Trạng thái</label><select class="select" data-status>${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}" ${v===exam.status?'selected':''}>${l}</option>`).join('')}</select><div class="muted">Trạng thái được kiểm soát ở backend; Sẵn sàng/Đang thi phải vượt preflight.</div></div><div class="field"><label>Hiện điểm cho sinh viên</label><select class="select" data-score>${Object.entries(SCORE_LABEL).map(([v,l])=>`<option value="${v}" ${v===exam.score_visibility?'selected':''}>${l}</option>`).join('')}</select></div></div></div>`:''}
  ${canPurge?`<div class="card col-12 retention-danger"><div class="toolbar"><div><div class="card-title">An toàn dữ liệu sau thi</div><div class="muted">Admin có thể xem trước và xóa vĩnh viễn roster, bài làm, đề và asset sau khi đã xuất hồ sơ cần giữ.</div></div><button class="btn btn-danger" data-retention>Xem dữ liệu cần xóa</button></div></div>`:''}</div>`;

  const status=host.querySelector('[data-status]');
  status?.addEventListener('change',async()=>{
    const target=status.value;status.disabled=true;
    try{
      if(['ready','live'].includes(target)){
        const report=await runPreflight(exam.id);
        if(!report.ready){status.value=exam.status;toast(`Không thể chuyển trạng thái: còn ${report.summary.errors} lỗi preflight.`,'error',5500);return;}
      }
      if(target==='archived'&&!await confirmDialog({title:'Lưu trữ kỳ thi',message:'Kỳ thi sẽ rời danh sách vận hành thông thường. Hồ sơ chưa bị xóa.',confirmText:'Lưu trữ'})){status.value=exam.status;return;}
      await setExamStatus(exam.id,target);toast(`Đã chuyển kỳ thi sang “${STATUS_LABEL[target]}”.`,'success');await reload();
    }catch(e){status.value=exam.status;const extra=Array.isArray(e?.data?.readinessErrors)?` ${e.data.readinessErrors.join(' ')}`:'';toast(`${errorMessage(e)}${extra}`,'error',6000);}finally{status.disabled=false;}
  });
  const score=host.querySelector('[data-score]');
  score?.addEventListener('change',async()=>{score.disabled=true;try{await updateExam(exam.id,{score_visibility:score.value});toast('Đã cập nhật chế độ hiện điểm.','success');await reload();}catch(e){score.value=exam.score_visibility;toast(errorMessage(e),'error');}finally{score.disabled=false;}});
  host.querySelector('[data-retention]')?.addEventListener('click',()=>openRetention(ctx));
}

async function openRetention(ctx){
  try{
    const p=await retentionService.preview(ctx.exam.id);
    openModal({title:'Xóa vĩnh viễn dữ liệu kỳ thi',wide:true,body:`<div class="alert alert-danger"><strong>Không thể hoàn tác.</strong> Thao tác này xóa roster, bài làm chi tiết, đề thi và các file/ảnh/audio của kỳ thi. Metadata kỳ thi và audit log vẫn được giữ.</div><div class="page-grid"><div class="card col-3 stat-card"><div class="stat-value">${p.students}</div><div class="stat-label">Sinh viên</div></div><div class="card col-3 stat-card"><div class="stat-value">${p.attempts}</div><div class="stat-label">Bài làm</div></div><div class="card col-3 stat-card"><div class="stat-value">${p.assets}</div><div class="stat-label">Asset</div></div><div class="card col-3 stat-card"><div class="stat-value">${formatBytes(p.assetBytes)}</div><div class="stat-label">Dung lượng asset</div></div></div><form id="purge-form" class="stack retention-form"><label class="choice-row"><input type="checkbox" name="archive_confirmed"><span>Tôi xác nhận đã xuất/lưu Excel, PDF hoặc hồ sơ cần giữ.</span></label><div class="field"><label>Nhập mã kỳ thi <strong>${escapeHtml(p.exam.code)}</strong> để xác nhận</label><input class="input" name="confirm_code" autocomplete="off"></div></form>`,footer:'<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-danger" data-purge>Xóa vĩnh viễn dữ liệu</button>',onMount(modal){modal.querySelector('[data-cancel]').onclick=closeModal;modal.querySelector('[data-purge]').onclick=async e=>{const form=modal.querySelector('#purge-form'),code=form.elements.confirm_code.value.trim(),confirmed=form.elements.archive_confirmed.checked;if(!confirmed)return toast('Hãy xác nhận đã xuất hồ sơ cần giữ.','error');if(code.toUpperCase()!==String(p.exam.code).toUpperCase())return toast('Mã kỳ thi chưa đúng.','error');if(!await confirmDialog({title:'Xác nhận lần cuối',message:`Xóa vĩnh viễn dữ liệu chi tiết của ${p.exam.name}?`,confirmText:'Xóa vĩnh viễn',danger:true}))return;const btn=e.currentTarget;setBusy(btn,true,'Đang xóa…');try{await retentionService.purge(ctx.exam.id,code,true);closeModal();toast('Đã xóa dữ liệu chi tiết và chuyển kỳ thi sang lưu trữ.','success',6000);await ctx.reload();}catch(err){toast(errorMessage(err),'error',6000);setBusy(btn,false);}};}});
  }catch(e){toast(errorMessage(e),'error');}
}
