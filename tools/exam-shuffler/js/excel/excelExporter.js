/* =====================================================
   excelExporter.js v1.1
===================================================== */

import { buildAnswerWorkbook } from "./excelWriter.js";
import { downloadWorkbook } from "./downloadExcel.js";

export async function exportAnswerExcel(
    exams,
    fileName = "Dap_An_Tong_Hop.xlsx",
    download = true,
    sourceQuestions = []
) {
    const workbook = await buildAnswerWorkbook(exams, sourceQuestions);

    if (download) {
        await downloadWorkbook(workbook, fileName);
        return null;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob(
        [buffer],
        { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
}
