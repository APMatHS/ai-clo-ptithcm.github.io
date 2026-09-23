(() => {
  'use strict';

  const API = window.AptisAPI;
  if (!API?.client) return;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const currentView = () => location.hash.replace('#', '') || 'dashboard';
  const skillName = s => ({grammar:'Grammar',vocabulary:'Vocabulary',reading:'Reading',listening:'Listening',speaking:'Speaking',writing:'Writing'}[s] || s || 'Tổng hợp');
  const fmt = sec => `${String(Math.max(0, Math.floor(sec / 60))).padStart(2,'0')}:${String(Math.max(0, sec % 60)).padStart(2,'0')}`;

  const PLANS = {
    mini: {
      title: 'Mini Mock',
      sections: [
        { key:'core', title:'Core · Grammar & Vocabulary', seconds:12*60, blocks:[{skill:'grammar',count:10},{skill:'vocabulary',count:10}] },
        { key:'reading', title:'Reading', seconds:15*60, blocks:[{skill:'reading',count:8}] },
        { key:'listening', title:'Listening', seconds:15*60, blocks:[{skill:'listening',count:8}] },
        { key:'speaking', title:'Speaking', seconds:5*60, blocks:[{skill:'speaking',count:2}] },
        { key:'writing', title:'Writing', seconds:20*60, blocks:[{skill:'writing',count:2}] }
      ]
    },
    full: {
      title: 'Full Mock · luyện tập',
      sections: [
        { key:'core', title:'Core · Grammar & Vocabulary', seconds:25*60, blocks:[{skill:'grammar',count:25},{skill:'vocabulary',count:25}] },
        { key:'reading', title:'Reading', seconds:35*60, blocks:[{skill:'reading',count:20}] },
        { key:'listening', title:'Listening', seconds:40*60, blocks:[{skill:'listening',count:17}] },
        { key:'speaking', title:'Speaking', seconds:12*60, blocks:[{skill:'speaking',count:4}] },
        { key:'writing', title:'Writing', seconds:50*60, blocks:[{skill:'writing',count:4}] }
      ]
    }
  };

  const ctx = {
    userId: null,
    targetLevel: 'B2',
    state: null,
    attempt: null,
    timer: null,
    questionStartedAt: 0,
    recorder: null,
    stream: null,
    chunks: [],
    blob: null,
    recordTimer: null,
    prepTimer: null,
    timingOut: false,
    observerTimer: null
  };

  function toast(msg, type = '') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast'; }, 3300);
  }

  async function identity() {
    const session = await API.getSession();
    ctx.userId = session?.user?.id || null;
    if (!ctx.userId) return null;
    try {
      const me = await API.initializeMe();
      const row = Array.isArray(me) ? me[0] : me;
      ctx.targetLevel = row?.target_level || 'B2';
    } catch (_) {}
    return ctx.userId;
  }

  function stateKey() { return `aptis.mock.v2.${ctx.userId || 'guest'}`; }
  function draftKey(q) { return `${ctx.state?.attemptId || ctx.attempt?.attempt_id || ''}:${q?.id || ''}`; }
  function save() { if (ctx.state) localStorage.setItem(stateKey(), JSON.stringify(ctx.state)); }
  function load() {
    try { ctx.state = JSON.parse(localStorage.getItem(stateKey()) || 'null'); }
    catch (_) { ctx.state = null; }
    if (ctx.state) {
      ctx.state.results ||= [];
      ctx.state.listeningPlays ||= {};
      ctx.state.drafts ||= {};
    }
    return ctx.state;
  }

  function plan() { return ctx.state ? PLANS[ctx.state.mode] : null; }
  function section() { return plan()?.sections?.[ctx.state.sectionIndex] || null; }
  function block() { return section()?.blocks?.[ctx.state.blockIndex] || null; }
  function currentQ() { return ctx.attempt?.questions?.[ctx.state?.questionIndex || 0] || null; }

  function cleanupRecording({ discardBlob = true } = {}) {
    clearInterval(ctx.prepTimer); ctx.prepTimer = null;
    clearInterval(ctx.recordTimer); ctx.recordTimer = null;
    try {
      if (ctx.recorder?.state === 'recording') ctx.recorder.stop();
    } catch (_) {}
    try { ctx.stream?.getTracks?.().forEach(t => t.stop()); } catch (_) {}
    ctx.stream = null;
    ctx.recorder = null;
    ctx.chunks = [];
    if (discardBlob) ctx.blob = null;
  }

  async function closeCurrentAttempt() {
    const id = ctx.state?.attemptId;
    if (!id) return null;
    const existing = ctx.state.results?.find(r => r.attempt_id === id);
    if (existing) return existing;
    try {
      const r = await API.finalizeMockAttempt(id);
      const row = {
        section: section()?.key,
        skill: block()?.skill || r?.skill,
        attempt_id: id,
        answered: Number(r?.answered_count || 0),
        total: Number(r?.question_count || 0),
        score: r?.score_percent == null ? null : Number(r.score_percent)
      };
      ctx.state.results.push(row);
      save();
      return row;
    } catch (_) {
      return null;
    }
  }

  async function clearState({ finalize = false } = {}) {
    cleanupRecording();
    clearInterval(ctx.timer); ctx.timer = null;
    if (finalize) await closeCurrentAttempt();
    localStorage.removeItem(stateKey());
    ctx.state = null;
    ctx.attempt = null;
  }

  async function mountMock() {
    if (currentView() !== 'mock') return;
    const root = $('#pageContent');
    if (!root || root.querySelector('.aptis-v2-mock')) return;
    await identity();
    load();
    renderMockHome();
  }

  function renderMockHome() {
    const root = $('#pageContent');
    if (!root) return;
    const active = ctx.state && !ctx.state.finished;
    const b2Ready = ctx.targetLevel === 'B2';
    root.innerHTML = `<div class="aptis-v2-mock">
      <div class="page-head"><div><div class="eyebrow">Aptis General · V2</div><h1>Thi thử</h1><p>Luyện theo áp lực thời gian, dùng ngân hàng Aptis Lab đã duyệt.</p></div></div>
      <div class="v2-format-note"><b>Format tham chiếu:</b> Core 25 phút · Reading 35 phút · Listening 40 phút · Speaking 12 phút · Writing 50 phút. Trong Mock, đáp án được khóa ở backend cho đến khi block đóng.</div>
      ${!b2Ready ? `<div class="v2-format-note"><b>Mock V2 hiện bật cho mục tiêu B2.</b> Bank B1 hiện chưa có Speaking/Writing nên hệ thống không tạo bài 6 kỹ năng ở mức B1 để tránh bài thi bị dừng giữa chừng.</div>` : ''}
      ${active ? `<section class="card v2-mock-resume"><div><div class="eyebrow">BÀI ĐANG DỞ</div><h3>${esc(plan()?.title || 'Mock Test')}</h3><p class="help">${esc(section()?.title || '')} · có thể tiếp tục phần đang làm.</p></div><div><button id="v2Resume" class="btn primary">Tiếp tục</button> <button id="v2Discard" class="btn ghost">Bỏ bài cũ</button></div></section>` : ''}
      <div class="v2-mock-grid">
        <section class="card v2-mock-card"><div class="eyebrow">BẢN RÚT GỌN</div><h2>Mini Mock</h2><p class="help">Đủ 6 kỹ năng, phù hợp luyện hằng ngày trước Full Mock.</p><ul><li>Core 20 câu</li><li>Reading 8 câu</li><li>Listening 8 câu</li><li>Speaking 2 prompt</li><li>Writing 2 prompt</li></ul><button class="btn primary" data-start-mock="mini" ${b2Ready?'':'disabled'}>Bắt đầu Mini Mock</button></section>
        <section class="card v2-mock-card"><div class="eyebrow">MÔ PHỎNG ĐỦ THỜI GIAN</div><h2>Full Mock</h2><p class="help">Bám thời lượng Aptis General; nội dung rút từ bank nội bộ theo từng kỹ năng.</p><ul><li>Core: 25 Grammar + 25 Vocabulary</li><li>Reading: 35 phút</li><li>Listening: 40 phút</li><li>Speaking: 12 phút</li><li>Writing: 50 phút</li></ul><button class="btn primary" data-start-mock="full" ${b2Ready?'':'disabled'}>Bắt đầu Full Mock</button></section>
      </div>
    </div>`;

    $$('[data-start-mock]', root).forEach(b => b.onclick = () => startMock(b.dataset.startMock));
    $('#v2Resume')?.addEventListener('click', resumeMock);
    $('#v2Discard')?.addEventListener('click', async () => {
      if (!confirm('Bỏ trạng thái Mock đang dở? Block hiện tại sẽ được đóng và giữ trong lịch sử nội bộ.')) return;
      await clearState({ finalize: true });
      await identity();
      renderMockHome();
    });
  }

  async function startMock(mode) {
    await identity();
    if (ctx.targetLevel !== 'B2') {
      toast('Mock V2 hiện chỉ bật cho mục tiêu B2 vì bank B1 chưa đủ Speaking/Writing.', 'error');
      return;
    }
    cleanupRecording();
    ctx.state = {
      mode,
      sessionId: crypto.randomUUID(),
      sectionIndex: 0,
      blockIndex: 0,
      attemptId: null,
      questionIndex: 0,
      deadline: null,
      results: [],
      listeningPlays: {},
      drafts: {},
      finished: false,
      startedAt: Date.now()
    };
    save();
    await prepareBlock(true);
  }

  async function resumeMock() {
    if (!ctx.state) return renderMockHome();
    if (ctx.targetLevel !== 'B2') return renderMockHome();
    if (!ctx.state.attemptId) return prepareBlock(false);
    try {
      ctx.attempt = await API.resumeMockAttempt(ctx.state.attemptId);
      if (ctx.attempt?.completed_at) return advanceBlock();
      const first = ctx.attempt?.questions?.findIndex(q => !q.answered);
      ctx.state.questionIndex = first >= 0 ? first : Math.min(ctx.state.questionIndex || 0, Math.max(0,(ctx.attempt?.questions?.length || 1)-1));
      save();
      renderQuestion();
    } catch (e) {
      toast(e.message || 'Không mở lại được Mock.', 'error');
      renderMockHome();
    }
  }

  async function prepareBlock(newSection = false) {
    cleanupRecording();
    const sec = section(), bl = block();
    if (!sec || !bl) return finishMock();
    const root = $('#pageContent');
    if (root) root.innerHTML = `<div class="aptis-v2-mock"><div class="card"><div class="help">Đang chuẩn bị ${esc(sec.title)}…</div></div></div>`;
    if (newSection || !ctx.state.deadline) ctx.state.deadline = Date.now() + sec.seconds * 1000;
    try {
      const payload = await API.drawMockBlock(bl.skill, ctx.targetLevel, bl.count, ctx.state.mode, sec.key, ctx.state.sessionId);
      if (!payload?.attempt_id || !payload?.questions?.length) throw new Error(`Ngân hàng ${skillName(bl.skill)} chưa đủ câu cho phần này.`);
      ctx.attempt = payload;
      ctx.state.attemptId = payload.attempt_id;
      ctx.state.questionIndex = 0;
      save();
      renderQuestion();
    } catch (e) {
      if (root) root.innerHTML = `<div class="aptis-v2-mock"><section class="card"><h2>Không tạo được phần thi</h2><p class="help">${esc(e.message || e)}</p><button id="v2BackMock" class="btn secondary">Về Thi thử</button></section></div>`;
      $('#v2BackMock')?.addEventListener('click', renderMockHome);
    }
  }

  function cleanPrompt(q) { return String(q?.prompt || '').replace(/^APTISCTX:[0-9a-f-]+\s+/i, ''); }

  function setBlockHtml(q) {
    const set = q?.set || q?.set_context;
    if (!set) return '';
    const body = set.body_text || '';
    return `<section class="v2-context"><b>${esc(set.title || (q.skill === 'reading' ? 'Reading passage' : 'Listening set'))}</b>${set.instructions ? `<div class="help">${esc(set.instructions)}</div>` : ''}${body ? `<p>${esc(body)}</p>` : ''}<div id="v2SetMedia"></div></section>`;
  }

  function answerHtml(q) {
    const opts = Array.isArray(q?.content?.options) ? q.content.options : [];
    if (opts.length) return `<div class="v2-answer-zone">${opts.map((o,i) => `<button class="v2-option" data-v2-option="${esc(o.key)}" ${q.answered?'disabled':''}><span class="key">${String.fromCharCode(65+i)}</span><span>${esc(o.text)}</span></button>`).join('')}</div>`;
    if (q.question_type === 'speaking_prompt') {
      const seconds = speakingSeconds(q.part);
      return `<div class="v2-record"><button id="v2Record" class="btn primary" ${q.answered?'disabled':''}>● ${isPart4(q.part) ? 'Bắt đầu chuẩn bị' : 'Bắt đầu ghi âm'}</button><span id="v2RecordStatus" class="v2-record-status">${q.answered ? 'Bài nói đã lưu.' : `Thời lượng mục tiêu: ${seconds} giây${isPart4(q.part) ? ' · chuẩn bị 60 giây' : ''}.`}</span></div><button id="v2SaveSpeaking" class="btn secondary" disabled>Lưu bài nói</button>`;
    }
    const draft = ctx.state?.drafts?.[draftKey(q)] ?? q.response?.text ?? '';
    return `<textarea id="v2Writing" class="v2-writing" ${q.answered?'disabled':''} placeholder="Viết câu trả lời…">${esc(draft)}</textarea><div class="v2-wordline"><span id="v2Words">${wordCount(draft)} từ</span><span>Nháp được lưu trên thiết bị trong phiên Mock</span></div><button id="v2SaveWriting" class="btn primary" ${q.answered?'disabled':''}>${q.answered?'Đã lưu':'Lưu câu trả lời'}</button>`;
  }

  function feedbackHtml(q) {
    if (!q.answered) return '';
    return '<div class="v2-feedback"><b>Đã ghi nhận câu trả lời.</b><div class="help">Đáp án và đánh giá được khóa trong lúc Mock.</div></div>';
  }

  function renderQuestion() {
    const q = currentQ(), sec = section(), bl = block(), root = $('#pageContent');
    if (!q || !sec || !root) return advanceBlock();
    cleanupRecording();
    ctx.questionStartedAt = performance.now();
    const pct = Math.round(100 * ((ctx.state.questionIndex || 0) + (q.answered ? 1 : 0)) / Math.max(1, ctx.attempt.questions.length));
    root.innerHTML = `<div class="aptis-v2-mock">
      <div class="v2-run-head"><div><b>${esc(plan().title)} · ${esc(sec.title)}</b><small>${esc(skillName(bl.skill))} · câu ${ctx.state.questionIndex+1}/${ctx.attempt.questions.length}</small></div><div id="v2Timer" class="v2-timer">--:--</div></div>
      <div class="v2-progress"><i style="width:${pct}%"></i></div>
      ${setBlockHtml(q)}
      <article class="card v2-question"><div class="question-meta"><span class="tag teal">${esc(skillName(q.skill))}</span><span class="tag">${esc(q.level)}</span><span class="tag">Part ${esc(q.part || '—')}</span>${q.topic?`<span class="tag">${esc(q.topic)}</span>`:''}</div><h2>${esc(cleanPrompt(q))}</h2><div id="v2QuestionMedia"></div><div id="v2Answer">${answerHtml(q)}</div><div id="v2Feedback">${feedbackHtml(q)}</div><div class="v2-nav-row"><span class="help">Mock không trả correctness/đáp án về trình duyệt.</span><button id="v2Next" class="btn secondary ${q.answered?'':'hidden'}">${ctx.state.questionIndex+1>=ctx.attempt.questions.length?'Hoàn thành phần này':'Câu tiếp theo →'}</button></div></article>
    </div>`;
    wireTimer();
    wireQuestion(q);
    loadMedia(q);
    $('#v2Next')?.addEventListener('click', nextQuestion);
  }

  function wireTimer() {
    clearInterval(ctx.timer);
    const tick = () => {
      const el = $('#v2Timer');
      if (!el || !ctx.state?.deadline) return;
      const left = Math.max(0, Math.ceil((ctx.state.deadline - Date.now()) / 1000));
      el.textContent = fmt(left);
      el.classList.toggle('warn', left <= 300 && left > 60);
      el.classList.toggle('danger', left <= 60);
      if (left <= 0 && !ctx.timingOut) {
        ctx.timingOut = true;
        clearInterval(ctx.timer);
        handleSectionTimeout().finally(() => { ctx.timingOut = false; });
      }
    };
    tick();
    ctx.timer = setInterval(tick, 1000);
  }

  function wireQuestion(q) {
    $$('[data-v2-option]').forEach(btn => btn.onclick = () => submit(q, { value: btn.dataset.v2Option }));
    const ta = $('#v2Writing');
    if (ta && !q.answered) {
      ta.oninput = () => {
        const w = $('#v2Words');
        if (w) w.textContent = `${wordCount(ta.value)} từ`;
        ctx.state.drafts ||= {};
        ctx.state.drafts[draftKey(q)] = ta.value;
        save();
      };
      $('#v2SaveWriting').onclick = () => submit(q, { text: ta.value.trim() });
    }
    if (q.question_type === 'speaking_prompt' && !q.answered) wireRecorder(q);
  }

  async function submit(q, response) {
    try {
      const elapsed = Math.max(0, Math.round(performance.now() - ctx.questionStartedAt));
      await API.submitMockAnswer(ctx.attempt.attempt_id, q.id, response, elapsed);
      q.answered = true;
      q.response = response;
      if (ctx.state.drafts) delete ctx.state.drafts[draftKey(q)];
      save();
      renderQuestion();
    } catch (e) {
      toast(e.message || 'Không lưu được câu trả lời.', 'error');
    }
  }

  function nextQuestion() {
    if (ctx.state.questionIndex + 1 >= ctx.attempt.questions.length) return advanceBlock();
    ctx.state.questionIndex += 1;
    save();
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function advanceBlock() {
    cleanupRecording();
    await closeCurrentAttempt();
    const sec = section();
    if (ctx.state.blockIndex + 1 < (sec?.blocks?.length || 0)) {
      ctx.state.blockIndex += 1;
      ctx.state.attemptId = null;
      ctx.state.questionIndex = 0;
      save();
      return prepareBlock(false);
    }
    return advanceSection(false);
  }

  async function handleSectionTimeout() {
    cleanupRecording();
    toast('Hết thời gian phần thi. Hệ thống đóng block hiện tại và chuyển phần tiếp theo.', 'error');
    await closeCurrentAttempt();
    return advanceSection(true);
  }

  function advanceSection(timedOut = false) {
    const finishedTitle = section()?.title || 'Phần thi';
    cleanupRecording();
    ctx.state.sectionIndex += 1;
    ctx.state.blockIndex = 0;
    ctx.state.attemptId = null;
    ctx.state.questionIndex = 0;
    ctx.state.deadline = null;
    save();
    clearInterval(ctx.timer); ctx.timer = null;
    if (ctx.state.sectionIndex >= plan().sections.length) return finishMock();
    const root = $('#pageContent');
    root.innerHTML = `<div class="aptis-v2-mock"><section class="card v2-section-done"><div class="big">${timedOut?'⏱':'✓'}</div><div class="eyebrow">${timedOut?'HẾT THỜI GIAN':'HOÀN THÀNH'}</div><h2>${esc(finishedTitle)}</h2><p>Phần tiếp theo: <b>${esc(section().title)}</b>.</p><button id="v2NextSection" class="btn primary">Bắt đầu phần tiếp theo</button></section></div>`;
    $('#v2NextSection').onclick = () => prepareBlock(true);
  }

  function finishMock() {
    cleanupRecording();
    clearInterval(ctx.timer); ctx.timer = null;
    ctx.state.finished = true;
    save();
    const rows = ctx.state.results || [];
    const objective = rows.filter(r => r.score != null);
    const avg = objective.length ? Math.round(objective.reduce((s,r) => s + Number(r.score || 0), 0) / objective.length) : null;
    const root = $('#pageContent');
    root.innerHTML = `<div class="aptis-v2-mock"><div class="page-head"><div><div class="eyebrow">HOÀN THÀNH</div><h1>${esc(plan().title)}</h1><p>Kết quả là thống kê luyện tập nội bộ, không phải điểm Aptis chính thức.</p></div></div><div class="v2-summary-grid">${rows.map(r => `<div class="card v2-summary-item"><small>${esc(skillName(r.skill))}</small><strong>${r.score==null?'Đã lưu':`${Math.round(Number(r.score))}%`}</strong><span class="help">${Number(r.answered||0)}/${Number(r.total||0)} câu</span></div>`).join('') || '<div class="card">Chưa có dữ liệu để tổng hợp.</div>'}</div>${avg!=null?`<div class="v2-format-note">Trung bình các block khách quan: <b>${avg}%</b>. Speaking/Writing không gộp vào phần trăm này.</div>`:''}<div class="v2-format-note">AI feedback Speaking/Writing vẫn dùng ở phần Luyện tập; Mock không hiện feedback giữa bài.</div><div><button id="v2FinishBack" class="btn primary">Về Thi thử</button></div></div>`;
    $('#v2FinishBack').onclick = async () => { await clearState(); await identity(); renderMockHome(); };
  }

  async function loadMedia(q) {
    const set = q?.set || q?.set_context;
    const media = q?.media?.path ? q.media : set?.media?.path ? set.media : null;
    const target = q?.media?.path ? $('#v2QuestionMedia') : $('#v2SetMedia');
    if (!media || !target) return;
    try {
      const url = await API.signedUrl(media, 3600);
      if (media.kind === 'audio' || media.mime?.startsWith('audio/')) {
        const listenKey = String(q.set_id || set?.id || media.path || q.id);
        target.innerHTML = `<audio id="v2Audio" controls controlsList="nodownload noplaybackrate" preload="metadata" src="${esc(url)}"></audio><div id="v2ListenCount" class="help"></div>`;
        wireListening($('#v2Audio'), listenKey);
      } else if (media.kind === 'image' || media.mime?.startsWith('image/')) {
        target.innerHTML = `<img src="${esc(url)}" alt="Hình câu hỏi">`;
      }
    } catch (_) {
      target.innerHTML = '<div class="help">Không tải được media.</div>';
    }
  }

  function wireListening(audio, listenKey) {
    if (!audio) return;
    ctx.state.listeningPlays ||= {};
    let maxTime = 0;
    const update = () => {
      const n = Number(ctx.state.listeningPlays[listenKey] || 0);
      const c = $('#v2ListenCount');
      if (c) c.textContent = `Recording này đã phát ${n}/2 lượt.`;
      if (n >= 2 && audio.currentTime < .35) audio.controls = false;
    };
    audio.addEventListener('play', () => {
      const n = Number(ctx.state.listeningPlays[listenKey] || 0);
      if (audio.currentTime < .35) {
        if (n >= 2) {
          audio.pause();
          audio.controls = false;
          toast('Trong Mock, mỗi recording chỉ được phát tối đa 2 lần.', 'error');
          return;
        }
        ctx.state.listeningPlays[listenKey] = n + 1;
        save();
        update();
      }
    });
    audio.addEventListener('timeupdate', () => { maxTime = Math.max(maxTime, audio.currentTime); });
    audio.addEventListener('seeking', () => { if (audio.currentTime > maxTime + .6) audio.currentTime = maxTime; });
    audio.addEventListener('ended', update);
    update();
  }

  function isPart4(part='') { return /(^|[-_ ])4($|[-_ ])/i.test(String(part)) || /part\s*4/i.test(String(part)); }
  function speakingSeconds(part='') {
    if (isPart4(part)) return 120;
    if (/(^|[-_ ])1($|[-_ ])/i.test(String(part)) || /part\s*1/i.test(String(part))) return 30;
    return 45;
  }

  function wireRecorder(q) {
    const btn = $('#v2Record'), saveBtn = $('#v2SaveSpeaking'), status = $('#v2RecordStatus');
    if (!btn || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      if (btn) btn.disabled = true;
      if (status) status.textContent = 'Trình duyệt chưa hỗ trợ ghi âm.';
      return;
    }
    let preparing = false;
    btn.onclick = async () => {
      if (ctx.recorder?.state === 'recording') {
        ctx.recorder.stop();
        return;
      }
      if (isPart4(q.part) && !preparing) {
        preparing = true;
        btn.disabled = true;
        let left = 60;
        status.textContent = `Chuẩn bị: ${left}s`;
        clearInterval(ctx.prepTimer);
        ctx.prepTimer = setInterval(() => {
          left -= 1;
          if (status?.isConnected) status.textContent = `Chuẩn bị: ${Math.max(0,left)}s`;
          if (left <= 0) {
            clearInterval(ctx.prepTimer); ctx.prepTimer = null;
            if (currentView() !== 'mock' || currentQ()?.id !== q.id) return;
            btn.disabled = false;
            beginRecording(q, btn, saveBtn, status);
          }
        }, 1000);
        return;
      }
      beginRecording(q, btn, saveBtn, status);
    };
  }

  async function beginRecording(q, btn, saveBtn, status) {
    try {
      cleanupRecording();
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      if (currentView() !== 'mock' || currentQ()?.id !== q.id) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      ctx.stream = stream;
      ctx.chunks = [];
      const recorder = new MediaRecorder(stream);
      ctx.recorder = recorder;
      const max = speakingSeconds(q.part);
      let left = max;
      recorder.ondataavailable = e => { if (e.data.size) ctx.chunks.push(e.data); };
      recorder.onstop = () => {
        clearInterval(ctx.recordTimer); ctx.recordTimer = null;
        stream.getTracks().forEach(t => t.stop());
        if (ctx.stream === stream) ctx.stream = null;
        const blob = new Blob(ctx.chunks, { type: recorder.mimeType || 'audio/webm' });
        ctx.blob = blob;
        if (currentView() === 'mock' && currentQ()?.id === q.id && btn?.isConnected) {
          btn.textContent = '● Ghi lại';
          btn.disabled = false;
          saveBtn.disabled = false;
          status.textContent = `Đã ghi ${(blob.size/1024).toFixed(0)} KB. Bấm Lưu bài nói.`;
        }
      };
      recorder.start();
      btn.textContent = '■ Dừng ghi';
      status.textContent = `Đang ghi · còn ${left}s`;
      ctx.recordTimer = setInterval(() => {
        left -= 1;
        if (status?.isConnected) status.textContent = `Đang ghi · còn ${Math.max(0,left)}s`;
        if (left <= 0 && recorder.state === 'recording') recorder.stop();
      }, 1000);
      saveBtn.onclick = async () => {
        if (!ctx.blob) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang tải lên…';
        try {
          const file = new File([ctx.blob], 'speaking.webm', { type: ctx.blob.type || 'audio/webm' });
          const media = await API.uploadRecording(file, ctx.userId);
          await submit(q, { recording: media });
        } catch (e) {
          toast(e.message || 'Không lưu được bài nói.', 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Lưu bài nói';
        }
      };
    } catch (_) {
      toast('Không truy cập được microphone.', 'error');
    }
  }

  function wordCount(v='') {
    const t = String(v).trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function rubricHtml(a, kind) {
    const data = a?.assessment || a?.rubric || a || {};
    const r = data.rubric || data;
    const s = r.scores || {};
    const title = data.estimated_level || r.estimated_level || '—';
    const total = data.total_score ?? r.total_score;
    const labels = kind === 'speaking'
      ? [['task_fulfilment','Task'],['grammar','Grammar'],['vocabulary','Vocabulary'],['fluency_coherence','Fluency & coherence'],['pronunciation_intelligibility','Pronunciation']]
      : [['task_fulfilment','Task'],['grammar','Grammar'],['vocabulary','Vocabulary'],['coherence_cohesion','Coherence'],['register_accuracy','Register & accuracy']];
    return `<div class="v2-feedback good"><b>Ước lượng luyện tập: ${esc(title)}${total==null?'':` · ${esc(total)}/25`}</b><div class="help">AI feedback chỉ dùng để luyện tập.</div><div class="v2-ai-rubric">${labels.map(([k,l]) => `<div><strong>${esc(l)}</strong><br>${esc(s[k] ?? '—')}/5</div>`).join('')}</div>${r.strengths?.length?`<p><b>Điểm tốt:</b> ${esc(r.strengths.join(' · '))}</p>`:''}${r.improvements?.length?`<p><b>Cần cải thiện:</b> ${esc(r.improvements.join(' · '))}</p>`:''}${r.next_attempt_tip?`<p><b>Lần sau:</b> ${esc(r.next_attempt_tip)}</p>`:''}</div>`;
  }

  async function appendProgressBreakdown() {
    if (currentView() !== 'progress') return;
    const root = $('#pageContent');
    if (!root || root.querySelector('.v2-breakdown')) return;
    const host = document.createElement('section');
    host.className = 'card v2-breakdown';
    host.innerHTML = '<h2>Chi tiết theo Part / chủ đề</h2><div class="help">Đang tổng hợp 90 ngày gần nhất…</div>';
    root.appendChild(host);
    try {
      const rows = await API.getProgressBreakdown(90);
      if (!rows?.length) {
        host.innerHTML = '<h2>Chi tiết theo Part / chủ đề</h2><div class="help">Chưa đủ dữ liệu luyện tập.</div>';
        return;
      }
      host.innerHTML = `<h2>Chi tiết theo Part / chủ đề</h2><p class="help">Mock được tách khỏi bảng này để không tạo kênh suy ra đáp án khi đang thi thử.</p><div class="table-wrap"><table class="data-table v2-breakdown-table"><thead><tr><th>Kỹ năng</th><th>Part</th><th>Chủ đề</th><th>Đã làm</th><th>Đúng</th><th>Độ chính xác</th></tr></thead><tbody>${rows.map(r => { const a=Number(r.accuracy_percent??0); const cls=a<50?'weak':a<70?'mid':'good'; return `<tr><td>${esc(skillName(r.skill))}</td><td>${esc(r.part||'—')}</td><td>${esc(r.topic||'Chung')}</td><td>${Number(r.answered_count||0)}</td><td>${Number(r.correct_count||0)}</td><td class="v2-accuracy ${cls}">${Math.round(a)}%</td></tr>`; }).join('')}</tbody></table></div>`;
    } catch (e) {
      host.innerHTML = `<h2>Chi tiết theo Part / chủ đề</h2><div class="help">${esc(e.message || 'Không tải được thống kê chi tiết.')}</div>`;
    }
  }

  async function injectWritingAssessment({ attemptId, questionId } = {}) {
    if (currentView() !== 'practice' || !attemptId || !questionId) return;
    const feedback = $('#lpFeedback');
    if (!feedback || $('#lpWritingAssess')) return;
    const box = document.createElement('div');
    box.id = 'lpWritingAssess';
    box.className = 'v2-write-assess';
    box.innerHTML = '<button class="btn primary" type="button">AI góp ý bài viết</button><div class="help">Chỉ gọi AI khi bạn bấm nút; kết quả là feedback luyện tập.</div>';
    feedback.insertAdjacentElement('afterend', box);
    try {
      const cached = await API.getWritingAssessment(attemptId, questionId);
      if (cached) {
        box.innerHTML = rubricHtml(cached, 'writing');
        return;
      }
    } catch (_) {}
    box.querySelector('button').onclick = async e => {
      const b = e.currentTarget;
      b.disabled = true;
      b.textContent = 'AI đang chấm…';
      try {
        const res = await API.assessWriting(attemptId, questionId);
        box.innerHTML = rubricHtml(res, 'writing');
      } catch (err) {
        toast(err.message || 'Chưa chấm được bài viết.', 'error');
        b.disabled = false;
        b.textContent = 'AI góp ý bài viết';
      }
    };
  }

  async function restorePracticeWritingAssessment() {
    if (currentView() !== 'practice' || $('#lpWritingAssess')) return;
    try {
      const state = await API.getLearningState?.();
      const attemptId = state?.active_attempt_id;
      if (!attemptId) return;
      const attempt = await API.resumeAttempt(attemptId);
      const index = Math.max(0, Math.min(Number(state?.question_index || 0), Math.max(0,(attempt?.questions?.length || 1)-1)));
      const q = attempt?.questions?.[index];
      if (q?.question_type === 'writing_prompt' && q?.answered) {
        await injectWritingAssessment({ attemptId, questionId: q.id });
      }
    } catch (_) {}
  }

  window.addEventListener('aptis:v2-answer-submitted', e => {
    if (e.detail?.response?.text) setTimeout(() => injectWritingAssessment(e.detail), 60);
  });

  function onViewChange() {
    clearTimeout(ctx.observerTimer);
    ctx.observerTimer = setTimeout(() => {
      const view = currentView();
      if (view !== 'mock') cleanupRecording();
      if (view === 'mock') mountMock();
      if (view === 'progress') appendProgressBreakdown();
      if (view === 'practice') restorePracticeWritingAssessment();
    }, 40);
  }

  const root = $('#pageContent');
  if (root) new MutationObserver(onViewChange).observe(root, { childList:true, subtree:true });
  window.addEventListener('hashchange', onViewChange);
  window.addEventListener('pagehide', cleanupRecording);
  window.addEventListener('beforeunload', cleanupRecording);
  setTimeout(onViewChange, 350);
})();
