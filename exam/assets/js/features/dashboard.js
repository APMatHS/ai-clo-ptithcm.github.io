import { dashboardData } from '../services/dashboard.js';
import { staffShell } from '../core/shell.js';
import { formatDateTime,escapeHtml,badge } from '../core/ui.js';

export async function renderDashboard(root,profile){
  root.innerHTML=staffShell({profile,active:'home',title:'Tổng quan',content:'<div class="card">Đang tải dữ liệu…</div>'});
  const data=await dashboardData();
  const rows=data.upcoming.map(s=>`<tr><td><strong>${escapeHtml(s.exams?.name||'')}</strong><div class="muted">${escapeHtml(s.exams?.subject_name||'')}</div></td><td>${escapeHtml(s.name)}</td><td>${formatDateTime(s.starts_at)}</td><td>${badge(s.status,s.status==='live'?'success':s.status==='ready'?'info':'')}</td><td><a class="btn btn-secondary" href="#/exam/${s.exam_id}">Mở</a></td></tr>`).join('');
  root.querySelector('.content').innerHTML=`<div class="page-header"><div><h1>Hệ thống thi</h1><p class="muted">Theo dõi kỳ thi, ca thi và trạng thái vận hành.</p></div><a class="btn btn-primary" href="#/exams">Quản lý kỳ thi</a></div>
  <div class="kpi-row"><div class="card stat-card"><div class="stat-value">${data.stats.exams}</div><div class="stat-label">Kỳ thi nhìn thấy</div></div><div class="card stat-card"><div class="stat-value">${data.stats.live}</div><div class="stat-label">Đang LIVE</div></div><div class="card stat-card"><div class="stat-value">${data.stats.upcoming}</div><div class="stat-label">Ca sắp tới</div></div><div class="card stat-card"><div class="stat-value">${data.stats.attempts}</div><div class="stat-label">Bài thi đã tạo</div></div></div>
  <div class="card" style="margin-top:18px"><div class="card-title">Ca thi sắp tới</div>${rows?`<div class="table-wrap"><table class="table"><thead><tr><th>Kỳ thi</th><th>Ca</th><th>Bắt đầu</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty-state">Chưa có ca thi sắp tới.</div>'}</div>`;
}
