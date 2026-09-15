/* =====================================================
   questionSplitter.js v2.3
   - Nhận diện Câu 1 / Câu 1. / Câu 1: / Câu 1) / Q1 / Question 1.
   - Khi người dùng xác nhận N câu, đề gốc PHẢI có đúng Câu 1..Câu N.
   - Nếu thiếu/dư/trùng số câu: dừng và báo cụ thể để người dùng sửa file nguồn.
   - Nếu file chứa nhiều đề nối tiếp, chọn khối hợp lệ bắt đầu từ Câu 1.
===================================================== */

const W_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const ELEMENT_NODE = typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1;

function getParagraphText(paragraph) {
    if (!paragraph || typeof paragraph.getElementsByTagNameNS !== "function") return "";
    const textNodes = paragraph.getElementsByTagNameNS(W_NAMESPACE, "t");
    let text = "";
    for (let i = 0; i < textNodes.length; i++) text += textNodes[i].textContent || "";
    return text.replace(/\u00a0/g, " ");
}

function isSectPr(node) {
    return node && node.nodeType === ELEMENT_NODE &&
        (node.localName === "sectPr" || node.nodeName === "w:sectPr");
}

function parseQuestionStart(paragraph) {
    if (!paragraph || paragraph.nodeType !== ELEMENT_NODE) return null;
    if (!(paragraph.localName === "p" || paragraph.nodeName === "w:p")) return null;

    const text = getParagraphText(paragraph).replace(/\s+/g, " ").trim();
    if (!text) return null;

    let match = text.match(/^(Câu|Question)\s*(\d+)(?=\s|$|[\.\:\)\-–—])/i);
    if (match) return { number: Number(match[2]), kind: "named", text };

    match = text.match(/^Q\s*(\d+)(?=\s|$|[\.\:\)\-–—])/i);
    if (match) return { number: Number(match[1]), kind: "q", text };

    match = text.match(/^(\d+)\s*[\.\:\)](?=\s|$)/);
    if (match) return { number: Number(match[1]), kind: "numeric", text };

    return null;
}

function candidatePools(candidates) {
    const preferred = candidates.filter(c => c.kind !== "numeric");
    return preferred.length ? [preferred, candidates] : [candidates];
}

function splitIntoCandidateBlocks(pool) {
    const starts = [];
    pool.forEach((item, index) => {
        if (item.number === 1) starts.push(index);
    });

    return starts.map((startIndex, blockIndex) => {
        const endIndex = blockIndex + 1 < starts.length ? starts[blockIndex + 1] : pool.length;
        return pool.slice(startIndex, endIndex);
    });
}

function diagnoseBlock(block, expectedCount) {
    const numbers = block.map(item => item.number);
    const counts = new Map();
    numbers.forEach(number => counts.set(number, (counts.get(number) || 0) + 1));

    const missing = [];
    for (let number = 1; number <= expectedCount; number++) {
        if (!counts.has(number)) missing.push(number);
    }

    const extra = [...new Set(numbers.filter(number => number < 1 || number > expectedCount))]
        .sort((a, b) => a - b);

    const duplicate = [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([number]) => number)
        .sort((a, b) => a - b);

    const exactSequence =
        block.length === expectedCount &&
        missing.length === 0 &&
        extra.length === 0 &&
        duplicate.length === 0 &&
        numbers.every((number, index) => number === index + 1);

    const score =
        missing.length +
        extra.length +
        duplicate.length * 2 +
        Math.abs(block.length - expectedCount);

    return { block, numbers, missing, extra, duplicate, exactSequence, score };
}

function findExactQuestionBlock(candidates, expectedCount) {
    if (!Number.isInteger(expectedCount) || expectedCount <= 0) return null;

    let bestInvalid = null;

    for (const pool of candidatePools(candidates)) {
        const blocks = splitIntoCandidateBlocks(pool);

        for (const block of blocks) {
            const diagnosis = diagnoseBlock(block, expectedCount);
            if (diagnosis.exactSequence) {
                return { selected: block, diagnosis };
            }

            if (
                !bestInvalid ||
                diagnosis.score < bestInvalid.score ||
                (diagnosis.score === bestInvalid.score && block.length > bestInvalid.block.length)
            ) {
                bestInvalid = diagnosis;
            }
        }
    }

    return { selected: null, diagnosis: bestInvalid };
}

function formatNumberList(numbers, prefix = "Câu") {
    return numbers.map(number => `${prefix} ${number}`).join(", ");
}

function buildStructureError(diagnosis, expectedCount, totalDetected) {
    if (!diagnosis) {
        return `Không tìm thấy khối đề bắt đầu từ Câu 1. Đã phát hiện ${totalDetected} mốc có dạng đầu câu.`;
    }

    const details = [];
    if (diagnosis.missing.length) {
        details.push(`Thiếu: ${formatNumberList(diagnosis.missing)}`);
    }
    if (diagnosis.extra.length) {
        details.push(`Dư: ${formatNumberList(diagnosis.extra)}`);
    }
    if (diagnosis.duplicate.length) {
        details.push(`Trùng số: ${formatNumberList(diagnosis.duplicate)}`);
    }
    if (!details.length && diagnosis.block.length !== expectedCount) {
        details.push(`Phát hiện ${diagnosis.block.length} câu, trong khi đã xác nhận ${expectedCount} câu`);
    }
    if (!details.length) {
        details.push(`Thứ tự số câu không đúng 1 → ${expectedCount}`);
    }

    return `Đề gốc chưa hợp lệ. ${details.join("; ")}. Vui lòng sửa file Word rồi bấm Kiểm tra định dạng lại.`;
}

function choiceLabelsInText(text) {
    const labels = [];
    const regex = /(?:^|[\s\t])([A-D])\s*[\.\:\)]/g;
    let match;
    while ((match = regex.exec(text)) !== null) labels.push(match[1]);

    if (labels.length === 0) {
        const fallback = /([A-D])\s*[\.\:\)]/g;
        while ((match = fallback.exec(text)) !== null) labels.push(match[1]);
    }
    return labels;
}

function findLastQuestionEnd(nodes, startIndex) {
    const seen = new Set();
    for (let i = startIndex; i < nodes.length; i++) {
        const node = nodes[i];
        if (isSectPr(node)) continue;
        if (!node || node.nodeType !== ELEMENT_NODE) continue;

        choiceLabelsInText(getParagraphText(node)).forEach(label => seen.add(label));
        if (seen.has("A") && seen.has("B") && seen.has("C") && seen.has("D")) return i + 1;
    }
    return nodes.length;
}

function looksLikeExamTitle(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim().toUpperCase();
    if (!normalized) return false;
    return /^(ĐỀ|DE)\s+(THI|KIỂM TRA|KIEM TRA)/i.test(normalized) ||
           /^(BÀI|BAI)\s+(THI|KIỂM TRA|KIEM TRA)/i.test(normalized);
}

function findHeaderStart(nodes, firstStart, candidates) {
    const earlierQuestionExists = candidates.some(c => c.nodeIndex < firstStart && c.number === 1);
    if (!earlierQuestionExists) return 0;

    for (let i = firstStart - 1; i >= 0; i--) {
        if (isSectPr(nodes[i])) continue;
        const text = getParagraphText(nodes[i]);
        if (looksLikeExamTitle(text)) return i;
    }
    return 0;
}

export function splitQuestions(bodyNode, expectedQuestionCount = null) {
    if (!bodyNode || typeof bodyNode.childNodes === "undefined") {
        return { headerNodes: [], questionBlocks: [], footerNodes: [], totalNodes: 0, detectedQuestionStarts: 0 };
    }

    const nodes = Array.from(bodyNode.childNodes);
    const candidates = [];

    nodes.forEach((node, index) => {
        if (isSectPr(node)) return;
        const parsed = parseQuestionStart(node);
        if (parsed) candidates.push({ ...parsed, nodeIndex: index });
    });

    let selectedStarts;
    if (Number.isInteger(expectedQuestionCount) && expectedQuestionCount > 0) {
        const result = findExactQuestionBlock(candidates, expectedQuestionCount);
        if (!result?.selected) {
            throw new Error(buildStructureError(result?.diagnosis, expectedQuestionCount, candidates.length));
        }
        selectedStarts = result.selected;
    } else {
        selectedStarts = candidates;
    }

    if (selectedStarts.length === 0) {
        return {
            headerNodes: nodes.filter(node => !isSectPr(node)),
            questionBlocks: [], footerNodes: [], totalNodes: nodes.length,
            detectedQuestionStarts: candidates.length
        };
    }

    const firstStart = selectedStarts[0].nodeIndex;
    const headerStart = findHeaderStart(nodes, firstStart, candidates);
    const headerNodes = nodes.slice(headerStart, firstStart).filter(node => !isSectPr(node));
    const questionBlocks = [];
    let footerNodes = [];

    for (let q = 0; q < selectedStarts.length; q++) {
        const startIndex = selectedStarts[q].nodeIndex;
        let endIndex;

        if (q < selectedStarts.length - 1) {
            endIndex = selectedStarts[q + 1].nodeIndex;
        } else if (Number.isInteger(expectedQuestionCount) && expectedQuestionCount > 0) {
            endIndex = findLastQuestionEnd(nodes, startIndex);
            footerNodes = nodes.slice(endIndex).filter(node => !isSectPr(node));
        } else {
            endIndex = nodes.length;
        }

        questionBlocks.push({
            index: q + 1,
            startNodeIndex: startIndex,
            questionNumber: q + 1,
            nodes: nodes.slice(startIndex, endIndex).filter(node => !isSectPr(node)),
            answers: [], correctAnswer: null
        });
    }

    return {
        headerNodes, questionBlocks, footerNodes,
        totalNodes: nodes.length,
        detectedQuestionStarts: candidates.length,
        selectedSourceNumbers: selectedStarts.map((_, index) => index + 1),
        headerStartNodeIndex: headerStart
    };
}

export function isQuestionStart(paragraph) {
    return Boolean(parseQuestionStart(paragraph));
}
