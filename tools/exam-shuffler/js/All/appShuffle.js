/* =====================================================
   appShuffle.js
   Exam Shuffler v2.0 - Production Pipeline
===================================================== */

import { readDocx } from "./docx/docxReader.js";
import { 
    loadDocument, 
    getDocumentBody, 
    updateDocumentBody, 
    writeRawDocument 
} from "./docx/docxWriter.js";
import { splitQuestions } from "./docx/questionSplitter.js";
import { analyzeQuestions } from "./docx/answerExtractor.js";
import { shuffleQuestions } from "./shuffle/questionShuffle.js";
import { shuffleAllChoices } from "./shuffle/choiceShuffle.js";
import { buildExamSet } from "./shuffle/examBuilder.js";
import { validateExamSet } from "./utils/validator.js";

/**
 * Deep clone mảng câu hỏi chứa các DOM Nodes (Tránh DataCloneError của structuredClone)
 * @param {Array} questions 
 * @returns {Array} Mảng câu hỏi mới với các DOM Nodes được clone độc lập
 */
function cloneQuestions(questions) {
    if (!Array.isArray(questions)) return [];

    return questions.map(q => {
        const clonedQ = { ...q };

        // Clone các mảng chứa DOM Node (stem, paragraphs)
        if (Array.isArray(q.stem)) {
            clonedQ.stem = q.stem.map(node => (node && typeof node.cloneNode === "function" ? node.cloneNode(true) : node));
        }
        if (Array.isArray(q.paragraphs)) {
            clonedQ.paragraphs = q.paragraphs.map(node => (node && typeof node.cloneNode === "function" ? node.cloneNode(true) : node));
        }
        if (q.questionParagraph && typeof q.questionParagraph.cloneNode === "function") {
            clonedQ.questionParagraph = q.questionParagraph.cloneNode(true);
        }

        // Clone danh sách choices và node xml tương ứng
        if (Array.isArray(q.choices)) {
            clonedQ.choices = q.choices.map(choice => {
                const clonedChoice = { ...choice };
                if (choice.paragraph && typeof choice.paragraph.cloneNode === "function") {
                    clonedChoice.paragraph = choice.paragraph.cloneNode(true);
                }
                if (choice.xml && typeof choice.xml.cloneNode === "function") {
                    clonedChoice.xml = choice.xml.cloneNode(true);
                }
                return clonedChoice;
            });
        }

        return clonedQ;
    });
}

/**
 * Tái tạo danh sách Paragraphs từ cấu trúc một đề hoàn chỉnh
 */
function assembleExamParagraphs(exam) {
    const rebuiltParagraphs = [];

    if (exam.header) rebuiltParagraphs.push(...exam.header);

    for (const q of exam.questions) {
        if (q.stem) rebuiltParagraphs.push(...q.stem);
        if (q.choices) {
            for (const choice of q.choices) {
                if (choice.xml) rebuiltParagraphs.push(choice.xml);
            }
        }
    }

    if (exam.footer) rebuiltParagraphs.push(...exam.footer);

    return rebuiltParagraphs;
}

/**
 * Cầu nối biến đổi dữ liệu Exam Object thành Blob .docx
 */
async function renderExamToBlob(exam, originalZip, parsedXmlDoc) {
    // 1. Tạo bản sao của DOMDocument và JSZip để tránh xung đột giữa các mã đề
    const xmlDocClone = parsedXmlDoc.cloneNode(true);
    const zipClone = originalZip.clone();

    // 2. Gom toàn bộ Paragraphs theo đúng thứ tự: Header -> Stem/Choices -> Footer
    const newParagraphs = assembleExamParagraphs(exam);

    // 3. Cập nhật <w:body> (giữ nguyên <w:sectPr>)
    updateDocumentBody(xmlDocClone, newParagraphs);

    // 4. Serialize DOM XML và cập nhật lại vào JSZip
    writeRawDocument(zipClone, xmlDocClone);

    // 5. Xuất file Blob .docx
    return await zipClone.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
}

/**
 * Pipeline thực thi chính cho Exam Shuffler v2.0
 * 
 * @param {File|Blob|ArrayBuffer} fileInput - File Word câu hỏi gốc
 * @param {Array<string|number>} examCodes - Danh sách các mã đề cần tạo
 * @param {Object} options - Tùy chọn xáo trộn
 * @param {Function} [onProgress] - Callback cập nhật tiến trình cho UI (percent, message)
 */
export async function processExamShuffling(
    fileInput,
    examCodes = ["101", "102", "103", "104"],
    options = { shuffleQuestions: true, shuffleChoices: true },
    onProgress = () => {}
) {
    console.time("[Pipeline] Total Execution Time");

    try {
        // 1. Reader: Đọc Zip file
        onProgress(5, "Đang đọc cấu trúc file Word (.docx)...");
        const zip = await readDocx(fileInput);

        // 2. Load XML Document
        onProgress(15, "Đang nạp cấu trúc XML document...");
        const xmlDoc = await loadDocument(zip);

        // 3. Trích xuất thẻ <w:body>
        onProgress(20, "Đang trích xuất thẻ <w:body>...");
        const bodyNode = getDocumentBody(xmlDoc);

        // 4. Splitter: Tách các khối câu hỏi và Header (Truyền trực tiếp bodyNode)
        onProgress(30, "Đang phân tách các khối câu hỏi & Header...");
        const splitResult = splitQuestions(bodyNode);
        
        const header = splitResult.headerNodes ?? [];
        const questionBlocks = splitResult.questionBlocks ?? [];
        const footer = []; 

        // 5. Extractor: Phân tích chi tiết câu hỏi
        onProgress(40, "Đang phân tích đáp án gạch chân và CLO...");
        const rawQuestions = analyzeQuestions(questionBlocks);

        // 6 & 7. Shuffle: Xáo trộn vị trí câu & đáp án A/B/C/D
        onProgress(55, `Đang xử lý xáo trộn cho ${examCodes.length} mã đề...`);
        const questionSets = examCodes.map((code) => {
            // Dùng cloneQuestions thay cho structuredClone để an toàn với DOM Nodes
            let processedQuestions = cloneQuestions(rawQuestions);

            if (options.shuffleQuestions) {
                processedQuestions = shuffleQuestions(processedQuestions);
            }

            if (options.shuffleChoices) {
                processedQuestions = shuffleAllChoices(processedQuestions);
            }

            return processedQuestions;
        });

        // 8. Exam Builder: Ghép các mã đề
        onProgress(70, "Đang đóng gói cấu trúc bộ đề...");
        const exams = buildExamSet(examCodes, header, questionSets, footer);

        // 9. Validator: Kiểm tra tính toàn vẹn bộ đề
        onProgress(80, "Đang kiểm tra tính toàn vẹn dữ liệu...");
        if (typeof validateExamSet === "function") {
            const validationResults = validateExamSet(exams);
            
            if (Array.isArray(validationResults) && validationResults.some(r => r && !r.valid)) {
                const invalidCodes = validationResults.filter(r => !r.valid).map(r => r.examCode).join(", ");
                throw new Error(`Kiểm tra tính toàn vẹn thất bại tại các mã đề: ${invalidCodes}`);
            }
        }

        // 10-13. Writer: Render các file Blobs tương ứng
        onProgress(85, "Đang khởi tạo render các file .docx...");
        const exportResults = await Promise.all(
            exams.map(async (exam, index) => {
                const blob = await renderExamToBlob(exam, zip, xmlDoc);

                const currentPercent = 85 + Math.round(((index + 1) / exams.length) * 15);
                onProgress(currentPercent, `Đã tạo xong mã đề ${exam.examCode} (${index + 1}/${exams.length})`);

                return {
                    examCode: exam.examCode,
                    blob
                };
            })
        );

        onProgress(100, "Hoàn tất tạo bộ đề thi!");
        console.timeEnd("[Pipeline] Total Execution Time");

        return exportResults;

    } catch (error) {
        console.error("[Pipeline Error] Failed to process exam shuffling:", error);
        throw error;
    }
}