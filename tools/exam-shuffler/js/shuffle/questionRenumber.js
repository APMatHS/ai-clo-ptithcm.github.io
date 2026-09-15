/* =====================================================
   questionRenumber.js v2.0
   Hỗ trợ: Câu 1, Câu 1., Câu 1:, Câu 1), Question 1, Q1, 1.
   Chỉ thay phần số và giữ nguyên kiểu dấu câu/định dạng run của Word.
===================================================== */

const W_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function replaceRangeAcrossTextNodes(textNodes, start, end, replacement) {
    let offset = 0;
    let inserted = false;

    for (const textNode of textNodes) {
        const text = textNode.textContent || "";
        const nodeStart = offset;
        const nodeEnd = offset + text.length;
        offset = nodeEnd;

        if (nodeEnd <= start || nodeStart >= end) continue;

        const localStart = Math.max(0, start - nodeStart);
        const localEnd = Math.min(text.length, end - nodeStart);
        const before = text.slice(0, localStart);
        const after = text.slice(localEnd);

        if (!inserted) {
            textNode.textContent = before + replacement + after;
            inserted = true;
        } else {
            textNode.textContent = before + after;
        }
    }

    return inserted;
}

function findNumberRange(fullText) {
    let match = fullText.match(/^\s*(?:Câu|Question)\s*(\d+)(?=\s|$|[\.\:\)\-–—])/i);
    if (match) {
        const relative = match[0].lastIndexOf(match[1]);
        return { start: (match.index || 0) + relative, end: (match.index || 0) + relative + match[1].length };
    }

    match = fullText.match(/^\s*Q\s*(\d+)(?=\s|$|[\.\:\)\-–—])/i);
    if (match) {
        const relative = match[0].lastIndexOf(match[1]);
        return { start: (match.index || 0) + relative, end: (match.index || 0) + relative + match[1].length };
    }

    match = fullText.match(/^\s*(\d+)\s*[\.\:\)]/);
    if (match) {
        const relative = match[0].indexOf(match[1]);
        return { start: (match.index || 0) + relative, end: (match.index || 0) + relative + match[1].length };
    }

    return null;
}

function paragraphCandidates(node) {
    if (!node || typeof node.getElementsByTagNameNS !== "function") return [];

    if (node.nodeType === 1 && (node.localName === "p" || node.nodeName === "w:p")) {
        return [node];
    }

    return Array.from(node.getElementsByTagNameNS(W_NAMESPACE, "p"));
}

export function renumberQuestion(question, newNumber) {
    if (!question || !Array.isArray(question.nodes) || question.nodes.length === 0) {
        return question;
    }

    for (const node of question.nodes) {
        for (const paragraph of paragraphCandidates(node)) {
            const textNodes = Array.from(paragraph.getElementsByTagNameNS(W_NAMESPACE, "t"));
            if (textNodes.length === 0) continue;

            const fullText = textNodes.map(t => t.textContent || "").join("");
            const range = findNumberRange(fullText);
            if (!range) continue;

            replaceRangeAcrossTextNodes(textNodes, range.start, range.end, String(newNumber));
            question.number = newNumber;
            return question;
        }
    }

    question.number = newNumber;
    return question;
}

export function renumberAllQuestions(questions) {
    if (!Array.isArray(questions)) {
        throw new TypeError("Tham số 'questions' phải là một mảng.");
    }
    return questions.map((q, index) => renumberQuestion(q, index + 1));
}
