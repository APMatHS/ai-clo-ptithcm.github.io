/* =====================================================
   downloadExcel.js
   Exam Shuffler v1.0 - Browser File Downloader for Excel

   Chức năng:
   - Nhận một đối tượng ExcelJS Workbook đã hoàn chỉnh.
   - Chuyển đổi Workbook sang Binary Buffer / Blob định dạng .xlsx.
   - Kích hoạt thao tác tải file xuống trên trình duyệt người dùng.
   - Tự động dọn dẹp URL Object để tối ưu bộ nhớ DOM (REVOKE_URL).
===================================================== */

/**
 * Xuất Workbook thành file .xlsx và kích hoạt download trên Browser
 * 
 * @param {Object} workbook - Đối tượng ExcelJS Workbook đã hoàn chỉnh
 * @param {string} fileName - Tên file xuất ra (mặc định: "AnswerKey.xlsx")
 */
export async function downloadWorkbook(workbook, fileName = "AnswerKey.xlsx") {
    // 1. Validation Fail-Fast
    if (!workbook || typeof workbook.xlsx?.writeBuffer !== "function") {
        throw new Error("[downloadExcel] Đối tượng Workbook không hợp lệ hoặc thiếu phương thức writeBuffer.");
    }

    // 2. Chuyển đổi Workbook thành Binary Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 3. Tạo Blob với MIME type chuẩn của Excel (.xlsx)
    const blob = new Blob(
        [buffer],
        {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
    );

    // 4. Tạo URL tạm thời cho Blob
    const url = URL.createObjectURL(blob);

    // 5. Tạo thẻ <a> ẩn để kích hoạt sự kiện download
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;

    document.body.appendChild(anchor);
    anchor.click();

    // 6. Dọn dẹp DOM và giải phóng bộ nhớ
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}