/* =====================================================
   formatter.js
   Exam Shuffler v1.0 - Clean & Minimal Excel Formatter

   Chức năng:
   - Áp dụng các định dạng giao diện cơ bản cho Worksheet "Đáp án".
   - Chuẩn hóa Font: Times New Roman, Size 12 cho toàn bộ ô.
   - Căn giữa (Alignment) ngang/dọc cho dữ liệu.
   - Viền mảnh (Thin Border) cho các ô chứa dữ liệu.
   - In đậm (Bold) cho dòng Header (Dòng 1).
   - Đặt chiều rộng cột (Column Width) cố định, không tô màu nền.
===================================================== */

/**
 * Định dạng giao diện cho toàn bộ Worksheet "Đáp án"
 * 
 * @param {Object} worksheet - Đối tượng ExcelJS Worksheet đã có dữ liệu thô
 */
export function formatWorksheet(worksheet) {
    if (!worksheet) {
        throw new Error("[formatter] Worksheet không được để trống.");
    }

    const rowCount = worksheet.rowCount;
    const columnCount = worksheet.columnCount;

    if (rowCount === 0 || columnCount === 0) return;

    // 1. Áp dụng Font, Alignment và Border cho toàn bộ ô có dữ liệu
    applyCellFormatting(worksheet, rowCount, columnCount);

    // 2. Định dạng riêng cho dòng Header (Dòng 1)
    formatHeaderRow(worksheet, columnCount);

    // 3. Đặt kích thước chiều rộng cột cố định
    setColumnWidths(worksheet, columnCount);
}

/**
 * 1. Áp dụng Font Times New Roman 12, Alignment căn giữa và Thin Border
 */
function applyCellFormatting(worksheet, rowCount, columnCount) {
    const thinBorder = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
    };

    const centerAlignment = {
        vertical: "middle",
        horizontal: "center"
    };

    const defaultFont = {
        name: "Times New Roman",
        size: 12,
        bold: false
    };

    for (let r = 1; r <= rowCount; r++) {
        const row = worksheet.getRow(r);
        for (let c = 1; c <= columnCount; c++) {
            const cell = row.getCell(c);

            cell.font = { ...defaultFont };
            cell.alignment = centerAlignment;
            cell.border = thinBorder;
        }
    }
}

/**
 * 2. Định dạng dòng Header (Dòng 1): In đậm (Bold)
 */
function formatHeaderRow(worksheet, columnCount) {
    const headerRow = worksheet.getRow(1);

    for (let c = 1; c <= columnCount; c++) {
        const cell = headerRow.getCell(c);
        cell.font = {
            name: "Times New Roman",
            size: 12,
            bold: true
        };
    }
}

/**
 * 3. Thiết lập chiều rộng cột cố định
 * - Cột 1 ("Câu"): 8
 * - Các cột còn lại (Mã đề, CLO): 10
 */
function setColumnWidths(worksheet, columnCount) {
    for (let c = 1; c <= columnCount; c++) {
        const column = worksheet.getColumn(c);
        if (c === 1) {
            column.width = 8; // Cột "Câu"
        } else {
            column.width = 10; // Các cột Mã đề & CLO
        }
    }
}