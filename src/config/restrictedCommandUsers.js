const RESTRICTED_COMMAND_UIDS = ["9095318723300347162"];
const RESTRICTED_COMMAND_BLOCK_MESSAGE = "Ch\u1ecb Ph\u01b0\u01a1ng kh\u00f4ng cho b\u00e9 x\u00e0i l\u1ec7nh oiiii";

const GLOBAL_RESTRICTED_COMMAND_SETTING_ID = "__GLOBAL_RESTRICTED_COMMAND_POLICY__";
const GLOBAL_RESTRICTED_COMMAND_FIELD = "restrictedUidCommandEnabled";

function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

const RESTRICTED_COMMAND_UID_SET = new Set(
    RESTRICTED_COMMAND_UIDS.map((uid) => normalizeId(uid)).filter(Boolean)
);

function isRestrictedCommandUid(rawId) {
    const normalized = normalizeId(rawId);
    if (!normalized) return false;
    return RESTRICTED_COMMAND_UID_SET.has(normalized);
}

module.exports = {
    RESTRICTED_COMMAND_UIDS,
    RESTRICTED_COMMAND_BLOCK_MESSAGE,
    GLOBAL_RESTRICTED_COMMAND_SETTING_ID,
    GLOBAL_RESTRICTED_COMMAND_FIELD,
    normalizeId,
    isRestrictedCommandUid,
};

