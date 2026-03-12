require("dotenv").config();
const mongoose = require("mongoose");
const { Zalo } = require("zca-js");

const { loadConfig } = require("./src/config/loadConfig");
const { loadCookie } = require("./src/auth/loadCookie");
const { User } = require("./src/db/userModel");
const { GroupSetting } = require("./src/db/groupSettingModel");
const { imageMetadataGetter } = require("./src/media/imageMetadataGetter");
const { handleHelloCommand } = require("./src/commands/hello");
const { handleHelpCommand } = require("./src/commands/help");
const { handleThongTinCommand } = require("./src/commands/thongtin");
const { handleCheckTTCommand } = require("./src/commands/checktt");
const { handleKickCommand } = require("./src/commands/kick");
const { handleXepHangChatCommand } = require("./src/commands/xephangchat");
const { handleResetChatCommand } = require("./src/commands/resetchat");
const { createMessageHandler } = require("./src/bot/createMessageHandler");
const { createGroupEventHandler } = require("./src/bot/createGroupEventHandler");
const { createKickIntentStore } = require("./src/runtime/kickIntentStore");

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
            xepHangCommand: `${prefix}xhchat`.toLowerCase(),
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
            handleXepHang: handleXepHangChatCommand,
            handleResetChat: handleResetChatCommand,
        };

        console.log("Zalo bot đã đăng nhập thành công");
        console.log(
            `Lệnh đang nghe: ${commands.helpCommand}, ${commands.helloCommand}, ${commands.thongTinCommand}, ${commands.checkTTCommand}, ${commands.kickCommand}, ${commands.xepHangCommand}, ${commands.resetChatCommand}`
        );

        const messageHandler = createMessageHandler({ api, User, commands, botUserId });
        const groupEventHandler = createGroupEventHandler({
            api,
            GroupSetting,
            User,
            kickIntentStore,
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


