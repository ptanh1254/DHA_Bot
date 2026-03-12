function buildStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BAT" : "TAT";
    return [
        `Che do auto mute tu cam hien tai: ${statusText}`,
        `Dung \`${prefix}camnoibay on\` de bat`,
        `Dung \`${prefix}camnoibay off\` de tat`,
    ].join("\n");
}

async function handleCamNoiBayCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!"
) {
    const normalizedArgs = String(argsText || "").trim().toLowerCase();

    if (!normalizedArgs) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const statusMessage = buildStatusMessage(prefix, setting?.bannedWordMuteEnabled === true);
        await api.sendMessage({ msg: statusMessage }, threadId, message.type);
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai cu phap. Dung \`${prefix}camnoibay on\` hoac \`${prefix}camnoibay off\`.`,
            },
            threadId,
            message.type
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { bannedWordMuteEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "Da bat auto mute khi dung tu cam trong nhom nay."
                : "Da tat auto mute tu cam trong nhom nay.",
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleCamNoiBayCommand,
};
