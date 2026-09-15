/* =====================================================
   Exam Shuffler v2.0
   Main Controller (Kiểm thử hạ tầng khép kín)
===================================================== */

import { readDocx, validateDocx, generateDocxBlob } from "./docx/docxReader.js";
import { loadDocument, getDocumentBody, writeRawDocument } from "./docx/docxWriter.js";
import { splitQuestions } from "./docx/questionSplitter.js";
import { analyzeQuestions } from "./docx/answerExtractor.js";

console.log("APP STARTED");

const fileInput = document.getElementById("docxFile");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const processBtn = document.getElementById("processBtn");
console.log("processBtn =", processBtn);

const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");

const logContent = document.getElementById("logContent");
const checkList = document.getElementById("checkList");

let selectedFile = null;

/* =====================================================
   Nhật ký hệ thống (Log)
===================================================== */
function log(message) {
    logContent.textContent += "\n> " + message;
    logContent.scrollTop = logContent.scrollHeight;
}

/* =====================================================
   Thanh trạng thái (Progress Bar)
===================================================== */
function setProgress(percent, text = "") {
    progressBar.style.width = percent + "%";
    if (text) {
        statusText.textContent = text;
    }
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
    fileName.textContent = file.name;
    fileInfo.classList.remove("hidden");
    checkList.innerHTML = `
        ✅ Đã chọn file DOCX<br>
        ⏳ Chưa phân tích cấu trúc đề
    `;
    log("Đã chọn: " + file.name);
}

/* =====================================================
   Input Event Listeners
===================================================== */
fileInput.addEventListener("change", (e) => {
    handleFile(e.target.files[0]);
});

/* =====================================================
   Kéo và thả file (Drag & Drop)
===================================================== */
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

/* =====================================================
   XỬ LÝ CHÍNH: CHẠY THỬ PIPELINE NGUYÊN TRẠNG (IDENTITY ONLY)
===================================================== */
processBtn.addEventListener("click", async () => {
    console.log(">>> CLICK");

    if (!selectedFile) {
        alert("Hãy chọn đề gốc.");
        return;
    }

    try {
        log("--------------------------------");
        log("Khởi động kiểm thử hạ tầng DOCX...");
        setProgress(15, "Đọc hạ tầng DOCX...");

        /* =====================================================
           Bước 1: Đọc & Validate cấu trúc file ZIP (Reader)
        ===================================================== */
        const zip = await readDocx(selectedFile);
        validateDocx(zip);
        log("✓ Bước 1: Đọc file ZIP & OOXML ổn định.");

        /* =====================================================
           Bước 2: Quản lý vòng đời XML (Writer - Load)
        ===================================================== */
        setProgress(40, "Dựng cây DOM XML...");
        const xmlDoc = await loadDocument(zip); 
        const bodyNode = getDocumentBody(xmlDoc); // Gọi hàm vừa để lấy node, vừa kích hoạt xác thực cấu trúc XML ẩn
        log("✓ Bước 2: Khởi tạo DOM XML và định vị w:body thành công.");

        // =============================================================
        // VÙNG THAO TÁC XML (IDENTITY TRANSFORMATION)
        //
        // Giai đoạn tiếp theo sẽ bổ sung:
        // 1. Tách các khối câu hỏi (Question Splitter)
        // 2. Phân tích câu hỏi (answerExtractor)
        // 3. Trộn câu hỏi / đáp án (Shuffle Engine)
        // 4. Ghi đè nội dung XML (docxWriter)
        // 5. Đánh lại số câu và xuất đề mới
        // =============================================================

        /* =====================================================
           Bước 3: Tuần tự hóa và đóng gói ngược lại (Writer - Write)
        ===================================================== */
        setProgress(65, "Tuần tự hóa DOM XML...");
        writeRawDocument(zip, xmlDoc); 
        log("✓ Bước 3: Tuần tự hóa cây DOM ngược lại vào JSZip thành công.");

        /* =====================================================
           Bước 4: Sinh Blob đầu ra và kích hoạt Tải xuống
        ===================================================== */
        setProgress(85, "Đang xuất bản file test...");
        const outputBlob = await generateDocxBlob(zip);

        const objectUrl = URL.createObjectURL(outputBlob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = "Identity_Test_" + selectedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);

        /* =====================================================
           Cập nhật UI kết quả
        ===================================================== */
        checkList.innerHTML = `
            ✅ Reader giải nén ổn định<br>
            ✅ DOMParser khởi tạo thành công<br>
            ✅ Định vị vùng dữ liệu w:body<br>
            ✅ XMLSerializer tuần tự hóa an toàn<br>
            ✅ Xuất file Identity_Test về máy thành công
        `;

        log("✓ Hoàn thành kiểm thử! Hãy kiểm tra file trong thư mục Download.");
        setProgress(100, "Hoàn thành");

    } 
    catch (err) {
        console.error(err);
        log("❌ Lỗi hệ thống: " + err.message);
        alert(err.message);
        setProgress(0, "Lỗi");
    }
});