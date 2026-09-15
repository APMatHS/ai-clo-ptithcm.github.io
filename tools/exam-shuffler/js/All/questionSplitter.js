/* =====================================================
   questionSplitter.js v1.6
   Exam Shuffler Architecture

   Trách nhiệm: 
   - Phân đoạn cây DOM w:body thành Header và các Khối câu hỏi độc lập.
   - Sử dụng cơ chế phân rã mạch lạc để phục vụ mở rộng dài hạn.
   - Phòng thủ chặt chẽ ranh giới câu hỏi, vượt qua bộ Test Cases biên của dự án.
===================================================== */

// Namespace chuẩn của WordprocessingML trong OpenXML
const W_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Phòng thủ môi trường: Đảm bảo chạy an toàn trên cả Browser lẫn môi trường Test (Node.js/JSDOM)
const ELEMENT_NODE = typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1;

/**
 * Phân đoạn cấu trúc w:body thành vùng Header và danh sách các khối câu hỏi nguyên khối
 * @param {Element} bodyNode - Node <w:body> trích xuất từ docxWriter
 * @returns {Object} { headerNodes: Element[], questionBlocks: Object[], totalNodes: number }
 */
export function splitQuestions(bodyNode) {
    if (!bodyNode || typeof bodyNode.childNodes === "undefined") {
        return { headerNodes: [], questionBlocks: [], totalNodes: 0 };
    }

    const headerNodes = [];
    const questionBlocks = [];
    let currentBlock = null;

    // Chuyển đổi childNodes thành mảng phẳng đại diện cho cấu trúc gốc
    const nodes = Array.from(bodyNode.childNodes);

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Duyệt và giữ lại các text node hoặc comment node ở vùng tương ứng
        if (node.nodeType !== ELEMENT_NODE) { 
            if (currentBlock) {
                currentBlock.nodes.push(node);
            } else {
                headerNodes.push(node);
            }
            continue;
        }

        // Nhận diện ranh giới câu mới dựa trên phần tử <w:p>
        if (node.localName === "p" && isQuestionStart(node)) {
            currentBlock = {
                index: questionBlocks.length + 1, 
                startNodeIndex: i,                // Tọa độ node gốc phục vụ debug
                questionNumber: null,             // Sẽ được điền chính xác ở tầng answerExtractor
                nodes: [node],
                answers: [],
                correctAnswer: null
            };
            questionBlocks.push(currentBlock);
        } else {
            // Nếu là w:tbl, w:p thông thường, hoặc node cấu trúc đứng trước câu đầu tiên
            if (currentBlock) {
                currentBlock.nodes.push(node);
            } else {
                // Toàn bộ dữ liệu trước Câu 1 được gom trọn vẹn vào Header để bảo toàn cấu trúc file
                headerNodes.push(node);
            }
        }
    }

    return {
        headerNodes,
        questionBlocks,
        totalNodes: nodes.length
    };
}

/**
 * Phân rã logic nhận diện để tăng tính rõ ràng, dễ bảo trì và mở rộng trong tương lai
 * @param {Element} paragraph - Thẻ <w:p>
 * @returns {boolean}
 */
function isQuestionStart(paragraph) {
    // Chuẩn hóa toàn bộ khoảng trắng đặc biệt, tab ẩn (\t) thành dấu cách đơn
    const text = getParagraphText(paragraph)
        .replace(/\s+/g, " ")
        .trim();
    
    // Mẫu 1: Nhận diện tiền tố rõ ràng (Câu 1, Question 2, Q3...) [Đạt Test 5]
    if (/^(Câu|Question|Q)\s*\d+(\s|$|[\.:)])/i.test(text)) {
        return true;
    }
    
    // Mẫu 2: Nhận diện số thuần có ký tự phân tách đi kèm liền sau và có khoảng trắng/kết thúc chuỗi để siết biên chặt chẽ (Ví dụ: "1. ", "12:", "3) ") [Đạt Test 5, loại bỏ rủi ro 1.a]
    if (/^\d+[\.:)](\s|$)/.test(text)) {
        return true;
    }
    
    // Mẫu 3: Nhận diện số cô độc hoàn toàn trên một dòng đơn lẻ (Ví dụ người ra đề xuống dòng viết số "4") [Đạt Test 5]
    if (/^\d+$/.test(text)) {
        return true;
    }
    
    // Các trường hợp văn bản thường "2026 năm học" [Đạt Test 3] hoặc "1 tín chỉ" [Đạt Test 4] sẽ rơi xuống đây và trả về false
    return false;
}

/**
 * Trích xuất text thuần an toàn xuyên Namespace bằng getElementsByTagNameNS
 * @param {Element} paragraph - Thẻ <w:p>
 * @returns {string}
 */
function getParagraphText(paragraph) {
    const textNodes = paragraph.getElementsByTagNameNS(W_NAMESPACE, "t");
    let text = "";
    
    for (let i = 0; i < textNodes.length; i++) {
        text += textNodes[i].textContent;
    }
    
    return text;
}