(() => {
  'use strict';

  const API = window.AptisAPI;
  const SKILLS = {
    grammar: ['Grammar', 'G'], vocabulary: ['Vocabulary', 'V'], reading: ['Reading', 'R'],
    listening: ['Listening', 'L'], speaking: ['Speaking', 'S'], writing: ['Writing', 'W']
  };
  const state = {
    session: null, me: null, settings: null, attempts: [], activity: [], aiUsage: [], vocabulary: [],
    view: 'dashboard', practice: null, practiceIndex: 0, answerResult: null, questionStartedAt: null,
    recorder: null, recordChunks: [], recordedBlob: null, manageTab: 'questions'
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  const fmtDate = (v) => v ? new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(v)) : '—';
  const fmtDateTime = (v) => v ? new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(v)) : '—';
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  let toastTimer;
  function toast(message, type = '') {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.className = 'toast', 3000);
  }

  function page(html) { $('#pageContent').innerHTML = html; window.scrollTo({ top: 0, behavior: 'instant' }); }
  function setBusy(btn, busy, label = 'Đang xử lý…') {
    if (!btn) return;
    if (busy) { btn.dataset.oldText = btn.textContent; btn.textContent = label; btn.disabled = true; }
    else { btn.textContent = btn.dataset.oldText || btn.textContent; btn.disabled = false; }
  }
  function skillName(key) { return SKILLS[key]?.[0] || key || 'Tổng hợp'; }
  function userInitial() { return (state.me?.full_name || 'A').trim().charAt(0).toUpperCase(); }

  function computeStreak() {
    const set = new Set((state.activity || []).filter(x => (x.questions_answered || 0) > 0).map(x => x.activity_date));
    if (!set.size) return 0;
    const d = new Date();
    const today = d.toISOString().slice(0, 10);
    if (!set.has(today)) d.setDate(d.getDate() - 1);
    let streak = 0;
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (!set.has(key)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function skillStats() {
    const out = {};
    Object.keys(SKILLS).forEach(k => out[k] = { attempts: 0, score: null, answered: 0 });
    for (const a of state.attempts || []) {
      if (!a.skill || !out[a.skill]) continue;
      out[a.skill].attempts++;
      out[a.skill].answered += a.answered_count || 0;
      if (a.score_percent != null) {
        if (out[a.skill].score == null) out[a.skill].score = Number(a.score_percent);
        else out[a.skill].score = (out[a.skill].score * (out[a.skill].attempts - 1) + Number(a.score_percent)) / out[a.skill].attempts;
      }
    }
    return out;
  }

  function aiUsedToday() { return (state.aiUsage || []).reduce((s, x) => s + Number(x.calls || 0), 0); }

  async function refreshCore() {
    const results = await Promise.allSettled([
      API.getSettings(), API.getAttempts(), API.getActivity(), API.getAiUsageToday(), API.getVocabulary()
    ]);
    if (results[0].status === 'fulfilled') state.settings = results[0].value;
    if (results[1].status === 'fulfilled') state.attempts = results[1].value || [];
    if (results[2].status === 'fulfilled') state.activity = results[2].value || [];
    if (results[3].status === 'fulfilled') state.aiUsage = results[3].value || [];
    if (results[4].status === 'fulfilled') state.vocabulary = results[4].value || [];
    updateHeader();
  }

  function updateHeader() {
    if (!state.me) return;
    $('#targetLevelText').textContent = state.me.target_level || 'B2';
    $('#streakText').textContent = computeStreak();
    $('#userNameTop').textContent = state.me.full_name || 'Người học';
    $('#userInitial').textContent = userInitial();
    $('#manageNavBtn').classList.toggle('hidden', !state.me.can_manage_content);
  }

  function showAuth() {
    $('#authGate').classList.remove('hidden');
    $('#accessDenied').classList.add('hidden');
    $('#labApp').classList.add('hidden');
  }
  function showDenied() {
    $('#authGate').classList.add('hidden');
    $('#accessDenied').classList.remove('hidden');
    $('#labApp').classList.add('hidden');
  }
  function showApp() {
    $('#authGate').classList.add('hidden');
    $('#accessDenied').classList.add('hidden');
    $('#labApp').classList.remove('hidden');
  }

  async function initAuthenticated() {
    try {
      const access = await API.initializeMe();
      state.me = Array.isArray(access) ? access[0] : access;
      if (!state.me?.enabled) return showDenied();
      showApp();
      await refreshCore();
      const requested = location.hash.replace('#', '');
      const allowed = ['dashboard','practice','mock','vocabulary','progress','coach','suggestions','manage'];
      state.view = allowed.includes(requested) ? requested : 'dashboard';
      if (state.view === 'manage' && !state.me.can_manage_content) state.view = 'dashboard';
      renderView();
    } catch (err) {
      const text = `${err?.message || ''}`;
      if (text.includes('APTIS_ACCESS_NOT_GRANTED')) showDenied();
      else { showAuth(); toast(text || 'Không thể mở Aptis Lab.', 'error'); }
    }
  }

  async function boot() {
    wireStaticEvents();
    try {
      state.session = await API.getSession();
      if (!state.session) return showAuth();
      await initAuthenticated();
    } catch (err) { showAuth(); toast(err.message || 'Lỗi khởi tạo.', 'error'); }
  }

  function wireStaticEvents() {
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      setBusy(btn, true, 'Đang đăng nhập…');
      try {
        state.session = await API.signIn($('#loginEmail').value.trim(), $('#loginPassword').value);
        await initAuthenticated();
      } catch (err) { toast(err.message || 'Đăng nhập không thành công.', 'error'); }
      finally { setBusy(btn, false); }
    });
    $('#logoutBtn').addEventListener('click', logout);
    $('#deniedLogout').addEventListener('click', logout);
    $('#targetLevelBtn').addEventListener('click', openTargetDialog);
    $('#mobileMenuBtn').addEventListener('click', () => toggleMobileMenu(true));
    $('#mobileBackdrop').addEventListener('click', () => toggleMobileMenu(false));
    $('#labNav').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]'); if (!btn) return;
      navigate(btn.dataset.view);
    });
  }

  async function logout() {
    try { await API.signOut(); } catch (_) {}
    state.session = state.me = null;
    showAuth();
  }

  function toggleMobileMenu(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#mobileBackdrop').classList.toggle('hidden', !open);
  }

  function navigate(view) {
    if (view === 'manage' && !state.me?.can_manage_content) return;
    state.view = view;
    location.hash = view;
    $$('#labNav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    toggleMobileMenu(false);
    renderView();
  }

  async function openTargetDialog() {
    const dlg = $('#simpleDialog');
    $('#dialogTitle').textContent = 'Mục tiêu Aptis';
    $('#dialogBody').innerHTML = `<p class="help">Mặc định là B2. Bạn có thể đổi mục tiêu bất kỳ lúc nào; dữ liệu luyện tập cũ vẫn được giữ.</p>
      <div class="grid two"><button class="btn ${state.me.target_level==='B1'?'primary':'secondary'}" data-level="B1" type="button">Mục tiêu B1</button><button class="btn ${state.me.target_level==='B2'?'primary':'secondary'}" data-level="B2" type="button">Mục tiêu B2</button></div>`;
    $('#dialogBody').onclick = async (e) => {
      const b = e.target.closest('[data-level]'); if (!b) return;
      setBusy(b, true);
      try { await API.setTargetLevel(b.dataset.level); state.me.target_level = b.dataset.level; updateHeader(); dlg.close(); toast(`Đã đặt mục tiêu ${b.dataset.level}.`); renderView(); }
      catch (err) { toast(err.message || 'Không thể đổi mục tiêu.', 'error'); }
      finally { setBusy(b, false); }
    };
    dlg.showModal();
  }

  function renderView() {
    $$('#labNav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    const map = { dashboard: renderDashboard, practice: renderPractice, mock: renderMock, vocabulary: renderVocabulary, progress: renderProgress, coach: renderCoach, suggestions: renderSuggestions, manage: renderManage };
    (map[state.view] || renderDashboard)();
  }

  function renderDashboard() {
    const stats = skillStats();
    const completed = state.attempts.filter(a => a.completed_at).length;
    const questions = state.activity.reduce((s, x) => s + Number(x.questions_answered || 0), 0);
    const weak = Object.entries(stats).filter(([,v]) => v.score != null).sort((a,b) => a[1].score-b[1].score)[0]?.[0] || 'vocabulary';
    const recent = state.attempts.slice(0, 5);
    page(`
      <div class="page-head"><div><div class="eyebrow">Aptis General · ${esc(state.me.target_level)}</div><h1>Chào ${esc((state.me.full_name||'').split(' ').slice(-1)[0] || 'bạn')}</h1><p>Luyện từ ngân hàng đã duyệt; AI chỉ dùng khi thật sự cần để tiết kiệm API.</p></div></div>
      <section class="card hero-card"><div class="eyebrow" style="color:#a9ddd7">BUỔI HỌC HÔM NAY</div><h2>Khoảng 20–25 phút để giữ nhịp học</h2><p>Hệ thống ưu tiên kỹ năng cần củng cố và câu hỏi đã lưu trong ngân hàng. Việc rút câu không gọi AI.</p><div class="hero-actions"><button id="startToday" class="btn primary">Bắt đầu luyện ${esc(skillName(weak))}</button><button id="openPractice" class="btn secondary">Tự chọn nội dung</button></div></section>
      <div class="section-title"><h2>Tổng quan của tôi</h2><span>Không có bảng xếp hạng</span></div>
      <div class="grid four">
        <div class="card metric"><small>Chuỗi học</small><strong>🔥 ${computeStreak()}</strong><em>ngày liên tiếp</em></div>
        <div class="card metric"><small>Bài luyện hoàn thành</small><strong>${completed}</strong><em>lượt đã lưu</em></div>
        <div class="card metric"><small>Câu đã trả lời</small><strong>${questions}</strong><em>trong lịch sử hiện có</em></div>
        <div class="card metric"><small>Từ vựng đã lưu</small><strong>${state.vocabulary.length}</strong><em>sổ từ cá nhân</em></div>
      </div>
      <div class="section-title"><h2>Kỹ năng B1/B2</h2><span>Mức hiển thị là dữ liệu luyện tập nội bộ, không phải kết quả Aptis chính thức.</span></div>
      <div class="grid three">${Object.entries(SKILLS).map(([k,[name,icon]]) => {
        const s = stats[k]; const score = s.score == null ? 0 : clamp(Math.round(s.score),0,100);
        return `<div class="card skill-card"><div class="skill-icon">${icon}</div><div class="skill-copy"><b>${name}</b><span>${s.attempts ? `${s.attempts} lượt · TB ${Math.round(s.score||0)}%` : 'Chưa có dữ liệu'}</span><div class="progress-bar"><i style="width:${score}%"></i></div></div></div>`;
      }).join('')}</div>
      <div class="section-title"><h2>Hoạt động gần đây</h2><button id="seeProgress" class="btn ghost small">Xem tiến độ</button></div>
      ${recent.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Thời gian</th><th>Kỹ năng</th><th>Mục tiêu</th><th>Đã làm</th><th>Kết quả</th></tr></thead><tbody>${recent.map(a => `<tr><td>${fmtDateTime(a.started_at)}</td><td>${esc(skillName(a.skill))}</td><td>${esc(a.target_level)}</td><td>${a.answered_count}/${a.question_count}</td><td>${a.score_percent==null?'—':`${Math.round(a.score_percent)}%`}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>Chưa có lịch sử luyện tập</b><span>Bắt đầu một bài luyện để hệ thống ghi nhận tiến độ.</span></div>`}
    `);
    $('#startToday').onclick = () => { state.practice = { presetSkill: weak }; navigate('practice'); };
    $('#openPractice').onclick = () => navigate('practice');
    $('#seeProgress').onclick = () => navigate('progress');
  }

  function renderPractice() {
    const preset = state.practice?.presetSkill || 'grammar';
    state.practice = null;
    page(`
      <div class="page-head"><div><div class="eyebrow">Luyện tập từ ngân hàng</div><h1>Luyện Aptis General</h1><p>Rút câu đã lưu trong Supabase; không sinh câu mới mỗi lần học.</p></div></div>
      <div class="card practice-setup">
        <label class="field">Kỹ năng<select id="practiceSkill">${Object.entries(SKILLS).map(([k,[n]]) => `<option value="${k}" ${k===preset?'selected':''}>${n}</option>`).join('')}<option value="">Tổng hợp</option></select></label>
        <label class="field">Mức<select id="practiceLevel"><option ${state.me.target_level==='B1'?'selected':''}>B1</option><option ${state.me.target_level==='B2'?'selected':''}>B2</option></select></label>
        <label class="field">Số câu<select id="practiceCount"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label>
        <button id="drawPractice" class="btn primary">Rút câu luyện</button>
      </div>
      <div id="practiceArea" class="practice-box" style="margin-top:16px"><div class="empty"><b>Chọn kỹ năng rồi rút câu</b><span>Nếu ngân hàng chưa có câu đã duyệt ở mức tương ứng, hệ thống sẽ báo để Admin/English teacher bổ sung.</span></div></div>
    `);
    $('#drawPractice').onclick = startPractice;
  }

  async function startPractice() {
    const btn = $('#drawPractice'); setBusy(btn, true, 'Đang rút câu…');
    try {
      const data = await API.drawPractice($('#practiceSkill').value || null, $('#practiceLevel').value, Number($('#practiceCount').value));
      if (!data?.attempt_id || !data.questions?.length) {
        $('#practiceArea').innerHTML = `<div class="empty"><b>Ngân hàng chưa đủ câu phù hợp</b><span>Admin hoặc English teacher có thể thêm và xuất bản câu hỏi trong Quản trị Aptis.</span></div>`;
        return;
      }
      state.practice = { attemptId: data.attempt_id, questions: data.questions };
      state.practiceIndex = 0; state.answerResult = null; state.questionStartedAt = performance.now();
      renderPracticeQuestion();
    } catch (err) { toast(err.message || 'Không rút được câu.', 'error'); }
    finally { setBusy(btn, false); }
  }

  async function renderPracticeQuestion() {
    const area = $('#practiceArea'); if (!area || !state.practice) return;
    const q = state.practice.questions[state.practiceIndex];
    state.answerResult = null; state.recordedBlob = null; state.questionStartedAt = performance.now();
    const options = Array.isArray(q.content?.options) ? q.content.options : [];
    area.innerHTML = `<article class="card question-card">
      <div class="question-meta"><span class="tag teal">${esc(skillName(q.skill))}</span><span class="tag">${esc(q.level)}</span><span class="tag">Part ${esc(q.part)}</span><span class="tag">Độ khó ${esc(q.difficulty)}</span>${q.topic?`<span class="tag">${esc(q.topic)}</span>`:''}</div>
      <h2>${esc(q.prompt)}</h2>
      <div id="questionMedia" class="question-media"></div>
      <div id="answerZone">${renderAnswerInput(q, options)}</div>
      <div id="answerFeedback"></div>
      <div class="question-footer"><span class="question-counter">Câu ${state.practiceIndex+1}/${state.practice.questions.length}</span><button id="nextQuestion" class="btn secondary hidden">${state.practiceIndex+1===state.practice.questions.length?'Hoàn thành':'Câu tiếp theo →'}</button></div>
    </article>`;
    if (q.media?.path) loadQuestionMedia(q.media);
    wireAnswerControls(q);
    $('#nextQuestion').onclick = async () => {
      if (state.practiceIndex + 1 >= state.practice.questions.length) {
        await refreshCore();
        area.innerHTML = `<div class="card"><div class="eyebrow">HOÀN THÀNH</div><h2>Đã lưu bài luyện</h2><p class="help">Tiến độ và streak đã được cập nhật. Bạn có thể làm tiếp hoặc xem phần Tiến độ.</p><div class="page-actions"><button id="practiceAgain" class="btn primary">Luyện tiếp</button><button id="practiceProgress" class="btn secondary">Xem tiến độ</button></div></div>`;
        $('#practiceAgain').onclick = () => renderPractice(); $('#practiceProgress').onclick = () => navigate('progress');
      } else { state.practiceIndex++; renderPracticeQuestion(); }
    };
  }

  function renderAnswerInput(q, options) {
    if (q.question_type === 'speaking_prompt') return `<div class="record-box"><button id="recordBtn" class="btn primary" type="button">● Bắt đầu ghi âm</button><span id="recordStatus" class="record-status">Bài nói sẽ lưu trong bucket riêng của tài khoản.</span></div><button id="submitFree" class="btn secondary" style="margin-top:12px" disabled>Lưu bài nói</button>`;
    if (q.question_type === 'writing_prompt') return `<textarea id="writingAnswer" class="writing-box" placeholder="Viết câu trả lời của bạn tại đây…"></textarea><div class="help" id="wordCount">0 từ · V1 lưu bài; AI chấm sẽ dùng quota khi Edge Function được bật.</div><button id="submitFree" class="btn primary" style="margin-top:12px">Lưu bài viết</button>`;
    if (!options.length) return `<textarea id="genericAnswer" class="writing-box" placeholder="Nhập câu trả lời…"></textarea><button id="submitFree" class="btn primary" style="margin-top:12px">Trả lời</button>`;
    return `<div class="options">${options.map(o => `<button class="option-btn" data-value="${esc(o.key)}" type="button"><span class="option-key">${esc(o.key)}</span><span>${esc(o.text)}</span></button>`).join('')}</div>`;
  }

  function wireAnswerControls(q) {
    if (q.question_type === 'speaking_prompt') return wireRecorder(q);
    if (q.question_type === 'writing_prompt') {
      const ta = $('#writingAnswer'); ta.oninput = () => { $('#wordCount').textContent = `${ta.value.trim()?ta.value.trim().split(/\s+/).length:0} từ · V1 lưu bài; AI chấm dùng quota khi được bật.`; };
      $('#submitFree').onclick = () => submitCurrent(q, { text: ta.value.trim() }); return;
    }
    const optionBtns = $$('.option-btn');
    if (optionBtns.length) optionBtns.forEach(b => b.onclick = () => submitCurrent(q, { value: b.dataset.value }, b));
    else $('#submitFree').onclick = () => submitCurrent(q, { text: $('#genericAnswer').value.trim() });
  }

  async function wireRecorder(q) {
    const btn = $('#recordBtn'), status = $('#recordStatus'), submit = $('#submitFree');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      btn.disabled = true; status.textContent = 'Trình duyệt này chưa hỗ trợ ghi âm trực tiếp.'; return;
    }
    btn.onclick = async () => {
      if (state.recorder?.state === 'recording') { state.recorder.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.recordChunks = [];
        state.recorder = new MediaRecorder(stream);
        state.recorder.ondataavailable = e => { if (e.data.size) state.recordChunks.push(e.data); };
        state.recorder.onstop = () => {
          state.recordedBlob = new Blob(state.recordChunks, { type: state.recorder.mimeType || 'audio/webm' });
          stream.getTracks().forEach(t => t.stop());
          btn.textContent = '● Ghi lại'; submit.disabled = false; status.textContent = `Đã ghi ${(state.recordedBlob.size/1024).toFixed(0)} KB. Nhấn “Lưu bài nói”.`;
        };
        state.recorder.start(); btn.textContent = '■ Dừng ghi'; status.textContent = 'Đang ghi âm…';
      } catch (err) { toast('Không truy cập được microphone.', 'error'); }
    };
    submit.onclick = async () => {
      if (!state.recordedBlob) return;
      setBusy(submit, true, 'Đang tải lên…');
      try {
        const file = new File([state.recordedBlob], 'speaking.webm', { type: state.recordedBlob.type || 'audio/webm' });
        const media = await API.uploadRecording(file, state.me.user_id);
        await submitCurrent(q, { recording: media });
      } catch (err) { toast(err.message || 'Không lưu được bài nói.', 'error'); }
      finally { setBusy(submit, false); }
    };
  }

  async function submitCurrent(q, response, clickedOption = null) {
    if (state.answerResult) return;
    try {
      const elapsed = Math.round(performance.now() - state.questionStartedAt);
      const result = await API.submitAnswer(state.practice.attemptId, q.id, response, elapsed);
      state.answerResult = result;
      $$('.option-btn').forEach(b => b.disabled = true);
      if (clickedOption) clickedOption.classList.add(result.is_correct ? 'correct' : 'wrong');
      if (result.correct_answer?.value) $$('.option-btn').find(b => b.dataset.value === result.correct_answer.value)?.classList.add('correct');
      const cls = result.is_correct === true ? 'good' : result.is_correct === false ? 'bad' : '';
      const title = result.is_correct === true ? '✓ Chính xác' : result.is_correct === false ? 'Chưa đúng' : 'Đã lưu bài luyện';
      $('#answerFeedback').innerHTML = `<div class="feedback ${cls}"><b>${title}</b>${result.correct_answer?.value?`<div>Đáp án: <strong>${esc(result.correct_answer.value)}</strong></div>`:''}${result.explanation?`<div>${esc(result.explanation)}</div>`:''}${result.is_correct==null?`<div class="help">Speaking/Writing được lưu; AI chấm sẽ được nối ở giai đoạn tiếp theo và chịu giới hạn lượt/ngày.</div>`:''}</div>`;
      $('#nextQuestion').classList.remove('hidden');
    } catch (err) { toast(err.message || 'Không lưu được câu trả lời.', 'error'); }
  }

  async function loadQuestionMedia(media) {
    try {
      const url = await API.signedUrl(media, 3600); if (!url || !$('#questionMedia')) return;
      if (media.kind === 'image' || media.mime?.startsWith('image/')) $('#questionMedia').innerHTML = `<img src="${esc(url)}" alt="Hình minh họa câu hỏi">`;
      else if (media.kind === 'audio' || media.mime?.startsWith('audio/')) $('#questionMedia').innerHTML = `<audio controls preload="metadata" src="${esc(url)}"></audio>`;
    } catch (_) { $('#questionMedia').innerHTML = `<div class="help">Không tải được media của câu hỏi.</div>`; }
  }

  function renderMock() {
    page(`<div class="page-head"><div><div class="eyebrow">Thi thử</div><h1>Mock Test</h1><p>Khung đã chừa sẵn cho Aptis General và sau này Aptis Advanced.</p></div></div>
      <div class="grid two"><div class="card"><h2>Mini Mock</h2><p class="help">Sẽ dùng ma trận cố định theo kỹ năng/part và rút từ ngân hàng đã duyệt. Không gọi AI khi tạo đề.</p><span class="status review">Chuẩn bị ở V1.1</span></div><div class="card"><h2>Full Mock</h2><p class="help">Mô phỏng thời gian từng phần, giới hạn lượt nghe, Speaking/Writing và kết quả ước lượng nội bộ.</p><span class="status review">Chuẩn bị ở V1.2</span></div></div>
      <div class="card" style="margin-top:16px"><h3>Trong lúc chờ Mock hoàn chỉnh</h3><p class="help">Bạn có thể dùng Luyện tập → Tổng hợp để rút câu ngẫu nhiên từ nhiều kỹ năng.</p><button id="mixedPractice" class="btn primary">Luyện tổng hợp</button></div>`);
    $('#mixedPractice').onclick = () => navigate('practice');
  }

  function renderVocabulary() {
    page(`<div class="page-head"><div><div class="eyebrow">Sổ từ cá nhân</div><h1>Từ vựng của tôi</h1><p>Lưu và ôn từ riêng; dữ liệu của mỗi tài khoản tách biệt bằng RLS.</p></div><button id="addWordBtn" class="btn primary">+ Thêm từ</button></div>
      <div class="card"><div class="toolbar"><input id="vocabSearch" placeholder="Tìm từ…"><select id="vocabMastery"><option value="">Tất cả mức</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}">Mức ${n}</option>`).join('')}</select></div><div id="vocabList" class="vocab-list" style="margin-top:12px"></div></div>`);
    const draw = () => {
      const term = $('#vocabSearch').value.trim().toLowerCase(), mastery = $('#vocabMastery').value;
      const rows = state.vocabulary.filter(v => (!term || v.term.toLowerCase().includes(term) || (v.meaning||'').toLowerCase().includes(term)) && (mastery==='' || String(v.mastery)===mastery));
      $('#vocabList').innerHTML = rows.length ? rows.map(v => `<div class="vocab-item"><div><b>${esc(v.term)}</b><span>${esc(v.meaning||'')}</span>${v.example?`<small> · ${esc(v.example)}</small>`:''}</div><div class="toolbar"><select data-mastery="${v.id}">${[0,1,2,3,4,5].map(n=>`<option ${n===v.mastery?'selected':''}>${n}</option>`).join('')}</select><button class="btn danger small" data-del-word="${v.id}">Xóa</button></div></div>`).join('') : `<div class="empty"><b>Chưa có từ vựng</b><span>Thêm các từ bạn muốn ôn lại.</span></div>`;
      $$('[data-mastery]').forEach(s => s.onchange = async () => { try { await API.updateVocabulary(s.dataset.mastery,{ mastery:Number(s.value), last_reviewed_at:new Date().toISOString() }); await reloadVocabulary(); } catch(e){toast(e.message,'error');} });
      $$('[data-del-word]').forEach(b => b.onclick = async () => { try { await API.deleteVocabulary(b.dataset.delWord); await reloadVocabulary(); } catch(e){toast(e.message,'error');} });
    };
    $('#vocabSearch').oninput = draw; $('#vocabMastery').onchange = draw; $('#addWordBtn').onclick = openVocabDialog; draw();
  }

  async function reloadVocabulary() { state.vocabulary = await API.getVocabulary(); renderVocabulary(); }
  function openVocabDialog() {
    const dlg=$('#simpleDialog'); $('#dialogTitle').textContent='Thêm từ vựng';
    $('#dialogBody').innerHTML=`<div class="form-grid"><label class="field">Từ / cụm từ<input id="wordTerm"></label><label class="field">Nghĩa<input id="wordMeaning"></label><label class="field full">Ví dụ<textarea id="wordExample" rows="3"></textarea></label></div><div class="form-actions"><button id="saveWord" class="btn primary" type="button">Lưu từ</button></div>`;
    $('#saveWord').onclick=async()=>{const b=$('#saveWord'),term=$('#wordTerm').value.trim();if(!term)return toast('Nhập từ cần lưu.','error');setBusy(b,true);try{await API.addVocabulary({user_id:state.me.user_id,term,meaning:$('#wordMeaning').value.trim(),example:$('#wordExample').value.trim()});state.vocabulary=await API.getVocabulary();dlg.close();renderVocabulary();}catch(e){toast(e.message||'Không lưu được từ.','error');}finally{setBusy(b,false)}}; dlg.showModal();
  }

  function renderProgress() {
    const stats=skillStats(), streak=computeStreak();
    const last30=[]; for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);last30.push({date:k,count:Number(state.activity.find(x=>x.activity_date===k)?.questions_answered||0)});}
    const max=Math.max(1,...last30.map(x=>x.count));
    page(`<div class="page-head"><div><div class="eyebrow">Tiến độ cá nhân</div><h1>Hành trình ${esc(state.me.target_level)}</h1><p>Dữ liệu dùng để định hướng luyện tập, không quy đổi thành chứng chỉ chính thức.</p></div></div>
      <div class="grid three"><div class="card metric"><small>Streak hiện tại</small><strong>🔥 ${streak}</strong><em>ngày</em></div><div class="card metric"><small>30 ngày gần nhất</small><strong>${last30.reduce((s,x)=>s+x.count,0)}</strong><em>câu đã trả lời</em></div><div class="card metric"><small>Lượt luyện</small><strong>${state.attempts.length}</strong><em>trong 90 ngày</em></div></div>
      <div class="card" style="margin-top:16px"><h3>Hoạt động 30 ngày</h3><div class="timeline">${last30.map(x=>`<i class="daybar ${x.count?'active':''}" title="${x.date}: ${x.count} câu" style="--h:${8+Math.round(72*x.count/max)}px"></i>`).join('')}</div></div>
      <div class="section-title"><h2>Theo kỹ năng</h2><span>Trung bình từ các bài luyện đã ghi nhận</span></div><div class="grid three">${Object.entries(SKILLS).map(([k,[n,i]])=>{const s=stats[k],score=s.score==null?0:Math.round(s.score);return `<div class="card skill-card"><div class="skill-icon">${i}</div><div class="skill-copy"><b>${n}</b><span>${s.attempts?`${s.attempts} lượt · ${score}%`:'Chưa có dữ liệu'}</span><div class="progress-bar"><i style="width:${clamp(score,0,100)}%"></i></div></div></div>`}).join('')}</div>`);
  }

  function coachRecommendations() {
    const stats=skillStats();
    const ranked=Object.entries(stats).sort((a,b)=>(a[1].score??-1)-(b[1].score??-1));
    const weak=ranked.filter(([,v])=>v.score!=null).slice(0,2).map(([k])=>k);
    const rec=[];
    if (!state.attempts.length) rec.push(['1','Làm bài luyện đầu tiên','Bắt đầu Grammar hoặc Vocabulary để hệ thống có dữ liệu thực tế.']);
    else weak.forEach((k,i)=>rec.push([String(i+1),`Ưu tiên ${skillName(k)}`,`Điểm luyện tập của kỹ năng này đang thấp hơn các kỹ năng khác.`]));
    if (state.vocabulary.length<10) rec.push(['V','Xây sổ từ vựng','Lưu ít nhất 10 từ/cụm từ thường gặp để ôn lặp lại.']);
    if (computeStreak()===0) rec.push(['🔥','Khởi động streak','Hoàn thành vài câu hôm nay để bắt đầu chuỗi ngày học.']);
    return rec.slice(0,4);
  }

  function renderCoach() {
    const used=aiUsedToday(), limit=Number(state.me.ai_daily_limit||10), pct=limit?clamp(Math.round(100*used/limit),0,100):100, rec=coachRecommendations();
    page(`<div class="page-head"><div><div class="eyebrow">AI Coach</div><h1>Gợi ý học tập</h1><p>V1 ưu tiên phân tích bằng dữ liệu và thuật toán; không gọi API nếu không cần.</p></div></div>
      <div class="grid two"><div class="card"><h2>Hôm nay nên làm gì?</h2><div class="coach-list">${rec.map(([i,t,d])=>`<div class="coach-item"><span>${esc(i)}</span><div><b>${esc(t)}</b><div class="help">${esc(d)}</div></div></div>`).join('')}</div></div>
      <div class="card quota"><div><h2>Quota AI</h2><p class="help">Áp dụng cho AI chấm Speaking/Writing, giải thích nâng cao hoặc sinh nội dung khi các Edge Function tương ứng được bật.</p><b>${used}/${limit} lượt hôm nay</b></div><div class="quota-ring" style="--pct:${pct}%"><b>${Math.max(0,limit-used)} còn lại</b></div></div></div>
      <div class="card" style="margin-top:16px"><h3>Nguyên tắc tiết kiệm API</h3><p class="help">Rút câu, chấm câu trắc nghiệm, tính streak, thống kê tiến độ và ôn từ vựng đều chạy bằng database/code. AI không được gọi chỉ vì người học mở trang.</p></div>`);
  }

  async function renderSuggestions() {
    page(`<div class="page-head"><div><div class="eyebrow">Góp ý · Đề xuất</div><h1>Đề xuất cho Aptis Lab</h1><p>Teacher thường và student dùng cùng cơ chế này; Admin/English teacher có thể xem để xử lý nội dung.</p></div></div>
      <div class="grid two"><form id="suggestionForm" class="card"><h2>Gửi đề xuất</h2><label class="field">Loại<select id="suggestionKind"><option value="content">Đề xuất nội dung</option><option value="question_feedback">Phản hồi câu hỏi</option><option value="feature">Đề xuất chức năng</option></select></label><label class="field" style="margin-top:10px">Nội dung<textarea id="suggestionMessage" rows="7" required placeholder="Mô tả rõ đề xuất của bạn…"></textarea></label><button class="btn primary" style="margin-top:12px">Gửi đề xuất</button></form><div class="card"><h2>Đề xuất đã gửi</h2><div id="mySuggestions"><div class="help">Đang tải…</div></div></div></div>`);
    $('#suggestionForm').onsubmit=async(e)=>{e.preventDefault();const b=e.submitter,msg=$('#suggestionMessage').value.trim();if(msg.length<3)return;setBusy(b,true);try{await API.addSuggestion({user_id:state.me.user_id,kind:$('#suggestionKind').value,message:msg});toast('Đã gửi đề xuất.');renderSuggestions();}catch(err){toast(err.message||'Không gửi được.','error')}finally{setBusy(b,false)}};
    try{const rows=await API.getSuggestions();const mine=state.me.can_manage_content?rows:rows.filter(x=>x.user_id===state.me.user_id);$('#mySuggestions').innerHTML=mine.length?mine.slice(0,20).map(x=>`<div class="vocab-item"><div><b>${esc(x.kind)}</b><small>${esc(x.message)}</small></div><span class="status ${esc(x.status)}">${esc(x.status)}</span></div>`).join(''):`<div class="empty"><b>Chưa có đề xuất</b><span>Bạn có thể gửi góp ý ngay tại đây.</span></div>`}catch(e){$('#mySuggestions').innerHTML='<div class="help">Không tải được danh sách.</div>'}
  }

  function renderManage() {
    if (!state.me.can_manage_content) return navigate('dashboard');
    page(`<div class="page-head"><div><div class="eyebrow">Quản trị Aptis</div><h1>Ngân hàng & quyền truy cập</h1><p>English teacher quản lý nội dung; Admin quản lý thêm quyền và thiết lập toàn hệ thống.</p></div></div>
      <div class="tabs"><button data-mtab="questions" class="${state.manageTab==='questions'?'active':''}">Ngân hàng câu hỏi</button><button data-mtab="suggestions" class="${state.manageTab==='suggestions'?'active':''}">Đề xuất</button>${state.me.can_manage_access?`<button data-mtab="access" class="${state.manageTab==='access'?'active':''}">Quyền Aptis</button><button data-mtab="settings" class="${state.manageTab==='settings'?'active':''}">Thiết lập</button>`:''}</div><div id="manageArea"></div>`);
    $$('[data-mtab]').forEach(b=>b.onclick=()=>{state.manageTab=b.dataset.mtab;renderManage()});
    if(state.manageTab==='questions') manageQuestions(); else if(state.manageTab==='suggestions') manageSuggestions(); else if(state.manageTab==='access'&&state.me.can_manage_access) manageAccess(); else if(state.manageTab==='settings'&&state.me.can_manage_access) manageSettings(); else {state.manageTab='questions';manageQuestions()}
  }

  async function manageQuestions() {
    const area=$('#manageArea');area.innerHTML=`<div class="card"><div class="page-head"><div><h2>Ngân hàng Aptis</h2><p class="help">Learner chỉ nhận dữ liệu câu hỏi an toàn qua RPC; trường đáp án không được đọc trực tiếp.</p></div><button id="newQuestionBtn" class="btn primary">+ Thêm câu hỏi</button></div><div class="toolbar"><select id="qSkillFilter"><option value="">Mọi kỹ năng</option>${Object.entries(SKILLS).map(([k,[n]])=>`<option value="${k}">${n}</option>`).join('')}</select><select id="qStatusFilter"><option value="">Mọi trạng thái</option><option>draft</option><option>review</option><option>published</option><option>archived</option></select></div><div id="qTable" style="margin-top:12px"><div class="help">Đang tải…</div></div></div>`;
    const load=async()=>{try{const rows=await API.getQuestions({skill:$('#qSkillFilter').value,status:$('#qStatusFilter').value});$('#qTable').innerHTML=rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Kỹ năng</th><th>Mức</th><th>Nội dung</th><th>Part</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody>${rows.map(q=>`<tr><td>${esc(skillName(q.skill))}</td><td>${esc(q.level)}</td><td>${esc(q.prompt).slice(0,130)}</td><td>${esc(q.part)}</td><td><span class="status ${esc(q.status)}">${esc(q.status)}</span></td><td>${fmtDate(q.updated_at)}</td><td><button class="btn ghost small" data-edit-q="${q.id}">Sửa</button>${state.me.can_manage_access?` <button class="btn danger small" data-del-q="${q.id}">Xóa</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><b>Ngân hàng đang trống</b><span>Thêm câu hỏi đầu tiên để bắt đầu.</span></div>`;$$('[data-edit-q]').forEach(b=>b.onclick=()=>openQuestionDialog(rows.find(q=>q.id===b.dataset.editQ)));$$('[data-del-q]').forEach(b=>b.onclick=async()=>{if(!confirm('Xóa vĩnh viễn câu hỏi này?'))return;try{await API.deleteQuestion(b.dataset.delQ);toast('Đã xóa câu hỏi.');load()}catch(e){toast(e.message||'Không xóa được.','error')}})}catch(e){$('#qTable').innerHTML=`<div class="help">${esc(e.message||'Không tải được ngân hàng.')}</div>`}};
    $('#newQuestionBtn').onclick=()=>openQuestionDialog(null,load);$('#qSkillFilter').onchange=load;$('#qStatusFilter').onchange=load;await load();
  }

  function openQuestionDialog(q=null,onSaved=null){
    const dlg=$('#simpleDialog');$('#dialogTitle').textContent=q?'Sửa câu hỏi':'Thêm câu hỏi Aptis';
    const opts=Array.isArray(q?.content?.options)?q.content.options.map(o=>`${o.key}|${o.text}`).join('\n'):'';
    $('#dialogBody').innerHTML=`<div class="form-grid">
      <label class="field">Kỹ năng<select id="qSkill">${Object.entries(SKILLS).map(([k,[n]])=>`<option value="${k}" ${q?.skill===k?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="field">Mức<select id="qLevel"><option ${q?.level==='B1'?'selected':''}>B1</option><option ${(!q||q?.level==='B2')?'selected':''}>B2</option></select></label>
      <label class="field">Part<input id="qPart" value="${esc(q?.part||'general')}"></label>
      <label class="field">Loại<select id="qType"><option value="mcq" ${(!q||q?.question_type==='mcq')?'selected':''}>Trắc nghiệm</option><option value="speaking_prompt" ${q?.question_type==='speaking_prompt'?'selected':''}>Speaking prompt</option><option value="writing_prompt" ${q?.question_type==='writing_prompt'?'selected':''}>Writing prompt</option></select></label>
      <label class="field">Độ khó<select id="qDifficulty">${[1,2,3,4,5].map(n=>`<option ${n===(q?.difficulty||3)?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="field">Chủ đề<input id="qTopic" value="${esc(q?.topic||'')}"></label>
      <label class="field full">Nội dung câu hỏi<textarea id="qPrompt" rows="4">${esc(q?.prompt||'')}</textarea></label>
      <label class="field full">Phương án (mỗi dòng: A|nội dung)<textarea id="qOptions" rows="5" placeholder="A|Option A\nB|Option B\nC|Option C\nD|Option D">${esc(opts)}</textarea></label>
      <label class="field">Đáp án (A/B/C/D)<input id="qAnswer" value="${esc(q?.answer?.value||'')}"></label>
      <label class="field">Trạng thái<select id="qStatus"><option ${(!q||q?.status==='draft')?'selected':''}>draft</option><option ${q?.status==='review'?'selected':''}>review</option><option ${q?.status==='published'?'selected':''}>published</option><option ${q?.status==='archived'?'selected':''}>archived</option></select></label>
      <label class="field full">Giải thích<textarea id="qExplanation" rows="3">${esc(q?.explanation||'')}</textarea></label>
      <label class="field full">Media Listening/Hình ảnh<input id="qMedia" type="file" accept="audio/*,image/jpeg,image/png,image/webp"><span class="help">Lưu vào private bucket aptis-content. File hiện tại: ${esc(q?.media?.name||q?.media?.path||'không có')}</span></label>
    </div><div class="form-actions"><button id="saveQuestion" class="btn primary" type="button">Lưu câu hỏi</button></div>`;
    $('#saveQuestion').onclick=async()=>{const b=$('#saveQuestion'),type=$('#qType').value,prompt=$('#qPrompt').value.trim();if(!prompt)return toast('Nhập nội dung câu hỏi.','error');setBusy(b,true);try{let media=q?.media||{};const file=$('#qMedia').files[0];if(file)media=await API.uploadContent(file,$('#qSkill').value);const options=$('#qOptions').value.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [key,...rest]=line.split('|');return{key:(key||'').trim(),text:rest.join('|').trim()}}).filter(o=>o.key&&o.text);const payload={...(q?.id?{id:q.id}:{}),exam_family:'general',skill:$('#qSkill').value,level:$('#qLevel').value,part:$('#qPart').value.trim()||'general',question_type:type,difficulty:Number($('#qDifficulty').value),topic:$('#qTopic').value.trim()||null,prompt,content:type==='mcq'?{options}:{},answer:type==='mcq'?{value:$('#qAnswer').value.trim().toUpperCase()}:{},explanation:$('#qExplanation').value.trim()||null,media,source_type:q?.source_type||'manual',status:$('#qStatus').value,is_active:true};if(type==='mcq'&&(!options.length||!payload.answer.value))throw new Error('Trắc nghiệm cần phương án và đáp án.');await API.saveQuestion(payload);dlg.close();toast('Đã lưu câu hỏi.');if(onSaved)onSaved();else manageQuestions()}catch(e){toast(e.message||'Không lưu được câu hỏi.','error')}finally{setBusy(b,false)}};dlg.showModal();
  }

  async function manageAccess(){const area=$('#manageArea');area.innerHTML=`<div class="grid two"><form id="memberForm" class="card"><h2>Thêm / cập nhật quyền</h2><label class="field">Email tài khoản AI-CLO<input id="memberEmail" type="email" required></label><label class="field" style="margin-top:10px">Vai trò trong Aptis<select id="memberRole"><option value="learner">Learner</option><option value="english_teacher">English teacher</option></select></label><label class="field" style="margin-top:10px">Quota AI riêng<input id="memberLimit" type="number" min="0" max="100" placeholder="Để trống = dùng mặc định"></label><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="memberEnabled" type="checkbox" checked> Được bật quyền Aptis</label><button class="btn primary" style="margin-top:14px">Lưu quyền</button></form><div class="card"><h2>Quy tắc</h2><p class="help"><b>Admin:</b> toàn quyền.<br><b>English teacher:</b> quản lý nội dung, không quản lý tài khoản.<br><b>Teacher thường:</b> learner mặc định.<br><b>Student:</b> chỉ vào được khi Admin thêm.</p></div></div><div class="card" style="margin-top:16px"><h2>Danh sách quyền</h2><div id="memberTable"><div class="help">Đang tải…</div></div></div>`;
    const load=async()=>{try{const rows=await API.adminListMembers();$('#memberTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Họ tên</th><th>Email</th><th>Role hệ thống</th><th>Role Aptis</th><th>Mục tiêu</th><th>Quota riêng</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.system_role)}</td><td>${esc(x.content_role)}</td><td>${esc(x.target_level)}</td><td>${x.ai_daily_limit_override??'—'}</td><td>${x.enabled?'Bật':'Tắt'}</td></tr>`).join('')}</tbody></table></div>`}catch(e){$('#memberTable').innerHTML=`<div class="help">${esc(e.message)}</div>`}};
    $('#memberForm').onsubmit=async(e)=>{e.preventDefault();const b=e.submitter;setBusy(b,true);try{await API.adminSetMember($('#memberEmail').value.trim(),$('#memberEnabled').checked,$('#memberRole').value,$('#memberLimit').value);toast('Đã cập nhật quyền Aptis.');e.target.reset();$('#memberEnabled').checked=true;await load()}catch(err){toast(err.message||'Không cập nhật được quyền.','error')}finally{setBusy(b,false)}};await load();
  }

  async function manageSettings(){const area=$('#manageArea');let s;try{s=await API.getSettings()}catch(e){return area.innerHTML=`<div class="help">${esc(e.message)}</div>`}area.innerHTML=`<form id="settingsForm" class="card"><h2>Thiết lập Aptis Lab</h2><div class="form-grid"><label class="field">Quota AI mặc định / người / ngày<input id="settingLimit" type="number" min="0" max="100" value="${s.default_ai_daily_limit}"></label><label class="field">Giữ recording Speaking (ngày)<input id="settingRetention" type="number" min="1" max="3650" value="${s.speaking_record_retention_days}"></label><label class="field full" style="display:flex;grid-template-columns:auto 1fr;align-items:center"><input id="settingAdvanced" type="checkbox" ${s.allow_advanced?'checked':''}> Cho phép hiển thị Aptis Advanced (schema đã chừa sẵn; frontend V1 vẫn tập trung General)</label></div><div class="form-actions"><button class="btn primary">Lưu thiết lập</button></div></form>`;$('#settingsForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b,true);try{await API.adminUpdateSettings($('#settingLimit').value,$('#settingAdvanced').checked,$('#settingRetention').value);state.settings=await API.getSettings();toast('Đã lưu thiết lập.')}catch(err){toast(err.message||'Không lưu được.','error')}finally{setBusy(b,false)}}}

  async function manageSuggestions(){const area=$('#manageArea');area.innerHTML=`<div class="card"><h2>Đề xuất từ người dùng</h2><div id="suggestionAdmin"><div class="help">Đang tải…</div></div></div>`;try{const rows=await API.getSuggestions();$('#suggestionAdmin').innerHTML=rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDate(x.created_at)}</td><td>${esc(x.kind)}</td><td>${esc(x.message)}</td><td><span class="status ${esc(x.status)}">${esc(x.status)}</span></td><td><select data-sug-status="${x.id}"><option ${x.status==='new'?'selected':''}>new</option><option ${x.status==='reviewing'?'selected':''}>reviewing</option><option ${x.status==='accepted'?'selected':''}>accepted</option><option ${x.status==='declined'?'selected':''}>declined</option><option ${x.status==='done'?'selected':''}>done</option></select></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><b>Chưa có đề xuất</b></div>`;$$('[data-sug-status]').forEach(s=>s.onchange=async()=>{try{await API.updateSuggestion(s.dataset.sugStatus,{status:s.value,reviewed_by:state.me.user_id,reviewed_at:new Date().toISOString()});toast('Đã cập nhật đề xuất.')}catch(e){toast(e.message,'error')}})}catch(e){$('#suggestionAdmin').innerHTML=`<div class="help">${esc(e.message)}</div>`}}

  boot();
})();
