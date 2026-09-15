/* =====================================================
   bmFormsExporter.js v2.1
   Xuất BM06 khung trống và BM08 theo mẫu PTIT.
   Phần thông tin/chữ ký dùng tab stop, không dùng bảng.
===================================================== */

const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

function run(text, { bold = false, italic = false, underline = false, size = 24 } = {}) {
    return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${bold ? "<w:b/><w:bCs/>" : ""}${italic ? "<w:i/><w:iCs/>" : ""}${underline ? '<w:u w:val="single"/>' : ""}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

const tabRun = () => "<w:r><w:tab/></w:r>";
const breakRun = () => "<w:r><w:br/></w:r>";

function tabsXml(tabs = []) {
    if (!tabs.length) return "";
    return `<w:tabs>${tabs.map(({ pos, val = "left" }) => `<w:tab w:val="${val}" w:pos="${pos}"/>`).join("")}</w:tabs>`;
}

function paragraph(content, { align = "left", before = 0, after = 0, line = 240, tabs = [], keepNext = false } = {}) {
    return `<w:p><w:pPr><w:jc w:val="${align}"/>${tabsXml(tabs)}<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${content}</w:p>`;
}

function p(text, options = {}) {
    const { bold = false, italic = false, underline = false, size = 24, ...paragraphOptions } = options;
    const content = String(text ?? "").split("\n").map((part, index) => `${index ? breakRun() : ""}${run(part, { bold, italic, underline, size })}`).join("");
    return paragraph(content, paragraphOptions);
}

function pRuns(runs, options = {}) {
    return paragraph(runs.map(item => item.tab ? tabRun() : run(item.text, item)).join(""), options);
}

function cell(body, { bold = false, width = 1600, align = "center", span = 1, vMerge = "", size = 24 } = {}) {
    const content = String(body || "").startsWith("<w:p") ? body : p(body, { bold, align, size, line: 230 });
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${vMerge ? `<w:vMerge${vMerge === "restart" ? ' w:val="restart"' : ""}/>` : ""}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="35" w:type="dxa"/><w:left w:w="45" w:type="dxa"/><w:bottom w:w="35" w:type="dxa"/><w:right w:w="45" w:type="dxa"/></w:tcMar></w:tcPr>${content}</w:tc>`;
}

function row(cells, { header = false, height = 0 } = {}) {
    return `<w:tr><w:trPr>${header ? "<w:tblHeader/>" : ""}<w:cantSplit/>${height ? `<w:trHeight w:val="${height}" w:hRule="atLeast"/>` : ""}</w:trPr>${cells.join("")}</w:tr>`;
}

function table(rows, widths) {
    const total = widths.reduce((sum, width) => sum + width, 0);
    const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
        .map(name => `<w:${name} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`).join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

function styles() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
}

async function makeDocx(body, { pageWidth = 11907, pageHeight = 16840, marginTop = 425, marginRight = 1134, marginBottom = 425, marginLeft = 1134 } = {}) {
    if (typeof JSZip === "undefined") throw new Error("Không tải được JSZip để tạo BM06/BM08.");
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"/><w:pgMar w:top="${marginTop}" w:right="${marginRight}" w:bottom="${marginBottom}" w:left="${marginLeft}" w:header="360" w:footer="360"/></w:sectPr></w:body></w:document>`;
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
    zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.folder("word").file("document.xml", documentXml).file("styles.xml", styles());
    zip.folder("word").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function normClo(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return /^CLO/i.test(text) ? text.toUpperCase().replace(/\s+/g, "") : `CLO${text}`;
}

function viDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
}

function dateWords(value, city = "TPHCM") {
    if (!value) return `${city}, ngày  ..... tháng  ..... năm 20...`;
    const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return `${city}, ngày  ..... tháng  ..... năm 20...`;
    return `${city}, ngày ${String(date.getDate()).padStart(2, "0")} tháng ${String(date.getMonth() + 1).padStart(2, "0")} năm ${date.getFullYear()}`;
}

function decimal(value, digits = 2) {
    return Number(value.toFixed(digits)).toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits === 1 ? 1 : 0 });
}

function unitLabel(prefix, value, fallback) {
    const text = String(value || fallback).trim();
    return new RegExp(`^${prefix}\\s*:`, "i").test(text) ? text : `${prefix}: ${text.replace(new RegExp(`^${prefix}\\s+`, "i"), "")}`;
}

function parseCloDescriptions(value) {
    const descriptions = {};
    String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach((line, index) => {
        const divider = line.indexOf("|");
        if (divider < 0) throw new Error(`Dòng mô tả CLO ${index + 1} phải có dạng: CLO1 | Nội dung.`);
        descriptions[normClo(line.slice(0, divider))] = line.slice(divider + 1).trim();
    });
    return descriptions;
}

function bm06Header(metadata, examCode) {
    const leftCenter = 2300;
    const rightCenter = 7900;
    return [
        pRuns([{ tab: true }, { text: unitLabel("KHOA", metadata.faculty, "CƠ BẢN 2"), size: 24 }, { tab: true }, { text: "Biểu mẫu BM06", bold: true, size: 24 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }], line: 240 }),
        pRuns([{ tab: true }, { text: unitLabel("BỘ MÔN", metadata.department, "TOÁN"), bold: true, underline: true, size: 24 }, { tab: true }, { text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, size: 24 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }], line: 240 }),
        pRuns([{ tab: true }, { text: "Độc lập - Tự do - Hạnh phúc", bold: true, underline: true, size: 24 }], { tabs: [{ pos: rightCenter, val: "center" }], line: 240 }),
        pRuns([{ tab: true }, { text: dateWords(metadata.signedDate, "TPHCM"), italic: true, size: 24 }], { tabs: [{ pos: rightCenter, val: "center" }], before: 120, after: 180 }),
        p(`MA TRẬN ĐỀ THI – ĐỀ ${examCode || ""}`, { align: "center", bold: true, size: 30, after: 100 })
    ].join("");
}

function bm06Info(metadata) {
    const mid = 4000;
    return [
        pRuns([{ text: "Kỳ thi: ", bold: true }, { text: metadata.semester ? `Học kỳ ${metadata.semester}` : "" }, { tab: true }, { text: "Năm học: ", bold: true }, { text: metadata.academicYear || "" }, { tab: true }, { text: "Lớp: ", bold: true }, { text: metadata.className || "" }], { tabs: [{ pos: 2600 }, { pos: 5200 }], line: 240 }),
        pRuns([{ text: "Chương trình đào tạo đại học ngành: ", bold: true }, { text: metadata.trainingProgram || "" }]),
        pRuns([{ text: "Tên học phần: ", bold: true }, { text: metadata.subject || "" }]),
        pRuns([{ text: "Mã học phần: ", bold: true }, { text: metadata.courseCode || "" }, { tab: true }, { text: "Số tín chỉ: ", bold: true }, { text: metadata.credits || "" }], { tabs: [{ pos: mid }] }),
        pRuns([{ text: "Ngày thi: ", bold: true }, { text: viDate(metadata.examDate) }, { tab: true }, { text: "Ca thi: ", bold: true }, { text: metadata.examSession || "" }, { tab: true }, { text: "Thời gian làm bài thi: ", bold: true }, { text: metadata.durationMinutes ? `${metadata.durationMinutes} phút` : "" }], { tabs: [{ pos: 2900 }, { pos: 5000 }], after: 50 })
    ].join("");
}

function buildBM06Body(firstExam, metadata = {}) {
    const widths = [2500, 1600, 1600, 1600, 1600, 1780];
    const rows = [
        row([
            cell("Tên chương/\nbài/chủ đề", { width: widths[0], bold: true, vMerge: "restart" }),
            cell("Phân phối tỉ lệ", { width: widths[1], bold: true, vMerge: "restart" }),
            cell("Số câu hỏi giữa các mức độ tư duy", { width: widths[2] + widths[3] + widths[4], bold: true, span: 3 }),
            cell("Cộng\n(%)", { width: widths[5], bold: true, vMerge: "restart" })
        ], { header: true }),
        row([
            cell("", { width: widths[0], vMerge: "continue" }),
            cell("", { width: widths[1], vMerge: "continue" }),
            cell("CLO1\n(%)", { width: widths[2], bold: true }),
            cell("CLO2\n(%)", { width: widths[3], bold: true }),
            cell("CLO3\n(%)", { width: widths[4], bold: true }),
            cell("", { width: widths[5], vMerge: "continue" })
        ], { header: true }),
        row(["(1)", "(4)", "(2)", "(3)", "(6)", "(6)"].map((text, index) => cell(text, { width: widths[index] })), { header: true })
    ];
    for (let index = 0; index < 6; index++) rows.push(row(widths.map(width => cell("", { width })), { height: 620 }));
    rows.push(row([cell("TỔNG CỘNG:", { width: widths[0], bold: true }), ...widths.slice(1).map(width => cell("", { width }))], { height: 520 }));
    const signatureCenter = 7900;
    return [
        bm06Header(metadata, firstExam?.examCode || ""),
        bm06Info(metadata),
        table(rows, widths),
        pRuns([{ tab: true }, { text: "TRƯỞNG BỘ MÔN", bold: true, size: 24 }], { tabs: [{ pos: signatureCenter, val: "center" }], before: 100 }),
        pRuns([{ tab: true }, { text: metadata.approvedBy || "", bold: true, size: 24 }], { tabs: [{ pos: signatureCenter, val: "center" }], before: 720 })
    ].join("");
}

function bm08Header(metadata, examCode) {
    const leftCenter = 2600;
    const rightCenter = 7600;
    return [
        pRuns([{ tab: true }, { text: "HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG", size: 22 }, { tab: true }, { text: "Mẫu BM08", bold: true, size: 24 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }], line: 220 }),
        pRuns([{ tab: true }, { text: "CƠ SỞ TẠI THÀNH PHỐ HỒ CHÍ MINH", size: 22 }, { tab: true }, { text: "ĐỀ THI KẾT THÚC HỌC PHẦN", bold: true, size: 28 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }], line: 240 }),
        pRuns([{ tab: true }, { text: unitLabel("KHOA", metadata.faculty, "CƠ BẢN 2"), bold: true, size: 22 }], { tabs: [{ pos: leftCenter, val: "center" }] }),
        pRuns([{ tab: true }, { text: unitLabel("BỘ MÔN", metadata.department, "TOÁN"), bold: true, underline: true, size: 22 }], { tabs: [{ pos: leftCenter, val: "center" }], after: 80 }),
        p(`Mẫu đáp án/hướng dẫn chấm  - Đề ${examCode || ""}`, { align: "center", bold: true, size: 30, after: 80 })
    ].join("");
}

function bm08Info(metadata) {
    const right = 5000;
    return [
        pRuns([{ text: "Tên học phần: ", bold: true }, { text: metadata.subject || "" }, { tab: true }, { text: "Mã học phần: ", bold: true }, { text: metadata.courseCode || "" }], { tabs: [{ pos: right }] }),
        pRuns([{ text: "Số tín chỉ: ", bold: true }, { text: metadata.credits || "" }, { tab: true }, { text: "Học kỳ/Năm học: ", bold: true }, { text: `${metadata.semester || ""}${metadata.semester || metadata.academicYear ? "/" : ""}${metadata.academicYear || ""}` }], { tabs: [{ pos: right }] }),
        pRuns([{ text: "Giảng viên ra đề: ", bold: true }, { text: metadata.preparedBy || "" }, { tab: true }, { text: "Ngày thi: ", bold: true }, { text: viDate(metadata.examDate) }, { tab: true }, { text: "Ca thi: ", bold: true }, { text: metadata.examSession || "" }], { tabs: [{ pos: right }, { pos: 7900 }] }),
        pRuns([{ text: "Hình thức thi: ", bold: true }, { text: metadata.examFormat || "Trắc nghiệm" }, { tab: true }, { text: "Thời gian: ", bold: true }, { text: metadata.durationMinutes ? `${metadata.durationMinutes} phút` : "" }], { tabs: [{ pos: right }], after: 40 })
    ].join("");
}

function buildBM08Body(exam, metadata = {}) {
    const questions = exam?.questions || [];
    const total = questions.length || 1;
    const point = 10 / total;
    const descriptions = parseCloDescriptions(metadata.cloDescriptions);
    const output = [
        bm08Header(metadata, exam?.examCode || ""),
        bm08Info(metadata),
        p("1. Đáp án & Thang điểm", { bold: true, keepNext: true }),
        p(`Đề gồm ${questions.length} câu, mỗi câu ${decimal(point)} điểm.`, { keepNext: true })
    ];

    for (let start = 0; start < questions.length; start += 15) {
        const part = questions.slice(start, start + 15);
        const labelWidth = 850;
        const answerWidth = Math.floor((9630 - labelWidth) / part.length);
        const widths = [labelWidth, ...part.map(() => answerWidth)];
        output.push(table([
            row([cell("Câu", { width: labelWidth }), ...part.map((_, index) => cell(String(start + index + 1), { width: answerWidth }))]),
            row([cell("Đáp án", { width: labelWidth }), ...part.map(question => cell(String(question.correct || "").toUpperCase(), { width: answerWidth }))])
        ], widths));
    }

    output.push(p("2. Phiếu chấm theo CLO", { bold: true, before: 40, after: 20, keepNext: true }));
    const cloWidths = [800, 3000, 1850, 1050, 950, 1050, 950];
    const cloValues = [...new Set(questions.map(question => normClo(question.clo)).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    const cloRows = [row([
        cell("CLO", { width: cloWidths[0], bold: true }),
        cell("Nội dung đánh giá", { width: cloWidths[1], bold: true }),
        cell("Câu hỏi liên\nquan", { width: cloWidths[2], bold: true }),
        cell("Trọng số (%)", { width: cloWidths[3], bold: true }),
        cell("Điểm tối\nđa", { width: cloWidths[4], bold: true }),
        cell("Điểm đạt\nđược", { width: cloWidths[5], bold: true }),
        cell("Nhận\nxét", { width: cloWidths[6], bold: true })
    ], { header: true })];

    for (const clo of cloValues) {
        const numbers = questions.map((question, index) => normClo(question.clo) === clo ? index + 1 : null).filter(Boolean);
        cloRows.push(row([
            cell(clo, { width: cloWidths[0] }),
            cell(descriptions[clo] || "", { width: cloWidths[1] }),
            cell(numbers.map(number => `Câu ${number}`).join(", "), { width: cloWidths[2] }),
            cell(`${decimal(numbers.length * 100 / total, 0)}%`, { width: cloWidths[3] }),
            cell(decimal(numbers.length * point, 1), { width: cloWidths[4] }),
            cell("…", { width: cloWidths[5] }),
            cell("…", { width: cloWidths[6] })
        ], { height: 520 }));
    }
    output.push(table(cloRows, cloWidths));
    output.push(p("Tổng điểm: …/10", { align: "center", bold: true, after: 40 }));
    output.push(p("3. Ghi chú cho giảng viên chấm thi", { bold: true, keepNext: true }));
    output.push(p("•     Chấm theo ý, không trừ điểm kiểu “lỗi chính tả” nếu không làm sai lệch nội dung.\n•     Với ý trả lời tương đương (không giống đáp án nhưng đúng bản chất), giảng viên cho điểm tương ứng.\n•     Điểm làm tròn đến 0,1.", { line: 240 }));

    const leftCenter = 2600;
    const rightCenter = 7600;
    output.push(pRuns([{ tab: true }, { text: dateWords(metadata.signedDate, "TPHCM"), italic: true, size: 24 }], { tabs: [{ pos: rightCenter, val: "center" }], before: 80 }));
    output.push(pRuns([{ tab: true }, { text: "TRƯỞNG BỘ MÔN DUYỆT", bold: true, size: 24 }, { tab: true }, { text: "GIẢNG VIÊN RA ĐỀ", bold: true, size: 24 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }] }));
    output.push(pRuns([{ tab: true }, { text: "(ký và ghi rõ họ tên)", italic: true, size: 24 }, { tab: true }, { text: "(ký và ghi rõ họ tên)", italic: true, size: 24 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }] }));
    output.push(pRuns([{ tab: true }, { text: metadata.approvedBy || "", size: 24 }, { tab: true }, { text: metadata.preparedBy || "", size: 24 }], { tabs: [{ pos: leftCenter, val: "center" }, { pos: rightCenter, val: "center" }], before: 720 }));
    return output.join("");
}

export async function exportBMForms(exams, metadata = {}) {
    if (!Array.isArray(exams) || !exams.length) return [];
    const documents = [{
        name: "BM06_Ma_tran_de_thi.docx",
        blob: await makeDocx(buildBM06Body(exams[0], metadata), {
            pageWidth: 12240,
            pageHeight: 15840,
            marginTop: 700,
            marginRight: 1440,
            marginBottom: 700,
            marginLeft: 1440
        })
    }];
    for (const exam of exams) {
        documents.push({ name: `BM08_${exam.examCode}.docx`, blob: await makeDocx(buildBM08Body(exam, metadata)) });
    }
    return documents;
}
