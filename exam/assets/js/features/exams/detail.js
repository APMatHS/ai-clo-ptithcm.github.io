import { getExam,getMembership,listSessions } from '../../services/exams.js';
import { staffShell } from '../../core/shell.js';
import { loadUiState,saveUiState,setState } from '../../state.js';
import { hasAnyPermission,expandScopedMembership,scopedSessionIds,isSystemAdmin } from '../../core/permissions.js';
import { escapeHtml,badge } from '../../core/ui.js';
import { renderOverview } from './overview.js';
import { renderSessions } from './sessions.js';
import { renderRoster } from './roster.js';
import { renderPaper } from './paper.js';
import { renderMembers } from './members.js';
import { renderSources } from './sources.js';
import { renderPreflight } from './preflight.js';

const allTabs=[['overview','Tổng quan'],['sessions','Ca & phòng'],['roster','Danh sách SV'],['paper','Đề thi'],['sources','Tài liệu gốc'],['members','Nhân sự'],['preflight','Kiểm tra trước thi']];

export async function renderExamDetail(root,profile,examId){
  const [{exam,members},rawMembership,allSessions]=await Promise.all([getExam(examId),getMembership(examId,profile.id),listSessions(examId)]);
  setState({selectedExam:exam});
  const rawPerms=Array.isArray(rawMembership?.permissions)?rawMembership.permissions:[],scopeIds=scopedSessionIds(rawMembership),hasGlobalOps=rawMembership?.exam_role==='owner'||rawPerms.some(p=>!String(p).includes('@')&&String(p)!=='view_exam')||isSystemAdmin(profile);
  const sessions=scopeIds.length&&!hasGlobalOps?allSessions.filter(s=>scopeIds.includes(s.id)):allSessions;
  const membership=expandScopedMembership(rawMembership);
  const canFullPreflight=isSystemAdmin(profile)||rawMembership?.exam_role==='owner'||rawPerms.includes('manage_exam')||rawPerms.includes('manage_paper');
  const tabs=allTabs.filter(([id])=>id==='overview'||id==='sessions'||(id==='roster'&&hasAnyPermission(profile,rawMembership,'manage_roster'))||(id==='paper'&&hasAnyPermission(profile,rawMembership,'manage_paper'))||(id==='sources'&&hasAnyPermission(profile,rawMembership,'manage_assets'))||(id==='members'&&hasAnyPermission(profile,rawMembership,'manage_members'))||(id==='preflight'&&canFullPreflight));
  const key=`exam-tab:${examId}`;let active=loadUiState(key,'overview');if(!tabs.some(t=>t[0]===active))active='overview';
  const live=hasAnyPermission(profile,rawMembership,'manage_live')?`<a class="btn btn-secondary" href="#/exam/${exam.id}/live">LIVE</a>`:'';
  const results=hasAnyPermission(profile,rawMembership,'view_results')?`<a class="btn btn-secondary" href="#/exam/${exam.id}/results">Kết quả</a>`:'';
  const scopeNote=scopeIds.length&&!hasGlobalOps?`<div class="muted">Phạm vi: ${sessions.map(s=>escapeHtml(s.name)).join(', ')||'chưa được gán ca'}</div>`:'';
  const content=`<div class="page-header"><div><div class="row wrap"><a class="btn btn-secondary" href="#/exams">← Kỳ thi</a>${badge(exam.exam_type==='final'?'Cuối kỳ':exam.exam_type==='midterm'?'Giữa kỳ':'Khác',exam.exam_type==='final'?'warning':'info')}</div><h1 class="exam-detail-title">${escapeHtml(exam.name)}</h1><p class="muted">${escapeHtml(exam.subject_name)} · ${escapeHtml(exam.code)}</p>${scopeNote}</div><div class="row">${live}${results}</div></div><div class="section-tabs" data-tabs>${tabs.map(([id,label])=>`<button class="section-tab ${id===active?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div><div id="exam-tab-content" class="exam-tab-content"></div>`;
  root.innerHTML=staffShell({profile,active:'exam',examId:exam.id,title:exam.name,content});
  const host=root.querySelector('#exam-tab-content');
  const ctx={root,host,profile,exam,members,membership,rawMembership,sessions,allSessions,reload:()=>renderExamDetail(root,profile,examId)};
  const mount=async id=>{saveUiState(key,id);root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));host.innerHTML='<div class="card">Đang tải…</div>';if(id==='overview')await renderOverview(ctx);if(id==='sessions')await renderSessions(ctx);if(id==='roster')await renderRoster(ctx);if(id==='paper')await renderPaper(ctx);if(id==='sources')await renderSources(ctx);if(id==='members')await renderMembers(ctx);if(id==='preflight')await renderPreflight(ctx);};
  root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>mount(b.dataset.tab)));
  await mount(active);
}
