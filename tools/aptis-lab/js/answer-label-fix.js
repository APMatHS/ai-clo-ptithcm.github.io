(() => {
  'use strict';

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  function fixAnswerLabels(root = document) {
    root.querySelectorAll('.lp-question').forEach((card) => {
      const feedback = card.querySelector('.feedback');
      const correctOption = card.querySelector('.option-btn.correct');
      if (!feedback || !correctOption) return;

      const answerLine = [...feedback.querySelectorAll('div')]
        .find((el) => /^\s*Đáp án:\s*/i.test(el.textContent || ''));
      if (!answerLine || answerLine.dataset.displayAnswerFixed === '1') return;

      const displayKey = correctOption.querySelector('.option-key')?.textContent?.trim() || '';
      const spans = correctOption.querySelectorAll('span');
      const optionText = spans.length > 1 ? spans[spans.length - 1].textContent.trim() : '';
      if (!displayKey) return;

      answerLine.innerHTML = `Đáp án: <strong>${esc(displayKey)}${optionText ? ` — ${esc(optionText)}` : ''}</strong>`;
      answerLine.dataset.displayAnswerFixed = '1';
    });
  }

  const root = document.getElementById('pageContent');
  if (!root) return;

  const observer = new MutationObserver(() => fixAnswerLabels(root));
  observer.observe(root, { childList: true, subtree: true });
  fixAnswerLabels(root);
})();
