/* =====================================================
   qrGenerator.js
   Exam Shuffler v1.1 - Pure Image Generator for QR Code

   Chức năng:
   - Nhận chuỗi payload (được tạo từ qrPayload.js).
   - Gọi thư viện QRCode (qrcode.min.js) để render ảnh QR.
   - Xuất dữ liệu dưới dạng Base64 DataURL (PNG) hoặc Uint8Array.
   - Tách helper base64ToUint8Array cô lập cơ chế chuyển đổi binary.
===================================================== */

import { buildQrPayload } from "./qrPayload.js";

/**
 * Kích thước hiển thị tiêu chuẩn của ảnh QR (pixel)
 */
const DEFAULT_QR_SIZE = 200;

/**
 * Cấu hình mặc định cho việc sinh mã QR
 */
const DEFAULT_OPTIONS = {
    errorCorrectionLevel: "M", // M = ~15% khả năng khôi phục lỗi (Tối ưu giữa kích thước & độ nhạy)
    type: "image/png",
    margin: 1,                 // Viền trắng tối giản xung quanh (1 block)
    width: DEFAULT_QR_SIZE,    // Kích thước pixel tiêu chuẩn
    color: {
        dark: "#000000",       // Điểm QR màu đen
        light: "#FFFFFF"       // Nền màu trắng
    }
};

/**
 * Helper chuyển đổi chuỗi Base64 sang Uint8Array độc lập môi trường
 * 
 * @param {string} base64 - Chuỗi Base64
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64) {
    // 1. Môi trường Browser tiêu chuẩn
    if (typeof window !== "undefined" && typeof window.atob === "function") {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    // 2. Môi trường Node.js / Electron / CLI
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(base64, "base64"));
    }

    throw new Error("[qrGenerator] Môi trường hiện tại không hỗ trợ giải mã Base64.");
}

/**
 * Kiểm tra sự tồn tại của thư viện QRCode trên window/global
 */
function ensureQRCodeLibrary() {
    if (typeof window !== "undefined" && window.QRCode) {
        return window.QRCode;
    }
    if (typeof QRCode !== "undefined") {
        return QRCode;
    }
    throw new Error(
        "[qrGenerator] Chưa nạp thư viện qrcode.min.js. " +
        "Vui lòng thêm thẻ <script src=\"libs/qrcode.min.js\"></script> vào HTML."
    );
}

/**
 * Sinh chuỗi Base64 Data URL (PNG) của mã QR từ Payload hoặc Exam Object
 * 
 * @param {string|Object} input - Chuỗi payload (ESV1|...) hoặc Đối tượng exam
 * @param {Object} [customOptions] - Tùy chọn override (nếu có)
 * @returns {Promise<string>} Base64 Data URL (VD: "data:image/png;base64,iVBORw0HG...")
 */
export async function generateQrDataUrl(input, customOptions = {}) {
    const QRCodeLib = ensureQRCodeLibrary();

    // 1. Xác định chuỗi text cần mã hóa
    let payloadText = "";
    if (typeof input === "string") {
        payloadText = input.trim();
    } else if (typeof input === "object" && input !== null) {
        payloadText = buildQrPayload(input);
    } else {
        throw new Error("[qrGenerator] Đầu vào không hợp lệ (phải là chuỗi Payload hoặc đối tượng Exam).");
    }

    if (!payloadText) {
        throw new Error("[qrGenerator] Chuỗi Payload để tạo QR rỗng.");
    }

    // 2. Tùy chỉnh cấu hình
    const options = { ...DEFAULT_OPTIONS, ...customOptions };

    // 3. Gọi thư viện QRCode sinh Data URL
    try {
        const dataUrl = await QRCodeLib.toDataURL(payloadText, options);
        return dataUrl;
    } catch (err) {
        throw new Error(`[qrGenerator] Lỗi khi tạo ảnh QR: ${err.message}`);
    }
}

/**
 * Sinh dữ liệu Binary (Uint8Array) của mã QR để chèn trực tiếp vào Zip/DOCX Media
 * 
 * @param {string|Object} input - Chuỗi payload hoặc Đối tượng exam
 * @param {Object} [customOptions] - Tùy chọn override
 * @returns {Promise<Uint8Array>} Mảng dữ liệu nhị phân của file PNG
 */
export async function generateQrBuffer(input, customOptions = {}) {
    const dataUrl = await generateQrDataUrl(input, customOptions);

    // Bóc tách tiền tố "data:image/png;base64," và chuyển đổi sang Uint8Array
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    return base64ToUint8Array(base64Data);
}