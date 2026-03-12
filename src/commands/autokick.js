function buildAutoKickStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BAT" : "TAT";
    return [
        `Che do auto kick nguoi tung bi kick hien tai: ${statusText}`,
        `Dung \`${prefix}autokick on\` de bat`,
        `Dung \`${prefix}autokick off\` de tat`,
    ].join("\n");
}

async function handleAutoKickCommand(
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
        const statusMessage = buildAutoKickStatusMessage(
            prefix,
            setting?.autoKickRejoinEnabled === true
        );
        await api.sendMessage({ msg: statusMessage }, threadId, message.type);
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai cu phap. Dung \`${prefix}autokick on\` hoac \`${prefix}autokick off\`.`,
            },
            threadId,
            message.type
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { autoKickRejoinEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "Da bat auto kick: ai tung bi kick vao lai se bi kick tiep."
                : "Da tat auto kick nguoi tung bi kick.",
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleAutoKickCommand,
};
