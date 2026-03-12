function buildStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "B\u1eacT" : "T\u1eaeT";
    return [
        `Ch\u1ebf \u0111\u1ed9 welcome hi\u1ec7n t\u1ea1i: ${statusText}`,
        `D\u00f9ng \`${prefix}hello on\` \u0111\u1ec3 b\u1eadt`,
        `D\u00f9ng \`${prefix}hello off\` \u0111\u1ec3 t\u1eaft`,
    ].join("\n");
}

async function handleHelloCommand(
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
        const statusMessage = buildStatusMessage(prefix, setting?.welcomeEnabled === true);
        await api.sendMessage({ msg: statusMessage }, threadId, message.type);
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai c\u00fa ph\u00e1p. D\u00f9ng \`${prefix}hello on\` ho\u1eb7c \`${prefix}hello off\`.`,
            },
            threadId,
            message.type
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { welcomeEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "\u0110\u00e3 b\u1eadt ch\u00e0o m\u1eebng th\u00e0nh vi\u00ean m\u1edbi cho nh\u00f3m n\u00e0y."
                : "\u0110\u00e3 t\u1eaft ch\u00e0o m\u1eebng th\u00e0nh vi\u00ean m\u1edbi cho nh\u00f3m n\u00e0y.",
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleHelloCommand,
};
