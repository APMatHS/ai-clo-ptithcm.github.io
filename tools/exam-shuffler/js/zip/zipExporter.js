/* ==========================================================
 * zipExporter.js v1.1
 * Đóng gói DOCX + Excel. Lỗi được throw lên controller để
 * không báo "Hoàn tất" giả khi ZIP thất bại.
 * ========================================================== */

function validateInput(exams, excels, docs) {
    if (!Array.isArray(exams)) throw new Error("exams phải là Array.");
    if (!Array.isArray(excels)) throw new Error("excels phải là Array.");
    if (!Array.isArray(docs)) throw new Error("docs phải là Array.");
}

function validateFile(file) {
    if (!file || typeof file !== "object") throw new Error("Định dạng file không hợp lệ.");
    if (!file.name) throw new Error("Thiếu tên file.");
    if (!(file.blob instanceof Blob)) throw new Error(`"${file.name}" không phải Blob.`);
}

function addFilesToFolder(folder, files) {
    if (!folder || !files.length) return;
    for (const file of files) {
        validateFile(file);
        folder.file(file.name, file.blob);
    }
}

function downloadZip(blob, fileName) {
    if (typeof saveAs === "function") {
        saveAs(blob, fileName);
        return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function finalizeZip(zip, zipName) {
    const blob = await zip.generateAsync({
        type: "blob",
        compression: "STORE"
    });

    downloadZip(blob, zipName);
    return blob;
}

export async function exportZip(options = {}) {
    const {
        exams = [],
        excels = [],
        docs = [],
        zipName = "Exam-CLO.zip"
    } = options;

    validateInput(exams, excels, docs);

    const zip = new JSZip();
    addFilesToFolder(zip.folder("Exams"), exams);
    addFilesToFolder(zip.folder("Excel"), excels);
    addFilesToFolder(zip.folder("Docs"), docs);

    return await finalizeZip(zip, zipName);
}

export function createDefaultZipName() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const stamp =
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) + "_" +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());

    return `Exam-CLO_${stamp}.zip`;
}

export function hasExportFiles(exams = [], excels = [], docs = []) {
    return exams.length > 0 || excels.length > 0 || docs.length > 0;
}

export function addTextFile(folder, fileName, content = "") {
    if (!folder) throw new Error("Folder không hợp lệ.");
    folder.file(fileName, content);
}

export function createReadme() {
    return `Exam Shuffler

Package: Exam-CLO.zip

- Exams/: các đề đã trộn.
- Excel/: đáp án và thống kê CLO.
`;
}

export function addReadme(docsFolder) {
    addTextFile(docsFolder, "README.txt", createReadme());
}

export function addVersionFile(docsFolder, version = "2.6.0") {
    docsFolder.file("version.json", JSON.stringify({
        app: "Exam Shuffler",
        package: "Exam-CLO.zip",
        version,
        created: new Date().toISOString()
    }, null, 4));
}

export function printExportInfo(zipName, totalFiles) {
    console.log(`[Exam Shuffler] ${zipName}: ${totalFiles} files`);
}
