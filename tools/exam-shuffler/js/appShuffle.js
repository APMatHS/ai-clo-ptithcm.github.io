/* =====================================================
   appShuffle.js
   Exam Shuffler v3.0
===================================================== */

import { readDocx } from "./docx/docxReader.js";
import { loadDocument, getDocumentBody, updateDocumentBody, writeRawDocument } from "./docx/docxWriter.js";
import { splitQuestions } from "./docx/questionSplitter.js";
import { analyzeQuestions } from "./docx/answerExtractor.js";
import { createNumberingResolver } from "./docx/numberingResolver.js";
import { shuffleQuestions } from "./shuffle/questionShuffle.js";
import { shuffleAllChoices } from "./shuffle/choiceShuffle.js";
import { renumberAllQuestions } from "./shuffle/questionRenumber.js";
import { buildExamSet } from "./shuffle/examBuilder.js";
import { validateExamSet } from "./utils/validator.js";
import { applyExamCodeToExam, updateExamCodeInZipParts } from "./docx/examCodeWriter.js";
import { exportAnswerExcel } from "./excel/excelExporter.js";
import { formatExamDocument } from "./docx/docxFormatter.js";

function cloneNode(node) {
    return node && typeof node.cloneNode === "function" ? node.cloneNode(true) : node;
}

function normalizeClo(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(?:CLO\s*)?(\d+)$/i);
    return match ? match[1] : text;
}

function cloneQuestions(questions) {
    if (!Array.isArray(questions)) return [];
    return questions.map(q => ({
        ...q,
        nodes: Array.isArray(q.nodes) ? q.nodes.map(cloneNode) : [],
        stem: Array.isArray(q.stem) ? q.stem.map(cloneNode) : [],
        trailing: Array.isArray(q.trailing) ? q.trailing.map(cloneNode) : [],
        choices: Array.isArray(q.choices)
            ? q.choices.map(choice => ({
                ...choice,
                nodes: Array.isArray(choice.nodes) ? choice.nodes.map(cloneNode) : []
            }))
            : [],
        layoutRows: Array.isArray(q.layoutRows)
            ? q.layoutRows.map(row => row.passthrough
                ? { ...row, node: cloneNode(row.node) }
                : {
                    ...row,
                    template: cloneNode(row.template),
                    choiceIndexes: Array.isArray(row.choiceIndexes) ? [...row.choiceIndexes] : []
                })
            : []
    }));
}

function assembleExamNodes(exam) {
    return [
        ...(Array.isArray(exam.header) ? exam.header : []),
        ...(Array.isArray(exam.questions) ? exam.questions.flatMap(q => Array.isArray(q.nodes) ? q.nodes : []) : []),
        ...(Array.isArray(exam.footer) ? exam.footer : [])
    ];
}

async function parseSource(fileInput, expectedQuestionCount) {
    const count = Number(expectedQuestionCount);
    if (!Number.isInteger(count) || count <= 0) {
        throw new Error("Vui lòng xác nhận số câu của đề trước khi kiểm tra/trộn.");
    }

    const zip = await readDocx(fileInput);
    const xmlDoc = await loadDocument(zip);
    const numberingResolver = await createNumberingResolver(zip);
    const bodyNode = getDocumentBody(xmlDoc);
    const splitResult = splitQuestions(bodyNode, count);
    const header = splitResult.headerNodes ?? [];
    const questionBlocks = splitResult.questionBlocks ?? [];
    const footer = splitResult.footerNodes ?? [];

    if (questionBlocks.length !== count) {
        throw new Error(`Số câu không khớp: xác nhận ${count}, nhưng tách được ${questionBlocks.length}.`);
    }

    const rawQuestions = analyzeQuestions(questionBlocks, numberingResolver).map((q, index) => ({
        ...q,
        sourceIndex: index + 1,
        originalNumber: Number(q.number) || index + 1,
        clo: normalizeClo(q.clo),
        originalCorrect: q.correct || ""
    }));

    return { zip, xmlDoc, splitResult, header, footer, rawQuestions, expectedQuestionCount: count };
}

function applyManualOverrides(rawQuestions, overrides = []) {
    return rawQuestions.map((q, index) => {
        const override = overrides[index] || {};
        const clo = override.clo !== undefined ? normalizeClo(override.clo) : normalizeClo(q.clo);
        const chosen = String(override.correct ?? "").trim().toUpperCase();
        const correct = /^[A-D]$/.test(chosen) ? chosen : String(q.correct || "").toUpperCase();
        const choices = (q.choices || []).map(choice => ({
            ...choice,
            correct: /^[A-D]$/.test(correct) ? String(choice.label).toUpperCase() === correct : Boolean(choice.correct)
        }));
        return { ...q, clo, correct, choices, originalCorrect: correct };
    });
}

function cloCounts(questions) {
    const counts = {};
    questions.forEach(q => {
        if (!q.clo) return;
        const key = `CLO${q.clo}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

export async function analyzeExamSource(fileInput, expectedQuestionCount) {
    const parsed = await parseSource(fileInput, expectedQuestionCount);
    const questions = parsed.rawQuestions.map(q => ({
        sourceIndex: q.sourceIndex,
        originalNumber: q.originalNumber,
        stemText: q.stemText || "",
        clo: q.clo || "",
        correct: q.correct || "",
        correctCount: (q.choices || []).filter(c => c.correct).length,
        choicesFromNumbering: Boolean(q.choicesFromNumbering),
        choices: (q.choices || []).map(c => ({
            label: c.label,
            text: String(c.text || "").replace(/^\s*[A-D]\s*[\.\:\)]\s*/i, ""),
            correct: Boolean(c.correct)
        }))
    }));

    return {
        questions,
        diagnostics: {
            expectedQuestionCount: parsed.expectedQuestionCount,
            detectedQuestionStarts: parsed.splitResult.detectedQuestionStarts,
            selectedSourceNumbers: parsed.splitResult.selectedSourceNumbers || [],
            headerNodes: parsed.header.length,
            footerNodes: parsed.footer.length,
            cloCounts: cloCounts(parsed.rawQuestions),
            numberingChoiceQuestions: parsed.rawQuestions.filter(q => q.choicesFromNumbering).length,
            missingClo: parsed.rawQuestions.filter(q => !q.clo).length,
            missingCorrect: parsed.rawQuestions.filter(q => (q.choices || []).filter(c => c.correct).length !== 1).length,
            badChoiceCount: parsed.rawQuestions.filter(q => (q.choices || []).length !== 4).length
        }
    };
}

async function renderExamToBlob(exam, originalZip, parsedXmlDoc) {
    const xmlDocClone = parsedXmlDoc.cloneNode(true);
    const zipClone = originalZip.clone();
    const formattedNodes = formatExamDocument(assembleExamNodes(exam));
    updateDocumentBody(xmlDocClone, formattedNodes);
    writeRawDocument(zipClone, xmlDocClone);
    const auxiliaryUpdate = await updateExamCodeInZipParts(zipClone, exam.examCode);
    if (!exam.bodyExamCodeUpdated && auxiliaryUpdate.replacements === 0) {
        throw new Error(`Mã đề ${exam.examCode}: không tìm thấy "Mã đề/Đề số/Code" trong phần thân, header hoặc footer của Word.`);
    }
    return await zipClone.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });
}

export async function processExamShuffling(
    fileInput,
    examCodes = ["101", "102", "103", "104"],
    options = { shuffleQuestions: true, shuffleChoices: true, expectedQuestionCount: null, manualOverrides: [] },
    onProgress = () => {}
) {
    const expectedQuestionCount = Number(options.expectedQuestionCount);
    onProgress(5, "Đang đọc và phân tích file Word...");
    const parsed = await parseSource(fileInput, expectedQuestionCount);
    const { zip, xmlDoc, splitResult, header, footer } = parsed;

    onProgress(28, "Đang áp dụng các chỉnh sửa đáp án/CLO từ màn hình kiểm tra...");
    const rawQuestions = applyManualOverrides(parsed.rawQuestions, options.manualOverrides || []);
    const malformed = rawQuestions
        .map((q, index) => ({ number: index + 1, choices: q.choices.length, correct: q.choices.filter(c => c.correct).length }))
        .filter(row => row.choices !== 4 || row.correct !== 1);
    if (malformed.length > 0) {
        const sample = malformed.slice(0, 8).map(row => `Câu ${row.number}: ${row.choices} phương án, ${row.correct} đáp án đúng`).join("; ");
        throw new Error(`Đề chưa đạt kiểm tra trước khi trộn. ${sample}`);
    }

    onProgress(42, `Đã xác nhận ${expectedQuestionCount} câu. Đang tạo ${examCodes.length} mã đề...`);
    const questionSets = examCodes.map(() => {
        let processed = cloneQuestions(rawQuestions);
        if (options.shuffleQuestions !== false) processed = shuffleQuestions(processed);
        if (options.shuffleChoices !== false) processed = shuffleAllChoices(processed);
        return renumberAllQuestions(processed);
    });

    const exams = buildExamSet(examCodes, header, questionSets, footer);
    exams.forEach(exam => { exam.bodyExamCodeUpdated = applyExamCodeToExam(exam, false); });

    const validationResults = validateExamSet(exams, { expectedQuestionCount });
    const invalid = validationResults.filter(result => !result.valid);
    if (invalid.length > 0) {
        const summary = invalid.map(result => `${result.examCode}: ${result.errors.slice(0, 3).join("; ")}`).join(" | ");
        throw new Error(`Kiểm tra tính toàn vẹn thất bại. ${summary}`);
    }

    const exportResults = [];
    for (let index = 0; index < exams.length; index++) {
        const exam = exams[index];
        const percent = 56 + Math.round((index / exams.length) * 30);
        onProgress(percent, `Đang tạo mã đề ${exam.examCode} (${index + 1}/${exams.length})...`);
        const blob = await renderExamToBlob(exam, zip, xmlDoc);
        exportResults.push({ examCode: exam.examCode, blob });
    }

    onProgress(90, "Đang tạo Excel chuẩn 4 sheet...");
    const excelBlob = await exportAnswerExcel(exams, "Dap_an_CLO.xlsx", false, rawQuestions);
    onProgress(100, "Hoàn tất bộ đề và bảng Excel.");

    return {
        exams,
        docxFiles: exportResults,
        excelBlob,
        diagnostics: {
            expectedQuestionCount,
            detectedQuestionStarts: splitResult.detectedQuestionStarts,
            selectedSourceNumbers: splitResult.selectedSourceNumbers || [],
            headerNodes: header.length,
            footerNodes: footer.length,
            cloCounts: cloCounts(rawQuestions),
            numberingChoiceQuestions: rawQuestions.filter(q => q.choicesFromNumbering).length,
            missingClo: rawQuestions.filter(q => !q.clo).length
        }
    };
}
