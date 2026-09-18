(() => {
  'use strict';
  const API = window.AptisAPI;
  if (!API?.client) return;

  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const contextByQuestion = new Map();
  const questionCache = new Map();
  let lastEditingQuestionId = null;
  let setRowsCache = [];

  const style = document.createElement('style');
  style.textContent = `
    .aptis-set-context{margin:10px 0 18px;padding:16px 18px;border:1px solid #cfe7e2;border-radius:14px;background:#f4fbf9;color:#183b37}
    .aptis-set-context small{display:block;font-weight:800;letter-spacing:.08em;color:#0f766e;margin-bottom:6px}
    .aptis-set-context h3{margin:0 0 8px;font-size:18px}
    .aptis-set-context p{margin:7px 0;white-space:pre-line;line-height:1.65}
    .aptis-bank-note{padding:10px 12px;border-radius:10px;background:#f6f8fb;color:#667085;font-size:13px}
    .aptis-bank-actions{display:flex;gap:8px;flex-wrap:wrap}
  `;
  document.head.appendChild(style);

  const originalDrawPractice = API.drawPractice.bind(API);
  API.drawPractice = async (...args) => {
    const data = await originalDrawPractice(...args);
    for (const q of data?.questions || []) {
      if (!q?.set_context?.id) continue;
      contextByQuestion.set(q.id, q.set_context);
      q.prompt = `APTISCTX:${q.id} ${q.prompt}`;
      if (!q.media?.path && q.set_context?.media?.path) q.media = q.set_context.media;
    }
    return data;
  };

  const originalGetQuestions = API.getQuestions.bind(API);
  API.getQuestions = async (...args) => {
    const rows = await originalGetQuestions(...args);
    for (const q of rows || []) questionCache.set(q.id, q);
    return rows;
  };

  const originalSaveQuestion = API.saveQuestion.bind(API);
  API.saveQuestion = async (question) => {
    const setSelect = document.querySelector('#qSet');
    const orderInput = document.querySelector('#qItemOrder');
    if (setSelect) {
      question.set_id = setSelect.value || null;
      question.item_order = question.set_id ? Math.max(1, Number(orderInput?.value || 1)) : null;
      const parent = setRowsCache.find(s => s.id === question.set_id);
      if (parent) {
        question.skill = parent.skill;
        question.level = parent.level;
        question.part = parent.part;
      }
    }
    if (question.prompt) {
      const { data, error } = await API.client.rpc('aptis_find_question_duplicates', {
        p_prompt: question.prompt,
        p_exclude_id: question.id || null
      });
      if (error) throw error;
      if (data?.length) {
        const top = data[0];
        const pct = Math.round(Number(top.similarity_score || 0) * 100);
        if (!window.confirm(`Phát hiện câu tương tự (${pct}%):\n\n${top.prompt}\n\nVẫn lưu câu này?`)) {
          throw new Error('Đã hủy lưu vì có câu tương tự trong ngân hàng.');
        }
      }
    }
    return originalSaveQuestion(question);
  };

  document.addEventListener('click', (e) => {
    const edit = e.target.closest?.('[data-edit-q]');
    if (edit) lastEditingQuestionId = edit.dataset.editQ || null;
    if (e.target.closest?.('#newQuestionBtn')) lastEditingQuestionId = null;
  }, true);

  function renderPracticeContext() {
    document.querySelectorAll('.question-card h2').forEach(h2 => {
      const text = h2.textContent || '';
      const match = text.match(/^APTISCTX:([0-9a-f-]+)\s+/i);
      if (!match || h2.dataset.aptisContextDone === '1') return;
      const qid = match[1];
      const ctx = contextByQuestion.get(qid);
      h2.textContent = text.replace(match[0], '');
      h2.dataset.aptisContextDone = '1';
      if (!ctx) return;
      const box = document.createElement('section');
      box.className = 'aptis-set-context';
      const small = document.createElement('small'); small.textContent = 'BỘ NỘI DUNG'; box.appendChild(small);
      if (ctx.title) { const title = document.createElement('h3'); title.textContent = ctx.title; box.appendChild(title); }
      if (ctx.instructions) { const p = document.createElement('p'); p.textContent = ctx.instructions; box.appendChild(p); }
      if (ctx.body_text) { const p = document.createElement('p'); p.textContent = ctx.body_text; box.appendChild(p); }
      h2.parentNode.insertBefore(box, h2);
    });
  }

  async function loadSetsForQuestionDialog() {
    const skill = document.querySelector('#qSkill');
    if (!skill || document.querySelector('#qSet')) return;
    const { data, error } = await API.client.from('aptis_sets')
      .select('id,title,skill,level,part,status,is_active')
      .neq('status', 'archived').order('title');
    if (error) return;
    setRowsCache = data || [];
    const current = lastEditingQuestionId ? questionCache.get(lastEditingQuestionId) : null;
    const topicField = document.querySelector('#qTopic')?.closest('.field');
    if (!topicField?.parentNode) return;
    const setField = document.createElement('label');
    setField.className = 'field';
    setField.innerHTML = `Thuộc bộ Reading/Listening<select id="qSet"><option value="">Câu độc lập</option>${setRowsCache.map(s => `<option value="${esc(s.id)}" ${current?.set_id===s.id?'selected':''}>[${esc(s.skill)} ${esc(s.level)}] ${esc(s.title)}</option>`).join('')}</select>`;
    const orderField = document.createElement('label');
    orderField.className = 'field';
    orderField.innerHTML = `Thứ tự trong bộ<input id="qItemOrder" type="number" min="1" value="${Number(current?.item_order || 1)}">`;
    topicField.insertAdjacentElement('afterend', orderField);
    topicField.insertAdjacentElement('afterend', setField);
    const setSelect = setField.querySelector('select');
    setSelect.addEventListener('change', () => {
      const parent = setRowsCache.find(s => s.id === setSelect.value);
      if (!parent) return;
      const skillEl = document.querySelector('#qSkill');
      const levelEl = document.querySelector('#qLevel');
      const partEl = document.querySelector('#qPart');
      if (skillEl) skillEl.value = parent.skill;
      if (levelEl) levelEl.value = parent.level;
      if (partEl) partEl.value = parent.part;
    });
  }

  function isAdminManagePage() {
    return !!document.querySelector('[data-mtab="access"]');
  }

  function enhanceManageTabs() {
    const manageArea = document.querySelector('#manageArea');
    const tabs = manageArea?.previousElementSibling;
    if (!manageArea || !tabs?.classList?.contains('tabs') || tabs.querySelector('[data-aptis-sets-tab]')) return;
    const questionsTab = tabs.querySelector('[data-mtab="questions"]');
    if (!questionsTab) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.dataset.aptisSetsTab = '1'; btn.textContent = 'Bộ Reading / Listening';
    questionsTab.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderSetManager(manageArea);
    });
  }

  async function getSets(filters = {}) {
    let q = API.client.from('aptis_sets').select('*').order('updated_at', { ascending: false }).limit(500);
    if (filters.skill) q = q.eq('skill', filters.skill);
    if (filters.level) q = q.eq('level', filters.level);
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q; if (error) throw error; return data || [];
  }

  async function renderSetManager(area) {
    area.innerHTML = `<div class="card"><div class="page-head"><div><h2>Bộ Reading / Listening</h2><p class="help">Một passage hoặc audio có thể chứa nhiều câu con. Transcript Listening chỉ dành cho người biên soạn và không được trả cho learner khi rút câu.</p></div><button id="newAptisSet" class="btn primary">+ Thêm bộ</button></div><div class="toolbar"><select id="setSkillFilter"><option value="">Reading + Listening</option><option value="reading">Reading</option><option value="listening">Listening</option></select><select id="setLevelFilter"><option value="">B1 + B2</option><option>B1</option><option>B2</option></select><select id="setStatusFilter"><option value="">Mọi trạng thái</option><option>draft</option><option>review</option><option>published</option><option>archived</option></select></div><div id="setTable" style="margin-top:12px"><div class="help">Đang tải…</div></div><p class="aptis-bank-note" style="margin-top:12px">Câu con được tạo ở tab “Ngân hàng câu hỏi”, chọn “Thuộc bộ Reading/Listening” và số thứ tự trong bộ.</p></div>`;
    const reload = async () => {
      try {
        const rows = await getSets({ skill: document.querySelector('#setSkillFilter')?.value, level: document.querySelector('#setLevelFilter')?.value, status: document.querySelector('#setStatusFilter')?.value });
        setRowsCache = rows;
        const host = document.querySelector('#setTable');
        if (!host) return;
        host.innerHTML = rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Kỹ năng</th><th>Mức</th><th>Tiêu đề</th><th>Part</th><th>Trạng thái</th><th>Revision</th><th></th></tr></thead><tbody>${rows.map(s => `<tr><td>${esc(s.skill)}</td><td>${esc(s.level)}</td><td>${esc(s.title)}</td><td>${esc(s.part)}</td><td><span class="status ${esc(s.status)}">${esc(s.status)}</span></td><td>v${Number(s.revision||1)}</td><td><button class="btn ghost small" data-edit-set="${s.id}">Sửa</button>${isAdminManagePage()?` <button class="btn danger small" data-del-set="${s.id}">Xóa</button>`:''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>Chưa có bộ nội dung</b><span>Tạo passage Reading hoặc audio Listening đầu tiên.</span></div>`;
        host.querySelectorAll('[data-edit-set]').forEach(b => b.onclick = () => openSetDialog(rows.find(s => s.id === b.dataset.editSet), reload));
        host.querySelectorAll('[data-del-set]').forEach(b => b.onclick = async () => {
          if (!confirm('Xóa bộ này? Các câu con sẽ trở thành câu độc lập.')) return;
          const { error } = await API.client.from('aptis_sets').delete().eq('id', b.dataset.delSet);
          if (error) return alert(error.message);
          reload();
        });
      } catch (e) {
        const host = document.querySelector('#setTable'); if (host) host.innerHTML = `<div class="help">${esc(e.message || 'Không tải được bộ nội dung.')}</div>`;
      }
    };
    document.querySelector('#newAptisSet').onclick = () => openSetDialog(null, reload);
    ['#setSkillFilter','#setLevelFilter','#setStatusFilter'].forEach(sel => document.querySelector(sel).onchange = reload);
    await reload();
  }

  function openSetDialog(row, onSaved) {
    const dlg = document.querySelector('#simpleDialog');
    document.querySelector('#dialogTitle').textContent = row ? 'Sửa bộ Aptis' : 'Thêm bộ Reading / Listening';
    document.querySelector('#dialogBody').innerHTML = `<div class="form-grid">
      <label class="field">Kỹ năng<select id="setSkill"><option value="reading" ${!row||row.skill==='reading'?'selected':''}>Reading</option><option value="listening" ${row?.skill==='listening'?'selected':''}>Listening</option></select></label>
      <label class="field">Mức<select id="setLevel"><option ${row?.level==='B1'?'selected':''}>B1</option><option ${!row||row?.level==='B2'?'selected':''}>B2</option></select></label>
      <label class="field">Part<input id="setPart" value="${esc(row?.part || 'reading-1')}"></label>
      <label class="field">Độ khó<select id="setDifficulty">${[1,2,3,4,5].map(n=>`<option ${n===Number(row?.difficulty||3)?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="field full">Tiêu đề<input id="setTitle" value="${esc(row?.title || '')}"></label>
      <label class="field">Chủ đề<input id="setTopic" value="${esc(row?.topic || '')}"></label>
      <label class="field">Trạng thái<select id="setStatus"><option ${!row||row?.status==='draft'?'selected':''}>draft</option><option ${row?.status==='review'?'selected':''}>review</option><option ${row?.status==='published'?'selected':''}>published</option><option ${row?.status==='archived'?'selected':''}>archived</option></select></label>
      <label class="field full">Hướng dẫn<textarea id="setInstructions" rows="2">${esc(row?.instructions || '')}</textarea></label>
      <label class="field full">Passage Reading<textarea id="setBody" rows="8" placeholder="Để trống với Listening">${esc(row?.body_text || '')}</textarea></label>
      <label class="field full">Transcript Listening<textarea id="setTranscript" rows="8" placeholder="Không trả transcript này cho learner khi rút câu">${esc(row?.transcript || '')}</textarea></label>
      <label class="field full">Audio / hình ảnh<input id="setMedia" type="file" accept="audio/*,image/jpeg,image/png,image/webp"><span class="help">File hiện tại: ${esc(row?.media?.name || row?.media?.path || 'không có')}</span></label>
    </div><div class="form-actions"><button id="saveAptisSet" class="btn primary" type="button">Lưu bộ</button></div>`;
    document.querySelector('#saveAptisSet').onclick = async () => {
      const btn = document.querySelector('#saveAptisSet'); btn.disabled = true;
      try {
        let media = row?.media || {};
        const file = document.querySelector('#setMedia').files[0];
        if (file) media = await API.uploadContent(file, document.querySelector('#setSkill').value);
        const payload = {
          exam_family: 'general', skill: document.querySelector('#setSkill').value,
          level: document.querySelector('#setLevel').value, part: document.querySelector('#setPart').value.trim() || 'general',
          difficulty: Number(document.querySelector('#setDifficulty').value), topic: document.querySelector('#setTopic').value.trim() || null,
          title: document.querySelector('#setTitle').value.trim(), instructions: document.querySelector('#setInstructions').value.trim() || null,
          body_text: document.querySelector('#setBody').value.trim() || null, transcript: document.querySelector('#setTranscript').value.trim() || null,
          media, source_type: row?.source_type || 'manual', status: document.querySelector('#setStatus').value, is_active: true
        };
        if (!payload.title) throw new Error('Cần nhập tiêu đề bộ.');
        const op = row?.id ? API.client.from('aptis_sets').update(payload).eq('id', row.id) : API.client.from('aptis_sets').insert(payload);
        const { error } = await op; if (error) throw error;
        dlg.close(); await onSaved?.();
      } catch (e) { alert(e.message || 'Không lưu được bộ.'); }
      finally { btn.disabled = false; }
    };
    dlg.showModal();
  }

  const observer = new MutationObserver(() => {
    renderPracticeContext();
    enhanceManageTabs();
    loadSetsForQuestionDialog();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  renderPracticeContext(); enhanceManageTabs();
})();
