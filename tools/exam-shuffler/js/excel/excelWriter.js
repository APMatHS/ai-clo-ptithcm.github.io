/* =====================================================
   excelWriter.js v1.4
   Chuẩn chung AI-CLO / Exam Shuffler / cham-thi-clo:
   1) Đáp án
   2) Đáp án ngang (chuyển vị)
   3) Phân bố CLO
   4) Đối chiếu đề
===================================================== */

import * as ExcelJS from "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/+esm";
const Excel = ExcelJS.default ?? ExcelJS;

import { exportAnswers } from "./answerExporter.js";
import { formatWorksheet } from "./formatter.js";
import { exportCLOStatistics } from "./cloStatisticsExporter.js";
import { exportHorizontalAnswers } from "./horizontalAnswerExporter.js";
import { exportQuestionMapping } from "./mappingExporter.js";

export async function buildAnswerWorkbook(exams) {
    if (!Array.isArray(exams) || exams.length === 0) {
        throw new Error("[excelWriter] Danh sách bộ đề (exams) không hợp lệ hoặc rỗng.");
    }
    if (!Excel || typeof Excel.Workbook !== "function") {
        throw new Error("[excelWriter] Thư viện ExcelJS chưa được nạp chính xác.");
    }

    const workbook = new Excel.Workbook();
    workbook.creator = "Exam Shuffler";
    workbook.lastModifiedBy = "Exam Shuffler";
    workbook.company = "Exam Shuffler";
    workbook.title = "Dap an + CLO";
    workbook.subject = "Canonical answer workbook for cham-thi-clo";
    workbook.description = "4-sheet canonical workbook shared with AI-CLO";
    workbook.created = new Date();
    workbook.modified = new Date();

    const answerSheet = workbook.addWorksheet("Đáp án", { views: [{ showGridLines: true }] });
    exportAnswers(answerSheet, exams);
    formatWorksheet(answerSheet);

    const horizontalSheet = workbook.addWorksheet("Đáp án ngang", { views: [{ showGridLines: true }] });
    exportHorizontalAnswers(horizontalSheet, exams);
    formatWorksheet(horizontalSheet);
    horizontalSheet.getColumn(1).width = 12;
    horizontalSheet.getColumn(2).width = 11;

    const cloSheet = workbook.addWorksheet("Phân bố CLO", { views: [{ showGridLines: true }] });
    exportCLOStatistics(cloSheet, exams);
    formatWorksheet(cloSheet);

    const mappingSheet = workbook.addWorksheet("Đối chiếu đề", { views: [{ showGridLines: true }] });
    exportQuestionMapping(mappingSheet, exams);
    formatWorksheet(mappingSheet);
    mappingSheet.getColumn(1).width = 12;
    mappingSheet.getColumn(2).width = 10;
    mappingSheet.getColumn(3).width = 10;
    mappingSheet.getColumn(4).width = 12;
    mappingSheet.getColumn(5).width = 13;
    mappingSheet.getColumn(6).width = 10;

    return workbook;
}
