import { escapeHtml } from './ui.js';
import { roleLabel } from './permissions.js';

const navItem=(href,label,icon,active)=>`<a class="nav-button ${active?'active':''}" href="${href}"><span aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span></a>`;

export function staffShell({profile,active='home',content,title='AI-CLO EXAM',examId=null}){
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">AI-CLO <span>EXAM</span></div>
      <nav class="sidebar-nav" aria-label="Điều hướng chính">
        ${navItem('#/','Tổng quan','⌂',active==='home')}
        ${navItem('#/exams','Kỳ thi','▣',active==='exams'||active==='exam')}
        ${examId?navItem(`#/exam/${examId}/live`,'LIVE','●',active==='live'):navItem('#/exams','LIVE','●',active==='live')}
        ${examId?navItem(`#/exam/${examId}/results`,'Kết quả','▤',active==='results'):navItem('#/exams','Kết quả','▤',active==='results')}
        ${navItem('#/student','Thi SV','▶',active==='student')}
      </nav>
      <div class="sidebar-footer">
        <div style="font-weight:800">${escapeHtml(profile?.full_name||'')}</div>
        <div style="font-size:12px;color:#b9d0e2">${escapeHtml(roleLabel(profile?.system_role))}</div>
        <button id="staff-logout" class="btn btn-ghost" style="color:#fff;padding-left:0;margin-top:8px">Đăng xuất</button>
      </div>
    </aside>
    <main class="main-shell">
      <header class="topbar"><div class="topbar-title">${escapeHtml(title)}</div><div class="row"><span class="badge">${escapeHtml(roleLabel(profile?.system_role))}</span><button id="staff-logout-mobile" class="btn btn-secondary">Đăng xuất</button></div></header>
      <div class="content">${content}</div>
    </main>
  </div>`;
}
