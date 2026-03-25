const PROTECTED_OWNER_UIDS = [
    "2370937689986813380",
    "9095318723300347162",
];

const PROTECTED_OWNER_BLOCK_MESSAGE = "eiu c\u1ee7a ch\u1ee7 bot k \u0111\u1ee5ng \u0111\u01b0\u1ee3c \u0111\u00e2u";

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

module.exports = {
    PROTECTED_OWNER_UIDS,
    PROTECTED_OWNER_BLOCK_MESSAGE,
    isProtectedOwnerUid,
    normalizeId,
};
