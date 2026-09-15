/* =====================================================
   docxFormatter.js v2.2
   - Làm sạch dấu hiệu đáp án ở nội dung lựa chọn.
   - Chỉ in đậm nhãn A./B./C./D., nội dung phương án để thường.
   - Chỉ làm đậm nhãn Câu n/Question n/Qn.
===================================================== */

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

function paragraphText(pNode) {
    if (!pNode || typeof pNode.getElementsByTagNameNS !== "function") return "";
    const nodes = pNode.getElementsByTagNameNS(W_NS, "t");
    let text = "";
    for (let i = 0; i < nodes.length; i++) text += nodes[i].textContent || "";
    return text;
}

function isAnswerParagraph(pNode) {
    const text = paragraphText(pNode);
    return /(?:^|[\s\t])A\s*[\.\:\)]/.test(text) ||
           /(?:^|[\s\t])B\s*[\.\:\)]/.test(text) ||
           /(?:^|[\s\t])C\s*[\.\:\)]/.test(text) ||
           /(?:^|[\s\t])D\s*[\.\:\)]/.test(text);
}

function removeProps(run, names) {
    for (const name of names) {
        const list = run.getElementsByTagNameNS(W_NS, name);
        for (let i = list.length - 1; i >= 0; i--) {
            const node = list[i];
            if (node.parentNode) node.parentNode.removeChild(node);
        }
    }
}

function directChild(parent, localName) {
    return Array.from(parent?.childNodes || []).find(child =>
        child.nodeType === 1 && (child.localName === localName || child.nodeName === `w:${localName}`)
    ) || null;
}

function ensureRunProperties(run) {
    let rPr = directChild(run, "rPr");
    if (!rPr) {
        rPr = run.ownerDocument.createElementNS(W_NS, "w:rPr");
        run.insertBefore(rPr, run.firstChild);
    }
    return rPr;
}

function addProp(run, localName, value = null) {
    const rPr = ensureRunProperties(run);
    const prop = run.ownerDocument.createElementNS(W_NS, `w:${localName}`);
    if (value !== null) prop.setAttributeNS(W_NS, "w:val", value);
    rPr.appendChild(prop);
}

function setNormalAnswerRun(run) {
    removeProps(run, ["b", "bCs", "i", "iCs", "u", "color", "rStyle"]);
    addProp(run, "b", "0");
    addProp(run, "bCs", "0");
    addProp(run, "i", "0");
    addProp(run, "iCs", "0");
    addProp(run, "u", "none");
    addProp(run, "color", "auto");
}

function setBold(run) {
    removeProps(run, ["b", "bCs"]);
    addProp(run, "b", "1");
    addProp(run, "bCs", "1");
}

function setTextNode(textNode, text) {
    textNode.textContent = text;
    textNode.removeAttributeNS(XML_NS, "space");
    textNode.removeAttribute("xml:space");
    if (/^\s|\s$/.test(text)) textNode.setAttributeNS(XML_NS, "xml:space", "preserve");
}

function directRunText(run) {
    const tNodes = run.getElementsByTagNameNS(W_NS, "t");
    let text = "";
    for (let i = 0; i < tNodes.length; i++) text += tNodes[i].textContent || "";
    return text;
}

function boldChoiceLabelInRun(run) {
    const text = directRunText(run);
    const match = text.match(/^(\s*[A-D]\s*[\.\:\)]\s*)(.*)$/s);
    if (!match) return false;

    const labelText = match[1];
    const rest = match[2];
    const tNodes = run.getElementsByTagNameNS(W_NS, "t");

    if (!rest.trim()) {
        setBold(run);
        return true;
    }

    // Trường hợp phổ biến: A. và nội dung nằm chung một w:t.
    if (tNodes.length === 1 && run.parentNode) {
        const labelRun = run.cloneNode(true);
        const labelT = labelRun.getElementsByTagNameNS(W_NS, "t")[0];
        setTextNode(labelT, labelText);
        setNormalAnswerRun(labelRun);
        setBold(labelRun);

        setTextNode(tNodes[0], rest);
        setNormalAnswerRun(run);
        run.parentNode.insertBefore(labelRun, run);
        return true;
    }

    // Nếu nhãn đã nằm ở run riêng, chỉ bold run đó.
    const firstText = tNodes[0]?.textContent || "";
    if (/^\s*[A-D]\s*[\.\:\)]\s*$/.test(firstText)) {
        setBold(run);
        return true;
    }

    return false;
}

function normalizeAnswerParagraph(pNode) {
    const runs = Array.from(pNode.getElementsByTagNameNS(W_NS, "r"));
    runs.forEach(setNormalAnswerRun);

    // Snapshot mới sau khi có thể split run.
    const after = Array.from(pNode.getElementsByTagNameNS(W_NS, "r"));
    after.forEach(boldChoiceLabelInRun);
}

function ensureBold(run) {
    setBold(run);
}

function getDirectRunsWithText(pNode) {
    const result = [];
    for (const node of Array.from(pNode.childNodes || [])) {
        if (node.nodeType !== 1 || !(node.localName === "r" || node.nodeName === "w:r")) continue;
        const text = directRunText(node);
        if (text) result.push({ runNode: node, text });
    }
    return result;
}

function setRunText(run, text) {
    const tNodes = run.getElementsByTagNameNS(W_NS, "t");
    if (tNodes.length !== 1) return false;
    setTextNode(tNodes[0], text);
    return true;
}

function boldQuestionLabel(paragraph) {
    const runsInfo = getDirectRunsWithText(paragraph);
    if (runsInfo.length === 0) return;

    const combined = runsInfo.map(item => item.text).join("");
    const match = combined.match(/^\s*(?:(?:Câu|Question)\s*\d+|Q\s*\d+)[\.\:\)]?/i);
    if (!match) return;

    const labelEnd = match[0].length;
    let offset = 0;

    for (const item of runsInfo) {
        const run = item.runNode;
        const text = item.text;
        const start = offset;
        const end = offset + text.length;
        offset = end;

        if (end <= labelEnd) {
            ensureBold(run);
            continue;
        }
        if (start >= labelEnd) break;

        const splitIndex = labelEnd - start;
        const tNodes = run.getElementsByTagNameNS(W_NS, "t");
        if (tNodes.length !== 1 || splitIndex <= 0 || splitIndex >= text.length) break;

        const labelRun = run.cloneNode(true);
        if (!setRunText(labelRun, text.slice(0, splitIndex))) break;
        ensureBold(labelRun);
        if (!setRunText(run, text.slice(splitIndex))) break;
        paragraph.insertBefore(labelRun, run);
        break;
    }
}

export function formatExamDocument(nodes) {
    if (!Array.isArray(nodes)) return nodes;

    for (const node of nodes) {
        if (!node || typeof node.getElementsByTagNameNS !== "function") continue;

        const paragraphs = [];
        if (node.nodeType === 1 && (node.localName === "p" || node.nodeName === "w:p")) paragraphs.push(node);

        const nested = node.getElementsByTagNameNS(W_NS, "p");
        for (let i = 0; i < nested.length; i++) {
            if (!paragraphs.includes(nested[i])) paragraphs.push(nested[i]);
        }

        for (const p of paragraphs) {
            if (isAnswerParagraph(p)) normalizeAnswerParagraph(p);
            else boldQuestionLabel(p);
        }
    }
    return nodes;
}

export function removeAnswerUnderline(nodes) { return formatExamDocument(nodes); }
export function removeAnswerRedColor(nodes) { return formatExamDocument(nodes); }
export function removeAnswerColor(nodes) { return formatExamDocument(nodes); }
export function formatLabelsInParagraphs(nodes) { return formatExamDocument(nodes); }
export function boldQuestionLabels(nodes) { return formatExamDocument(nodes); }
export function boldChoiceLabels(nodes) { return formatExamDocument(nodes); }
