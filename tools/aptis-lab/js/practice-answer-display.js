(() => {
  'use strict';

  const page = document.getElementById('pageContent');
  if (!page) return;

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function getDisplayedCorrectAnswer(card) {
    const option = card?.querySelector('.option-btn.correct');
    if (!option) return null;

    const label = option.querySelector('.option-key')?.textContent?.trim() || '';
    const textNode = [...option.children].find(child => !child.classList.contains('option-key'));
    const text = textNode?.textContent?.trim() || '';
    if (!label) return null;

    return { label, text };
  }

  function syncCard(card) {
    if (!card?.classList?.contains('lp-question')) return;

    const answer = getDisplayedCorrectAnswer(card);
    if (!answer) return;

    const feedback = card.querySelector('#lpFeedback .feedback');
    if (!feedback) return;

    const answerLine = [...feedback.children].find(node =>
      node.tagName === 'DIV' && /^Đáp án\s*:/i.test(node.textContent?.trim() || '')
    );
    if (!answerLine) return;

    const suffix = answer.text ? ` — ${escapeHtml(answer.text)}` : '';
    answerLine.innerHTML = `Đáp án: <strong>${escapeHtml(answer.label)}</strong>${suffix}`;
  }

  function syncVisiblePracticeAnswer() {
    page.querySelectorAll('.question-card.lp-question').forEach(syncCard);
  }

  let scheduled = false;
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncVisiblePracticeAnswer();
    });
  };

  new MutationObserver(scheduleSync).observe(page, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleSync);
  scheduleSync();
})();
