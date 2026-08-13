const { BotSetting } = require("../db/botSettingModel");

const DEFAULT_OWNER_UIDS = [
    "2721266574503736929",
    "7678683608712964658"
];

const PROTECTED_BOSS_UID = "7678683608712964658";

const DEFAULT_TIM_UIDS = [
    "7678683608712964658",
    "9030208052692663539",
    "7251832302630164225"
];

const PROTECTED_OWNER_BLOCK_MESSAGE = "em iu của chủ bot k đụng được đâu";

function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

const dynamicOwnerUids = new Set(DEFAULT_OWNER_UIDS.map(normalizeId).filter(Boolean));
const dynamicTimUids = new Set(DEFAULT_TIM_UIDS.map(normalizeId).filter(Boolean));

async function loadProtectedUsersFromDb() {
    try {
        const setting = await BotSetting.findOne({ settingId: "global" }).lean();
        if (setting) {
            if (Array.isArray(setting.protectedOwnerUids)) {
                for (const id of setting.protectedOwnerUids) {
                    const norm = normalizeId(id);
                    if (norm) dynamicOwnerUids.add(norm);
                }
            }
            if (Array.isArray(setting.protectedTimUids)) {
                for (const id of setting.protectedTimUids) {
                    const norm = normalizeId(id);
                    if (norm) dynamicTimUids.add(norm);
                }
            }
        }
    } catch (e) {
        console.error("Lỗi load protected users từ DB:", e.message);
    }
}

// Load khi khởi động
loadProtectedUsersFromDb();

async function saveProtectedUsersToDb() {
    try {
        await BotSetting.findOneAndUpdate(
            { settingId: "global" },
            {
                $set: {
                    protectedOwnerUids: Array.from(dynamicOwnerUids),
                    protectedTimUids: Array.from(dynamicTimUids),
                },
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
    } catch (e) {
        console.error("Lỗi lưu protected users vào DB:", e.message);
    }
}

function isProtectedOwnerUid(rawId) {
    const normalized = normalizeId(rawId);
    if (!normalized) return false;
    return dynamicOwnerUids.has(normalized);
}

function isProtectedBossUid(rawId) {
    return normalizeId(rawId) === PROTECTED_BOSS_UID;
}

function isAllowedTimCommandUid(rawId) {
    const normalized = normalizeId(rawId);
    if (!normalized) return false;
    return dynamicTimUids.has(normalized) || dynamicOwnerUids.has(normalized);
}

async function addProtectedOwnerUid(rawId) {
    const norm = normalizeId(rawId);
    if (!norm) return false;
    dynamicOwnerUids.add(norm);
    await saveProtectedUsersToDb();
    return true;
}

async function removeProtectedOwnerUid(rawId) {
    const norm = normalizeId(rawId);
    if (!norm) return false;
    dynamicOwnerUids.delete(norm);
    await saveProtectedUsersToDb();
    return true;
}

async function addAllowedTimUid(rawId) {
    const norm = normalizeId(rawId);
    if (!norm) return false;
    dynamicTimUids.add(norm);
    await saveProtectedUsersToDb();
    return true;
}

async function removeAllowedTimUid(rawId) {
    const norm = normalizeId(rawId);
    if (!norm) return false;
    dynamicTimUids.delete(norm);
    await saveProtectedUsersToDb();
    return true;
}

function getProtectedOwnerList() {
    return Array.from(dynamicOwnerUids);
}

function getProtectedTimList() {
    return Array.from(dynamicTimUids);
}

let PROTECTED_OWNER_SENDER_RANGE = [150, 300];
let PROTECTED_OWNER_TARGET_RANGE = [0, 15];

function setProtectedSenderRange(min, max) {
    const a = Number(min) || 0;
    const b = Number(max) || 0;
    if (a <= b) PROTECTED_OWNER_SENDER_RANGE = [a, b];
}

function setProtectedTargetRange(min, max) {
    const a = Number(min) || 0;
    const b = Number(max) || 0;
    if (a <= b) PROTECTED_OWNER_TARGET_RANGE = [a, b];
}

function getRandomIntInclusive(min, max) {
    const a = Math.ceil(Number(min) || 0);
    const b = Math.floor(Number(max) || 0);
    if (b < a) return a;
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

function getProtectedRandomPercent(senderId, targetId) {
    if (senderId && isProtectedBossUid(senderId)) {
        return 300;
    }
    if (senderId && isProtectedOwnerUid(senderId)) {
        return getRandomIntInclusive(...PROTECTED_OWNER_SENDER_RANGE);
    }
    if (targetId && isProtectedOwnerUid(targetId)) {
        return getRandomIntInclusive(...PROTECTED_OWNER_TARGET_RANGE);
    }
    return null;
}

module.exports = {
    PROTECTED_OWNER_UIDS: DEFAULT_OWNER_UIDS,
    PROTECTED_BOSS_UID,
    PROTECTED_OWNER_BLOCK_MESSAGE,
    isProtectedOwnerUid,
    isProtectedBossUid,
    isAllowedTimCommandUid,
    addProtectedOwnerUid,
    removeProtectedOwnerUid,
    addAllowedTimUid,
    removeAllowedTimUid,
    getProtectedOwnerList,
    getProtectedTimList,
    normalizeId,
    setProtectedSenderRange,
    setProtectedTargetRange,
    getProtectedRandomPercent,
};
