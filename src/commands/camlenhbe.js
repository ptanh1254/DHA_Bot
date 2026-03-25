const { getMessageType, sendMessage } = require("../utils/commonHelpers");
const {
    RESTRICTED_COMMAND_UIDS,
    GLOBAL_RESTRICTED_COMMAND_SETTING_ID,
    GLOBAL_RESTRICTED_COMMAND_FIELD,
} = require("../config/restrictedCommandUsers");

function formatBlockedUidList() {
    return RESTRICTED_COMMAND_UIDS.map((uid) => `UID ${uid}`).join(", ");
}

async function getRestrictedUidCommandEnabled(GroupSetting) {
    try {
        const globalSetting = await GroupSetting.findOne({
            groupId: GLOBAL_RESTRICTED_COMMAND_SETTING_ID,
        }).lean();
        return globalSetting?.[GLOBAL_RESTRICTED_COMMAND_FIELD] !== false;
    } catch (error) {
        console.error("[camlenhbe] Loi doc global setting:", error?.message || error);
        return true;
    }
}

async function setRestrictedUidCommandEnabled(GroupSetting, enabled) {
    try {
        await GroupSetting.findOneAndUpdate(
            { groupId: GLOBAL_RESTRICTED_COMMAND_SETTING_ID },
            { $set: { [GLOBAL_RESTRICTED_COMMAND_FIELD]: enabled } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean();
        return true;
    } catch (error) {
        console.error("[camlenhbe] Loi cap nhat global setting:", error?.message || error);
        return false;
    }
}

async function handleRestrictedUidToggleCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!"
) {
    const messageType = getMessageType(message);
    const normalizedArgs = String(argsText || "").trim().toLowerCase();

    if (!normalizedArgs) {
        const enabled = await getRestrictedUidCommandEnabled(GroupSetting);
        const statusText = enabled ? "BẬT" : "TẮT";
        await sendMessage(
            api,
            {
                msg: [
                    `Trạng thái cấm lệnh UID đặc biệt (toàn hệ thống): ${statusText}`,
                    `UID đang áp dụng: ${formatBlockedUidList()}`,
                    `Dùng \`${prefix}camlenhbe on\` để bật`,
                    `Dùng \`${prefix}camlenhbe off\` để tắt`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await sendMessage(
            api,
            {
                msg: [
                    "Sai cú pháp.",
                    `Dùng \`${prefix}camlenhbe\` để xem trạng thái`,
                    `Dùng \`${prefix}camlenhbe on\` để bật`,
                    `Dùng \`${prefix}camlenhbe off\` để tắt`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    const saved = await setRestrictedUidCommandEnabled(GroupSetting, shouldEnable);
    if (!saved) {
        await sendMessage(
            api,
            { msg: "Không cập nhật được trạng thái global, thử lại sau nhé." },
            threadId,
            messageType
        );
        return;
    }

    await sendMessage(
        api,
        {
            msg: shouldEnable
                ? `Đã BẬT cấm lệnh toàn hệ thống cho: ${formatBlockedUidList()}.`
                : `Đã TẮT cấm lệnh toàn hệ thống cho: ${formatBlockedUidList()}.`,
        },
        threadId,
        messageType
    );
}

module.exports = {
    getRestrictedUidCommandEnabled,
    handleRestrictedUidToggleCommand,
};
