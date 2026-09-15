/* =====================================================
   answerExtractor.js
   Exam Shuffler v2.0 - Core Extraction Engine

   Chức năng:
   - Phân tích và đóng gói cấu trúc câu hỏi nguyên bản.
   - Trích xuất Stem, Choices (hỗ trợ lựa chọn multi-paragraph/multi-node), CLO, và đáp án đúng.
   - Lưu trữ reference XML nguyên khối phục vụ trộn đề không mất định dạng.
===================================================== */

const W_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Lấy toàn bộ text thuần của một paragraph XML (Hỗ trợ OpenXML Namespace & Fallback)
 * @param {Element} p - Node XML
 * @returns {string} Text thuần đã trim
 */
export function getParagraphText(p) {
    if (!p) return "";
    
    // Nếu là phần tử DOM có hỗ trợ getElementsByTagNameNS (OpenXML)
    if (typeof p.getElementsByTagNameNS === "function") {
        const textNodes = p.getElementsByTagNameNS(W_NAMESPACE, "t");
        if (textNodes.length > 0) {
            let text = "";
            for (let i = 0; i < textNodes.length; i++) {
                text += textNodes[i].textContent;
            }
            return text.trim();
        }
    }
    
    // Fallback cho Node thông thường hoặc textContent
    return p.textContent ? p.textContent.trim() : "";
}

/**
 * Kiểm tra xem một paragraph có chứa thẻ gạch chân hợp lệ hay không
 * (Bỏ qua trường hợp thẻ w:u có thuộc tính w:val="none")
 * @param {Element} paragraph 
 * @returns {boolean}
 */
export function hasUnderline(paragraph) {
    if (!paragraph || typeof paragraph.getElementsByTagName !== "function") return false;
    
    const runs = paragraph.getElementsByTagName("w:r");
    for (const run of runs) {
        const u = run.getElementsByTagName("w:u");
        if (u.length > 0) {
            const val = u[0].getAttribute("w:val");
            if (val !== "none") {
                return true;
            }
        }
    }
    return false;
}

/**
 * Phân tích một khối câu hỏi (questionBlock) sang cấu trúc v2.0
 * @param {Object|Array} questionInput - Khối câu hỏi (Array các nodes hoặc Object chứa nodes/paragraphs)
 */
export function analyzeQuestion(questionInput) {
    // 1. Tương thích linh hoạt API: Lấy mảng nodes/paragraphs từ questionInput
    let questionNodes = [];
    if (Array.isArray(questionInput)) {
        questionNodes = questionInput;
    } else if (questionInput && typeof questionInput === "object") {
        questionNodes = questionInput.nodes ?? questionInput.paragraphs ?? [];
    }

    // Cấu trúc dữ liệu v2.0 an toàn tuyệt đối
    const result = {
        number: 0,
        clo: "",
        questionParagraph: questionNodes[0] ?? null,
        nodes: [...questionNodes],
        paragraphs: [...questionNodes], // Giữ backwards compatibility
        stem: [],
        stemText: "",
        choices: [],
        correct: "",
        startIndex: -1,
        endIndex: -1
    };

    if (questionNodes.length === 0) {
        return result;
    }

    let currentChoice = null;

    for (const node of questionNodes) {
        const text = getParagraphText(node);

        /* ---------- 1. Nhận diện Số câu (Chỉ lấy ở phần đầu câu) ---------- */
        const qMatch = text.match(/^Câu\s+(\d+)/i) || text.match(/^Question\s+(\d+)/i) || text.match(/^(\d+)[\.\)]/);
        if (qMatch && result.number === 0) {
            result.number = Number(qMatch[1]);
        }

        /* ---------- 2. Nhận diện CLO ---------- */
        const cloMatch = text.match(/\(CLO\s*(\d+)\)/i);
        if (cloMatch && !result.clo) {
            result.clo = cloMatch[1];
        }

        /* ---------- 3. Nhận diện các lựa chọn A/B/C/D ---------- */
        const choiceMatch = text.match(/^([ABCD])[\.\)]/);
        
        if (choiceMatch) {
            // Khởi tạo một Lựa chọn mới (Dạng mảng nodes để hỗ trợ đáp án nhiều dòng/bảng)
            currentChoice = {
                label: choiceMatch[1],
                choiceIndex: result.choices.length, // Index gốc phục vụ shuffle
                paragraph: node,       // Dòng đầu tiên của lựa chọn
                nodes: [node],         // Mảng chứa TOÀN BỘ các node (dòng/bảng) thuộc lựa chọn này
                xml: node,             // Reference XML phục vụ Writer
                correct: hasUnderline(node), // Áp dụng logic lọc w:val
                text
            };

            result.choices.push(currentChoice);

            if (currentChoice.correct) {
                result.correct = currentChoice.label;
            }
            continue;
        }

        /* ---------- 4. Nội dung nối tiếp (Multi-line Choice hoặc Stem) ---------- */
        if (currentChoice) {
            // Đã xuất hiện nhãn A/B/C/D trước đó và dòng này không phải nhãn mới
            // ➔ Node này thuộc về nội dung nối tiếp của Lựa chọn hiện tại
            currentChoice.nodes.push(node);

            // Cập nhật thuộc tính correct nếu dòng nối tiếp chứa gạch chân
            if (!currentChoice.correct && hasUnderline(node)) {
                currentChoice.correct = true;
                result.correct = currentChoice.label;
            }
        } else {
            // Chưa xuất hiện bất kỳ lựa chọn A/B/C/D nào ➔ Thuộc về Thân câu hỏi (Stem)
            result.stem.push(node);
        }
    }

    // Tổng hợp stemText
    result.stemText = result.stem
        .map(getParagraphText)
        .filter(Boolean)
        .join("\n");

    return result;
}

/**
 * Phân tích toàn bộ tập hợp các khối câu hỏi trong đề
 * @param {Array} questionBlocks - Mảng các khối câu hỏi từ questionSplitter
 */
export function analyzeQuestions(questionBlocks) {
    if (!Array.isArray(questionBlocks)) {
        throw new TypeError("questionBlocks must be an array.");
    }
    
    return questionBlocks.map(block => analyzeQuestion(block));
}