const https = require("https");
const { getMessageType } = require("../utils/commonHelpers");
const { VN_TIMEZONE, getVNDateParts } = require("../utils/vnTime");

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 40 * 1000;
const MAX_PROMPT_CHARS = 4000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_MAX_CHARS_PER_MESSAGE = 1500;
const DEFAULT_MAX_MESSAGE_PARTS = 6;

const ASK_STYLE_PROMPT_CONCISE = [
    "Bạn là trợ lý tiếng Việt cho chat nhóm.",
    "Trả lời thân thiện, tự nhiên, rõ ràng.",
    "Mặc định trả lời ngắn gọn 3-8 câu, đi thẳng vào ý chính.",
    "Chỉ nêu ví dụ khi thực sự cần.",
    "Không dùng Markdown, không dùng LaTeX, không dùng ký hiệu dạng $...$.",
    "Nếu là phép tính, trả kết quả rõ ràng và giải thích ngắn.",
].join("\n");

const ASK_STYLE_PROMPT_DETAILED = [
    "Bạn là trợ lý tiếng Việt cho chat nhóm.",
    "Người dùng đang muốn câu trả lời chi tiết.",
    "Trả lời đầy đủ theo từng ý, có ví dụ khi phù hợp.",
    "Không dùng Markdown, không dùng LaTeX, không dùng ký hiệu dạng $...$.",
].join("\n");

function resolveGeminiApiKey() {
    const candidates = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API,
        process.env.GOOGLE_API_KEY,
    ];

    for (const value of candidates) {
        const key = String(value || "").trim();
        if (key) return key;
    }

    return "";
}

function truncateText(value, maxChars) {
    const text = String(value || "").trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}...`;
}

function toPositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    return normalized > 0 ? normalized : fallback;
}

function splitTextByLimit(text, limit) {
    const source = String(text || "").trim();
    if (!source) return [];
    if (source.length <= limit) return [source];

    const chunks = [];
    let remaining = source;

    while (remaining.length > limit) {
        let cutAt = remaining.lastIndexOf("\n", limit);
        if (cutAt < Math.floor(limit * 0.5)) {
            cutAt = remaining.lastIndexOf(" ", limit);
        }
        if (cutAt < Math.floor(limit * 0.5)) {
            cutAt = limit;
        }

        const head = remaining.slice(0, cutAt).trim();
        if (head) chunks.push(head);
        remaining = remaining.slice(cutAt).trim();
    }

    if (remaining) chunks.push(remaining);
    return chunks;
}

function shouldUseDetailedStyle(prompt) {
    const normalized = String(prompt || "").toLowerCase();
    const detailHints = [
        "chi tiết",
        "chi tiet",
        "phân tích sâu",
        "phan tich sau",
        "giải thích kỹ",
        "giai thich ky",
        "đầy đủ",
        "day du",
        "cụ thể",
        "cu the",
    ];
    return detailHints.some((hint) => normalized.includes(hint));
}

function sanitizeAnswerText(value) {
    let text = String(value || "").trim();
    if (!text) return "";

    text = text
        .replace(/\r\n/g, "\n")
        .replace(/```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\$([^$]+)\$/g, "$1")
        .replace(/\\times/g, "x")
        .replace(/\\cdot/g, "*")
        .replace(/\\div/g, "/")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/^\s*[-*]\s+/gm, "- ")
        .trim();

    return text;
}

function normalizeVietnameseText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function hasMathKeyword(prompt) {
    const normalized = normalizeVietnameseText(prompt);
    const keywords = [
        "tinh",
        "ket qua",
        "bang bao nhieu",
        "bao nhieu",
        "giai",
        "calc",
        "calculate",
        "solve",
        "math",
    ];

    return keywords.some((keyword) => normalized.includes(keyword));
}

function extractMathExpression(prompt) {
    const raw = String(prompt || "");
    const candidates = raw.match(/[\d\s()+\-*/xX×:.,]+/g) || [];
    const picked = candidates
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .filter((part) => /\d/.test(part) && /[+\-*/xX×:]/.test(part))
        .sort((a, b) => b.length - a.length)[0];

    return picked || "";
}

function isLikelyDateExpression(expression) {
    const text = String(expression || "").trim();
    return /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(text);
}

function shouldUseQuickMath(prompt, expression) {
    const fullPrompt = String(prompt || "").trim();
    const expr = String(expression || "").trim();
    if (!fullPrompt || !expr) return false;

    const mathKeyword = hasMathKeyword(fullPrompt);
    const compactPrompt = fullPrompt.replace(/\s+/g, "");
    const compactExpr = expr.replace(/\s+/g, "");
    const expressionLikeOnly = /^[\d+\-*/().,xX×:=\s]+$/.test(fullPrompt);

    if (expressionLikeOnly) return true;
    if (isLikelyDateExpression(expr) && !mathKeyword) return false;

    const promptWithoutExpr = fullPrompt.replace(expr, " ").trim();
    if (!mathKeyword && promptWithoutExpr.length > 10) return false;

    if (!mathKeyword && compactExpr.length < Math.max(4, Math.floor(compactPrompt.length * 0.35))) {
        return false;
    }

    return true;
}

function safeEvalMathExpression(expression) {
    const normalized = String(expression || "")
        .replace(/[xX×]/g, "*")
        .replace(/:/g, "/")
        .replace(/,/g, ".")
        .replace(/\s+/g, "")
        .trim();

    if (!normalized) return null;
    if (!/^[\d+\-*/().]+$/.test(normalized)) return null;
    if (!/[+\-*/]/.test(normalized)) return null;

    const openParens = (normalized.match(/\(/g) || []).length;
    const closeParens = (normalized.match(/\)/g) || []).length;
    if (openParens !== closeParens) return null;

    try {
        const value = Function(`"use strict"; return (${normalized});`)();
        if (!Number.isFinite(value)) return null;
        return value;
    } catch (_) {
        return null;
    }
}

function formatMathValue(value) {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(10)));
}

function tryBuildMathAnswer(prompt) {
    const expression = extractMathExpression(prompt);
    if (!expression) return "";
    if (!shouldUseQuickMath(prompt, expression)) return "";

    const value = safeEvalMathExpression(expression);
    if (value === null) return "";

    const normalizedExpression = String(expression || "")
        .replace(/\s+/g, "")
        .replace(/[xX×]/g, "x")
        .replace(/:/g, "/");
    const result = formatMathValue(value);

    return [
        `Kết quả: ${result}.`,
        `Theo thứ tự ưu tiên phép toán, biểu thức ${normalizedExpression} cho ra ${result}.`,
    ].join("\n");
}

function getVNWeekday(date = new Date()) {
    return new Intl.DateTimeFormat("vi-VN", {
        timeZone: VN_TIMEZONE,
        weekday: "long",
    }).format(date);
}

function getVNClock(date = new Date()) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: VN_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

function tryBuildDateTimeAnswer(prompt, now = new Date()) {
    const normalized = normalizeVietnameseText(prompt);

    const hasNowHint = /(hom nay|ngay hom nay|bay gio|luc nay|hien tai)/.test(normalized);
    const hasDateHint = /(ngay|thu|bao nhieu|nhieu|nhiu)/.test(normalized);
    const hasTimeHint = /(gio|may gio|mấy giờ)/.test(normalized);

    if (!hasNowHint || (!hasDateHint && !hasTimeHint)) {
        return "";
    }

    const { day, month, year } = getVNDateParts(now);
    const weekday = getVNWeekday(now);
    const clock = getVNClock(now);

    return `Hôm nay là ${weekday}, ngày ${Number(day)} tháng ${Number(month)} năm ${year}. Bây giờ là ${clock} (giờ Việt Nam).`;
}

function buildTemporalContext(now = new Date()) {
    const { day, month, year, dayLabel } = getVNDateParts(now);
    const weekday = getVNWeekday(now);
    const clock = getVNClock(now);

    return [
        "Context time (Asia/Ho_Chi_Minh):",
        `- Today is ${dayLabel} (${weekday}).`,
        `- Current local time is ${clock}.`,
        "If user asks about current date/time (today, now, this moment), use the context above exactly and do not guess another date.",
        "If user asks for real-time market/news data, clearly state you cannot browse live web in this bot command unless data is provided.",
        `Current numeric date: ${Number(day)}/${Number(month)}/${year}.`,
    ].join("\n");
}

function buildUsage(prefix = "!") {
    return [
        `Cách dùng: ${prefix}ask <câu hỏi>`,
        `Ví dụ: ${prefix}ask dịch giúp câu "How are you?" sang tiếng Việt.`,
        `Gợi ý: thêm "chi tiết" nếu bạn muốn câu trả lời dài hơn.`,
    ].join("\n");
}

function postJson(url, payload, timeoutMs = REQUEST_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        let timedOut = false;
        const body = JSON.stringify(payload);

        const req = https.request(
            url,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
                timeout: timeoutMs,
            },
            (res) => {
                let raw = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    raw += chunk;
                });
                res.on("end", () => {
                    if (timedOut) return;
                    resolve({
                        statusCode: Number(res.statusCode) || 0,
                        body: raw,
                    });
                });
            }
        );

        req.on("timeout", () => {
            timedOut = true;
            req.destroy(new Error("Gemini API timeout"));
        });

        req.on("error", (error) => {
            if (timedOut) {
                reject(new Error("Gemini API timeout"));
                return;
            }
            reject(error);
        });

        req.write(body);
        req.end();
    });
}

function parseJsonSafe(raw) {
    try {
        return JSON.parse(String(raw || ""));
    } catch (_) {
        return null;
    }
}

function extractGeminiText(data) {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const chunks = [];

    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts)
            ? candidate.content.parts
            : [];

        for (const part of parts) {
            if (typeof part?.text === "string" && part.text.trim()) {
                chunks.push(part.text.trim());
            }
        }
    }

    return chunks.join("\n\n").trim();
}

async function askGemini(prompt, now = new Date()) {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
        throw new Error("MISSING_GEMINI_API_KEY");
    }

    const model = String(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
    const maxOutputTokens = toPositiveInt(
        process.env.GEMINI_MAX_OUTPUT_TOKENS,
        DEFAULT_MAX_OUTPUT_TOKENS
    );
    const stylePrompt = shouldUseDetailedStyle(prompt)
        ? ASK_STYLE_PROMPT_DETAILED
        : ASK_STYLE_PROMPT_CONCISE;
    const temporalContext = buildTemporalContext(now);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
        contents: [
            {
                role: "user",
                parts: [{ text: `${stylePrompt}\n\n${temporalContext}\n\nCâu hỏi người dùng:\n${prompt}` }],
            },
        ],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens,
        },
    };

    const response = await postJson(endpoint, payload);
    const parsed = parseJsonSafe(response.body);

    if (response.statusCode >= 400) {
        const apiMessage =
            parsed?.error?.message && typeof parsed.error.message === "string"
                ? parsed.error.message
                : `Gemini API trả về lỗi HTTP ${response.statusCode}`;
        const error = new Error(apiMessage);
        error.statusCode = response.statusCode;
        throw error;
    }

    if (parsed?.promptFeedback?.blockReason) {
        throw new Error(`Nội dung bị chặn bởi chính sách an toàn: ${parsed.promptFeedback.blockReason}`);
    }

    const text = extractGeminiText(parsed);
    if (!text) {
        throw new Error("Gemini không trả về nội dung văn bản.");
    }

    return sanitizeAnswerText(text);
}

async function sendChunkedMessage(api, threadId, messageType, text) {
    const maxCharsPerMessage = toPositiveInt(
        process.env.ASK_MAX_CHARS_PER_MESSAGE,
        DEFAULT_MAX_CHARS_PER_MESSAGE
    );
    const maxMessageParts = toPositiveInt(
        process.env.ASK_MAX_MESSAGE_PARTS,
        DEFAULT_MAX_MESSAGE_PARTS
    );

    const chunks = splitTextByLimit(text, maxCharsPerMessage);
    const toSend = chunks.slice(0, maxMessageParts);

    for (let i = 0; i < toSend.length; i++) {
        const part = toSend[i];
        const msg = toSend.length > 1 ? `[${i + 1}/${toSend.length}] ${part}` : part;
        await api.sendMessage({ msg }, threadId, messageType);
    }

    if (chunks.length > maxMessageParts) {
        await api.sendMessage(
            {
                msg: `Nội dung còn dài, mình đã gửi ${maxMessageParts} phần đầu. Bạn có thể yêu cầu: "tiếp tục phần còn lại".`,
            },
            threadId,
            messageType
        );
    }
}

async function handleAskCommand(api, message, threadId, argsText, prefix = "!") {
    const messageType = getMessageType(message);
    const prompt = truncateText(argsText, MAX_PROMPT_CHARS);
    const now = new Date();

    if (!prompt) {
        await api.sendMessage({ msg: buildUsage(prefix) }, threadId, messageType);
        return;
    }

    const quickMathAnswer = tryBuildMathAnswer(prompt);
    if (quickMathAnswer) {
        await sendChunkedMessage(api, threadId, messageType, quickMathAnswer);
        return;
    }

    const quickDateTimeAnswer = tryBuildDateTimeAnswer(prompt, now);
    if (quickDateTimeAnswer) {
        await sendChunkedMessage(api, threadId, messageType, quickDateTimeAnswer);
        return;
    }

    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
        await api.sendMessage(
            {
                msg: [
                    "Bạn chưa cấu hình Gemini API key.",
                    "Thêm 1 trong các biến: GEMINI_API_KEY hoặc GEMINI_API hoặc GOOGLE_API_KEY.",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    try {
        const answer = await askGemini(prompt, now);
        await sendChunkedMessage(api, threadId, messageType, answer);
    } catch (error) {
        await api.sendMessage(
            {
                msg:
                    Number(error?.statusCode) === 401
                        ? "Gemini API key không hợp lệ hoặc đã hết hiệu lực. Vui lòng tạo key mới."
                        : `Không gọi được Gemini lúc này (${error?.statusCode || "không rõ mã lỗi"}).`,
            },
            threadId,
            messageType
        );
    }
}

module.exports = {
    handleAskCommand,
};
