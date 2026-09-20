import { getExam,getMembership,listSessions } from '../../services/exams.js';
import { staffShell } from '../../core/shell.js';
import { loadUiState,saveUiState,setState } from '../../state.js';
import { escapeHtml,badge } from '../../core/ui.js';
import { renderOverview } from './overview.js';
import { renderSessions } from './sessions.js';
import { renderRoster } from './roster.js';
import { renderPaper } from './paper.js';
import { renderMembers } from './members.js';
import { renderPreflight } from './preflight.js';

const tabs=[['overview','Tổng quan'],['sessions','Ca & phòng'],['roster','Danh sách SV'],['paper','Đề thi'],['members','Nhân sự'],['preflight','Kiểm tra trước thi']];

export async function renderExamDetail(root,profile,examId){
  const [{exam,members},membership,sessions]=await Promise.all([getExam(examId),getMembership(examId,profile.id),listSessions(examId)]);
  setState({selectedExam:exam});
  const key=`exam-tab:${examId}`;let active=loadUiState(key,'overview');if(!tabs.some(t=>t[0]===active))active='overview';
  const content=`<div class="page-header"><div><div class="row wrap"><a class="btn btn-secondary" href="#/exams">← Kỳ thi</a>${badge(exam.exam_type==='final'?'Cuối kỳ':exam.exam_type==='midterm'?'Giữa kỳ':'Khác',exam.exam_type==='final'?'warning':'info')}</div><h1 class="exam-detail-title">${escapeHtml(exam.name)}</h1><p class="muted">${escapeHtml(exam.subject_name)} · ${escapeHtml(exam.code)}</p></div><div class="row"><a class="btn btn-secondary" href="#/exam/${exam.id}/live">LIVE</a><a class="btn btn-secondary" href="#/exam/${exam.id}/results">Kết quả</a></div></div><div class="section-tabs" data-tabs>${tabs.map(([id,label])=>`<button class="section-tab ${id===active?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div><div id="exam-tab-content" class="exam-tab-content"></div>`;
  root.innerHTML=staffShell({profile,active:'exam',examId:exam.id,title:exam.name,content});
  const host=root.querySelector('#exam-tab-content');
  const ctx={root,host,profile,exam,members,membership,sessions,reload:()=>renderExamDetail(root,profile,examId)};
  const mount=async id=>{saveUiState(key,id);root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));host.innerHTML='<div class="card">Đang tải…</div>';if(id==='overview')await renderOverview(ctx);if(id==='sessions')await renderSessions(ctx);if(id==='roster')await renderRoster(ctx);if(id==='paper')await renderPaper(ctx);if(id==='members')await renderMembers(ctx);if(id==='preflight')await renderPreflight(ctx);};
  root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>mount(b.dataset.tab)));
  await mount(active);
}
