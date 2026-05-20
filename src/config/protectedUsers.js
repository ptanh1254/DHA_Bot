const PROTECTED_OWNER_UIDS = [
    "2370937689986813380",
    "3347672659938300246",
    "1007238265958694361",
    "9095318723300347162",
    "8073429320276439081"

];

const PROTECTED_OWNER_BLOCK_MESSAGE = "em iu c\u1ee7a ch\u1ee7 bot k \u0111\u1ee5ng \u0111\u01b0\u1ee3c \u0111\u00e2u";

function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

const PROTECTED_OWNER_UID_SET = new Set(PROTECTED_OWNER_UIDS.map(normalizeId).filter(Boolean));

function isProtectedOwnerUid(rawId) {
    const normalized = normalizeId(rawId);
    if (!normalized) return false;
    return PROTECTED_OWNER_UID_SET.has(normalized);
}


let PROTECTED_OWNER_SENDER_RANGE = [150, 300];
let PROTECTED_OWNER_TARGET_RANGE = [0, 50];

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

/**
 * Return a random percent according to protected rules
 * - if sender is protected => use sender range
 * - else if target is protected => use target range
 * - otherwise return null (caller can fallback)
 */
function getProtectedRandomPercent(senderId, targetId) {
    if (senderId && isProtectedOwnerUid(senderId)) {
        return getRandomIntInclusive(...PROTECTED_OWNER_SENDER_RANGE);
    }
    if (targetId && isProtectedOwnerUid(targetId)) {
        return getRandomIntInclusive(...PROTECTED_OWNER_TARGET_RANGE);
    }
    return null;
}

module.exports = {
    PROTECTED_OWNER_UIDS,
    PROTECTED_OWNER_BLOCK_MESSAGE,
    isProtectedOwnerUid,
    normalizeId,
    // percent range setters/getter for runtime configuration
    setProtectedSenderRange,
    setProtectedTargetRange,
    getProtectedRandomPercent,
};
