/* =====================================================
   docxReader.js (Exam Shuffler v2.5)

   Chức năng:
   - TẦNG HẠ TẦNG (Infrastructure Layer) quản lý giao tiếp với JSZip.
   - Cô lập hoàn toàn thư viện bên thứ ba với tầng nghiệp vụ (Business Logic).
   - Đọc, kiểm tra cấu trúc cơ bản và đóng gói sinh dữ liệu Blob từ file DOCX.
===================================================== */

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Đưa hằng số ra ngoài phạm vi hàm và đóng băng để tối ưu bộ nhớ và bảo đảm tính bất biến
const REQUIRED_FILES = Object.freeze([
    "word/document.xml",
    "word/styles.xml",
    "[Content_Types].xml"
]);

/**
 * Trích xuất nội dung thông báo lỗi một cách an toàn kể cả khi lỗi không phải là Object Error tiêu chuẩn
 */
function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Đọc file DOCX và nạp vào một instance mới của JSZip
 * @param {File|Blob|Object} file - Đối tượng file dữ liệu đầu vào
 * @returns {Promise<JSZip>} Instance JSZip chứa dữ liệu đã giải nén
 */
export async function readDocx(file) {
    if (typeof JSZip === "undefined") {
        throw new ReferenceError("Thư viện JSZip chưa được định nghĩa hoặc chưa được import.");
    }

    if (!file) {
        throw new Error("Không có file DOCX.");
    }

    if (file.name && typeof file.name === "string") {
        if (!file.name.toLowerCase().endsWith(".docx")) {
            throw new Error("Sai định dạng file. Hệ thống chỉ chấp nhận file .docx");
        }
    }

    if (file.type && typeof file.type === "string") {
        if (file.type !== DOCX_MIME_TYPE) {
            throw new Error("MIME type không hợp lệ. File truyền vào không phải là tài liệu Word (.docx).");
        }
    }

    if (typeof file.arrayBuffer !== "function") {
        throw new TypeError("Đối tượng file không hỗ trợ phương thức arrayBuffer().");
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        return await JSZip.loadAsync(arrayBuffer);
    } 
    catch (err) {
        throw new Error("Không thể đọc cấu trúc file (Có thể file bị hỏng hoặc lỗi định dạng ZIP): " + getErrorMessage(err));
    }
}

/**
 * Kiểm tra tính toàn vẹn của các file cấu trúc OOXML cốt lõi trong đề
 * @param {JSZip} zip - Instance JSZip cần kiểm tra
 * @returns {boolean} Trả về true nếu cấu trúc file hợp lệ
 */
export function validateDocx(zip) {
    if (!zip || typeof zip.file !== "function") {
        throw new TypeError("Tham số truyền vào validateDocx phải là một instance hợp lệ của JSZip.");
    }

    for (const fileName of REQUIRED_FILES) {
        if (!zip.file(fileName)) {
            throw new Error(`Cấu trúc file DOCX không hợp lệ. Thiếu file thành phần: ${fileName}`);
        }
    }

    return true;
}

/**
 * Lấy danh sách đường dẫn file nội bộ bên trong file nén (Hỗ trợ Debug)
 * @param {JSZip} zip - Instance JSZip
 * @returns {string[]} Mảng các đường dẫn file nội bộ
 */
export function listFiles(zip) {
    if (!zip || typeof zip.forEach !== "function") {
        throw new TypeError("Tham số truyền vào listFiles phải là một instance hợp lệ của JSZip.");
    }

    const files = [];
    zip.forEach((path, entry) => {
        if (!entry.dir) {
            files.push(path);
        }
    });
    return files;
}

/**
 * Xuất bản (nén lại) toàn bộ cấu trúc JSZip thành một Blob định dạng DOCX hoàn chỉnh.
 * @param {JSZip} zip - Instance JSZip chứa dữ liệu đề đã hoán vị và chỉnh sửa XML
 * @returns {Promise<Blob>} Đối tượng Blob định dạng DOCX chuẩn để chuẩn bị Download
 */
export async function generateDocxBlob(zip) {
    if (!zip || typeof zip.generateAsync !== "function") {
        throw new TypeError("Tham số truyền vào generateDocxBlob phải là một instance hợp lệ của JSZip.");
    }

    try {
        return await zip.generateAsync({
            type: "blob",
            mimeType: DOCX_MIME_TYPE,
            compression: "DEFLATE",
            compressionOptions: {
                level: 6
            }
        });
    }
    catch (err) {
        throw new Error("Không thể đóng gói và xuất dữ liệu Blob DOCX mới: " + getErrorMessage(err));
    }
}