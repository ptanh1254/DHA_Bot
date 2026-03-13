require("dotenv").config();
const mongoose = require("mongoose");
const { Zalo } = require("zca-js");

const { loadConfig } = require("./src/config/loadConfig");
const { loadCookie } = require("./src/auth/loadCookie");
const { User } = require("./src/db/userModel");
const { GroupSetting } = require("./src/db/groupSettingModel");
const { MutedMember } = require("./src/db/mutedMemberModel");
const { GroupKeyMember } = require("./src/db/groupKeyMemberModel");
const { CommandViolation } = require("./src/db/commandViolationModel");
const { KickHistory } = require("./src/db/kickHistoryModel");
const { imageMetadataGetter } = require("./src/media/imageMetadataGetter");
const { handleHelloCommand } = require("./src/commands/hello");
const { handleHelpCommand } = require("./src/commands/help");
const { handleThongTinCommand } = require("./src/commands/thongtin");
const { handleCheckTTCommand } = require("./src/commands/checktt");
const { handleCheckCommand } = require("./src/commands/check");
const { handleCheckIngameCommand } = require("./src/commands/checkingame");
const { handleIngameCommand } = require("./src/commands/ingame");
const { handleRemoveIngameCommand } = require("./src/commands/removeingame");
const { handlePreventRecallCommand } = require("./src/commands/chongthuhoi");
const { handleKickCommand } = require("./src/commands/kick");
const { handleMuteCommand } = require("./src/commands/mute");
const { handleUnmuteCommand } = require("./src/commands/unmute");
const { handleCamNoiBayCommand } = require("./src/commands/camnoibay");
const { handleAutoKickCommand } = require("./src/commands/autokick");
const { handleAutoKickListCommand } = require("./src/commands/autokicklist");
const { handleAutoKickRemoveCommand } = require("./src/commands/autokickremove");
const { handleAddQTVCommand } = require("./src/commands/addbqt");
const { handleRemoveQTVCommand } = require("./src/commands/removeqtv");
const { handleXepHangChatCommand } = require("./src/commands/xephangchat");
const { handleResetChatCommand } = require("./src/commands/resetchat");
const { createMessageHandler } = require("./src/bot/createMessageHandler");
const { createGroupEventHandler } = require("./src/bot/createGroupEventHandler");
const { createKickIntentStore } = require("./src/runtime/kickIntentStore");
const { createMessageStore } = require("./src/runtime/messageStore");
const { getVNDateParts } = require("./src/utils/vnTime");

const config = loadConfig();

const zalo = new Zalo({
    selfListen: true,
    checkUpdate: true,
    logging: true,
    imageMetadataGetter,
});

async function startBot() {
    try {
        console.log("🤖 [BOT] Khởi động bot...");
        console.log("Đang kết nối MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        const now = new Date();
        const vnParts = getVNDateParts(now);
        const backfillResult = await User.collection.updateMany(
            {
                $or: [
                    { totalMsgCount: { $exists: false } },
                    { totalMsgCount: null },
                ],
            },
            [
                {
                    $set: {
                        totalMsgCount: { $ifNull: ["$msgCount", 0] },
                    },
                },
            ]
        );
        console.log(
            `Backfill totalMsgCount xong: ${backfillResult.modifiedCount || 0} bản ghi`
        );
        const backfillPeriodResult = await User.collection.updateMany(
            {
                $or: [
                    { dailyMsgCount: { $exists: false } },
                    { monthlyMsgCount: { $exists: false } },
                    { dayKey: { $exists: false } },
                    { monthKey: { $exists: false } },
                ],
            },
            [
                {
                    $set: {
                        dailyMsgCount: { $ifNull: ["$dailyMsgCount", { $ifNull: ["$msgCount", 0] }] },
                        monthlyMsgCount: {
                            $ifNull: ["$monthlyMsgCount", { $ifNull: ["$msgCount", 0] }],
                        },
                        dayKey: { $ifNull: ["$dayKey", vnParts.dayKey] },
                        monthKey: { $ifNull: ["$monthKey", vnParts.monthKey] },
                    },
                },
            ]
        );
        console.log(
            `Backfill bộ đếm ngày/tháng xong: ${backfillPeriodResult.modifiedCount || 0} bản ghi`
        );

        const imei = process.env.ZALO_IMEI;
        const userAgent = process.env.ZALO_USER_AGENT;
        if (!imei || !userAgent) {
            throw new Error("Thieu ZALO_IMEI hoac ZALO_USER_AGENT trong .env");
        }

        const cookie = loadCookie();

        console.log("Đang đăng nhập Zalo bằng cookie...");
        const api = await zalo.login({
            cookie,
            imei,
            userAgent,
        });

        const accountInfo = await api.fetchAccountInfo().catch(() => null);
        const botUserId = String(accountInfo?.userId || "").replace(/_0$/, "").trim();
        if (botUserId) {
            console.log(`Bot UID: ${botUserId}`);
        }
        const prefix = (config.PREFIX || "!").trim();
        const kickIntentStore = createKickIntentStore();
        const messageStore = createMessageStore(1000, 5 * 60 * 1000); // Store last 1000 messages for 5 minutes
        const commands = {
            helpCommand: `${prefix}help`.toLowerCase(),
            helloCommand: `${prefix}hello`.toLowerCase(),
            thongTinCommand: `${prefix}thongtin`.toLowerCase(),
            checkTTCommand: `${prefix}checktt`.toLowerCase(),
            checkCommand: `${prefix}check`.toLowerCase(),
            checkIngameCommand: `${prefix}checkingame`.toLowerCase(),
            ingameCommand: `${prefix}ingame`.toLowerCase(),
            removeIngameCommand: `${prefix}xoaingame`.toLowerCase(),
            kickCommand: `${prefix}dapbaymau`.toLowerCase(),
            kickAliasCommand: `${prefix}kick`.toLowerCase(),
            muteCommand: `${prefix}mute`.toLowerCase(),
            unmuteCommand: `${prefix}unmute`.toLowerCase(),
            camNoiBayCommand: `${prefix}camnoibay`.toLowerCase(),
            autoKickCommand: `${prefix}autokick`.toLowerCase(),
            autoKickListCommand: `${prefix}autokicklist`.toLowerCase(),
            autoKickRemoveCommand: `${prefix}autokickremove`.toLowerCase(),
            goAutoKickCommand: `${prefix}goautokick`.toLowerCase(),
            addBQTCommand: `${prefix}addqtv`.toLowerCase(),
            addQTVCommand: `${prefix}addqtv`.toLowerCase(),
            removeQTVCommand: `${prefix}removeqtv`.toLowerCase(),
            removeQTVAliasCommand: `${prefix}rmqtv`.toLowerCase(),
            xepHangDayCommand: `${prefix}xhchat`.toLowerCase(),
            xepHangMonthCommand: `${prefix}xhchatthang`.toLowerCase(),
            xepHangTotalCommand: `${prefix}xhchattong`.toLowerCase(),
            resetChatCommand: `${prefix}rschat`.toLowerCase(),
            handleHelp: (api, message, threadId) =>
                handleHelpCommand(api, message, threadId, prefix),
            handleHello: (api, message, threadId, argsText) =>
                handleHelloCommand(api, message, threadId, GroupSetting, argsText, prefix),
            handleThongTin: handleThongTinCommand,
            handleCheckTT: (api, message, threadId, User) =>
                handleCheckTTCommand(api, message, threadId, User, prefix),
            handleCheck: (api, message, threadId) =>
                handleCheckCommand(api, message, threadId, prefix),
            handleCheckIngame: (api, message, threadId) =>
                handleCheckIngameCommand(api, message, threadId, User),
            handleIngame: (api, message, threadId, argsText, User) =>
                handleIngameCommand(api, message, threadId, User, argsText, prefix),
            handleRemoveIngame: (api, message, threadId, argsText, User) =>
                handleRemoveIngameCommand(
                    api,
                    message,
                    threadId,
                    User,
                    argsText,
                    prefix
                ),
            handleKick: (api, message, threadId, argsText) =>
                handleKickCommand(
                    api,
                    message,
                    threadId,
                    GroupSetting,
                    argsText,
                    prefix,
                    kickIntentStore
                ),
            handleMute: (api, message, threadId) =>
                handleMuteCommand(api, message, threadId, MutedMember, prefix),
            handleUnmute: (api, message, threadId) =>
                handleUnmuteCommand(api, message, threadId, MutedMember, prefix),
            handleCamNoiBay: (api, message, threadId, argsText) =>
                handleCamNoiBayCommand(
                    api,
                    message,
                    threadId,
                    GroupSetting,
                    argsText,
                    prefix
                ),
            handleAutoKick: (api, message, threadId, argsText) =>
                handleAutoKickCommand(
                    api,
                    message,
                    threadId,
                    GroupSetting,
                    argsText,
                    prefix
                ),
            handleAutoKickList: (api, message, threadId) =>
                handleAutoKickListCommand(api, message, threadId, KickHistory, prefix),
            handleAutoKickRemove: (api, message, threadId, argsText) =>
                handleAutoKickRemoveCommand(
                    api,
                    message,
                    threadId,
                    KickHistory,
                    argsText,
                    prefix
                ),
            handleAddQTV: (api, message, threadId) =>
                handleAddQTVCommand(api, message, threadId, GroupKeyMember, prefix),
            handleAddBQT: (api, message, threadId) =>
                handleAddQTVCommand(api, message, threadId, GroupKeyMember, prefix),
            handleRemoveQTV: (api, message, threadId, argsText) =>
                handleRemoveQTVCommand(
                    api,
                    message,
                    threadId,
                    GroupKeyMember,
                    argsText,
                    prefix
                ),
            handleXepHangDay: (api, message, threadId, User, botUid) =>
                handleXepHangChatCommand(api, message, threadId, User, {
                    botUserId: botUid,
                    rankingType: "day",
                }),
            handleXepHangMonth: (api, message, threadId, User, botUid) =>
                handleXepHangChatCommand(api, message, threadId, User, {
                    botUserId: botUid,
                    rankingType: "month",
                }),
            handleXepHangTotal: (api, message, threadId, User, botUid) =>
                handleXepHangChatCommand(api, message, threadId, User, {
                    botUserId: botUid,
                    rankingType: "total",
                }),
            handleResetChat: handleResetChatCommand,
        };

        console.log("Zalo bot đã đăng nhập thành công");
        console.log(
            `Lệnh đang nghe: ${commands.helpCommand}, ${commands.helloCommand}, ${commands.thongTinCommand}, ${commands.checkTTCommand}, ${commands.checkCommand}, ${commands.checkIngameCommand}, ${commands.kickCommand}, ${commands.muteCommand}, ${commands.unmuteCommand}, ${commands.camNoiBayCommand}, ${commands.autoKickCommand}, ${commands.autoKickListCommand}, ${commands.autoKickRemoveCommand}, ${commands.goAutoKickCommand}, ${commands.addQTVCommand}, ${commands.removeQTVCommand}, ${commands.xepHangDayCommand}, ${commands.xepHangMonthCommand}, ${commands.xepHangTotalCommand}, ${commands.resetChatCommand}`
        );

        const messageHandler = createMessageHandler({
            api,
            User,
            MutedMember,
            GroupSetting,
            GroupKeyMember,
            CommandViolation,
            commands,
            botUserId,
            messageStore,
        });
        const groupEventHandler = createGroupEventHandler({
            api,
            GroupSetting,
            User,
            KickHistory,
            kickIntentStore,
            botUserId,
        });
        api.listener.on("message", messageHandler);
        api.listener.on("group_event", groupEventHandler);

        // Handle message recall/undo events
        api.listener.on("undo", async (undo) => {
            try {
                console.log("[🔔 UNDO EVENT] Nhận được sự kiện thu hồi tin nhắn");
                
                const threadId = String(undo?.threadId || "").trim();
                if (!threadId) {
                    console.log("[UNDO] Không có threadId");
                    return;
                }

                const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
                if (setting?.preventRecallEnabled !== true) {
                    console.log("[UNDO] Chế độ chống thu hồi chưa được bật");
                    return;
                }

                // Get the recalled message ID
                const globalMsgId = Number(undo?.data?.content?.globalMsgId || 0);
                if (!globalMsgId) {
                    console.log("[UNDO] Không có globalMsgId");
                    return;
                }

                console.log(`[UNDO] Tìm kiếm tin nhắn với ID: ${globalMsgId}`);
                
                // Retrieve the original message from store
                const originalMessage = messageStore.getMessage(threadId, globalMsgId);
                if (!originalMessage) {
                    console.log(`[UNDO] Không tìm thấy tin nhắn bị thu hồi (msgId: ${globalMsgId})`);
                    return;
                }

                const recalledContent = originalMessage.content;
                const recallerName = originalMessage.senderName || `UID ${originalMessage.senderUid}`;

                if (!recalledContent) {
                    console.log("[UNDO] Không có nội dung tin nhắn");
                    return;
                }

                try {
                    const msg = [
                        "� PHÁT HIỆN! 🔥",
                        `${recallerName} vừa thu hồi tin nhắn (bị bắt tại trận 😂)`,
                        "",
                        "📢 NỘI DUNG BẤT CỨU:",
                        `"${recalledContent}"`,
                        "",
                        "💀 Thôi mà, em ơi, tham lam cau được quả lựu đạn 😅",
                    ].join("\n");

                    await api.sendMessage({ msg }, threadId, 1);
                    console.log(`[🎉 RECALL SUCCESS] Đã gửi thông báo thu hồi tin nhắn cho nhóm ${threadId}`);
                } catch (error) {
                    console.error("Lỗi gửi thông báo thu hồi:", error);
                }
            } catch (error) {
                console.error("Lỗi handler undo:", error);
            }
        });

        api.listener.start();
        console.log("Đã bật listener");
    } catch (error) {
        console.error("Khởi động bot thất bại:", error);
        try {
            await mongoose.disconnect();
        } catch (_) {}
        process.exit(1);
    }
}

startBot();



