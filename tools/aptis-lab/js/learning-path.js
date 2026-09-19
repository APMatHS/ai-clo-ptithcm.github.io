(() => {
  'use strict';

  const API = window.AptisAPI;
  if (!API?.client || !API.getLearningPath) return;

  const SKILLS = {
    grammar: ['Grammar', 'G', 'Ngữ pháp theo chủ điểm từ B1 đến B2.'],
    vocabulary: ['Vocabulary', 'V', 'Từ vựng, collocations, synonyms và phrasal verbs.'],
    reading: ['Reading', 'R', 'Đọc passage theo bộ và luyện tìm ý, chi tiết, suy luận.'],
    listening: ['Listening', 'L', 'Luyện nghe theo audio bank khi nội dung sẵn sàng.'],
    speaking: ['Speaking', 'S', 'Ghi âm và luyện phản xạ theo prompt.'],
    writing: ['Writing', 'W', 'Viết có autosave, word count và lưu lịch sử.']
  };

  const ctx = {
    userId: null, path: null, saved: null, local: null, tab: 'route',
    attempt: null, index: 0, questionStartedAt: 0, mounting: false,
    saveTimer: null, recorder: null, recordChunks: [], recordBlob: null
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const currentView = () => location.hash.replace('#', '') || 'dashboard';
  const localKey = () => `aptis.learning.v2.${ctx.userId || 'guest'}`;

  function notify(message, type = '') {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.className = `toast show ${type}`;
    clearTimeout(notify._t); notify._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(localKey()) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function writeLocal(patch = {}) {
    ctx.local = { ...(ctx.local || {}), ...patch, saved_at: Date.now() };
    try { localStorage.setItem(localKey(), JSON.stringify(ctx.local)); } catch (_) {}
    return ctx.local;
  }

  async function ensureIdentity() {
    if (ctx.userId) return ctx.userId;
    const session = await API.getSession();
    ctx.userId = session?.user?.id || null;
    ctx.local = readLocal();
    return ctx.userId;
  }

  async function ensureData(force = false) {
    await ensureIdentity(); if (!ctx.userId) return;
    if (!force && ctx.path && ctx.saved !== undefined) return;
    const [pathRes, stateRes] = await Promise.allSettled([API.getLearningPath(), API.getLearningState()]);
    if (pathRes.status === 'fulfilled') ctx.path = pathRes.value;
    if (stateRes.status === 'fulfilled') ctx.saved = stateRes.value;
    if (!ctx.saved) {
      ctx.saved = {
        practice_tab: ctx.local?.practice_tab || 'route',
        active_attempt_id: ctx.local?.active_attempt_id || null,
        active_lesson_id: ctx.local?.active_lesson_id || null,
        question_index: Number(ctx.local?.question_index || 0),
        draft_response: ctx.local?.draft_response || {},
        ui_state: ctx.local?.ui_state || {},
        scroll_position: Number(ctx.local?.scroll_position || 0)
      };
    }
    ctx.tab = ['route','skills','review'].includes(ctx.saved.practice_tab) ? ctx.saved.practice_tab : (ctx.local?.practice_tab || 'route');
  }

  function patchSaved(patch) { ctx.saved = { ...(ctx.saved || {}), ...patch }; writeLocal(patch); }
  async function persist(patch, { remote = true } = {}) {
    patchSaved(patch); if (!remote) return ctx.saved;
    try { const row = await API.saveLearningState(patch); ctx.saved = row || ctx.saved; return row; }
    catch (err) { console.warn('Aptis learning state save failed:', err); return ctx.saved; }
  }
  function persistScroll({ remote = true } = {}) {
    if (currentView() !== 'practice') return;
    persist({ practice_tab: ctx.tab, question_index: Math.max(0, Number(ctx.index || 0)), scroll_position: Math.max(0, Math.round(window.scrollY || 0)) }, { remote });
  }
  function debounceDraftSave(patch) {
    patchSaved(patch); clearTimeout(ctx.saveTimer); ctx.saveTimer = setTimeout(() => persist(patch), 450);
  }

  function skillName(skill) { return SKILLS[skill]?.[0] || skill || 'Tổng hợp'; }
  function findLesson(id) {
    if (!id || !ctx.path?.units) return null;
    for (const unit of ctx.path.units) {
      const lesson = (unit.lessons || []).find(x => x.id === id);
      if (lesson) return { lesson, unit };
    }
    return null;
  }
  function allLessons() { return (ctx.path?.units || []).flatMap(unit => (unit.lessons || []).map(lesson => ({ lesson, unit }))); }
  function routeStats() {
    const available = allLessons().filter(x => x.lesson.is_available);
    const completed = available.filter(x => x.lesson.status === 'completed');
    return { total: available.length, completed: completed.length, percent: available.length ? Math.round(100 * completed.length / available.length) : 0 };
  }
  function nextRecommendedLesson() {
    const list = allLessons().filter(x => x.lesson.is_available);
    return list.find(x => x.lesson.status === 'in_progress') || list.find(x => x.lesson.status !== 'completed') || list[0] || null;
  }

  function setTab(tab) {
    if (!['route','skills','review'].includes(tab)) return;
    ctx.tab = tab; persist({ practice_tab: tab, scroll_position: 0 }); renderTab();
  }
  function tabButton(tab, label, sub) {
    return `<button type="button" class="lp-tab ${ctx.tab === tab ? 'active' : ''}" data-lp-tab="${tab}"><b>${label}</b><span>${sub}</span></button>`;
  }

  async function mountPractice() {
    if (ctx.mounting || currentView() !== 'practice') return;
    const root = $('#pageContent'); if (!root || root.querySelector('.aptis-learning-v2')) return;
    ctx.mounting = true;
    const previousScroll = Number(ctx.saved?.scroll_position || ctx.local?.scroll_position || 0);
    root.innerHTML = `<div class="aptis-learning-v2">
      <div class="page-head"><div><div class="eyebrow">Học · luyện · ôn tập</div><h1>Luyện tập Aptis General</h1><p>Lộ trình B1→B2 dùng chung ngân hàng Supabase; mọi bài cá nhân được lưu để tiếp tục và ôn lại.</p></div></div>
      <div class="lp-tabs">${tabButton('route','Lộ trình học','Học tuần tự từ nền tảng đến B2')}${tabButton('skills','Luyện kỹ năng','Tự chọn kỹ năng, mức và số câu')}${tabButton('review','Ôn tập thông minh','Ưu tiên câu sai, chưa gặp và lâu chưa ôn')}</div>
      <div id="lpBody"><div class="card"><div class="help">Đang tải lộ trình và trạng thái học…</div></div></div>
    </div>`;
    try {
      await ensureData(true);
      $$('.lp-tab', root).forEach(btn => btn.onclick = () => setTab(btn.dataset.lpTab));
      renderTab();
      requestAnimationFrame(() => { if (previousScroll > 0) window.scrollTo({ top: previousScroll, behavior: 'instant' }); });
    } catch (err) {
      $('#lpBody').innerHTML = `<div class="card"><b>Không tải được Luyện tập.</b><p class="help">${esc(err?.message || err)}</p></div>`;
    } finally { ctx.mounting = false; }
  }

  function refreshTabButtons() { $$('.lp-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.lpTab === ctx.tab)); }
  function renderTab() { refreshTabButtons(); if (ctx.tab === 'skills') return renderSkills(); if (ctx.tab === 'review') return renderReview(); return renderRoute(); }

  function continueCard(tab) {
    if (!ctx.saved?.active_attempt_id || ctx.saved.practice_tab !== tab) return '';
    const found = findLesson(ctx.saved.active_lesson_id);
    const title = found?.lesson?.title || (tab === 'review' ? 'Ôn tập thông minh đang dở' : 'Bài luyện đang dở');
    return `<section class="lp-continue"><div><span>TIẾP TỤC BÀI ĐANG HỌC</span><h3>${esc(title)}</h3><p>Câu ${Number(ctx.saved.question_index || 0)+1}. Đáp án đã nộp được lưu trên Supabase; vị trí hiện tại được phục hồi tự động.</p></div><button type="button" class="btn primary" data-resume-attempt>Tiếp tục</button></section>`;
  }
  function wireContinue(root = document) {
    $$('[data-resume-attempt]', root).forEach(btn => btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Đang mở…';
      try { await resumeActiveAttempt(); }
      catch (err) { notify(err?.message || 'Không thể mở bài đang học.', 'error'); btn.disabled = false; btn.textContent = 'Tiếp tục'; }
    });
  }

  function renderRoute() {
    const body = $('#lpBody'); if (!body) return;
    const stats = routeStats(); const recommended = nextRecommendedLesson(); const active = findLesson(ctx.saved?.active_lesson_id);
    const recommendedTitle = active?.lesson?.title || recommended?.lesson?.title || 'Chọn bài đầu tiên';
    body.innerHTML = `${continueCard('route')}
      <section class="lp-route-hero card"><div class="lp-route-copy"><div class="eyebrow">LỘ TRÌNH CHUNG</div><h2>${esc(ctx.path?.course?.title || 'Aptis General · B1 → B2')}</h2><p>${esc(ctx.path?.course?.description || '')}</p><div class="lp-progress-row"><div class="progress-bar"><i style="width:${stats.percent}%"></i></div><b>${stats.percent}%</b></div><small>${stats.completed}/${stats.total} bài khả dụng đã hoàn thành</small></div>
      <div class="lp-route-next"><span>Bài tiếp theo</span><strong>${esc(recommendedTitle)}</strong>${active ? '<button class="btn primary" data-resume-attempt>Tiếp tục bài đang học</button>' : recommended ? `<button class="btn primary" data-preview-lesson="${recommended.lesson.id}">Mở bài tiếp theo</button>` : ''}</div></section>
      <div class="section-title"><h2>12 Unit từ B1 đến B2</h2><span>Listening/Speaking/Writing chỉ mở khi ngân hàng nội dung tương ứng sẵn sàng.</span></div>
      <div class="lp-units">${(ctx.path?.units || []).map(unit => {
        const lessons = unit.lessons || []; const available = lessons.filter(x => x.is_available); const completed = available.filter(x => x.status === 'completed').length; const unitDone = available.length && completed === available.length; const hasActive = lessons.some(x => x.id === ctx.saved?.active_lesson_id); const firstOpen = !unitDone && (hasActive || unit.position === (recommended?.unit?.position || 1));
        return `<details class="lp-unit card ${unitDone ? 'done' : ''}" ${firstOpen ? 'open' : ''}><summary><div class="lp-unit-no">${unitDone ? '✓' : String(unit.position).padStart(2,'0')}</div><div><b>${esc(unit.title)}</b><span>${esc(unit.subtitle || '')}</span></div><div class="lp-unit-progress">${completed}/${available.length || lessons.length}</div></summary><div class="lp-unit-body"><p>${esc(unit.description || '')}</p><div class="lp-lessons">${lessons.map(lesson => {
          const statusText = lesson.status === 'completed' ? 'Đã học' : lesson.status === 'in_progress' ? 'Đang học' : lesson.is_available ? 'Chưa học' : 'Sắp mở'; const icon = lesson.status === 'completed' ? '✓' : lesson.is_available ? (SKILLS[lesson.skill]?.[1] || '•') : '🔒';
          return `<div class="lp-lesson ${lesson.status === 'completed' ? 'completed' : ''} ${!lesson.is_available ? 'locked' : ''}"><div class="lp-lesson-icon">${icon}</div><div class="lp-lesson-main"><div><b>${esc(lesson.title)}</b><span class="tag">${esc(lesson.level)}</span></div><p>${esc(lesson.objective || '')}</p><small>${esc(skillName(lesson.skill))} · ${lesson.estimated_minutes} phút · ${statusText}</small></div><button type="button" class="btn ${lesson.status === 'in_progress' ? 'primary' : 'secondary'} small" ${lesson.is_available ? `data-preview-lesson="${lesson.id}"` : 'disabled'}>${lesson.status === 'in_progress' ? 'Tiếp tục' : lesson.status === 'completed' ? 'Học lại' : lesson.is_available ? 'Mở bài' : 'Sắp mở'}</button></div>`;
        }).join('')}</div></div></details>`;
      }).join('')}</div>`;
    wireContinue(body); $$('[data-preview-lesson]', body).forEach(btn => btn.onclick = () => previewLesson(btn.dataset.previewLesson));
  }

  function previewLesson(lessonId) {
    const found = findLesson(lessonId); if (!found) return; const { lesson, unit } = found; const body = $('#lpBody');
    body.innerHTML = `<div class="lp-breadcrumb"><button class="btn ghost small" id="lpBackRoute">← Lộ trình</button><span>Unit ${unit.position} · ${esc(unit.title)}</span></div><section class="card lp-lesson-intro"><div class="question-meta"><span class="tag teal">${esc(skillName(lesson.skill))}</span><span class="tag">${esc(lesson.level)}</span><span class="tag">${lesson.estimated_minutes} phút</span></div><h2>${esc(lesson.title)}</h2><p class="lp-objective"><b>Mục tiêu:</b> ${esc(lesson.objective || '')}</p><div class="lp-teach-block"><span>TRƯỚC KHI LUYỆN</span><p>${esc(lesson.intro_text || 'Đọc mục tiêu và làm bài theo thứ tự. Hệ thống sẽ lưu từng câu và tiến độ của bạn.')}</p></div><div class="lp-lesson-actions"><button class="btn primary" id="lpStartLesson">Bắt đầu bài học</button>${lesson.status === 'completed' ? '<span class="lp-done-note">✓ Bạn đã hoàn thành bài này; học lại không xóa kết quả cũ.</span>' : ''}</div></section>`;
    $('#lpBackRoute').onclick = renderRoute;
    $('#lpStartLesson').onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Đang chuẩn bị bài…';
      try {
        const payload = await API.startLesson(lesson.id);
        patchSaved({ active_attempt_id: payload.attempt_id, active_lesson_id: lesson.id, practice_tab: 'route', question_index: 0, draft_response: {}, scroll_position: 0 });
        ctx.tab = 'route'; runAttempt(payload, { tab: 'route', lessonId: lesson.id });
      } catch (err) { notify(err?.message || 'Không thể bắt đầu bài học.', 'error'); btn.disabled = false; btn.textContent = 'Bắt đầu bài học'; }
    };
  }

  function renderSkills() {
    const body = $('#lpBody'); if (!body) return;
    const ui = { skill: 'grammar', level: $('#targetLevelText')?.textContent || 'B2', count: 10, ...(ctx.saved?.ui_state || {}), ...(ctx.local?.ui_state || {}) };
    const skill = SKILLS[ui.skill] ? ui.skill : 'grammar';
    body.innerHTML = `${continueCard('skills')}<section class="card lp-skill-header"><div><div class="eyebrow">LUYỆN TỰ DO</div><h2>Chọn kỹ năng bạn muốn tập trung</h2><p>Lần luyện vẫn được lưu đầy đủ vào lịch sử cá nhân và dùng cho Ôn tập thông minh.</p></div></section><div class="lp-skill-grid">${Object.entries(SKILLS).map(([key,[name,icon,desc]]) => `<button type="button" class="lp-skill-card ${key === skill ? 'active' : ''}" data-skill="${key}"><span>${icon}</span><b>${name}</b><small>${esc(desc)}</small></button>`).join('')}</div><section class="card lp-practice-config"><div><span class="eyebrow">THIẾT LẬP BÀI LUYỆN</span><h3>${esc(skillName(skill))}</h3><p>${esc(SKILLS[skill][2])}</p></div><div class="lp-config-row"><label class="field">Mức<select id="lpSkillLevel"><option ${ui.level === 'B1' ? 'selected' : ''}>B1</option><option ${ui.level !== 'B1' ? 'selected' : ''}>B2</option></select></label><label class="field">Số câu<select id="lpSkillCount">${[5,10,15,20].map(n => `<option ${Number(ui.count) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="btn primary" id="lpStartSkill">Bắt đầu luyện</button></div></section>`;
    wireContinue(body);
    $$('[data-skill]', body).forEach(btn => btn.onclick = () => { const nextUi = { ...ui, skill: btn.dataset.skill }; persist({ practice_tab: 'skills', ui_state: nextUi, scroll_position: 0 }); renderSkills(); });
    $('#lpStartSkill').onclick = async e => {
      const btn = e.currentTarget; const level = $('#lpSkillLevel').value; const count = Number($('#lpSkillCount').value); const nextUi = { skill, level, count }; btn.disabled = true; btn.textContent = 'Đang rút câu…';
      try {
        const data = await API.drawPractice(skill, level, count); if (!data?.attempt_id) throw new Error('Ngân hàng chưa có câu phù hợp cho lựa chọn này.');
        const payload = await API.resumeAttempt(data.attempt_id);
        await persist({ active_attempt_id: data.attempt_id, active_lesson_id: null, practice_tab: 'skills', question_index: 0, draft_response: {}, ui_state: nextUi, scroll_position: 0 });
        ctx.tab = 'skills'; runAttempt(payload, { tab: 'skills', lessonId: null });
      } catch (err) { notify(err?.message || 'Không thể tạo bài luyện.', 'error'); btn.disabled = false; btn.textContent = 'Bắt đầu luyện'; }
    };
  }

  function renderReview() {
    const body = $('#lpBody'); if (!body) return;
    const reviewCount = Number(ctx.saved?.ui_state?.review_count || ctx.local?.ui_state?.review_count || 15);
    body.innerHTML = `${continueCard('review')}<section class="card lp-review-hero"><div class="lp-review-icon">↻</div><div><div class="eyebrow">ÔN TẬP THÔNG MINH</div><h2>Mỗi lần ôn là một phiên cá nhân</h2><p>Hệ thống ưu tiên <b>câu từng sai</b> → <b>câu chưa gặp</b> → <b>câu lâu chưa ôn</b>, rồi mới đến câu đã đúng nhiều lần. Việc chọn câu không gọi AI.</p></div></section><div class="grid three lp-review-points"><div class="card"><b>1. Sửa lỗi cũ</b><p class="help">Câu từng sai được đưa trở lại sớm để kiểm tra bạn đã khắc phục chưa.</p></div><div class="card"><b>2. Mở rộng bank đã gặp</b><p class="help">Câu chưa gặp giúp tránh học thuộc một nhóm câu nhỏ.</p></div><div class="card"><b>3. Giãn cách ôn</b><p class="help">Câu đã đúng được giảm tần suất và quay lại sau một khoảng thời gian.</p></div></div><section class="card lp-review-start"><div><h3>Phiên ôn hôm nay</h3><p class="help">Chọn độ dài phù hợp với thời gian của bạn.</p></div><div class="lp-review-counts">${[10,15,20].map(n => `<button type="button" class="${reviewCount === n ? 'active' : ''}" data-review-count="${n}">${n}<small>câu</small></button>`).join('')}</div><button class="btn primary" id="lpStartReview">Bắt đầu ôn thông minh</button></section>`;
    wireContinue(body);
    $$('[data-review-count]', body).forEach(btn => btn.onclick = () => { const n = Number(btn.dataset.reviewCount); persist({ ui_state: { ...(ctx.saved?.ui_state || {}), review_count: n }, practice_tab: 'review' }); renderReview(); });
    $('#lpStartReview').onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Đang chọn câu…';
      try {
        const payload = await API.drawSmartReview(reviewCount);
        await persist({ active_attempt_id: payload.attempt_id, active_lesson_id: null, practice_tab: 'review', question_index: 0, draft_response: {}, ui_state: { ...(ctx.saved?.ui_state || {}), review_count: reviewCount }, scroll_position: 0 });
        ctx.tab = 'review'; runAttempt(payload, { tab: 'review', lessonId: null });
      } catch (err) { notify(err?.message || 'Không thể tạo phiên ôn.', 'error'); btn.disabled = false; btn.textContent = 'Bắt đầu ôn thông minh'; }
    };
  }

  async function resumeActiveAttempt() {
    const attemptId = ctx.saved?.active_attempt_id || ctx.local?.active_attempt_id;
    if (!attemptId) { notify('Không còn bài đang dở.', 'error'); await persist({ active_attempt_id: null, active_lesson_id: null, question_index: 0 }); return renderTab(); }
    const payload = await API.resumeAttempt(attemptId);
    if (payload.completed_at) {
      if (ctx.saved?.active_lesson_id) { try { await API.markLessonComplete(ctx.saved.active_lesson_id, attemptId); } catch (_) {} }
      else await API.clearLearningState({ keepTab: true });
      patchSaved({ active_attempt_id: null, active_lesson_id: null, question_index: 0, draft_response: {} }); await ensureData(true); notify('Bài này đã hoàn thành. Tiến độ đã được cập nhật.'); return renderTab();
    }
    runAttempt(payload, { tab: ctx.saved?.practice_tab || ctx.tab, lessonId: ctx.saved?.active_lesson_id || payload.metadata?.lesson_id || null, resume: true });
  }

  function runAttempt(payload, { tab = ctx.tab, lessonId = null, resume = false } = {}) {
    if (!payload?.questions?.length) { notify('Bài luyện không có câu hỏi.', 'error'); return renderTab(); }
    ctx.tab = tab; ctx.attempt = payload;
    const savedIndex = Number(ctx.saved?.question_index ?? ctx.local?.question_index ?? 0); const firstUnanswered = payload.questions.findIndex(q => !q.answered);
    ctx.index = clamp(resume ? savedIndex : (firstUnanswered >= 0 ? firstUnanswered : 0), 0, payload.questions.length - 1); ctx.questionStartedAt = performance.now();
    patchSaved({ active_attempt_id: payload.attempt_id, active_lesson_id: lessonId, practice_tab: tab, question_index: ctx.index }); refreshTabButtons(); renderAttemptQuestion();
  }

  function questionSetBlock(q) {
    if (!q?.set) return '';
    return `<section class="lp-set-block"><div><span>${q.skill === 'reading' ? 'READING PASSAGE' : q.skill === 'listening' ? 'LISTENING SET' : 'NỘI DUNG CHUNG'}</span><b>${esc(q.set.title || '')}</b></div>${q.set.instructions ? `<p class="help">${esc(q.set.instructions)}</p>` : ''}${q.set.body_text ? `<div class="lp-passage">${esc(q.set.body_text)}</div>` : ''}<div id="lpSetMedia"></div></section>`;
  }

  function optionsHtml(q) {
    const options = Array.isArray(q.content?.options) ? q.content.options : [];
    if (options.length) return `<div class="options">${options.map((o, index) => { const selected = q.response?.value === o.key; const correct = q.answered && q.correct_answer?.value === o.key; const wrong = q.answered && selected && q.is_correct === false; const displayKey = String.fromCharCode(65 + index); return `<button type="button" class="option-btn ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}" data-lp-option="${esc(o.key)}" ${q.answered ? 'disabled' : ''}><span class="option-key">${displayKey}</span><span>${esc(o.text)}</span></button>`; }).join('')}</div>`;
    const draft = ctx.saved?.draft_response?.question_id === q.id ? (ctx.saved.draft_response.text || '') : (q.response?.text || '');
    if (q.question_type === 'speaking_prompt') return `<div class="record-box"><button id="lpRecordBtn" class="btn primary" type="button" ${q.answered ? 'disabled' : ''}>● Bắt đầu ghi âm</button><span id="lpRecordStatus" class="record-status">${q.answered ? 'Bài nói đã được lưu.' : 'Bài ghi âm chỉ tải lên sau khi bạn bấm Lưu bài nói.'}</span></div><button id="lpSubmitSpeaking" class="btn secondary" style="margin-top:12px" disabled>Lưu bài nói</button>${q.answered ? '<div id="lpAiSpeakingBox" style="margin-top:12px"><button id="lpAssessSpeaking" class="btn primary" type="button">AI chấm bài nói</button><div class="help" style="margin-top:6px">Chỉ gọi AI khi bạn bấm nút. Đây là đánh giá luyện tập, không phải điểm Aptis chính thức.</div></div>' : ''}`;
    return `<textarea id="lpTextAnswer" class="writing-box" placeholder="${q.question_type === 'writing_prompt' ? 'Viết câu trả lời của bạn…' : 'Nhập câu trả lời…'}">${esc(draft)}</textarea><div class="help" id="lpWordCount">${draft.trim() ? draft.trim().split(/\s+/).length : 0} từ · tự động lưu nháp</div><button type="button" class="btn primary" id="lpSubmitText" ${q.answered ? 'disabled' : ''}>${q.answered ? 'Đã lưu' : q.question_type === 'writing_prompt' ? 'Lưu bài viết' : 'Trả lời'}</button>`;
  }

  function feedbackHtml(q) {
    if (!q.answered) return '';
    const cls = q.is_correct === true ? 'good' : q.is_correct === false ? 'bad' : ''; const title = q.is_correct === true ? '✓ Chính xác' : q.is_correct === false ? 'Chưa đúng' : 'Đã lưu bài';
    return `<div class="feedback ${cls}"><b>${title}</b>${q.correct_answer?.value ? `<div>Đáp án: <strong>${esc(q.correct_answer.value)}</strong></div>` : ''}${q.explanation ? `<div>${esc(q.explanation)}</div>` : ''}${q.is_correct == null ? '<div class="help">Bài tự do đã được lưu; chấm AI chỉ chạy khi người học chủ động yêu cầu.</div>' : ''}</div>`;
  }

  function renderAttemptQuestion() {
    const body = $('#lpBody'); const q = ctx.attempt?.questions?.[ctx.index]; if (!body || !q) return; ctx.questionStartedAt = performance.now(); ctx.recordBlob = null;
    const lessonInfo = findLesson(ctx.saved?.active_lesson_id);
    body.innerHTML = `<div class="lp-runner-head"><button type="button" class="btn ghost small" id="lpLeaveAttempt">← Về ${ctx.tab === 'route' ? 'lộ trình' : ctx.tab === 'skills' ? 'luyện kỹ năng' : 'ôn tập'}</button><div><b>${lessonInfo ? esc(lessonInfo.lesson.title) : ctx.tab === 'review' ? 'Ôn tập thông minh' : esc(skillName(q.skill))}</b><span>Câu ${ctx.index+1}/${ctx.attempt.questions.length}</span></div></div><div class="lp-runner-progress"><i style="width:${Math.round(100*(ctx.index+(q.answered?1:0))/ctx.attempt.questions.length)}%"></i></div>${questionSetBlock(q)}<article class="card question-card lp-question"><div class="question-meta"><span class="tag teal">${esc(skillName(q.skill))}</span><span class="tag">${esc(q.level)}</span><span class="tag">Part ${esc(q.part)}</span>${q.topic ? `<span class="tag">${esc(q.topic)}</span>` : ''}</div><h2>${esc(q.prompt)}</h2><div id="lpQuestionMedia" class="question-media"></div><div id="lpAnswerZone">${optionsHtml(q)}</div><div id="lpFeedback">${feedbackHtml(q)}</div><div class="question-footer"><span class="question-counter">Câu ${ctx.index+1}/${ctx.attempt.questions.length}</span><button id="lpNext" class="btn secondary ${q.answered ? '' : 'hidden'}">${ctx.index+1 === ctx.attempt.questions.length ? 'Hoàn thành' : 'Câu tiếp theo →'}</button></div></article>`;
    $('#lpLeaveAttempt').onclick = () => { persistScroll(); ctx.attempt = null; renderTab(); };
    wireQuestion(q); loadAttemptMedia(q);
    $('#lpNext').onclick = async () => { if (ctx.index+1 >= ctx.attempt.questions.length) return finishAttempt(); ctx.index += 1; await persist({ question_index: ctx.index, draft_response: {}, scroll_position: 0, practice_tab: ctx.tab }); renderAttemptQuestion(); window.scrollTo({ top: 0, behavior: 'instant' }); };
  }

  function wireQuestion(q) {
    $$('[data-lp-option]').forEach(btn => btn.onclick = () => submitQuestion(q, { value: btn.dataset.lpOption }));
    const ta = $('#lpTextAnswer');
    if (ta && !q.answered) {
      ta.oninput = () => { const text = ta.value; if ($('#lpWordCount')) $('#lpWordCount').textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} từ · tự động lưu nháp`; debounceDraftSave({ draft_response: { question_id: q.id, text }, question_index: ctx.index, practice_tab: ctx.tab }); };
      $('#lpSubmitText').onclick = () => submitQuestion(q, { text: ta.value.trim() });
    }
    if (q.question_type === 'speaking_prompt' && !q.answered) wireRecorder(q);
    if (q.question_type === 'speaking_prompt' && q.answered) wireSpeakingAssessment(q);
  }

  function speakingAssessmentHtml(a) {
    const r = a?.rubric || {};
    if (a?.status === 'insufficient_evidence' || r.status === 'insufficient_evidence') return '<div class="feedback"><b>Chưa đủ dữ liệu để đánh giá</b><div class="help">Recording quá ngắn hoặc chưa đủ rõ. Hãy ghi lại một câu trả lời đầy đủ hơn.</div></div>';
    const s=r.scores||{}; const labels=[['task_fulfilment','Hoàn thành yêu cầu'],['grammar','Ngữ pháp'],['vocabulary','Từ vựng'],['fluency_coherence','Độ trôi chảy & mạch lạc'],['pronunciation_intelligibility','Phát âm & độ dễ hiểu']];
    return `<div class="feedback good"><b>Ước lượng luyện tập: ${esc(a.estimated_level||r.estimated_level||'—')} · ${a.total_score==null?'—':esc(a.total_score)}/25</b><div class="help">Đánh giá AI phục vụ luyện tập, không phải điểm Aptis chính thức.</div><div style="margin-top:8px">${labels.map(([k,l])=>`<div><strong>${l}:</strong> ${esc(s[k]??'—')}/5</div>`).join('')}</div>${r.strengths?.length?`<div style="margin-top:8px"><strong>Điểm tốt:</strong> ${esc(r.strengths.join(' · '))}</div>`:''}${r.improvements?.length?`<div style="margin-top:8px"><strong>Cần cải thiện:</strong> ${esc(r.improvements.join(' · '))}</div>`:''}${r.next_attempt_tip?`<div style="margin-top:8px"><strong>Lần nói tiếp theo:</strong> ${esc(r.next_attempt_tip)}</div>`:''}</div>`;
  }

  async function wireSpeakingAssessment(q) {
    const box=$('#lpAiSpeakingBox'), btn=$('#lpAssessSpeaking'); if(!box||!btn)return;
    try { const cached=await API.getSpeakingAssessment(ctx.attempt.attempt_id,q.id); if(cached){box.innerHTML=speakingAssessmentHtml(cached);return;} } catch(_){}
    btn.onclick=async()=>{btn.disabled=true;btn.textContent='AI đang nghe và chấm…';try{const data=await API.assessSpeaking(ctx.attempt.attempt_id,q.id);box.innerHTML=speakingAssessmentHtml(data.assessment);}catch(err){notify(err?.message||'Không chấm được bài nói.','error');btn.disabled=false;btn.textContent='AI chấm bài nói';}};
  }

  async function wireRecorder(q) {
    const recordBtn = $('#lpRecordBtn'), saveBtn = $('#lpSubmitSpeaking'), status = $('#lpRecordStatus');
    if (!recordBtn || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { if (recordBtn) recordBtn.disabled = true; if (status) status.textContent = 'Trình duyệt chưa hỗ trợ ghi âm trực tiếp.'; return; }
    recordBtn.onclick = async () => {
      if (ctx.recorder?.state === 'recording') { ctx.recorder.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); ctx.recordChunks = []; ctx.recorder = new MediaRecorder(stream);
        ctx.recorder.ondataavailable = e => { if (e.data.size) ctx.recordChunks.push(e.data); };
        ctx.recorder.onstop = () => { ctx.recordBlob = new Blob(ctx.recordChunks, { type: ctx.recorder.mimeType || 'audio/webm' }); stream.getTracks().forEach(t => t.stop()); recordBtn.textContent = '● Ghi lại'; saveBtn.disabled = false; status.textContent = `Đã ghi ${(ctx.recordBlob.size/1024).toFixed(0)} KB.`; };
        ctx.recorder.start(); recordBtn.textContent = '■ Dừng ghi'; status.textContent = 'Đang ghi âm…';
      } catch (_) { notify('Không truy cập được microphone.', 'error'); }
    };
    saveBtn.onclick = async () => {
      if (!ctx.recordBlob) return; saveBtn.disabled = true; saveBtn.textContent = 'Đang tải lên…';
      try { const file = new File([ctx.recordBlob], 'speaking.webm', { type: ctx.recordBlob.type || 'audio/webm' }); const media = await API.uploadRecording(file, ctx.userId); await submitQuestion(q, { recording: media }); }
      catch (err) { notify(err?.message || 'Không lưu được bài nói.', 'error'); saveBtn.disabled = false; saveBtn.textContent = 'Lưu bài nói'; }
    };
  }

  async function submitQuestion(q, response) {
    if (q.answered) return; const elapsed = Math.max(0, Math.round(performance.now()-ctx.questionStartedAt));
    try { const result = await API.submitAnswer(ctx.attempt.attempt_id, q.id, response, elapsed); Object.assign(q, { response, answered: true, is_correct: result.is_correct, correct_answer: result.correct_answer, explanation: result.explanation }); await persist({ question_index: ctx.index, draft_response: {}, practice_tab: ctx.tab }); renderAttemptQuestion(); }
    catch (err) { notify(err?.message || 'Không lưu được câu trả lời.', 'error'); }
  }

  async function loadAttemptMedia(q) {
    const media = q.media?.path ? q.media : q.set?.media?.path ? q.set.media : null; const target = q.media?.path ? $('#lpQuestionMedia') : $('#lpSetMedia'); if (!media || !target) return;
    try { const url = await API.signedUrl(media, 3600); if (!url) return; if (media.kind === 'image' || media.mime?.startsWith('image/')) target.innerHTML = `<img src="${esc(url)}" alt="Hình minh họa">`; else if (media.kind === 'audio' || media.mime?.startsWith('audio/')) target.innerHTML = `<audio controls preload="metadata" src="${esc(url)}"></audio>`; }
    catch (_) { target.innerHTML = '<div class="help">Không tải được media.</div>'; }
  }

  async function finishAttempt() {
    const body = $('#lpBody'); body.innerHTML = '<div class="card"><div class="help">Đang lưu kết quả và cập nhật lộ trình…</div></div>';
    try {
      const latest = await API.resumeAttempt(ctx.attempt.attempt_id); const lessonId = ctx.saved?.active_lesson_id || latest.metadata?.lesson_id || null;
      if (lessonId) await API.markLessonComplete(lessonId, latest.attempt_id); else await API.clearLearningState({ keepTab: true });
      patchSaved({ active_attempt_id: null, active_lesson_id: null, question_index: 0, draft_response: {}, scroll_position: 0 }); ctx.attempt = null; await ensureData(true);
      const score = latest.score_percent == null ? 'Đã lưu' : `${Math.round(Number(latest.score_percent))}%`;
      body.innerHTML = `<section class="card lp-complete"><div class="lp-complete-icon">✓</div><div><div class="eyebrow">HOÀN THÀNH</div><h2>${lessonId ? 'Đã hoàn thành bài học' : 'Đã hoàn thành bài luyện'}</h2><p>Kết quả: <b>${score}</b>. Lịch sử từng câu được giữ để Ôn tập thông minh sử dụng về sau.</p></div><div class="lp-complete-actions"><button class="btn primary" id="lpContinueLearning">${ctx.tab === 'route' ? 'Tiếp tục lộ trình' : 'Luyện tiếp'}</button><button class="btn secondary" id="lpViewProgress">Xem tiến độ</button></div></section>`;
      $('#lpContinueLearning').onclick = () => renderTab(); $('#lpViewProgress').onclick = () => $('#labNav [data-view="progress"]')?.click();
    } catch (err) { body.innerHTML = `<div class="card"><b>Bài đã được lưu, nhưng chưa cập nhật được màn hình hoàn thành.</b><p class="help">${esc(err?.message || err)}</p><button class="btn primary" id="lpRetryFinish">Thử lại</button></div>`; $('#lpRetryFinish').onclick = finishAttempt; }
  }

  async function injectDashboardContinue() {
    if (currentView() !== 'dashboard') return; const root = $('#pageContent'); if (!root || root.querySelector('.lp-dashboard-continue')) return;
    try {
      await ensureData(); if (!ctx.saved?.active_attempt_id) return; const found = findLesson(ctx.saved.active_lesson_id); const title = found?.lesson?.title || (ctx.saved.practice_tab === 'review' ? 'Ôn tập thông minh' : 'Bài luyện cá nhân');
      const node = document.createElement('section'); node.className = 'card lp-dashboard-continue'; node.innerHTML = `<div><div class="eyebrow">BÀI ĐANG HỌC</div><h3>${esc(title)}</h3><p>Đang ở câu ${Number(ctx.saved.question_index || 0)+1}. Bạn có thể tiếp tục đúng vị trí đã dừng.</p></div><button class="btn primary">Tiếp tục</button>`; node.querySelector('button').onclick = () => $('#labNav [data-view="practice"]')?.click();
      const head = root.querySelector('.page-head'); if (head?.nextSibling) root.insertBefore(node, head.nextSibling); else root.prepend(node);
    } catch (_) {}
  }

  function handleHashChange() {
    const view = currentView(); const btn = $(`#labNav [data-view="${view}"]`);
    setTimeout(() => { if (btn && !btn.classList.contains('active')) { btn.click(); return; } if (view === 'practice') mountPractice(); if (view === 'dashboard') injectDashboardContinue(); }, 0);
  }

  document.addEventListener('click', e => { const nav = e.target.closest?.('#labNav [data-view]'); if (nav && currentView() === 'practice' && nav.dataset.view !== 'practice') persistScroll(); }, true);
  window.addEventListener('pagehide', () => { if (currentView() === 'practice') persistScroll({ remote: false }); });
  window.addEventListener('beforeunload', () => { if (currentView() === 'practice') persistScroll({ remote: false }); });
  window.addEventListener('hashchange', handleHashChange);

  const root = $('#pageContent');
  if (root) {
    const observer = new MutationObserver(() => { if (currentView() === 'practice') mountPractice(); else if (currentView() === 'dashboard') injectDashboardContinue(); });
    observer.observe(root, { childList: true, subtree: false });
  }
  setTimeout(handleHashChange, 250);
})();
