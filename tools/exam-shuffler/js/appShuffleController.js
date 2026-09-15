/* =====================================================
   appShuffleController.js
   Exam Shuffler v2.11
===================================================== */

import { analyzeExamSource, processExamShuffling } from "./appShuffle.js";
import { exportZip } from "./zip/zipExporter.js";
import { renderAnalysisPreview, collectManualOverrides } from "./preview/examPreview.js";
import { inferMetadataFromFile } from "./docx/metadataExtractor.js";
import { exportBMForms } from "./export/bmFormsExporter.js";

const fileInput = document.getElementById("docxFile");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const processBtn = document.getElementById("processBtn");
const checkFormatBtn = document.getElementById("checkFormatBtn");
const analysisPreview = document.getElementById("analysisPreview");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const logContent = document.getElementById("logContent");
const checkList = document.getElementById("checkList");
const questionCountInput = document.getElementById("questionCount");
const includeBMForms = document.getElementById("includeBMForms");
const bmMetadataPanel = document.getElementById("bmMetadataPanel");
const bmAutoReadStatus = document.getElementById("bmAutoReadStatus");

let selectedFile = null;
let lastAnalysis = null;
let lastAnalysisCount = null;
const MAX_EXAMS = 20;

const bmFields = {
    subject: document.getElementById("bmSubject"),
    courseCode: document.getElementById("bmCourseCode"),
    credits: document.getElementById("bmCredits"),
    semester: document.getElementById("bmSemester"),
    academicYear: document.getElementById("bmAcademicYear"),
    className: document.getElementById("bmClassName"),
    trainingProgram: document.getElementById("bmTrainingProgram"),
    examFormat: document.getElementById("bmExamFormat"),
    faculty: document.getElementById("bmFaculty"),
    department: document.getElementById("bmDepartment"),
    examDate: document.getElementById("bmExamDate"),
    examSession: document.getElementById("bmExamSession"),
    durationMinutes: document.getElementById("bmDuration"),
    preparedBy: document.getElementById("bmPreparedBy"),
    approvedBy: document.getElementById("bmApprovedBy"),
    signedDate: document.getElementById("bmSignedDate"),
    cloDescriptions: document.getElementById("bmCloDescriptions")
};

function log(message) {
    if (!logContent) return;
    logContent.textContent += "\n> " + message;
    logContent.scrollTop = logContent.scrollHeight;
}

function setProgress(percent, text = "") {
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (statusText && text) statusText.textContent = text;
}

function invalidateAnalysis(message = "Cần kiểm tra lại định dạng.") {
    lastAnalysis = null;
    lastAnalysisCount = null;
    if (analysisPreview) {
        analysisPreview.innerHTML = "";
        analysisPreview.classList.add("hidden");
    }
    if (checkList) checkList.innerHTML = `ℹ️ ${message}`;
}

function getExamCodes() {
    const input = document.getElementById("examCodes");
    if (!input) throw new Error("Không tìm thấy ô danh sách mã đề.");
    const examCodes = input.value.split(",").map(code => code.trim()).filter(Boolean);
    if (examCodes.length === 0) throw new Error("Vui lòng nhập ít nhất một mã đề.");
    if (examCodes.length > MAX_EXAMS) throw new Error(`Chỉ hỗ trợ tối đa ${MAX_EXAMS} mã đề trong một lần.`);
    const invalid = examCodes.find(code => !/^\d{3}$/.test(code));
    if (invalid) throw new Error(`Mã đề "${invalid}" không hợp lệ. Mã đề phải gồm 3 chữ số.`);
    if (new Set(examCodes).size !== examCodes.length) throw new Error("Danh sách mã đề có mã trùng nhau.");
    return examCodes;
}

function getExpectedQuestionCount() {
    if (!questionCountInput) throw new Error("Không tìm thấy ô xác nhận số câu.");
    const value = Number(questionCountInput.value);
    if (!Number.isInteger(value) || value < 1 || value > 500) throw new Error("Số câu phải là số nguyên từ 1 đến 500.");
    return value;
}

function collectBMMetadata() {
    const out = {};
    for (const [key, el] of Object.entries(bmFields)) out[key] = el?.value?.trim?.() ?? "";
    if (out.durationMinutes) out.durationMinutes = Number(out.durationMinutes);
    return out;
}

function applyBMMetadata(metadata = {}) {
    let found = 0;
    for (const [key, el] of Object.entries(bmFields)) {
        if (!el) continue;
        const value = metadata[key];
        if (value !== "" && value != null) {
            el.value = value;
            found++;
        }
    }
    if (bmAutoReadStatus) {
        bmAutoReadStatus.textContent = found
            ? `✓ Đã tự đọc được ${found} trường từ phần đầu đề Word. Hãy kiểm tra và bổ sung nếu cần.`
            : "Không nhận diện được trường hành chính rõ ràng từ phần đầu đề; bạn có thể nhập thủ công.";
    }
}

function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
        alert("Vui lòng chọn file DOCX.");
        return;
    }
    selectedFile = file;
    if (fileName) fileName.textContent = file.name;
    if (fileInfo) fileInfo.classList.remove("hidden");
    invalidateAnalysis("Đã chọn file. Nhập số câu rồi bấm “Kiểm tra định dạng”.");
    log(`Đã chọn file: ${file.name}`);
}

async function tryAutoReadBMMetadata(expectedQuestionCount) {
    if (!includeBMForms?.checked || !selectedFile) return;
    try {
        if (bmAutoReadStatus) bmAutoReadStatus.textContent = "Đang đọc thông tin từ phần đầu đề...";
        const metadata = await inferMetadataFromFile(selectedFile, expectedQuestionCount);
        applyBMMetadata(metadata);
        log("Đã thử tự đọc thông tin BM06/BM08 từ phần đầu file Word.");
    } catch (error) {
        if (bmAutoReadStatus) bmAutoReadStatus.textContent = `Không tự đọc được metadata: ${error.message}`;
        log(`⚠️ Không tự đọc được metadata BM: ${error.message}`);
    }
}

async function runFormatCheck() {
    if (!selectedFile) throw new Error("Vui lòng chọn file Word đề thi gốc.");
    const expectedQuestionCount = getExpectedQuestionCount();
    if (checkFormatBtn) {
        checkFormatBtn.disabled = true;
        checkFormatBtn.classList.add("opacity-60", "cursor-not-allowed");
    }
    setProgress(5, "Đang phân tích định dạng đề...");

    try {
        const analysis = await analyzeExamSource(selectedFile, expectedQuestionCount);
        lastAnalysis = analysis;
        lastAnalysisCount = expectedQuestionCount;
        const d = analysis.diagnostics;
        if (checkList) {
            checkList.innerHTML = `
                ✅ Tìm được đúng <b>${expectedQuestionCount}</b> câu, đánh số liên tục từ Câu 1 đến Câu ${expectedQuestionCount}.<br>
                ${d.badChoiceCount ? `❌ Có <b>${d.badChoiceCount}</b> câu không đủ 4 phương án.<br>` : "✅ Mỗi câu có 4 phương án A/B/C/D.<br>"}
                ${d.missingCorrect ? `⚠️ Có <b>${d.missingCorrect}</b> câu chưa xác định đúng 1 đáp án — chọn lại ở bên dưới.<br>` : "✅ Đã nhận diện đáp án đúng cho mọi câu.<br>"}
                ${d.missingClo ? `ℹ️ Có <b>${d.missingClo}</b> câu chưa có CLO — CLO không bắt buộc.<br>` : "✅ Đã nhận diện CLO cho mọi câu.<br>"}
                ℹ️ Phát hiện ${d.detectedQuestionStarts} mốc giống đầu câu trong toàn tài liệu.
            `;
        }
        renderAnalysisPreview(analysisPreview, analysis);
        await tryAutoReadBMMetadata(expectedQuestionCount);
        log(`Kiểm tra định dạng: ${expectedQuestionCount} câu; thiếu đáp án ${d.missingCorrect}; thiếu CLO ${d.missingClo}.`);
        setProgress(20, "Đã phân tích xong. Hãy kiểm tra/sửa đáp án và CLO nếu cần.");
        return analysis;
    } finally {
        if (checkFormatBtn) {
            checkFormatBtn.disabled = false;
            checkFormatBtn.classList.remove("opacity-60", "cursor-not-allowed");
        }
    }
}

function validateOverrides(overrides, expectedCount) {
    if (!Array.isArray(overrides) || overrides.length < expectedCount) throw new Error("Dữ liệu kiểm tra chưa đầy đủ. Hãy bấm “Kiểm tra định dạng” lại.");
    const missing = [];
    for (let i = 0; i < expectedCount; i++) {
        if (!/^[A-D]$/.test(String(overrides[i]?.correct || "").toUpperCase())) missing.push(i + 1);
    }
    if (missing.length) throw new Error(`Chưa chọn đáp án đúng cho câu: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? "..." : ""}.`);
}

if (fileInput) fileInput.addEventListener("change", event => handleFile(event.target.files[0]));
if (questionCountInput) questionCountInput.addEventListener("input", () => invalidateAnalysis("Số câu đã thay đổi. Hãy kiểm tra định dạng lại."));
if (includeBMForms) {
    includeBMForms.addEventListener("change", async () => {
        bmMetadataPanel?.classList.toggle("hidden", !includeBMForms.checked);
        if (includeBMForms.checked && selectedFile && lastAnalysisCount) await tryAutoReadBMMetadata(lastAnalysisCount);
    });
}

if (dropZone) {
    ["dragenter", "dragover"].forEach(eventName => dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(eventName => dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove("dragover"); }));
    dropZone.addEventListener("drop", event => handleFile(event.dataTransfer.files[0]));
}

if (checkFormatBtn) {
    checkFormatBtn.addEventListener("click", async () => {
        try {
            await runFormatCheck();
        } catch (error) {
            console.error(error);
            log(`❌ Kiểm tra định dạng: ${error.message}`);
            alert(`Lỗi kiểm tra định dạng: ${error.message}`);
            setProgress(0, "Không thể phân tích đề.");
        }
    });
}

if (processBtn) {
    processBtn.addEventListener("click", async () => {
        if (!selectedFile) { alert("Vui lòng chọn file Word đề thi gốc."); return; }
        processBtn.disabled = true;
        processBtn.classList.add("opacity-60", "cursor-not-allowed");
        setProgress(0, "Bắt đầu kiểm tra đề...");

        try {
            const examCodes = getExamCodes();
            const expectedQuestionCount = getExpectedQuestionCount();
            if (!lastAnalysis || lastAnalysisCount !== expectedQuestionCount) throw new Error("Hãy bấm “Kiểm tra định dạng” và xem lại câu hỏi trước khi trộn.");

            const manualOverrides = collectManualOverrides(analysisPreview);
            validateOverrides(manualOverrides, expectedQuestionCount);
            if (includeBMForms?.checked) {
                const missingClo = manualOverrides.map((item, index) => item?.clo ? null : index + 1).filter(Boolean);
                if (missingClo.length) throw new Error(`Muốn xuất BM08, cần nhập CLO cho câu: ${missingClo.slice(0, 12).join(", ")}${missingClo.length > 12 ? "..." : ""}.`);
            }
            const badChoices = (lastAnalysis.questions || []).filter(q => (q.choices || []).length !== 4);
            if (badChoices.length) throw new Error(`Có ${badChoices.length} câu không đủ 4 phương án A/B/C/D. Cần sửa file Word trước khi trộn.`);

            log("====================================");
            log(`Xác nhận số câu: ${expectedQuestionCount}`);
            log(`Mã đề: ${examCodes.join(", ")}`);

            const { exams, docxFiles, excelBlob, diagnostics } = await processExamShuffling(
                selectedFile,
                examCodes,
                { shuffleQuestions: true, shuffleChoices: true, expectedQuestionCount, manualOverrides },
                (percent, message) => { setProgress(percent, message); log(message); }
            );

            const docs = includeBMForms?.checked ? await exportBMForms(exams, collectBMMetadata()) : [];
            if (docs.length) log(`Đã tạo BM06 và ${examCodes.length} file BM08 theo mẫu PTIT.`);

            setProgress(100, "Đang đóng gói ZIP...");
            await exportZip({
                exams: docxFiles.map(({ examCode, blob }) => ({ name: `Đề_${examCode}.docx`, blob })),
                excels: [{ name: "Dap_an_CLO.xlsx", blob: excelBlob }],
                docs,
                zipName: "Exam-CLO.zip"
            });

            if (checkList) {
                const cloText = Object.entries(diagnostics.cloCounts || {}).map(([clo, count]) => `${clo}: ${count}`).join(" • ") || "Không có CLO";
                checkList.innerHTML = `
                    ✅ Đã tạo ${examCodes.length} mã đề.<br>
                    ✅ Excel chuẩn 4 sheet: Đáp án, Đáp án ngang, Phân bố CLO, Đối chiếu đề.<br>
                    ✅ Phân bố CLO giữ kiểu liệt kê số câu theo từng mã đề; ${cloText}.<br>
                    ${docs.length ? "✅ Đã xuất BM06 và BM08 có đáp án/phân bố CLO theo từng mã đề.<br>" : ""}
                    ✅ Mã đề body/header/footer và PAGE/NUMPAGES được giữ đúng.
                `;
            }

            log("✓ Hoàn tất và đã tạo file ZIP.");
            setProgress(100, "Hoàn tất.");
        } catch (error) {
            console.error(error);
            log(`❌ Lỗi: ${error.message}`);
            alert(`Lỗi: ${error.message}`);
            setProgress(0, "Xảy ra lỗi - chưa xuất bộ đề.");
        } finally {
            processBtn.disabled = false;
            processBtn.classList.remove("opacity-60", "cursor-not-allowed");
        }
    });
}
