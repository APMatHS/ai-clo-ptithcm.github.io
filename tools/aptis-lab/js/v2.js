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
      note: 'Bài mô phỏng ngắn để luyện áp lực thời gian. Cấu trúc dùng ngân hàng hiện có, không quy đổi thành điểm Aptis chính thức.',
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
      note: 'Mô phỏng thời gian Aptis General. Core 25 phút, Reading 35 phút, Listening 40 phút, Speaking 12 phút, Writing 50 phút. Số task được rút theo ngân hàng nội bộ hiện có.',
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
    userId: null, targetLevel: 'B2', state: null, attempt: null, timer: null,
    questionStartedAt: 0, recorder: null, chunks: [], blob: null, recordTimer: null
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
    if (ctx.userId) return ctx.userId;
    const session = await API.getSession();
    ctx.userId = session?.user?.id || null;
    try {
      const me = await API.initializeMe();
      const row = Array.isArray(me) ? me[0] : me;
      ctx.targetLevel = row?.target_level || 'B2';
    } catch (_) {}
    return ctx.userId;
  }

  function key() { return `aptis.mock.v2.${ctx.userId || 'guest'}`; }
  function save() { if (ctx.state) localStorage.setItem(key(), JSON.stringify(ctx.state)); }
  function load() {
    try { ctx.state = JSON.parse(localStorage.getItem(key()) || 'null'); }
    catch (_) { ctx.state = null; }
    return ctx.state;
  }
  function clearState() { localStorage.removeItem(key()); ctx.state = null; ctx.attempt = null; clearInterval(ctx.timer); }

  function plan() { return ctx.state ? PLANS[ctx.state.mode] : null; }
  function section() { return plan()?.sections?.[ctx.state.sectionIndex] || null; }
  function block() { return section()?.blocks?.[ctx.state.blockIndex] || null; }

  async function mountMock() {
    if (currentView() !== 'mock') return;
    const root = $('#pageContent');
    if (!root || root.querySelector('.aptis-v2-mock')) return;
    await identity(); load();
    renderMockHome();
  }

  function renderMockHome() {
    const root = $('#pageContent'); if (!root) return;
    const active = ctx.state && !ctx.state.finished;
    root.innerHTML = `<div class="aptis-v2-mock">
      <div class="page-head"><div><div class="eyebrow">Aptis General · V2</div><h1>Thi thử</h1><p>Luyện theo áp lực thời gian, dùng chính ngân hàng Aptis Lab đã duyệt.</p></div></div>
      <div class="v2-format-note"><b>Format tham chiếu:</b> Core 25 phút · Reading 35 phút · Listening 40 phút · Speaking 12 phút · Writing 50 phút. Listening trong Mock giới hạn tối đa 2 lượt nghe. Kết quả chỉ phục vụ luyện tập.</div>
      ${active ? `<section class="card v2-mock-resume"><div><div class="eyebrow">BÀI ĐANG DỞ</div><h3>${esc(plan()?.title || 'Mock Test')}</h3><p class="help">${esc(section()?.title || '')} · có thể tiếp tục đúng phần đang làm.</p></div><div><button id="v2Resume" class="btn primary">Tiếp tục</button> <button id="v2Discard" class="btn ghost">Bỏ bài cũ</button></div></section>` : ''}
      <div class="v2-mock-grid">
        <section class="card v2-mock-card"><div class="eyebrow">20–70 PHÚT TÙY TỐC ĐỘ</div><h2>Mini Mock</h2><p class="help">Bản rút gọn gồm đủ 6 kỹ năng, phù hợp luyện hằng ngày trước khi làm Full Mock.</p><ul><li>Core 20 câu</li><li>Reading 8 câu</li><li>Listening 8 câu, tối đa 2 lượt nghe</li><li>Speaking 2 prompt</li><li>Writing 2 prompt</li></ul><button class="btn primary" data-start-mock="mini">Bắt đầu Mini Mock</button></section>
        <section class="card v2-mock-card"><div class="eyebrow">MÔ PHỎNG ĐỦ THỜI GIAN</div><h2>Full Mock</h2><p class="help">Bám thời lượng chính thức của Aptis General; task được rút từ ngân hàng nội bộ hiện có.</p><ul><li>Core: 25 Grammar + 25 Vocabulary</li><li>Reading: 35 phút</li><li>Listening: 40 phút</li><li>Speaking: 12 phút</li><li>Writing: 50 phút</li></ul><button class="btn primary" data-start-mock="full">Bắt đầu Full Mock</button></section>
      </div>
    </div>`;
    $$('[data-start-mock]', root).forEach(b => b.onclick = () => startMock(b.dataset.startMock));
    $('#v2Resume')?.addEventListener('click', resumeMock);
    $('#v2Discard')?.addEventListener('click', () => { if (confirm('Bỏ trạng thái Mock đang dở? Các attempt đã lưu vẫn còn trong lịch sử.')) { clearState(); renderMockHome(); } });
  }

  async function startMock(mode) {
    await identity();
    ctx.state = { mode, sectionIndex:0, blockIndex:0, attemptId:null, questionIndex:0, deadline:null, results:[], listeningPlays:{}, finished:false, startedAt:Date.now() };
    save(); await prepareBlock(true);
  }

  async function resumeMock() {
    if (!ctx.state) return renderMockHome();
    if (!ctx.state.attemptId) return prepareBlock(false);
    try {
      ctx.attempt = await API.resumeAttempt(ctx.state.attemptId);
      const first = ctx.attempt?.questions?.findIndex(q => !q.answered);
      ctx.state.questionIndex = first >= 0 ? first : Math.min(ctx.state.questionIndex || 0, Math.max(0,(ctx.attempt?.questions?.length || 1)-1));
      save(); renderQuestion();
    } catch (e) { toast(e.message || 'Không mở lại được Mock.', 'error'); renderMockHome(); }
  }

  async function prepareBlock(newSection = false) {
    const sec = section(), bl = block();
    if (!sec || !bl) return finishMock();
    const root = $('#pageContent');
    if (root) root.innerHTML = `<div class="aptis-v2-mock"><div class="card"><div class="help">Đang chuẩn bị ${esc(sec.title)}…</div></div></div>`;
    if (newSection || !ctx.state.deadline) ctx.state.deadline = Date.now() + sec.seconds * 1000;
    try {
      const payload = await API.drawPractice(bl.skill, ctx.targetLevel, bl.count);
      if (!payload?.questions?.length) throw new Error(`Ngân hàng ${skillName(bl.skill)} chưa đủ câu để tạo phần thi.`);
      ctx.attempt = payload;
      ctx.state.attemptId = payload.attempt_id;
      ctx.state.questionIndex = 0;
      save(); renderQuestion();
    } catch (e) {
      if (root) root.innerHTML = `<div class="aptis-v2-mock"><section class="card"><h2>Không tạo được phần thi</h2><p class="help">${esc(e.message || e)}</p><button id="v2BackMock" class="btn secondary">Về Thi thử</button></section></div>`;
      $('#v2BackMock')?.addEventListener('click', renderMockHome);
    }
  }

  function cleanPrompt(q) { return String(q?.prompt || '').replace(/^APTISCTX:[0-9a-f-]+\s+/i, ''); }
  function currentQ() { return ctx.attempt?.questions?.[ctx.state?.questionIndex || 0] || null; }

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
    const value = q.response?.text || '';
    return `<textarea id="v2Writing" class="v2-writing" ${q.answered?'disabled':''} placeholder="Viết câu trả lời…">${esc(value)}</textarea><div class="v2-wordline"><span id="v2Words">${wordCount(value)} từ</span><span>Được tính trong thời gian của phần Writing</span></div><button id="v2SaveWriting" class="btn primary" ${q.answered?'disabled':''}>${q.answered?'Đã lưu':'Lưu câu trả lời'}</button>`;
  }

  function feedbackHtml(q) {
    if (!q.answered) return '';
    if (q.is_correct === true) return '<div class="v2-feedback good"><b>Đã ghi nhận câu trả lời.</b></div>';
    if (q.is_correct === false) return '<div class="v2-feedback bad"><b>Đã ghi nhận câu trả lời.</b><div class="help">Trong Mock không hiện đáp án để giữ trải nghiệm thi.</div></div>';
    return '<div class="v2-feedback"><b>Bài tự do đã được lưu.</b><div class="help">Bạn có thể yêu cầu AI góp ý sau khi lưu.</div></div>';
  }

  function renderQuestion() {
    const q = currentQ(), sec = section(), bl = block(), root = $('#pageContent');
    if (!q || !sec || !root) return advanceBlock();
    ctx.questionStartedAt = performance.now(); ctx.blob = null;
    const pct = Math.round(100 * ((ctx.state.questionIndex || 0) + (q.answered ? 1 : 0)) / Math.max(1, ctx.attempt.questions.length));
    root.innerHTML = `<div class="aptis-v2-mock">
      <div class="v2-run-head"><div><b>${esc(plan().title)} · ${esc(sec.title)}</b><small>${esc(skillName(bl.skill))} · câu ${ctx.state.questionIndex+1}/${ctx.attempt.questions.length}</small></div><div id="v2Timer" class="v2-timer">--:--</div></div>
      <div class="v2-progress"><i style="width:${pct}%"></i></div>
      ${setBlockHtml(q)}
      <article class="card v2-question"><div class="question-meta"><span class="tag teal">${esc(skillName(q.skill))}</span><span class="tag">${esc(q.level)}</span><span class="tag">Part ${esc(q.part || '—')}</span>${q.topic?`<span class="tag">${esc(q.topic)}</span>`:''}</div><h2>${esc(cleanPrompt(q))}</h2><div id="v2QuestionMedia"></div><div id="v2Answer">${answerHtml(q)}</div><div id="v2Feedback">${feedbackHtml(q)}</div><div id="v2AiBox" class="v2-ai-box"></div><div class="v2-nav-row"><span class="help">Không hiện đáp án trong lúc Mock.</span><button id="v2Next" class="btn secondary ${q.answered?'':'hidden'}">${ctx.state.questionIndex+1>=ctx.attempt.questions.length?'Hoàn thành phần này':'Câu tiếp theo →'}</button></div></article>
    </div>`;
    wireTimer(); wireQuestion(q); loadMedia(q);
    if (q.answered && (q.question_type === 'speaking_prompt' || q.question_type === 'writing_prompt')) wireAiAssessment(q);
    $('#v2Next')?.addEventListener('click', () => nextQuestion());
  }

  function wireTimer() {
    clearInterval(ctx.timer);
    const tick = () => {
      const el = $('#v2Timer'); if (!el || !ctx.state?.deadline) return;
      const left = Math.max(0, Math.ceil((ctx.state.deadline - Date.now())/1000));
      el.textContent = fmt(left); el.classList.toggle('warn', left <= 300 && left > 60); el.classList.toggle('danger', left <= 60);
      if (left <= 0) { clearInterval(ctx.timer); toast('Hết thời gian phần thi. Hệ thống chuyển sang phần tiếp theo.', 'error'); advanceSection(true); }
    };
    tick(); ctx.timer = setInterval(tick, 1000);
  }

  function wireQuestion(q) {
    $$('[data-v2-option]').forEach(btn => btn.onclick = () => submit(q, { value: btn.dataset.v2Option }));
    const ta = $('#v2Writing');
    if (ta && !q.answered) {
      ta.oninput = () => { const w = $('#v2Words'); if (w) w.textContent = `${wordCount(ta.value)} từ`; };
      $('#v2SaveWriting').onclick = () => submit(q, { text: ta.value.trim() });
    }
    if (q.question_type === 'speaking_prompt' && !q.answered) wireRecorder(q);
  }

  async function submit(q, response) {
    try {
      const elapsed = Math.max(0, Math.round(performance.now() - ctx.questionStartedAt));
      const res = await API.submitAnswer(ctx.attempt.attempt_id, q.id, response, elapsed);
      Object.assign(q, { answered:true, response, is_correct:res.is_correct, correct_answer:res.correct_answer, explanation:res.explanation });
      save(); renderQuestion();
    } catch (e) { toast(e.message || 'Không lưu được câu trả lời.', 'error'); }
  }

  function nextQuestion() {
    if (ctx.state.questionIndex + 1 >= ctx.attempt.questions.length) return advanceBlock();
    ctx.state.questionIndex += 1; save(); renderQuestion(); window.scrollTo({top:0,behavior:'instant'});
  }

  async function advanceBlock() {
    try {
      if (ctx.state.attemptId) {
        const latest = await API.resumeAttempt(ctx.state.attemptId);
        ctx.state.results.push({ section:section()?.key, skill:block()?.skill, attempt_id:ctx.state.attemptId, answered:latest?.answered_count || 0, total:latest?.question_count || 0, score:latest?.score_percent });
      }
    } catch (_) {}
    const sec = section();
    if (ctx.state.blockIndex + 1 < (sec?.blocks?.length || 0)) {
      ctx.state.blockIndex += 1; ctx.state.attemptId = null; ctx.state.questionIndex = 0; save(); return prepareBlock(false);
    }
    return advanceSection(false);
  }

  function advanceSection(timedOut = false) {
    const finishedTitle = section()?.title || 'Phần thi';
    ctx.state.sectionIndex += 1; ctx.state.blockIndex = 0; ctx.state.attemptId = null; ctx.state.questionIndex = 0; ctx.state.deadline = null; save();
    clearInterval(ctx.timer);
    if (ctx.state.sectionIndex >= plan().sections.length) return finishMock();
    const root = $('#pageContent');
    root.innerHTML = `<div class="aptis-v2-mock"><section class="card v2-section-done"><div class="big">${timedOut?'⏱':'✓'}</div><div class="eyebrow">${timedOut?'HẾT THỜI GIAN':'HOÀN THÀNH'}</div><h2>${esc(finishedTitle)}</h2><p>Phần tiếp theo: <b>${esc(section().title)}</b>.</p><button id="v2NextSection" class="btn primary">Bắt đầu phần tiếp theo</button></section></div>`;
    $('#v2NextSection').onclick = () => prepareBlock(true);
  }

  function finishMock() {
    clearInterval(ctx.timer); ctx.state.finished = true; save();
    const rows = ctx.state.results || [];
    const objective = rows.filter(r => r.score != null);
    const avg = objective.length ? Math.round(objective.reduce((s,r)=>s+Number(r.score||0),0)/objective.length) : null;
    const root = $('#pageContent');
    root.innerHTML = `<div class="aptis-v2-mock"><div class="page-head"><div><div class="eyebrow">HOÀN THÀNH</div><h1>${esc(plan().title)}</h1><p>Kết quả dưới đây là thống kê luyện tập nội bộ, không phải điểm Aptis chính thức.</p></div></div><div class="v2-summary-grid">${rows.map(r=>`<div class="card v2-summary-item"><small>${esc(skillName(r.skill))}</small><strong>${r.score==null?'Đã lưu':`${Math.round(Number(r.score))}%`}</strong><span class="help">${Number(r.answered||0)}/${Number(r.total||0)} câu</span></div>`).join('') || '<div class="card">Chưa có phần khách quan để tính.</div>'}</div>${avg!=null?`<div class="v2-format-note">Trung bình các phần khách quan trong phiên: <b>${avg}%</b>. Speaking/Writing cần rubric riêng nên không gộp vào phần trăm này.</div>`:''}<div><button id="v2FinishBack" class="btn primary">Về Thi thử</button></div></div>`;
    $('#v2FinishBack').onclick = () => { clearState(); renderMockHome(); };
  }

  async function loadMedia(q) {
    const set = q?.set || q?.set_context;
    const media = q?.media?.path ? q.media : set?.media?.path ? set.media : null;
    const target = q?.media?.path ? $('#v2QuestionMedia') : $('#v2SetMedia');
    if (!media || !target) return;
    try {
      const url = await API.signedUrl(media, 3600);
      if (media.kind === 'audio' || media.mime?.startsWith('audio/')) {
        target.innerHTML = `<audio id="v2Audio" controls controlsList="nodownload noplaybackrate" preload="metadata" src="${esc(url)}"></audio><div id="v2ListenCount" class="help"></div>`;
        wireListening($('#v2Audio'), q.id);
      } else if (media.kind === 'image' || media.mime?.startsWith('image/')) target.innerHTML = `<img src="${esc(url)}" alt="Hình câu hỏi">`;
    } catch (_) { target.innerHTML = '<div class="help">Không tải được media.</div>'; }
  }

  function wireListening(audio, qid) {
    if (!audio) return;
    ctx.state.listeningPlays ||= {};
    let maxTime = 0;
    const update = () => { const n = Number(ctx.state.listeningPlays[qid] || 0); const c = $('#v2ListenCount'); if (c) c.textContent = `Đã nghe ${n}/2 lượt.`; };
    audio.addEventListener('play', () => {
      const n = Number(ctx.state.listeningPlays[qid] || 0);
      if (audio.currentTime < .35) {
        if (n >= 2) { audio.pause(); toast('Trong Mock, mỗi audio chỉ được nghe tối đa 2 lần.', 'error'); return; }
        ctx.state.listeningPlays[qid] = n + 1; save(); update();
      }
    });
    audio.addEventListener('timeupdate', () => { maxTime = Math.max(maxTime, audio.currentTime); });
    audio.addEventListener('seeking', () => { if (audio.currentTime > maxTime + .6) audio.currentTime = maxTime; });
    audio.addEventListener('ended', () => { if (Number(ctx.state.listeningPlays[qid] || 0) >= 2) audio.controls = false; update(); });
    update();
  }

  function isPart4(part='') { return /(^|[-_ ])4($|[-_ ])/i.test(String(part)) || /part\s*4/i.test(String(part)); }
  function speakingSeconds(part='') { if (isPart4(part)) return 120; if (/(^|[-_ ])1($|[-_ ])/i.test(String(part)) || /part\s*1/i.test(String(part))) return 30; return 45; }

  function wireRecorder(q) {
    const btn = $('#v2Record'), saveBtn = $('#v2SaveSpeaking'), status = $('#v2RecordStatus');
    if (!btn || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { if (btn) btn.disabled = true; if (status) status.textContent = 'Trình duyệt chưa hỗ trợ ghi âm.'; return; }
    let preparing = false;
    btn.onclick = async () => {
      if (ctx.recorder?.state === 'recording') { ctx.recorder.stop(); return; }
      if (isPart4(q.part) && !preparing) {
        preparing = true; btn.disabled = true; let left = 60; status.textContent = `Chuẩn bị: ${left}s`;
        const t = setInterval(() => { left -= 1; status.textContent = `Chuẩn bị: ${left}s`; if (left <= 0) { clearInterval(t); btn.disabled = false; beginRecording(q, btn, saveBtn, status); } }, 1000);
        return;
      }
      beginRecording(q, btn, saveBtn, status);
    };
  }

  async function beginRecording(q, btn, saveBtn, status) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      ctx.chunks = []; ctx.recorder = new MediaRecorder(stream);
      const max = speakingSeconds(q.part); let left = max;
      ctx.recorder.ondataavailable = e => { if (e.data.size) ctx.chunks.push(e.data); };
      ctx.recorder.onstop = () => { clearInterval(ctx.recordTimer); stream.getTracks().forEach(t=>t.stop()); ctx.blob = new Blob(ctx.chunks,{type:ctx.recorder.mimeType||'audio/webm'}); btn.textContent='● Ghi lại'; btn.disabled=false; saveBtn.disabled=false; status.textContent=`Đã ghi ${(ctx.blob.size/1024).toFixed(0)} KB. Bấm Lưu bài nói.`; };
      ctx.recorder.start(); btn.textContent='■ Dừng ghi'; status.textContent=`Đang ghi · còn ${left}s`;
      ctx.recordTimer = setInterval(()=>{ left-=1; status.textContent=`Đang ghi · còn ${Math.max(0,left)}s`; if(left<=0 && ctx.recorder?.state==='recording') ctx.recorder.stop(); },1000);
      saveBtn.onclick = async () => {
        if (!ctx.blob) return; saveBtn.disabled=true; saveBtn.textContent='Đang tải lên…';
        try { const file=new File([ctx.blob],'speaking.webm',{type:ctx.blob.type||'audio/webm'}); const media=await API.uploadRecording(file,ctx.userId); await submit(q,{recording:media}); }
        catch(e){ toast(e.message||'Không lưu được bài nói.','error'); saveBtn.disabled=false; saveBtn.textContent='Lưu bài nói'; }
      };
    } catch (_) { toast('Không truy cập được microphone.', 'error'); }
  }

  function wordCount(v='') { const t=String(v).trim(); return t ? t.split(/\s+/).length : 0; }

  function rubricHtml(a, kind) {
    const data = a?.assessment || a?.rubric || a || {};
    const r = data.rubric || data;
    const s = r.scores || {};
    const title = data.estimated_level || r.estimated_level || '—';
    const total = data.total_score ?? r.total_score;
    const labels = kind === 'speaking'
      ? [['task_fulfilment','Task'],['grammar','Grammar'],['vocabulary','Vocabulary'],['fluency_coherence','Fluency & coherence'],['pronunciation_intelligibility','Pronunciation']]
      : [['task_fulfilment','Task'],['grammar','Grammar'],['vocabulary','Vocabulary'],['coherence_cohesion','Coherence'],['register_accuracy','Register & accuracy']];
    return `<div class="v2-feedback good"><b>Ước lượng luyện tập: ${esc(title)}${total==null?'':` · ${esc(total)}/25`}</b><div class="help">AI feedback chỉ dùng để luyện tập.</div><div class="v2-ai-rubric">${labels.map(([k,l])=>`<div><strong>${esc(l)}</strong><br>${esc(s[k] ?? '—')}/5</div>`).join('')}</div>${r.strengths?.length?`<p><b>Điểm tốt:</b> ${esc(r.strengths.join(' · '))}</p>`:''}${r.improvements?.length?`<p><b>Cần cải thiện:</b> ${esc(r.improvements.join(' · '))}</p>`:''}${r.next_attempt_tip?`<p><b>Lần sau:</b> ${esc(r.next_attempt_tip)}</p>`:''}</div>`;
  }

  function wireAiAssessment(q) {
    const box = $('#v2AiBox'); if (!box) return;
    const kind = q.question_type === 'speaking_prompt' ? 'speaking' : 'writing';
    box.innerHTML = `<button id="v2Assess" class="btn primary">AI chấm ${kind==='speaking'?'bài nói':'bài viết'}</button><div class="help">Chỉ gọi AI khi bạn bấm nút và sẽ tính vào quota AI hằng ngày.</div>`;
    $('#v2Assess').onclick = async e => {
      const btn=e.currentTarget; btn.disabled=true; btn.textContent='AI đang chấm…';
      try { const res = kind==='speaking' ? await API.assessSpeaking(ctx.attempt.attempt_id,q.id) : await API.assessWriting(ctx.attempt.attempt_id,q.id); box.innerHTML=rubricHtml(res,kind); }
      catch(err){ toast(err.message||'Chưa chấm được bằng AI.','error'); btn.disabled=false; btn.textContent=`AI chấm ${kind==='speaking'?'bài nói':'bài viết'}`; }
    };
  }

  async function appendProgressBreakdown() {
    if (currentView() !== 'progress') return;
    const root = $('#pageContent'); if (!root || root.querySelector('.v2-breakdown')) return;
    const host = document.createElement('section'); host.className='card v2-breakdown'; host.innerHTML='<h2>Chi tiết theo Part / chủ đề</h2><div class="help">Đang tổng hợp 90 ngày gần nhất…</div>'; root.appendChild(host);
    try {
      const rows = await API.getProgressBreakdown(90);
      if (!rows?.length) { host.innerHTML='<h2>Chi tiết theo Part / chủ đề</h2><div class="help">Chưa đủ dữ liệu hoặc backend V2 chưa được áp dụng.</div>'; return; }
      host.innerHTML = `<h2>Chi tiết theo Part / chủ đề</h2><p class="help">Dùng để tìm đúng nhóm cần ôn, thay vì chỉ nhìn trung bình theo kỹ năng.</p><div class="table-wrap"><table class="data-table v2-breakdown-table"><thead><tr><th>Kỹ năng</th><th>Part</th><th>Chủ đề</th><th>Đã làm</th><th>Đúng</th><th>Độ chính xác</th></tr></thead><tbody>${rows.map(r=>{const a=Number(r.accuracy_percent??0);const cls=a<50?'weak':a<70?'mid':'good';return `<tr><td>${esc(skillName(r.skill))}</td><td>${esc(r.part||'—')}</td><td>${esc(r.topic||'Chung')}</td><td>${Number(r.answered_count||0)}</td><td>${Number(r.correct_count||0)}</td><td class="v2-accuracy ${cls}">${Math.round(a)}%</td></tr>`}).join('')}</tbody></table></div>`;
    } catch (e) { host.innerHTML=`<h2>Chi tiết theo Part / chủ đề</h2><div class="help">${esc(e.message || 'Backend V2 chưa sẵn sàng.')}</div>`; }
  }

  function injectWritingAssessment(detail) {
    if (currentView() !== 'practice' || !detail?.response?.text) return;
    setTimeout(() => {
      const feedback = $('#lpFeedback'); if (!feedback || $('#lpWritingAssess')) return;
      const box=document.createElement('div'); box.id='lpWritingAssess'; box.className='v2-write-assess'; box.innerHTML='<button class="btn primary" type="button">AI góp ý bài viết</button><div class="help">Chỉ gọi AI khi bạn bấm nút; kết quả là feedback luyện tập.</div>';
      feedback.insertAdjacentElement('afterend',box);
      box.querySelector('button').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='AI đang chấm…';try{const res=await API.assessWriting(detail.attemptId,detail.questionId);box.innerHTML=rubricHtml(res,'writing');}catch(err){toast(err.message||'Chưa chấm được bài viết.','error');b.disabled=false;b.textContent='AI góp ý bài viết';}};
    },50);
  }

  window.addEventListener('aptis:v2-answer-submitted', e => injectWritingAssessment(e.detail));

  function onViewChange() {
    setTimeout(() => { if (currentView()==='mock') mountMock(); if (currentView()==='progress') appendProgressBreakdown(); }, 0);
  }

  const root = $('#pageContent');
  if (root) new MutationObserver(() => onViewChange()).observe(root,{childList:true,subtree:false});
  window.addEventListener('hashchange', onViewChange);
  setTimeout(onViewChange,350);
})();
