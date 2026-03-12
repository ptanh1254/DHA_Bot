const { getVNDateParts } = require("../utils/vnTime");
const { findMatchedBannedWord } = require("../config/bannedWords");

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

async function sendAutoMuteNotice(api, message, threadId, userId) {
    const rawName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const safeName = rawName || "Nguoi dung";
    const mentionText = `@${safeName}`;
    const msg = `${mentionText} n\u00f3i b\u1eady h\u00e3 kho\u00e1 m\u00f5m n\u00e0y c\u01b0ng`;

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
        console.error("Loi gui thong bao auto mute:", error);
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

function createMessageHandler({
    api,
    User,
    MutedMember,
    GroupSetting,
    GroupKeyMember,
    commands,
    botUserId = "",
}) {
    const {
        helpCommand,
        helloCommand,
        thongTinCommand,
        checkTTCommand,
        kickCommand,
        muteCommand,
        unmuteCommand,
        camNoiBayCommand,
        autoKickCommand,
        keyCommand,
        setKeyCommand,
        addAdminCommand,
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
        handleCamNoiBay,
        handleAutoKick,
        handleKey,
        handleSetKey,
        handleAddAdmin,
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

            if (!isBotSelf && MutedMember && hasText) {
                const matchedWord = findMatchedBannedWord(text);
                if (matchedWord) {
                    const setting = GroupSetting
                        ? await GroupSetting.findOne({ groupId: threadId }).lean()
                        : null;
                    const isAutoMuteEnabled = setting?.bannedWordMuteEnabled === true;
                    if (isAutoMuteEnabled) {
                        await MutedMember.findOneAndUpdate(
                            { groupId: threadId, userId },
                            {
                                $set: {
                                    mutedByUserId: "AUTO_MOD_BANNED_WORD",
                                    mutedByName: "Auto mute tu cam",
                                    mutedAt: new Date(),
                                },
                                $inc: { blockedMsgCount: 1 },
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
                        ).lean();

                        await tryDeleteMutedMessage(api, message, threadId, userId);
                        await sendAutoMuteNotice(api, message, threadId, userId);
                        console.log(
                            `[AUTO_MUTE] thread=${threadId} user=${userId} matchedWord=${matchedWord}`
                        );
                        return;
                    }
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
            const isCamNoiBay =
                normalized === camNoiBayCommand ||
                normalized.startsWith(`${camNoiBayCommand} `);
            const isAutoKick =
                normalized === autoKickCommand ||
                normalized.startsWith(`${autoKickCommand} `);
            const isKey =
                normalized === keyCommand || normalized.startsWith(`${keyCommand} `);
            const isSetKey =
                normalized === setKeyCommand || normalized.startsWith(`${setKeyCommand} `);
            const isAddAdmin =
                normalized === addAdminCommand ||
                normalized.startsWith(`${addAdminCommand} `) ||
                normalized === "@addadmin" ||
                normalized.startsWith("@addadmin ");
            const isXepHangDay = normalized === xepHangDayCommand;
            const isXepHangMonth = normalized === xepHangMonthCommand;
            const isXepHangTotal = normalized === xepHangTotalCommand;
            const isResetChat = normalized === resetChatCommand;
            const helloArgs = isHello ? normalized.slice(helloCommand.length).trim() : "";
            const kickArgs = isKick ? normalized.slice(kickCommand.length).trim() : "";
            const camNoiBayArgs = isCamNoiBay
                ? normalized.slice(camNoiBayCommand.length).trim()
                : "";
            const autoKickArgs = isAutoKick
                ? normalized.slice(autoKickCommand.length).trim()
                : "";
            const keyArgs = isKey ? text.slice(keyCommand.length).trim() : "";
            const setKeyArgs = isSetKey ? text.slice(setKeyCommand.length).trim() : "";

            const isKnownCommand =
                isHelp ||
                isHello ||
                isThongTin ||
                isCheckTT ||
                isKick ||
                isMute ||
                isUnmute ||
                isCamNoiBay ||
                isAutoKick ||
                isKey ||
                isSetKey ||
                isAddAdmin ||
                isXepHangDay ||
                isXepHangMonth ||
                isXepHangTotal ||
                isResetChat;

            if (!isBotSelf && isKnownCommand && !isHelp && !isKey && !isSetKey && !isAddAdmin) {
                const setting = GroupSetting
                    ? await GroupSetting.findOne({ groupId: threadId }).lean()
                    : null;
                const hasGateKey =
                    typeof setting?.commandAccessKey === "string" &&
                    setting.commandAccessKey.trim();
                const isGateEnabled = setting?.commandAccessEnabled === true && hasGateKey;

                if (isGateEnabled) {
                    const hasAccess = GroupKeyMember
                        ? await GroupKeyMember.exists({ groupId: threadId, userId })
                        : null;
                    if (!hasAccess) {
                        await api.sendMessage(
                            {
                                msg: `Ban chua co key de dung bot. Dung \`${keyCommand} <ma-key>\` de kich hoat.`,
                            },
                            threadId,
                            message.type
                        );
                        return;
                    }
                }
            }

            if (
                message.isSelf &&
                !isHelp &&
                !isHello &&
                !isThongTin &&
                !isCheckTT &&
                !isKick &&
                !isMute &&
                !isUnmute &&
                !isCamNoiBay &&
                !isAutoKick &&
                !isKey &&
                !isSetKey &&
                !isAddAdmin &&
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

            if (isCamNoiBay) {
                await handleCamNoiBay(api, message, threadId, camNoiBayArgs);
                return;
            }

            if (isAutoKick) {
                await handleAutoKick(api, message, threadId, autoKickArgs);
                return;
            }

            if (isSetKey) {
                await handleSetKey(api, message, threadId, setKeyArgs);
                return;
            }

            if (isKey) {
                await handleKey(api, message, threadId, keyArgs);
                return;
            }

            if (isAddAdmin) {
                await handleAddAdmin(api, message, threadId);
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
