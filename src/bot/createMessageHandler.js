const { getVNDateParts } = require("../utils/vnTime");

async function tryDeleteMutedMessage(api, message, threadId, userId) {
    const msgId = String(message?.data?.msgId || "").trim();
    const cliMsgId = String(message?.data?.cliMsgId || msgId || Date.now()).trim();
    if (!msgId) return false;

    try {
        await api.deleteMessage(
            {
                threadId,
                type: 1,
                data: {
                    cliMsgId,
                    msgId,
                    uidFrom: String(userId),
                },
            },
            false
        );
        return true;
    } catch (error) {
        console.error("Khong the xoa tin nhan cua nguoi bi mute:", error);
        return false;
    }
}

function shouldSendMuteNotice(strikeCount) {
    const value = Number(strikeCount) || 0;
    if (value <= 0) return false;
    if (value === 1 || value === 5 || value === 10) return true;
    return value > 10 && value % 10 === 0;
}

async function sendMuteNotice(api, message, threadId, userId, strikeCount) {
    const rawName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const safeName = rawName || "Ng\u01b0\u1eddi d\u00f9ng";
    const mentionText = `@${safeName}`;
    const msg = `${mentionText} bị khoá mõm r cưng ơi (${strikeCount})`;

    try {
        await api.sendMessage(
            {
                msg,
                mentions: [
                    {
                        pos: 0,
                        uid: String(userId),
                        len: mentionText.length,
                    },
                ],
            },
            threadId,
            message.type
        );
    } catch (error) {
        console.error("Loi gui canh bao mute:", error);
    }
}

async function updateUserMessageCounters(User, threadId, userId, senderName) {
    const now = new Date();
    const { dayKey, monthKey } = getVNDateParts(now);

    const current = await User.findOne({ groupId: threadId, userId }).lean();
    const currentDaily =
        current?.dayKey === dayKey ? Number(current?.dailyMsgCount) || 0 : 0;
    const currentMonthly =
        current?.monthKey === monthKey ? Number(current?.monthlyMsgCount) || 0 : 0;

    const updateDoc = {
        $setOnInsert: {
            groupId: threadId,
            userId,
            joinDate: now,
        },
        $inc: {
            msgCount: 1,
            totalMsgCount: 1,
        },
        $set: {
            dayKey,
            monthKey,
            dailyMsgCount: currentDaily + 1,
            monthlyMsgCount: currentMonthly + 1,
        },
    };

    if (senderName) {
        updateDoc.$set.displayName = senderName;
    }

    await User.findOneAndUpdate({ groupId: threadId, userId }, updateDoc, {
        upsert: true,
    });
}

function createMessageHandler({ api, User, MutedMember, commands, botUserId = "" }) {
    const {
        helpCommand,
        helloCommand,
        thongTinCommand,
        checkTTCommand,
        kickCommand,
        muteCommand,
        unmuteCommand,
        xepHangDayCommand,
        xepHangMonthCommand,
        xepHangTotalCommand,
        resetChatCommand,
        handleHelp,
        handleHello,
        handleThongTin,
        handleCheckTT,
        handleKick,
        handleMute,
        handleUnmute,
        handleXepHangDay,
        handleXepHangMonth,
        handleXepHangTotal,
        handleResetChat,
    } = commands;

    const normalizedBotUserId = String(botUserId || "").replace(/_0$/, "").trim();

    return async function onMessage(message) {
        try {
            const threadId = String(message.threadId);
            const userId = String(message.data?.uidFrom || "unknown");
            const rawText =
                typeof message.data?.content === "string" ? message.data.content : "";
            const text = rawText.trim();
            const normalized = text.toLowerCase();
            const hasText = normalized.length > 0;

            const normalizedSenderId = String(userId).replace(/_0$/, "").trim();
            const isBotSelf =
                message.isSelf ||
                (normalizedBotUserId && normalizedSenderId === normalizedBotUserId);

            if (!isBotSelf && MutedMember) {
                const mutedEntry = await MutedMember.findOneAndUpdate(
                    { groupId: threadId, userId },
                    { $inc: { blockedMsgCount: 1 } },
                    { returnDocument: "after" }
                ).lean();

                if (mutedEntry) {
                    await tryDeleteMutedMessage(api, message, threadId, userId);

                    const strikeCount = Number(mutedEntry?.blockedMsgCount) || 1;
                    if (shouldSendMuteNotice(strikeCount)) {
                        await sendMuteNotice(api, message, threadId, userId, strikeCount);
                    }
                    return;
                }
            }

            if (!isBotSelf) {
                const senderName =
                    typeof message.data?.dName === "string" ? message.data.dName.trim() : "";
                await updateUserMessageCounters(User, threadId, userId, senderName);
            }

            if (!hasText) {
                return;
            }

            const isHelp =
                normalized === helpCommand || normalized.startsWith(`${helpCommand} `);
            const isHello =
                normalized === helloCommand || normalized.startsWith(`${helloCommand} `);
            const isThongTin = normalized.startsWith(thongTinCommand);
            const isCheckTT =
                normalized === checkTTCommand || normalized.startsWith(`${checkTTCommand} `);
            const isKick =
                normalized === kickCommand || normalized.startsWith(`${kickCommand} `);
            const isMute =
                normalized === muteCommand || normalized.startsWith(`${muteCommand} `);
            const isUnmute =
                normalized === unmuteCommand || normalized.startsWith(`${unmuteCommand} `);
            const isXepHangDay = normalized === xepHangDayCommand;
            const isXepHangMonth = normalized === xepHangMonthCommand;
            const isXepHangTotal = normalized === xepHangTotalCommand;
            const isResetChat = normalized === resetChatCommand;
            const helloArgs = isHello ? normalized.slice(helloCommand.length).trim() : "";
            const kickArgs = isKick ? normalized.slice(kickCommand.length).trim() : "";

            if (
                message.isSelf &&
                !isHelp &&
                !isHello &&
                !isThongTin &&
                !isCheckTT &&
                !isKick &&
                !isMute &&
                !isUnmute &&
                !isXepHangDay &&
                !isXepHangMonth &&
                !isXepHangTotal &&
                !isResetChat
            ) {
                return;
            }

            if (isHello) {
                await handleHello(api, message, threadId, helloArgs);
                console.log(`Da xu ly command ${helloCommand} tai thread ${threadId}`);
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

            if (isMute) {
                await handleMute(api, message, threadId);
                return;
            }

            if (isUnmute) {
                await handleUnmute(api, message, threadId);
                return;
            }

            if (isXepHangDay) {
                await handleXepHangDay(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isXepHangMonth) {
                await handleXepHangMonth(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isXepHangTotal) {
                await handleXepHangTotal(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isResetChat) {
                await handleResetChat(api, message, threadId, User);
            }
        } catch (listenerError) {
            console.error("Loi xu ly message:", listenerError);
        }
    };
}

module.exports = {
    createMessageHandler,
};
