/* =====================================================
   docxWriter.js
   Exam Shuffler v2.0 (XML Lifecycle Management)

   Chức năng:
   - Tự quản lý vòng đời biến đổi giữa JSZip và cây DOM XML.
   - Trích xuất node gốc <w:body> để chuẩn bị cho khâu trộn câu hỏi.
   - Tuần tự hóa cây DOM XML ngược lại để cập nhật vào hạ tầng.
===================================================== */

/**
 * Trích xuất nội dung thông báo lỗi một cách an toàn
 */
function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Đọc file XML cốt lõi từ JSZip và dựng thành cây DOM XML hoàn chỉnh
 * @param {JSZip} zip - Instance JSZip gốc đang xử lý
 * @returns {Promise<Document>} Cây DOM XML ("word/document.xml")
 */
export async function loadDocument(zip) {
    if (!zip || typeof zip.file !== "function") {
        throw new TypeError("Tham số 'zip' phải là một instance hợp lệ của JSZip.");
    }

    const documentPath = "word/document.xml";
    const fileEntry = zip.file(documentPath);
    
    if (!fileEntry) {
        throw new Error(`Cấu trúc file không hợp lệ. Không tìm thấy tệp thành phần: ${documentPath}`);
    }

    try {
        // 1. Đọc nội dung file XML dưới dạng chuỗi văn bản thuần
        const xmlText = await fileEntry.async("string");
        
        // 2. Sử dụng DOMParser tích hợp sẵn để phân tích cú pháp chuỗi thành cây DOM XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        // 3. Phòng thủ kiểm tra lỗi parse của trình duyệt (parsererror)
        const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
        if (parserError) {
            throw new Error("Lỗi cú pháp XML bên trong tài liệu: " + parserError.textContent);
        }

        return xmlDoc;
    } 
    catch (err) {
        throw new Error("Thất bại khi nạp và parse cấu trúc document.xml: " + getErrorMessage(err));
    }
}

/**
 * Trích xuất node chứa toàn bộ nội dung hiển thị của file Word (<w:body>)
 * @param {Document} xmlDoc - Cây DOM XML đã được parse thành công
 * @returns {Element} Node đại diện cho thẻ <w:body>
 */
export function getDocumentBody(xmlDoc) {
    if (!xmlDoc || typeof xmlDoc.getElementsByTagName !== "function") {
        throw new TypeError("Tham số 'xmlDoc' phải là một cây DOM Document hợp lệ.");
    }

    const bodyNode = xmlDoc.getElementsByTagName("w:body")[0];
    if (!bodyNode) {
        throw new Error("Cấu trúc XML không hợp lệ: Không tìm thấy thẻ thành phần cốt lõi <w:body>.");
    }

    return bodyNode;
}

/**
 * Tuần tự hóa cây DOM XML và ghi đè ngược lại vào instance JSZip hạ tầng
 * @param {JSZip} zip - Instance JSZip gốc đang xử lý
 * @param {Document} xmlDoc - Cây DOM XML cần lưu trữ
 * @returns {JSZip} Instance JSZip đã được cập nhật dữ liệu mới
 */
export function writeRawDocument(zip, xmlDoc) {
    if (!zip || typeof zip.file !== "function") {
        throw new TypeError("Tham số 'zip' phải là một instance hợp lệ của JSZip.");
    }
    
    if (!xmlDoc) {
        throw new Error("Tham số 'xmlDoc' không được để trống.");
    }

    try {
        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(xmlDoc);

        zip.file("word/document.xml", xmlString);
        return zip;
    } 
    catch (err) {
        throw new Error("Thất bại khi tuần tự hóa DOM XML và ghi vào JSZip: " + getErrorMessage(err));
    }
}