/* =====================================================
   app.js
   Exam Shuffler v2.3 - Main Controller (Production Ready)

   Cải tiến v2.3:
   - An toàn DOM Event Listener (Kiểm tra Null Safety cho processBtn).
   - Vô hiệu hóa nút bấm trong quá trình xử lý (Anti-Spam Click).
   - Tách hằng số DOWNLOAD_DELAY phục vụ bảo trì dễ dàng.
===================================================== */

import { processExamShuffling } from "./appShuffle.js";
import { exportZip } from "./zip/zipExporter.js";
console.log("APP STARTED");

// Hằng số cấu hình
const DOWNLOAD_DELAY = 150; // Thời gian chờ giữa mỗi lượt tải (ms)

// DOM Elements
const fileInput = document.getElementById("docxFile");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const processBtn = document.getElementById("processBtn");

const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");

const logContent = document.getElementById("logContent");
const checkList = document.getElementById("checkList");

let selectedFile = null;

/* =====================================================
   Nhật ký hệ thống (Log)
===================================================== */
function log(message) {
    if (!logContent) return;
    logContent.textContent += "\n> " + message;
    logContent.scrollTop = logContent.scrollHeight;
}

/* =====================================================
   Thanh trạng thái (Progress Bar)
===================================================== */
function setProgress(percent, text = "") {
    if (progressBar) progressBar.style.width = percent + "%";
    if (statusText && text) statusText.textContent = text;
}

/* =====================================================
   Thu thập và Validation danh sách mã đề từ UI
===================================================== */
function getAndValidateExamCodes() {
    const codeInputs = [
        document.getElementById("code1"),
        document.getElementById("code2"),
        document.getElementById("code3"),
        document.getElementById("code4")
    ];

    // Lấy giá trị chuỗi đã trim
    const examCodes = codeInputs
        .map(input => input ? input.value.trim() : "")
        .filter(val => val.length > 0);

    // Fallback: Mặc định [201, 202, 203, 204] nếu chưa có các ô input trên DOM
    if (examCodes.length === 0) {
        return ["201", "202", "203", "204"];
    }

    // 1. Kiểm tra đủ 4 mã đề
    if (examCodes.length !== 4) {
        alert("Vui lòng nhập đầy đủ 4 mã đề.");
        return null;
    }

    // 2. Kiểm tra định dạng đúng 3 chữ số
    const isValidFormat = examCodes.every(code => /^\d{3}$/.test(code));
    if (!isValidFormat) {
        alert("Mã đề phải bao gồm đúng 3 chữ số (Ví dụ: 201, 202, 203, 204).");
        return null;
    }

    // 3. Kiểm tra trùng lặp mã đề
    const uniqueCodes = new Set(examCodes);
    if (uniqueCodes.size !== examCodes.length) {
        alert("Các mã đề không được trùng nhau. Vui lòng kiểm tra lại!");
        return null;
    }

    return examCodes;
}

/* =====================================================
   Xử lý chọn file dữ liệu đầu vào
===================================================== */
function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
        alert("Vui lòng chọn file DOCX.");
        return;
    }

    selectedFile = file;
    if (fileName) fileName.textContent = file.name;
    if (fileInfo) fileInfo.classList.remove("hidden");
    
    if (checkList) {
        checkList.innerHTML = `
            ✅ Đã chọn file DOCX<br>
            ⏳ Sẵn sàng xáo trộn bộ đề
        `;
    }
    log("Đã chọn file: " + file.name);
}

/* =====================================================
   Input Event Listeners
===================================================== */
if (fileInput) {
    fileInput.addEventListener("change", (e) => {
        handleFile(e.target.files[0]);
    });
}

/* =====================================================
   Kéo và thả file (Drag & Drop)
===================================================== */
if (dropZone) {
    ["dragenter", "dragover"].forEach(event => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(event => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
        });
    });

    dropZone.addEventListener("drop", (e) => {
        handleFile(e.dataTransfer.files[0]);
    });
}

/* =====================================================
   XỬ LÝ CHÍNH: XÁO TRỘN VÀ TẢI XUỐNG 4 ĐỀ THI (.DOCX)
===================================================== */
if (processBtn) {
    processBtn.addEventListener("click", async () => {
        console.log(">>> PROCESS SHUFFLE CLICKED");

        if (!selectedFile) {
            alert("Hãy chọn file đề gốc (.docx).");
            return;
        }

        // 1. Validate 4 mã đề từ UI
        const examCodes = getAndValidateExamCodes();
        if (!examCodes) return;

        // Vô hiệu hóa nút bấm chống spam click
        processBtn.disabled = true;

        try {
            log("--------------------------------");
            log("Khởi động Pipeline xáo trộn đề...");
            log(`Mã đề chuẩn bị tạo: ${examCodes.join(", ")}`);

            const options = {
                shuffleQuestions: true,
                shuffleChoices: true
            };

            // 2. Gọi Orchestrator thực thi Pipeline
           const { docxFiles, excelBlob } = await processExamShuffling(
    selectedFile,
    examCodes,
    options,
    (percent, message) => {
        setProgress(percent, message);
        log(message);
    }
);

console.log("Returned from processExamShuffling");
console.log(docxFiles);
console.log(excelBlob);


           
// 3. Tạo và tải file ZIP
log("Đang tạo file ZIP...");
console.log("Before exportZip");
await exportZip({
    exams: docxFiles.map(({ examCode, blob }) => ({
        name: `Đề_${examCode}.docx`,
        blob
    })),
    excels: [
        {
            name: "Dap_An_Tong_Hop.xlsx",
            blob: excelBlob
        }
    ]
});
console.log("After exportZip");


            // 4. Cập nhật UI kết quả
            if (checkList) {
                checkList.innerHTML = `
                    ✅ Validate 4 mã đề (${examCodes.join(", ")})<br>
                    ✅ Tách khối & Phân tích đáp án gạch chân<br>
                    ✅ Trộn vị trí câu & Trộn đáp án A/B/C/D<br>
                    ✅ Đánh lại số câu chuẩn (Câu 1, Câu 2...)<br>
                    ✅ Xuất và tải xuống thành công 4 file .docx
                `;
            }

            log("✓ TẠO ĐỀ THÀNH CÔNG! Đã tải đủ 4 đề thi về máy.");

        } catch (err) {
            console.error(err);
            log("❌ Lỗi hệ thống: " + err.message);
            alert("Lỗi: " + err.message);
            setProgress(0, "Lỗi");
        } finally {
            // Khôi phục trạng thái nút bấm
            processBtn.disabled = false;
        }
    });
}