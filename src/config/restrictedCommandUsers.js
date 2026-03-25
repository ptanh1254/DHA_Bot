const RESTRICTED_COMMAND_UIDS = ["9095318723300347162"];
const RESTRICTED_COMMAND_BLOCK_MESSAGE = "Chị Phương k cho bé xài lệnh oiiii";

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
