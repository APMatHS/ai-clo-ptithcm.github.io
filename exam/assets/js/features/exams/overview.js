import { updateExam } from '../../services/exams.js';
import { runPreflight } from '../../services/preflight.js';
import { hasPermission } from '../../core/permissions.js';
import { escapeHtml,badge,formatDateTime,toast,errorMessage,confirmDialog } from '../../core/ui.js';

const STATUS_LABEL={draft:'Nháp',ready:'Sẵn sàng',live:'Đang thi',closed:'Đã đóng',archived:'Lưu trữ'};
const SCORE_LABEL={hidden:'Không hiện',immediate:'Hiện ngay sau nộp',after_close:'Hiện sau khi kỳ thi đóng'};

export async function renderOverview(ctx){
  const {host,exam,sessions,members,profile,membership,reload}=ctx;
  const rooms=sessions.reduce((n,s)=>n+(s.exam_rooms?.length||0),0);
  const can=hasPermission(profile,membership,'manage_exam');
  host.innerHTML=`<div class="page-grid"><div class="card col-3 stat-card"><div class="stat-value">${sessions.length}</div><div class="stat-label">Ca thi</div></div><div class="card col-3 stat-card"><div class="stat-value">${rooms}</div><div class="stat-label">Phòng thi</div></div><div class="card col-3 stat-card"><div class="stat-value">${members.length}</div><div class="stat-label">Nhân sự</div></div><div class="card col-3 stat-card"><div class="stat-value">${exam.retention_days}</div><div class="stat-label">Ngày giữ hồ sơ</div></div>
  <div class="card col-6"><div class="card-title">Thông tin kỳ thi</div><div class="stack"><div><span class="muted">Mã:</span> <strong>${escapeHtml(exam.code)}</strong></div><div><span class="muted">Môn:</span> ${escapeHtml(exam.subject_name)}</div><div><span class="muted">Năm học / học kỳ:</span> ${escapeHtml(exam.academic_year||'—')} / ${escapeHtml(exam.semester||'—')}</div><div><span class="muted">Trạng thái:</span> ${badge(STATUS_LABEL[exam.status]||exam.status,exam.status==='live'?'success':exam.status==='ready'?'info':exam.status==='closed'?'warning':'')}</div><div><span class="muted">Hiện điểm:</span> ${escapeHtml(SCORE_LABEL[exam.score_visibility]||exam.score_visibility)}</div><div><span class="muted">Tạo:</span> ${formatDateTime(exam.created_at)}</div>${exam.retention_until?`<div><span class="muted">Đủ thời gian lưu trữ:</span> ${escapeHtml(formatDateTime(exam.retention_until))}</div>`:''}</div></div>
  <div class="card col-6"><div class="card-title">Nguyên tắc vận hành</div><div class="stack"><div class="alert">Mỗi ca dùng một đề; hệ thống sinh thứ tự câu và đáp án riêng cho từng sinh viên.</div><div class="alert">Sinh viên dùng MSSV + mã thi; không dùng tài khoản AI-CLO chính.</div><div class="alert">Hồ sơ bài thi được giữ mặc định ${exam.retention_days} ngày và không tự xóa khi hết hạn.</div></div></div>
  ${can?`<div class="card col-12"><div class="card-title">Điều hành kỳ thi</div><div class="form-grid overview-controls"><div class="field"><label>Trạng thái</label><select class="select" data-status>${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}" ${v===exam.status?'selected':''}>${l}</option>`).join('')}</select><div class="muted">Chuyển sang Sẵn sàng/Đang thi sẽ chạy preflight trước.</div></div><div class="field"><label>Hiện điểm cho sinh viên</label><select class="select" data-score>${Object.entries(SCORE_LABEL).map(([v,l])=>`<option value="${v}" ${v===exam.score_visibility?'selected':''}>${l}</option>`).join('')}</select></div></div></div>`:''}</div>`;

  const status=host.querySelector('[data-status]');
  status?.addEventListener('change',async()=>{
    const target=status.value;status.disabled=true;
    try{
      if(['ready','live'].includes(target)){
        const report=await runPreflight(exam.id);
        if(!report.ready){status.value=exam.status;toast(`Không thể chuyển trạng thái: còn ${report.summary.errors} lỗi preflight.`,'error',5500);return;}
      }
      if(target==='archived'&&!await confirmDialog({title:'Lưu trữ kỳ thi',message:'Kỳ thi sẽ rời danh sách vận hành thông thường. Hồ sơ chưa bị xóa.',confirmText:'Lưu trữ'})){status.value=exam.status;return;}
      const patch={status:target};
      if(target==='closed'&&!exam.retention_until)patch.retention_until=new Date(Date.now()+Number(exam.retention_days||30)*86400000).toISOString();
      if(['draft','ready','live'].includes(target))patch.retention_until=null;
      await updateExam(exam.id,patch);toast(`Đã chuyển kỳ thi sang “${STATUS_LABEL[target]}”.`,'success');await reload();
    }catch(e){status.value=exam.status;toast(errorMessage(e),'error');}finally{status.disabled=false;}
  });
  const score=host.querySelector('[data-score]');
  score?.addEventListener('change',async()=>{score.disabled=true;try{await updateExam(exam.id,{score_visibility:score.value});toast('Đã cập nhật chế độ hiện điểm.','success');await reload();}catch(e){score.value=exam.score_visibility;toast(errorMessage(e),'error');}finally{score.disabled=false;}});
}
