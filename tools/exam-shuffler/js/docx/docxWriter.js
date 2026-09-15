/* =====================================================
   docxWriter.js
   Exam Shuffler v2.2 - Production XML Lifecycle Engine

   Chức năng:
   - Quản lý nạp/ghi cây DOM XML giữa JSZip và DOMParser.
   - Cập nhật thẻ gốc <w:body> bằng mảng XML Nodes mới.
   - Bảo toàn 100% thuộc tính phân đoạn & lề trang (<w:sectPr>) bằng cơ chế Clone trước khi Clear DOM.
===================================================== */

function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}

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
        const xmlText = await fileEntry.async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

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

export function updateDocumentBody(xmlDoc, newNodes) {
    if (!xmlDoc) {
        throw new TypeError("Tham số 'xmlDoc' không được để trống.");
    }
    if (!Array.isArray(newNodes)) {
        throw new TypeError("Tham số 'newNodes' phải là một mảng XML Nodes.");
    }

    const bodyNode = getDocumentBody(xmlDoc);

    // 1. Trích xuất và CLONE ĐỘC LẬP thẻ <w:sectPr> cuối cùng trước khi xóa DOM
    let sectPrClone = null;
    const directChildren = Array.from(bodyNode.childNodes);
    for (let i = directChildren.length - 1; i >= 0; i--) {
        if (directChildren[i].nodeName === "w:sectPr") {
            sectPrClone = directChildren[i].cloneNode(true);
            break;
        }
    }

    // 2. Xóa sạch toàn bộ các node con hiện tại trong <w:body>
    while (bodyNode.firstChild) {
        bodyNode.removeChild(bodyNode.firstChild);
    }

    // 3. Chèn lần lượt các Node mới từ pipeline vào <w:body>
    for (const node of newNodes) {
        if (!node) continue;

        if (node.ownerDocument && node.ownerDocument !== xmlDoc) {
            const importedNode = xmlDoc.importNode(node, true);
            bodyNode.appendChild(importedNode);
        } else {
            bodyNode.appendChild(node);
        }
    }

    // 4. Khôi phục bản sao <w:sectPr> vào vị trí cuối cùng của <w:body>
    if (sectPrClone) {
        if (sectPrClone.ownerDocument && sectPrClone.ownerDocument !== xmlDoc) {
            bodyNode.appendChild(xmlDoc.importNode(sectPrClone, true));
        } else {
            bodyNode.appendChild(sectPrClone);
        }
    }
}

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

/**
 * =====================================================
 * Sinh file DOCX dưới dạng Blob.
 *
 * Dùng cho:
 * - Export DOCX
 * - Đóng gói ZIP
 *
 * @param {JSZip} zip
 * @returns {Promise<Blob>}
 * =====================================================
 */
export async function generateDocxBlob(zip) {

    if (!zip || typeof zip.generateAsync !== "function") {
        throw new TypeError("Tham số 'zip' phải là một instance hợp lệ của JSZip.");
    }

    return await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
            level: 9
        }
    });

}