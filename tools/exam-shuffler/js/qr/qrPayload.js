/* =====================================================
   qrPayload.js
   Exam Shuffler v1.1 - Robust Compact QR Payload Encoder with CRC16

   Chức năng:
   - Đóng gói dữ liệu bộ đề (Mã đề, Số câu, Đáp án, CLO, CRC16) thành chuỗi nén tối ưu.
   - Định dạng chuẩn: ESV1|ExamCode|QuestionCount|AnswerString|CLOList|CRC16
   - Phân tách CLO bằng dấu phẩy (,) hỗ trợ linh hoạt CLO1, CLO2... CLO15+.
   - Tích hợp tính mã kiểm tra CRC16 (CCITT-FALSE) để bảo vệ tính toàn vẹn dữ liệu.
===================================================== */

const FORMAT_HEADER = "ESV1";

/**
 * Tính mã kiểm tra CRC-16 (CCITT-FALSE) cho chuỗi input
 * @param {string} str - Chuỗi cần tính CRC
 * @returns {string} Mã Hex 4 ký tự viết hoa (VD: "9AF2")
 */
function calculateCRC16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Chuẩn hóa một ký tự đáp án (Falsy-safe)
 * @param {any} correct 
 * @returns {string}
 */
function sanitizeAnswerChar(correct) {
    if (correct == null) return "?";
    const str = String(correct).trim().toUpperCase();
    return str.length > 0 ? str.charAt(0) : "?";
}

/**
 * Chuẩn hóa giá trị CLO (Giữ nguyên toàn bộ chuỗi số/chữ của CLO)
 * @param {any} clo 
 * @returns {string}
 */
function sanitizeCloValue(clo) {
    if (clo == null) return "0";
    const str = String(clo).trim();
    return str.length > 0 ? str : "0";
}

/**
 * Tạo chuỗi dữ liệu nén chuẩn hóa kèm CRC16 cho QR Code
 * 
 * Mẫu đầu ra:
 * "ESV1|301|40|BACDACDBACCDABCD...|1,2,3,10,11,12...|9AF2"
 * 
 * @param {Object} exam - Đối tượng đề thi
 * @returns {string} Chuỗi payload hoàn chỉnh
 */
export function buildQrPayload(exam) {
    if (!exam || typeof exam !== "object") {
        throw new Error("[qrPayload] Đối tượng exam không hợp lệ.");
    }

    const examCode = String(exam.examCode ?? "").trim();
    if (!examCode) {
        throw new Error("[qrPayload] Mã đề (examCode) không được để trống.");
    }

    const questions = Array.isArray(exam.questions) ? exam.questions : [];
    const questionCount = questions.length;

    if (questionCount === 0) {
        throw new Error(`[qrPayload] Đề thi mã ${examCode} không chứa câu hỏi nào.`);
    }

    // 1. Trích xuất chuỗi Đáp án (VD: "BACD...")
    const answerString = questions
        .map(q => sanitizeAnswerChar(q.correct))
        .join("");

    // 2. Trích xuất mảng CLO phân tách bằng dấu phẩy (VD: "1,2,3,10,11,12")
    const cloString = questions
        .map(q => sanitizeCloValue(q.clo))
        .join(",");

    // 3. Ghép tiền tố dữ liệu trước khi tính CRC
    const rawPayload = `${FORMAT_HEADER}|${examCode}|${questionCount}|${answerString}|${cloString}`;

    // 4. Tính mã kiểm tra CRC16
    const crc16 = calculateCRC16(rawPayload);

    // 5. Chuỗi hoàn chỉnh bao gồm CRC ở cuối
    return `${rawPayload}|${crc16}`;
}