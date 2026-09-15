/* =====================================================
   cloStatisticsExporter.js v1.1
   - Sheet "Phân bố CLO".
   - Liệt kê số câu thuộc từng CLO theo từng mã đề.
   - Chuẩn nhãn: CLO1, CLO2, ...
===================================================== */

function cloLabel(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return /^CLO/i.test(raw) ? raw.replace(/\s+/g, "") : `CLO${raw}`;
}

function cloNumber(value) {
    const m = cloLabel(value).match(/(\d+)/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

export function exportCLOStatistics(worksheet, exams) {
    if (!worksheet || !Array.isArray(exams)) return;

    const cloSet = new Set();
    exams.forEach(exam => {
        (exam.questions || []).forEach(q => {
            const label = cloLabel(q.clo);
            if (label) cloSet.add(label);
        });
    });

    const cloList = [...cloSet].sort((a, b) => cloNumber(a) - cloNumber(b) || a.localeCompare(b, "vi"));

    worksheet.addRow(["CLO", ...exams.map(exam => `Đề ${exam.examCode}`)]);

    cloList.forEach(clo => {
        const row = [clo];
        exams.forEach(exam => {
            const questionNumbers = (exam.questions || [])
                .filter(q => cloLabel(q.clo) === clo)
                .map(q => q.number)
                .join(", ");
            row.push(questionNumbers);
        });
        worksheet.addRow(row);
    });
}
