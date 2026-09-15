/* =====================================================
   choiceShuffle.js
   Exam Shuffler v2.0

   Chức năng:
   - Trộn thứ tự các lựa chọn (A, B, C, D) cho từng câu hỏi.
   - Cập nhật lại nhãn hiển thị và vị trí đáp án đúng mới.
   - Tuân thủ kiến trúc pipeline: Chỉ thao tác Shallow Copy, 
     không gọi structuredClone() trên DOM Nodes.
===================================================== */

const LABELS = ["A", "B", "C", "D"];

/**
 * Fisher-Yates Shuffle cho mảng các lựa chọn
 * @param {Array} choices - Mảng các lựa chọn
 * @returns {Array} Mảng nông đã hoán vị vị trí
 */
function shuffleChoicesArray(choices) {
    if (!Array.isArray(choices)) return [];

    const shuffled = [...choices];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Xáo trộn phương án lựa chọn A/B/C/D cho 1 câu hỏi
 * @param {Object} question - Đối tượng câu hỏi
 * @returns {Object} Đối tượng câu hỏi mới chứa danh sách choices đã xáo trộn
 */
export function shuffleChoices(question) {
    if (!question || !Array.isArray(question.choices) || question.choices.length === 0) {
        return question;
    }

    // Shallow copy đối tượng câu hỏi
    const newQuestion = { ...question };

    // Hoán vị mảng choices (shallow copy)
    const shuffledChoices = shuffleChoicesArray(question.choices).map((choice, index) => ({
        ...choice,
        label: LABELS[index] ?? choice.label // Gán lại A, B, C, D theo vị trí mới
    }));

    // Tìm phương án đúng sau khi hoán vị
    const correctChoice = shuffledChoices.find(choice => choice.correct);

    if (!correctChoice) {
        throw new Error(
            `Question ${question.number || 'unknown'}: không tìm thấy đáp án đúng (thiếu gạch chân).`
        );
    }

    // Cập nhật nhãn đáp án đúng mới (A, B, C hoặc D)
    newQuestion.correct = correctChoice.label;
    newQuestion.choices = shuffledChoices;

    return newQuestion;
}

/**
 * Xáo trộn phương án lựa chọn cho toàn bộ danh sách câu hỏi
 * @param {Array} questions - Mảng danh sách câu hỏi
 * @returns {Array} Danh sách câu hỏi mới với các lựa chọn đã được trộn
 */
export function shuffleAllChoices(questions) {
    if (!Array.isArray(questions)) {
        throw new TypeError("Tham số 'questions' phải là một mảng.");
    }

    return questions.map(question => shuffleChoices(question));
}