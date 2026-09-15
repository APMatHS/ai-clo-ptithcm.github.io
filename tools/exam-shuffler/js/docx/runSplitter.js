/* =====================================================
   runSplitter.js
   Exam Shuffler v2.0

   Chức năng:
   - Tách Run XML mà vẫn giữ nguyên định dạng Word.
   - Dùng để Bold riêng "Câu n." và "A/B/C/D".
===================================================== */

const W_NS =
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Clone Run nhưng chỉ thay đổi Text
 */
function cloneRunWithText(runNode, text) {
    const clone = runNode.cloneNode(true);

    const tNodes = clone.getElementsByTagNameNS(W_NS, "t");

    if (tNodes.length === 0) {
        return clone;
    }

    // Xóa toàn bộ Text cũ
    while (tNodes.length > 1) {
        tNodes[1].parentNode.removeChild(tNodes[1]);
    }

    tNodes[0].textContent = text;

    if (
        text.startsWith(" ") ||
        text.endsWith(" ")
    ) {
        tNodes[0].setAttributeNS(
            "http://www.w3.org/XML/1998/namespace",
            "xml:space",
            "preserve"
        );
    } else {
        tNodes[0].removeAttribute("xml:space");
    }

    return clone;
}

/**
 * Lấy Text của Run
 */
function getRunText(runNode) {
    const tNodes = runNode.getElementsByTagNameNS(W_NS, "t");

    let text = "";

    for (let i = 0; i < tNodes.length; i++) {
        text += tNodes[i].textContent || "";
    }

    return text;
}

/**
 * Tách một Run tại vị trí ký tự offset
 *
 * Ví dụ:
 * Run = "Câu 1. (CLO1)"
 * offset = 6
 *
 * =>
 * Run1 = "Câu 1."
 * Run2 = " (CLO1)"
 */
export function splitRun(runNode, offset) {
    if (!runNode) {
        return [null, null];
    }

    const text = getRunText(runNode);

    if (text.length === 0) {
        return [runNode, null];
    }

    if (offset <= 0 || offset >= text.length) {
        return [runNode, null];
    }

    const leftText = text.substring(0, offset);
    const rightText = text.substring(offset);

    const leftRun = cloneRunWithText(runNode, leftText);
    const rightRun = cloneRunWithText(runNode, rightText);

    const parent = runNode.parentNode;

    parent.insertBefore(leftRun, runNode);
    parent.insertBefore(rightRun, runNode);
    parent.removeChild(runNode);

    return [leftRun, rightRun];
}

/**
 * Thêm Bold vào một Run
 */
export function applyBold(runNode) {
    if (!runNode) return;

    const doc = runNode.ownerDocument;

    let rPr = runNode.getElementsByTagNameNS(W_NS, "rPr")[0];

    if (!rPr) {
        rPr = doc.createElementNS(W_NS, "w:rPr");
        runNode.insertBefore(rPr, runNode.firstChild);
    }

    let b = rPr.getElementsByTagNameNS(W_NS, "b")[0];

    if (!b) {
        b = doc.createElementNS(W_NS, "w:b");
        rPr.appendChild(b);
    }
}

