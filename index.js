require("dotenv").config();
const mongoose = require("mongoose");
const { Zalo } = require("zca-js");

const { loadConfig } = require("./src/config/loadConfig");
const { loadCookie } = require("./src/auth/loadCookie");
const { User } = require("./src/db/userModel");
const { GroupSetting } = require("./src/db/groupSettingModel");
const { MutedMember } = require("./src/db/mutedMemberModel");
const { GroupKeyMember } = require("./src/db/groupKeyMemberModel");
const { KickHistory } = require("./src/db/kickHistoryModel");
const { imageMetadataGetter } = require("./src/media/imageMetadataGetter");
const { handleHelloCommand } = require("./src/commands/hello");
const { handleHelpCommand } = require("./src/commands/help");
const { handleThongTinCommand } = require("./src/commands/thongtin");
const { handleCheckTTCommand } = require("./src/commands/checktt");
const { handleKickCommand } = require("./src/commands/kick");
const { handleMuteCommand } = require("./src/commands/mute");
const { handleUnmuteCommand } = require("./src/commands/unmute");
const { handleCamNoiBayCommand } = require("./src/commands/camnoibay");
const { handleAutoKickCommand } = require("./src/commands/autokick");
const { handleKeyCommand } = require("./src/commands/key");
const { handleSetKeyCommand } = require("./src/commands/setkey");
const { handleAddAdminCommand } = require("./src/commands/addadmin");
const { handleXepHangChatCommand } = require("./src/commands/xephangchat");
const { handleResetChatCommand } = require("./src/commands/resetchat");
const { createMessageHandler } = require("./src/bot/createMessageHandler");
const { createGroupEventHandler } = require("./src/bot/createGroupEventHandler");
const { createKickIntentStore } = require("./src/runtime/kickIntentStore");
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
            `Backfill bo dem ngay/thang xong: ${backfillPeriodResult.modifiedCount || 0} bản ghi`
        );

        const imei = process.env.ZALO_IMEI;
        const userAgent = process.env.ZALO_USER_AGENT;
        if (!imei || !userAgent) {
            throw new Error("Thiếu ZALO_IMEI hoặc ZALO_USER_AGENT trong .env");
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
        const commands = {
            helpCommand: `${prefix}help`.toLowerCase(),
            helloCommand: `${prefix}hello`.toLowerCase(),
            thongTinCommand: `${prefix}thongtin`.toLowerCase(),
            checkTTCommand: `${prefix}checktt`.toLowerCase(),
            kickCommand: `${prefix}kick`.toLowerCase(),
            muteCommand: `${prefix}mute`.toLowerCase(),
            unmuteCommand: `${prefix}unmute`.toLowerCase(),
            camNoiBayCommand: `${prefix}camnoibay`.toLowerCase(),
            autoKickCommand: `${prefix}autokick`.toLowerCase(),
            keyCommand: `${prefix}key`.toLowerCase(),
            setKeyCommand: `${prefix}setkey`.toLowerCase(),
            addAdminCommand: `${prefix}addadmin`.toLowerCase(),
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
            handleKey: (api, message, threadId, argsText) =>
                handleKeyCommand(
                    api,
                    message,
                    threadId,
                    GroupSetting,
                    GroupKeyMember,
                    argsText,
                    prefix
                ),
            handleSetKey: (api, message, threadId, argsText) =>
                handleSetKeyCommand(
                    api,
                    message,
                    threadId,
                    GroupSetting,
                    GroupKeyMember,
                    argsText,
                    prefix
                ),
            handleAddAdmin: (api, message, threadId) =>
                handleAddAdminCommand(api, message, threadId, GroupKeyMember, prefix),
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
            `Lệnh đang nghe: ${commands.helpCommand}, ${commands.helloCommand}, ${commands.thongTinCommand}, ${commands.checkTTCommand}, ${commands.kickCommand}, ${commands.muteCommand}, ${commands.unmuteCommand}, ${commands.camNoiBayCommand}, ${commands.autoKickCommand}, ${commands.keyCommand}, ${commands.setKeyCommand}, ${commands.addAdminCommand}, ${commands.xepHangDayCommand}, ${commands.xepHangMonthCommand}, ${commands.xepHangTotalCommand}, ${commands.resetChatCommand}`
        );

        const messageHandler = createMessageHandler({
            api,
            User,
            MutedMember,
            GroupSetting,
            GroupKeyMember,
            commands,
            botUserId,
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


