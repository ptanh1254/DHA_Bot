const fs = require("fs");
const path = require("path");

const BANNED_WORDS_PATH = path.resolve(__dirname, "bannedWords.txt");

let cachedMtimeMs = -1;
let cachedWords = [];

function normalizeVietnamese(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseBannedWords(rawText) {
    const words = new Set();
    const lines = String(rawText || "").split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("#")) continue;
        if (trimmed.startsWith("//")) continue;

        const normalized = normalizeVietnamese(trimmed);
        if (normalized) {
            words.add(normalized);
        }
    }

    return [...words];
}

function getBannedWords() {
    try {
        const stat = fs.statSync(BANNED_WORDS_PATH);
        if (stat.mtimeMs !== cachedMtimeMs) {
            const raw = fs.readFileSync(BANNED_WORDS_PATH, "utf8");
            cachedWords = parseBannedWords(raw);
            cachedMtimeMs = stat.mtimeMs;
        }
    } catch (error) {
        if (cachedMtimeMs !== -1) {
            console.error("Không đọc được danh sách từ cấm:", error);
        }
        cachedMtimeMs = -1;
        cachedWords = [];
    }

    return cachedWords;
}

function findMatchedBannedWord(inputText) {
    const words = getBannedWords();
    if (words.length === 0) return "";

    const normalized = normalizeVietnamese(inputText);
    if (!normalized) return "";

    const padded = ` ${normalized} `;
    for (const word of words) {
        const target = ` ${word} `;
        if (padded.includes(target)) {
            return word;
        }
    }

    return "";
}

module.exports = {
    BANNED_WORDS_PATH,
    findMatchedBannedWord,
};

