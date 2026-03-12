function createMessageHandler({ api, User, commands, botUserId = "" }) {
    const {
        helpCommand,
        helloCommand,
        thongTinCommand,
        checkTTCommand,
        kickCommand,
        xepHangCommand,
        resetChatCommand,
        handleHelp,
        handleHello,
        handleThongTin,
        handleCheckTT,
        handleKick,
        handleXepHang,
        handleResetChat,
    } = commands;

    const normalizedBotUserId = String(botUserId || "").replace(/_0$/, "").trim();

    return async function onMessage(message) {
        try {
            const threadId = String(message.threadId);
            const userId = String(message.data?.uidFrom || "unknown");
            const rawText = message.data?.content;
            if (typeof rawText !== "string") return;

            const text = rawText.trim();
            const normalized = text.toLowerCase();

            const isHelp =
                normalized === helpCommand || normalized.startsWith(`${helpCommand} `);
            const isHello =
                normalized === helloCommand || normalized.startsWith(`${helloCommand} `);
            const isThongTin = normalized.startsWith(thongTinCommand);
            const isCheckTT =
                normalized === checkTTCommand || normalized.startsWith(`${checkTTCommand} `);
            const isKick =
                normalized === kickCommand || normalized.startsWith(`${kickCommand} `);
            const isXepHang = normalized === xepHangCommand;
            const isResetChat = normalized === resetChatCommand;
            const helloArgs = isHello ? normalized.slice(helloCommand.length).trim() : "";
            const kickArgs = isKick ? normalized.slice(kickCommand.length).trim() : "";

            const normalizedSenderId = String(userId).replace(/_0$/, "").trim();
            const isBotSelf =
                message.isSelf ||
                (normalizedBotUserId && normalizedSenderId === normalizedBotUserId);

            // Không cộng tin nhắn của chính bot vào thống kê.
            if (!isBotSelf) {
                const senderName =
                    typeof message.data?.dName === "string" ? message.data.dName.trim() : "";
                const updateDoc = {
                    $inc: { msgCount: 1, totalMsgCount: 1 },
                    $setOnInsert: { joinDate: new Date() },
                };
                if (senderName) {
                    updateDoc.$set = { displayName: senderName };
                }

                await User.findOneAndUpdate({ groupId: threadId, userId }, updateDoc, {
                    upsert: true,
                });
            }

            if (
                message.isSelf &&
                !isHelp &&
                !isHello &&
                !isThongTin &&
                !isCheckTT &&
                !isKick &&
                !isXepHang &&
                !isResetChat
            ) {
                return;
            }

            if (isHello) {
                await handleHello(api, message, threadId, helloArgs);
                console.log(`Đã xử lý command ${helloCommand} tại thread ${threadId}`);
                return;
            }

            if (isHelp) {
                await handleHelp(api, message, threadId);
                return;
            }

            if (isThongTin) {
                await handleThongTin(api, message, threadId);
                return;
            }

            if (isCheckTT) {
                await handleCheckTT(api, message, threadId, User);
                return;
            }

            if (isKick) {
                await handleKick(api, message, threadId, kickArgs);
                return;
            }

            if (isXepHang) {
                await handleXepHang(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isResetChat) {
                await handleResetChat(api, message, threadId, User);
            }
        } catch (listenerError) {
            console.error("Lỗi xử lý message:", listenerError);
        }
    };
}

module.exports = {
    createMessageHandler,
};
