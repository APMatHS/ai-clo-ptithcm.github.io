/* =====================================================
   answerKey.js
   Exam Shuffler v1.0

   Chức năng:
   - Sinh bảng đáp án
   - Xuất dữ liệu phục vụ Excel, QR
===================================================== */

/* =====================================================
   Sinh đáp án cho 1 mã đề
===================================================== */

export function buildAnswerKey(exam) {

    return exam.questions.map((question, index) => ({

        examCode: exam.examCode,

        question: index + 1,

        originalQuestion: question.number,

        clo: question.clo,

        answer: question.correct

    }));

}

/* =====================================================
   Sinh đáp án cho nhiều mã đề
===================================================== */

export function buildAnswerKeys(exams) {

    return exams.map(exam => ({

        examCode: exam.examCode,

        answers: buildAnswerKey(exam)

    }));

}