/* =====================================================
   examCodeWriter.js v2.7
   - Thay mã đề trong body/header/footer.
   - Chỉ thay các chữ số của mã đề, không gom paragraph về một w:t.
   - Giữ nguyên field PAGE / NUMPAGES và định dạng run.
   - Nếu đề không có vị trí mã đề, tự chèn "Mã đề: xxx" vào cuối header.
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

function updateParagraphExamCode(paragraph, examCode) {
    if (!paragraph || typeof paragraph.getElementsByTagNameNS !== "function") return false;

    const textNodes = Array.from(paragraph.getElementsByTagNameNS(W_NAMESPACE, "t"));
    if (textNodes.length === 0) return false;

    const fullText = textNodes.map(t => t.textContent || "").join("");
    const match = fullText.match(/(?:Mã\s*đề|Đề\s*số|Code)\s*:?\s*(\d{1,6})/i);
    if (!match) return false;

    const relative = match[0].lastIndexOf(match[1]);
    const start = (match.index || 0) + relative;
    const end = start + match[1].length;

    return replaceRangeAcrossTextNodes(textNodes, start, end, String(examCode));
}

function paragraphsInNode(node) {
    if (!node || typeof node.getElementsByTagNameNS !== "function") return [];

    const result = [];
    if (node.nodeType === 1 && (node.localName === "p" || node.nodeName === "w:p")) result.push(node);

    const nested = node.getElementsByTagNameNS(W_NAMESPACE, "p");
    for (let i = 0; i < nested.length; i++) {
        if (!result.includes(nested[i])) result.push(nested[i]);
    }
    return result;
}

function findOwnerDocument(exam) {
    for (const node of exam.header ?? []) {
        if (node?.ownerDocument) return node.ownerDocument;
    }
    for (const q of exam.questions ?? []) {
        for (const node of q.nodes ?? []) {
            if (node?.ownerDocument) return node.ownerDocument;
        }
    }
    for (const node of exam.footer ?? []) {
        if (node?.ownerDocument) return node.ownerDocument;
    }
    return null;
}

function createExamCodeParagraph(examCode, doc) {
    const p = doc.createElementNS(W_NAMESPACE, "w:p");
    const pPr = doc.createElementNS(W_NAMESPACE, "w:pPr");
    const jc = doc.createElementNS(W_NAMESPACE, "w:jc");
    jc.setAttributeNS(W_NAMESPACE, "w:val", "right");
    pPr.appendChild(jc);
    p.appendChild(pPr);

    const r = doc.createElementNS(W_NAMESPACE, "w:r");
    const rPr = doc.createElementNS(W_NAMESPACE, "w:rPr");
    rPr.appendChild(doc.createElementNS(W_NAMESPACE, "w:b"));
    r.appendChild(rPr);

    const t = doc.createElementNS(W_NAMESPACE, "w:t");
    t.textContent = `Mã đề: ${examCode}`;
    r.appendChild(t);
    p.appendChild(r);
    return p;
}

export function updateExamCodeInNodes(nodes, examCode) {
    if (!Array.isArray(nodes) || nodes.length === 0) return false;

    let updated = false;
    for (const node of nodes) {
        for (const paragraph of paragraphsInNode(node)) {
            if (updateParagraphExamCode(paragraph, examCode)) updated = true;
        }
    }
    return updated;
}

export function applyExamCodeToExam(exam, strict = false) {
    if (!exam) throw new TypeError("Tham số 'exam' không được để trống.");

    const updatedHeader = updateExamCodeInNodes(exam.header ?? [], exam.examCode);
    const updatedFooter = updateExamCodeInNodes(exam.footer ?? [], exam.examCode);
    let success = updatedHeader || updatedFooter;

    if (!success) {
        const doc = findOwnerDocument(exam);
        if (doc) {
            if (!Array.isArray(exam.header)) exam.header = [];
            exam.header.push(createExamCodeParagraph(exam.examCode, doc));
            success = true;
            exam.examCodeInserted = true;
        }
    }

    if (!success && strict) {
        throw new Error("Không thể tìm hoặc chèn vị trí Mã đề trong tài liệu.");
    }

    return success;
}

export async function updateExamCodeInZipParts(zip, examCode) {
    if (!zip || typeof zip.file !== "function") throw new TypeError("zip không hợp lệ.");

    const paths = Object.keys(zip.files).filter(path =>
        /^word\/(?:header|footer)\d*\.xml$/i.test(path)
    );

    let replacements = 0;
    const updatedParts = [];

    for (const path of paths) {
        const entry = zip.file(path);
        if (!entry) continue;

        const xmlText = await entry.async("string");
        const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");

        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error(`Không đọc được ${path}.`);
        }

        const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(W_NAMESPACE, "p"));
        let partUpdated = false;

        for (const paragraph of paragraphs) {
            if (updateParagraphExamCode(paragraph, examCode)) {
                replacements++;
                partUpdated = true;
            }
        }

        if (partUpdated) {
            zip.file(path, new XMLSerializer().serializeToString(xmlDoc));
            updatedParts.push(path);
        }
    }

    return { replacements, updatedParts };
}
