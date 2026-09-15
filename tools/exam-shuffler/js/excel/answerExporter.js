/* =====================================================
   answerExporter.js
   Canonical vertical answer sheet for cham-thi-clo.
===================================================== */

export function exportAnswers(worksheet, exams) {
    if (!worksheet) throw new Error("[answerExporter] Worksheet không được để trống.");
    if (!Array.isArray(exams) || exams.length === 0) throw new Error("[answerExporter] Danh sách bộ đề rỗng hoặc không hợp lệ.");
    const questionCount = validateAndGetQuestionCount(exams);
    writeHeader(worksheet, exams);
    writeQuestionNumbers(worksheet, questionCount);
    writeAnswerData(worksheet, exams);
}

function validateAndGetQuestionCount(exams) {
    const firstExamCount = exams[0].questions?.length ?? 0;
    if (firstExamCount === 0) throw new Error(`[answerExporter] Đề số ${exams[0].examCode} không chứa câu hỏi nào.`);
    for (let i = 1; i < exams.length; i++) {
        const currentCount = exams[i].questions?.length ?? 0;
        if (currentCount !== firstExamCount) {
            throw new Error(`[answerExporter] Không đồng nhất số câu: ${exams[0].examCode} có ${firstExamCount}, ${exams[i].examCode} có ${currentCount}.`);
        }
    }
    return firstExamCount;
}

function writeHeader(worksheet, exams) {
    const headerRow = worksheet.getRow(1);
    headerRow.getCell(1).value = "Câu";
    exams.forEach((exam, index) => {
        const codeColIndex = 2 + index * 2;
        headerRow.getCell(codeColIndex).value = exam.examCode ?? "";
        headerRow.getCell(codeColIndex + 1).value = "CLO";
    });
}

function writeQuestionNumbers(worksheet, questionCount) {
    for (let qIndex = 0; qIndex < questionCount; qIndex++) worksheet.getRow(2 + qIndex).getCell(1).value = qIndex + 1;
}

function cloLabel(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return /^CLO/i.test(raw) ? raw.replace(/\s+/g, "") : `CLO${raw}`;
}

function writeAnswerData(worksheet, exams) {
    exams.forEach((exam, examIndex) => {
        const codeColIndex = 2 + examIndex * 2;
        const cloColIndex = codeColIndex + 1;
        (exam.questions ?? []).forEach((q, qIndex) => {
            const row = worksheet.getRow(2 + qIndex);
            row.getCell(codeColIndex).value = q.correct != null ? String(q.correct).trim().toUpperCase() : "";
            row.getCell(cloColIndex).value = cloLabel(q.clo);
        });
    });
}
