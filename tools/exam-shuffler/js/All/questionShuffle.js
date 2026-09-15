/* =====================================================
   questionShuffle.js
   Exam Shuffler v2.0

   Chức năng:
   - Trộn thứ tự các câu hỏi bằng thuật toán Fisher-Yates.
   - Giữ nguyên nội dung và tham chiếu XML của từng câu hỏi.
   - Sinh Mapping đối chiếu vị trí (New Number ➔ Original Number & CLO).
===================================================== */

/**
 * Xáo trộn danh sách câu hỏi sử dụng thuật toán Fisher-Yates.
 * Lưu ý: Hàm thực hiện mảng nông [...questions] để đảo vị trí các phần tử.
 * Việc clone sâu các DOM Nodes được đảm nhận ở tầng Pipeline (appShuffle.js).
 * 
 * @param {Array} questions - Mảng danh sách câu hỏi
 * @returns {Array} Mảng câu hỏi đã được xáo trộn thứ tự
 */
export function shuffleQuestions(questions) {
    if (!Array.isArray(questions)) {
        throw new TypeError("Tham số 'questions' phải là một mảng.");
    }

    // Tạo mảng nông mới để không làm biến đổi mảng đầu vào trực tiếp
    const shuffled = [...questions];

    // Thuật toán Fisher-Yates Shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Sinh bảng ánh xạ (Mapping Table) đối chiếu giữa mã đề mới và đề gốc
 * 
 * @param {Array} shuffledQuestions - Danh sách câu hỏi đã xáo trộn
 * @returns {Array<{newNumber: number, originalNumber: number, clo: string}>}
 */
export function buildQuestionMap(shuffledQuestions) {
    if (!Array.isArray(shuffledQuestions)) {
        throw new TypeError("Tham số 'shuffledQuestions' phải là một mảng.");
    }

    return shuffledQuestions.map((question, index) => ({
        newNumber: index + 1,
        originalNumber: question.number ?? null,
        clo: question.clo ?? ""
    }));
}