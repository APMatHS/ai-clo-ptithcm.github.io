/* =====================================================
   numberingResolver.js v1.0
   - Đọc word/numbering.xml và word/styles.xml.
   - Nhận diện paragraph Word Numbering dạng A/B/C/D
     (upperLetter/lowerLetter), kể cả numPr kế thừa qua style.
   - Chỉ cung cấp metadata; answerExtractor quyết định chuỗi nào
     thực sự là 4 phương án của một câu hỏi.
===================================================== */

const W_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function attr(node, name) {
    if (!node) return "";
    return (
        node.getAttributeNS?.(W_NAMESPACE, name) ||
        node.getAttribute?.(`w:${name}`) ||
        node.getAttribute?.(name) ||
        ""
    );
}

function isElement(node, localName) {
    return Boolean(node && node.nodeType === 1 &&
        (node.localName === localName || node.nodeName === `w:${localName}`));
}

function directChild(parent, localName) {
    return Array.from(parent?.childNodes || []).find(child => isElement(child, localName)) || null;
}

function childValue(parent, localName) {
    const node = directChild(parent, localName);
    return node ? attr(node, "val") : "";
}

function parseXml(text, label) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const error = doc.getElementsByTagName("parsererror")[0];
    if (error) throw new Error(`Không đọc được ${label}: ${error.textContent || "XML không hợp lệ"}`);
    return doc;
}

async function loadXml(zip, path, required = false) {
    const entry = zip?.file?.(path);
    if (!entry) {
        if (required) throw new Error(`Thiếu ${path} trong file DOCX.`);
        return null;
    }
    return parseXml(await entry.async("string"), path);
}

function parseLevel(lvl) {
    const ilvl = Number(attr(lvl, "ilvl") || 0);
    const start = Number(childValue(lvl, "start") || 1);
    return {
        ilvl,
        start: Number.isFinite(start) ? start : 1,
        numFmt: childValue(lvl, "numFmt"),
        lvlText: childValue(lvl, "lvlText") || `%${ilvl + 1}.`
    };
}

function parseNumbering(numberingDoc) {
    const abstracts = new Map();
    const abstractNodes = numberingDoc?.getElementsByTagNameNS?.(W_NAMESPACE, "abstractNum") || [];

    for (let i = 0; i < abstractNodes.length; i++) {
        const node = abstractNodes[i];
        const id = attr(node, "abstractNumId");
        const levels = new Map();
        const lvlNodes = node.getElementsByTagNameNS(W_NAMESPACE, "lvl");
        for (let j = 0; j < lvlNodes.length; j++) {
            const parsed = parseLevel(lvlNodes[j]);
            levels.set(parsed.ilvl, parsed);
        }
        abstracts.set(String(id), levels);
    }

    const nums = new Map();
    const numNodes = numberingDoc?.getElementsByTagNameNS?.(W_NAMESPACE, "num") || [];
    for (let i = 0; i < numNodes.length; i++) {
        const node = numNodes[i];
        const numId = String(attr(node, "numId"));
        const abstractNumId = childValue(node, "abstractNumId");
        const overrides = new Map();
        const overrideNodes = node.getElementsByTagNameNS(W_NAMESPACE, "lvlOverride");

        for (let j = 0; j < overrideNodes.length; j++) {
            const override = overrideNodes[j];
            const ilvl = Number(attr(override, "ilvl") || 0);
            const startOverrideText = childValue(override, "startOverride");
            const overrideLvl = directChild(override, "lvl");
            overrides.set(ilvl, {
                startOverride: startOverrideText === "" ? null : Number(startOverrideText),
                level: overrideLvl ? parseLevel(overrideLvl) : null
            });
        }

        nums.set(numId, { abstractNumId: String(abstractNumId), overrides });
    }

    return { abstracts, nums };
}

function parseStyleNumbering(stylesDoc) {
    const styles = new Map();
    const nodes = stylesDoc?.getElementsByTagNameNS?.(W_NAMESPACE, "style") || [];

    for (let i = 0; i < nodes.length; i++) {
        const style = nodes[i];
        if (attr(style, "type") !== "paragraph") continue;
        const styleId = attr(style, "styleId");
        if (!styleId) continue;

        const pPr = directChild(style, "pPr");
        const numPr = directChild(pPr, "numPr");
        styles.set(styleId, {
            basedOn: childValue(style, "basedOn"),
            numId: numPr ? childValue(numPr, "numId") : "",
            ilvl: numPr && childValue(numPr, "ilvl") !== "" ? Number(childValue(numPr, "ilvl")) : null
        });
    }

    return styles;
}

function styleNumPr(styles, styleId) {
    const seen = new Set();
    let current = styleId;
    let inherited = { numId: "", ilvl: null };

    while (current && !seen.has(current)) {
        seen.add(current);
        const style = styles.get(current);
        if (!style) break;
        if (!inherited.numId && style.numId) inherited.numId = style.numId;
        if (inherited.ilvl == null && style.ilvl != null) inherited.ilvl = style.ilvl;
        if (inherited.numId && inherited.ilvl != null) break;
        current = style.basedOn;
    }
    return inherited;
}

function paragraphNumPr(paragraph, styles) {
    if (!isElement(paragraph, "p")) return null;
    const pPr = directChild(paragraph, "pPr");
    if (!pPr) return null;

    const numPr = directChild(pPr, "numPr");
    let numId = numPr ? childValue(numPr, "numId") : "";
    let ilvlText = numPr ? childValue(numPr, "ilvl") : "";
    let ilvl = ilvlText === "" ? null : Number(ilvlText);

    if (!numId || ilvl == null) {
        const pStyle = childValue(pPr, "pStyle");
        if (pStyle) {
            const inherited = styleNumPr(styles, pStyle);
            if (!numId) numId = inherited.numId;
            if (ilvl == null) ilvl = inherited.ilvl;
        }
    }

    if (!numId) return null;
    return { numId: String(numId), ilvl: Number.isFinite(ilvl) ? ilvl : 0 };
}

function effectiveLevel(model, numId, ilvl) {
    const num = model.nums.get(String(numId));
    if (!num) return null;

    const override = num.overrides.get(ilvl);
    const base = model.abstracts.get(num.abstractNumId)?.get(ilvl) || null;
    const level = override?.level || base;
    if (!level) return null;

    const start = override?.startOverride != null && Number.isFinite(override.startOverride)
        ? override.startOverride
        : level.start;

    return { ...level, start };
}

export async function createNumberingResolver(zip) {
    const numberingDoc = await loadXml(zip, "word/numbering.xml", false);
    if (!numberingDoc) {
        return Object.freeze({
            available: false,
            resolve: () => null
        });
    }

    const stylesDoc = await loadXml(zip, "word/styles.xml", false);
    const model = parseNumbering(numberingDoc);
    const styles = parseStyleNumbering(stylesDoc);

    return Object.freeze({
        available: true,
        resolve(paragraph) {
            const ref = paragraphNumPr(paragraph, styles);
            if (!ref) return null;
            const level = effectiveLevel(model, ref.numId, ref.ilvl);
            if (!level) return null;

            const fmt = String(level.numFmt || "");
            const isLetter = fmt === "upperLetter" || fmt === "lowerLetter";
            return {
                ...ref,
                ...level,
                key: `${ref.numId}:${ref.ilvl}`,
                isLetter,
                isChoiceLetter: isLetter && Number(level.start) === 1
            };
        }
    });
}
