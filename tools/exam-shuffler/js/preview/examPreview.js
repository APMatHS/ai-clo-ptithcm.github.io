/* =====================================================
   examPreview.js v1.0
   - Hiển thị kết quả phân tích đề trước khi trộn.
   - Cho phép sửa đáp án đúng và CLO ngay trên web.
   - CLO là tùy chọn, không bắt buộc.
===================================================== */

const LABELS = ["A", "B", "C", "D"];

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = text;
    return node;
}

function normalizeCloLabel(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(?:CLO\s*)?(\d+)$/i);
    return match ? match[1] : text;
}

function buildStats(questions) {
    const counts = new Map();
    let missingClo = 0;
    let missingCorrect = 0;
    let badChoices = 0;

    questions.forEach(q => {
        const clo = normalizeCloLabel(q.clo);
        if (!clo) missingClo++;
        else counts.set(clo, (counts.get(clo) || 0) + 1);

        if (!LABELS.includes(String(q.correct || "").toUpperCase())) missingCorrect++;
        if (!Array.isArray(q.choices) || q.choices.length !== 4) badChoices++;
    });

    return { counts, missingClo, missingCorrect, badChoices };
}

function renderSummary(container, analysis) {
    const questions = analysis.questions || [];
    const stats = buildStats(questions);
    const box = el("div", "grid grid-cols-2 md:grid-cols-4 gap-2 mb-4");

    const items = [
        [`${questions.length}`, "Câu phát hiện", "bg-blue-50 border-blue-200 text-blue-800"],
        [`${stats.missingCorrect}`, "Thiếu đáp án đúng", stats.missingCorrect ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"],
        [`${stats.missingClo}`, "Thiếu CLO", stats.missingClo ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"],
        [`${stats.badChoices}`, "Sai số phương án", stats.badChoices ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"]
    ];

    items.forEach(([value, label, cls]) => {
        const card = el("div", `border rounded-lg p-3 ${cls}`);
        card.appendChild(el("div", "text-xl font-bold", value));
        card.appendChild(el("div", "text-xs mt-1", label));
        box.appendChild(card);
    });
    container.appendChild(box);

    const cloBar = el("div", "flex flex-wrap gap-2 mb-4");
    if (stats.counts.size === 0) {
        cloBar.appendChild(el("span", "px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-600", "Không có CLO — vẫn có thể trộn"));
    } else {
        [...stats.counts.entries()]
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .forEach(([clo, count]) => {
                cloBar.appendChild(el("span", "px-3 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200", `CLO${clo}: ${count} câu`));
            });
        if (stats.missingClo) {
            cloBar.appendChild(el("span", "px-3 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200", `Chưa gán CLO: ${stats.missingClo}`));
        }
    }
    container.appendChild(cloBar);
}

function renderQuestionCard(container, q, index) {
    const card = el("div", "border rounded-xl p-4 bg-white shadow-sm");
    card.dataset.questionIndex = String(index);

    const top = el("div", "flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3");
    const title = el("div");
    title.appendChild(el("div", "font-semibold text-slate-900", `Câu ${index + 1}${q.originalNumber && q.originalNumber !== index + 1 ? ` (nhãn gốc: ${q.originalNumber})` : ""}`));
    if (q.stemText) title.appendChild(el("div", "text-sm text-slate-600 mt-1 whitespace-pre-wrap", q.stemText));
    top.appendChild(title);

    const cloWrap = el("label", "flex items-center gap-2 text-sm shrink-0");
    cloWrap.appendChild(el("span", "text-slate-600", "CLO"));
    const cloInput = el("input", "clo-input w-24 border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500");
    cloInput.value = q.clo ? `CLO${normalizeCloLabel(q.clo)}` : "";
    cloInput.placeholder = "Không bắt buộc";
    cloWrap.appendChild(cloInput);
    top.appendChild(cloWrap);
    card.appendChild(top);

    const choicesBox = el("div", "grid grid-cols-1 md:grid-cols-2 gap-2");
    const detected = String(q.correct || "").toUpperCase();

    (q.choices || []).forEach(choice => {
        const label = String(choice.label || "").toUpperCase();
        const row = el("label", "flex gap-2 items-start border rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `correct-${index}`;
        radio.value = label;
        radio.className = "mt-1 correct-radio";
        radio.checked = detected === label;
        row.appendChild(radio);
        row.appendChild(el("span", "font-bold text-slate-900 min-w-6", `${label}.`));
        row.appendChild(el("span", "text-sm text-slate-700 whitespace-pre-wrap", choice.text || ""));
        choicesBox.appendChild(row);
    });

    card.appendChild(choicesBox);

    const warnings = [];
    if ((q.choices || []).length !== 4) warnings.push(`Phát hiện ${(q.choices || []).length} phương án, cần đúng 4.`);
    if (!LABELS.includes(detected)) warnings.push("Chưa xác định đáp án đúng — hãy chọn A/B/C/D ở trên.");
    if (!q.clo) warnings.push("Chưa có CLO — có thể để trống hoặc nhập tại đây.");
    if (q.originalNumber && q.originalNumber !== index + 1) warnings.push(`Nhãn câu gốc là ${q.originalNumber}; khi xuất sẽ đánh lại thành ${index + 1}.`);

    if (warnings.length) {
        const warningBox = el("div", "mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2");
        warnings.forEach(w => warningBox.appendChild(el("div", "", `• ${w}`)));
        card.appendChild(warningBox);
    }

    container.appendChild(card);
}

export function renderAnalysisPreview(container, analysis) {
    if (!container) return;
    container.innerHTML = "";
    container.classList.remove("hidden");

    renderSummary(container, analysis);

    const note = el("div", "text-sm text-slate-600 mb-4");
    note.textContent = "Kiểm tra lại đáp án đúng và CLO. CLO không bắt buộc; đáp án đúng là bắt buộc để trộn.";
    container.appendChild(note);

    const list = el("div", "space-y-3");
    (analysis.questions || []).forEach((q, index) => renderQuestionCard(list, q, index));
    container.appendChild(list);
}

export function collectManualOverrides(container) {
    const overrides = [];
    if (!container) return overrides;

    const cards = container.querySelectorAll("[data-question-index]");
    cards.forEach(card => {
        const index = Number(card.dataset.questionIndex);
        const clo = normalizeCloLabel(card.querySelector(".clo-input")?.value || "");
        const correct = card.querySelector(".correct-radio:checked")?.value || "";
        overrides[index] = { clo, correct };
    });

    return overrides;
}

export function refreshCLOSummary(container) {
    if (!container) return;
    const counts = new Map();
    let missing = 0;
    container.querySelectorAll(".clo-input").forEach(input => {
        const clo = normalizeCloLabel(input.value);
        if (!clo) missing++;
        else counts.set(clo, (counts.get(clo) || 0) + 1);
    });

    const target = container.querySelector("[data-live-clo-summary]");
    if (!target) return;
    const parts = [...counts.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([clo, count]) => `CLO${clo}: ${count}`);
    if (missing) parts.push(`Chưa gán: ${missing}`);
    target.textContent = parts.join(" • ") || "Không có CLO";
}
