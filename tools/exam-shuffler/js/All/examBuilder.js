/* =====================================================
   examBuilder.js
   Exam Shuffler v2.2

   Chức năng:
   - Đóng vai trò Assembler / Composite trong Pipeline.
   - Nhận các khối XML/Structure đã được xử lý (Header, Questions, Footer).
   - Lắp ghép thành cấu trúc dữ liệu hoàn chỉnh cho từng mã đề.
   - Nguyên tắc: Pure Assembler (Không gọi structuredClone lên DOM Nodes).
   - Áp dụng nguyên tắc Fail-Fast: Chặn đứng execution nếu dữ liệu không nhất quán.
===================================================== */

/**
 * Lắp ghép cấu trúc cho MỘT mã đề hoàn chỉnh
 * @param {string|number} examCode - Mã đề (VD: "101")
 * @param {Array} header - Mảng các node Header XML
 * @param {Array} questions - Danh sách câu hỏi đã qua xáo trộn
 * @param {Array} footer - Mảng các node Footer XML
 */
export function buildExam(
    examCode,
    header = [],
    questions = [],
    footer = []
) {
    if (!examCode) {
        throw new Error("[examBuilder] examCode is required.");
    }

    return {
        examCode,
        header: Array.isArray(header) ? [...header] : header,
        questions: Array.isArray(questions) ? [...questions] : questions,
        footer: Array.isArray(footer) ? [...footer] : footer
    };
}

/**
 * Lắp ghép tập hợp BỘ ĐỀ cho danh sách nhiều mã đề
 * @param {Array<string|number>} examCodes - Mảng mã đề (VD: ["101", "102", "103", "104"])
 * @param {Array} header - Mảng Header dùng chung
 * @param {Array<Array>} questionSets - Mảng chứa các tập câu hỏi tương ứng từng mã đề
 * @param {Array} footer - Mảng Footer dùng chung
 */
export function buildExamSet(
    examCodes,
    header,
    questionSets,
    footer
) {
    // 1. Validate kiểu dữ liệu đầu vào
    if (!Array.isArray(examCodes) || !Array.isArray(questionSets)) {
        throw new TypeError("[examBuilder] examCodes and questionSets must be arrays.");
    }

    // 2. Fail-Fast: Kiểm tra sự tương thích độ dài giữa Mã đề và Tập câu hỏi
    if (examCodes.length !== questionSets.length) {
        throw new Error(
            `[examBuilder] Mismatch error: examCodes.length (${examCodes.length}) must equal questionSets.length (${questionSets.length}).`
        );
    }

    // 3. Tiến hành lắp ghép khi dữ liệu hoàn toàn hợp lệ
    return examCodes.map((code, index) => {
        return buildExam(
            code,
            header,
            questionSets[index],
            footer
        );
    });
}