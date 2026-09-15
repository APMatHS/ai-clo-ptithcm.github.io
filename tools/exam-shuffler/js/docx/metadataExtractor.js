/* =====================================================
   metadataExtractor.js v1.1
   Đọc phần trước Câu 1 và suy ra các trường hồ sơ BM06/BM08.
===================================================== */

import { readDocx } from "./docxReader.js";
import { loadDocument, getDocumentBody } from "./docxWriter.js";
import { splitQuestions } from "./questionSplitter.js";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function nodeText(node) {
    if (!node?.getElementsByTagNameNS) return "";
    const texts = node.getElementsByTagNameNS(W_NS, "t");
    let out = "";
    for (let i = 0; i < texts.length; i++) out += texts[i].textContent || "";
    return out.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function allHeaderText(nodes) {
    return (nodes || []).map(nodeText).filter(Boolean).join("\n");
}

function take(text, patterns) {
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) return m[1].trim().replace(/[;,.]+$/, "");
    }
    return "";
}

function normalizeDate(value) {
    const s = String(value || "").trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
    m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
    return s;
}

export function inferMetadataFromText(text) {
    const src = String(text || "");
    const subject = take(src, [/(?:Tên\s*học\s*phần|Học\s*phần|Môn(?:\s*học)?)[\s:.-]+([^\n]+?)(?=\s+(?:Mã\s*học\s*phần|Mã\s*HP|Mã\s*môn|Số\s*tín\s*chỉ|Học\s*kỳ|Ngày\s*thi|Ca\s*thi|Thời\s*gian)|$)/i]);
    const courseCode = take(src, [/(?:Mã\s*học\s*phần|Mã\s*HP|Mã\s*môn)[\s:.-]+([A-Za-z0-9._-]+)/i]);
    const credits = take(src, [/(?:Số\s*tín\s*chỉ|Tín\s*chỉ)[\s:.-]+([0-9]+(?:[.,][0-9]+)?)/i]);
    const semester = take(src, [/(?:Học\s*kỳ|HK)[\s:.-]+([^\n]+?)(?=\s+(?:Năm\s*học|Lớp|Mã\s*học\s*phần|Ngày\s*thi)|$)/i]);
    const academicYear = take(src, [/(?:Năm\s*học)[\s:.-]+([^\s\n,;]+)/i]);
    const className = take(src, [/(?:Lớp)[\s:.-]+([^\n]+?)(?=\s+(?:Chương\s*trình|Tên\s*học\s*phần|Mã\s*học\s*phần)|$)/i]);
    const trainingProgram = take(src, [/(?:Chương\s*trình\s*đào\s*tạo(?:\s*đại\s*học)?(?:\s*ngành)?)[\s:.-]+([^\n]+)/i]);
    const faculty = take(src, [/^\s*(KHOA\s+[^\n]+)/im]);
    const department = take(src, [/^\s*(BỘ\s*MÔN\s+[^\n]+)/im]);
    const examDate = normalizeDate(take(src, [/(?:Ngày\s*thi|Ngày)[\s:.-]+(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})/i]));
    const examSession = take(src, [/(?:Ca\s*thi|Ca)[\s:.-]+([^\s\n,;.]+)/i]);
    const duration = take(src, [/(?:Thời\s*gian(?:\s*làm\s*bài(?:\s*thi)?)?)[\s:.-]+(\d{1,3})\s*(?:phút|phut)?/i]);
    const examFormat = take(src, [/(?:Hình\s*thức\s*thi)[\s:.-]+([^\n]+)/i]);
    const preparedBy = take(src, [/(?:Giảng\s*viên\s*ra\s*đề|Người\s*ra\s*đề)[\s:.-]+([^\n]+)/i]);
    const approvedBy = take(src, [/(?:Trưởng\s*bộ\s*môn|Người\s*duyệt|Phê\s*duyệt)[\s:.-]+([^\n]+)/i]);

    return {
        subject,
        courseCode,
        credits,
        semester,
        academicYear,
        className,
        trainingProgram,
        faculty,
        department,
        examDate,
        examSession,
        durationMinutes: duration ? Number(duration) : "",
        examFormat,
        preparedBy,
        approvedBy,
        rawHeaderText: src
    };
}

export async function inferMetadataFromFile(file, expectedQuestionCount) {
    const zip = await readDocx(file);
    const xmlDoc = await loadDocument(zip);
    const body = getDocumentBody(xmlDoc);
    const split = splitQuestions(body, Number(expectedQuestionCount));
    const rawHeaderText = allHeaderText(split.headerNodes || []);
    return inferMetadataFromText(rawHeaderText);
}
