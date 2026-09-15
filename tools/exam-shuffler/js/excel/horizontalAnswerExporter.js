/* =====================================================
   horizontalAnswerExporter.js v1.2
   - Sheet "Đáp án ngang" là chuyển vị đúng nghĩa của sheet "Đáp án".
   - Không thêm cột/trường mới.
===================================================== */

export function exportHorizontalAnswers(worksheet, exams) {
    if (!worksheet || !Array.isArray(exams) || exams.length === 0) return;

    const questionCount = exams[0].questions?.length ?? 0;

    worksheet.addRow([
        "Câu",
        ...Array.from({ length: questionCount }, (_, i) => i + 1)
    ]);

    exams.forEach(exam => {
        const questions = exam.questions || [];
        worksheet.addRow([
            String(exam.examCode ?? ""),
            ...questions.map(q => String(q.correct ?? "").trim().toUpperCase())
        ]);
        worksheet.addRow([
            "CLO",
            ...questions.map(q => q.clo != null && String(q.clo).trim() !== ""
                ? `CLO${String(q.clo).replace(/^CLO\s*/i, "").trim()}`
                : "")
        ]);
    });
}
