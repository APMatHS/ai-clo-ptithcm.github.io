/* =====================================================
   validator.js v2.1
   - CLO không bắt buộc.
   - Kiểm tra số câu, đáp án, 4 lựa chọn và ánh xạ câu gốc.
===================================================== */

const LABELS = ["A", "B", "C", "D"];

function countByCLO(questions) {
    const map = {};
    questions.forEach(q => {
        if (!q.clo) return;
        map[q.clo] = (map[q.clo] || 0) + 1;
    });
    return map;
}

export function validateExam(exam, options = {}) {
    const {
        expectedQuestionCount = null,
        expectedCLO = null,
        answerKey = null
    } = options;

    const errors = [];
    const questions = exam.questions ?? [];

    if (expectedQuestionCount !== null && questions.length !== expectedQuestionCount) {
        errors.push(`Expected ${expectedQuestionCount} questions, found ${questions.length}.`);
    }

    const sourceIndexes = questions.map(q => q.sourceIndex).filter(Number.isInteger);
    const duplicateSource = sourceIndexes.filter((n, i) => sourceIndexes.indexOf(n) !== i);
    if (duplicateSource.length > 0) {
        errors.push(`Duplicate source questions: ${[...new Set(duplicateSource)].join(", ")}`);
    }

    if (expectedQuestionCount !== null && sourceIndexes.length === questions.length) {
        for (let i = 1; i <= expectedQuestionCount; i++) {
            if (!sourceIndexes.includes(i)) errors.push(`Missing source question: ${i}`);
        }
    }

    questions.forEach((q, index) => {
        if (!LABELS.includes(q.correct)) {
            errors.push(`Question ${index + 1}: Invalid correct answer`);
        }

        if (!Array.isArray(q.choices) || q.choices.length !== 4) {
            errors.push(`Question ${index + 1}: Must have exactly 4 choices`);
            return;
        }

        const correctCount = q.choices.filter(c => c.correct).length;
        if (correctCount !== 1) {
            errors.push(`Question ${index + 1}: Expected exactly one correct choice`);
        }

        const labels = q.choices.map(c => c.label);
        LABELS.forEach(label => {
            if (!labels.includes(label)) errors.push(`Question ${index + 1}: Missing choice ${label}`);
        });
    });

    if (expectedCLO) {
        const actual = countByCLO(questions);
        Object.keys(expectedCLO).forEach(clo => {
            if ((actual[clo] || 0) !== expectedCLO[clo]) {
                errors.push(`CLO ${clo}: expected ${expectedCLO[clo]}, found ${actual[clo] || 0}`);
            }
        });
    }

    if (Array.isArray(answerKey)) {
        answerKey.forEach((row, i) => {
            if (!questions[i]) return;
            if (row.answer !== questions[i].correct) errors.push(`AnswerKey mismatch at question ${i + 1}`);
        });
    }

    return { valid: errors.length === 0, totalErrors: errors.length, errors };
}

export function validateExamSet(exams, options = {}) {
    return exams.map(exam => ({ examCode: exam.examCode, ...validateExam(exam, options) }));
}
