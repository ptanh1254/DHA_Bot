function normalizeKey(rawValue) {
    return String(rawValue || "").trim().toLowerCase();
}

async function handleKeyCommand(
    api,
    message,
    threadId,
    GroupSetting,
    GroupKeyMember,
    argsText,
    prefix = "!"
) {
    const keyInput = normalizeKey(argsText);
    const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
    const isGateOn =
        setting?.commandAccessEnabled === true &&
        typeof setting?.commandAccessKey === "string" &&
        setting.commandAccessKey.trim();

    if (!isGateOn) {
        await api.sendMessage(
            {
                msg: "Nhom nay dang tat che do key. Moi thanh vien deu dung bot duoc.",
            },
            threadId,
            message.type
        );
        return;
    }

    if (!keyInput) {
        await api.sendMessage(
            {
                msg: `Nhap key de kich hoat quyen dung bot. Vi du: ${prefix}key <ma-key>`,
            },
            threadId,
            message.type
        );
        return;
    }

    const expectedKey = normalizeKey(setting.commandAccessKey);
    if (!expectedKey || keyInput !== expectedKey) {
        await api.sendMessage(
            { msg: "Sai key roi ban oi. Thu lai key chuan cua nhom nhe." },
            threadId,
            message.type
        );
        return;
    }

    const userId = String(message?.data?.uidFrom || "").trim();
    const userName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";

    await GroupKeyMember.findOneAndUpdate(
        { groupId: threadId, userId },
        {
            $set: {
                userName,
                verifiedAt: new Date(),
            },
            $setOnInsert: {
                groupId: threadId,
                userId,
            },
        },
        {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
        }
    );

    await api.sendMessage(
        {
            msg: "Hop le nha. Tu gio ban duoc dung bot trong nhom nay roi.",
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleKeyCommand,
};
