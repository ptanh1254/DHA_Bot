const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { CommandAlias } = require("../db/commandAliasModel");
const { BotResponse } = require("../db/botResponseModel");
const { loadAliases } = require("../runtime/aliasManager");
const { loadBotResponses, DEFAULT_RESPONSES } = require("../runtime/botResponseManager");
const { User } = require("../db/userModel");
const { UserDailyMessage } = require("../db/userDailyMessageModel");
const { UserWeeklyMessage } = require("../db/userWeeklyMessageModel");
const { KickHistory } = require("../db/kickHistoryModel");
const { ReminderSetting } = require("../db/reminderSettingModel");
const { getVNDateParts, getVNWeekInfo } = require("../utils/vnTime");

let io; // Global socket.io instance

function startWebServer(port = 3005, api = null, groupNameCache = {}) {
    const app = express();
    const server = http.createServer(app);
    io = new Server(server, {
        cors: { origin: "*" }
    });

    io.on("connection", (socket) => {
        console.log(`[Socket] Client kết nối: ${socket.id}`);
        socket.on("disconnect", () => {
            console.log(`[Socket] Client ngắt kết nối: ${socket.id}`);
        });
    });

    app.use(cors());
    app.use(bodyParser.json());
    app.use(express.static(path.join(__dirname, "public")));

    // Lấy danh sách alias
    app.get("/api/aliases", async (req, res) => {
        try {
            const aliases = await CommandAlias.find({}).sort({ createdAt: -1 });
            res.json(aliases);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Lấy danh sách tất cả lệnh gốc của hệ thống
    app.get("/api/commands", (req, res) => {
        const commands = [
            { cmd: '!hello', desc: 'Bật/tắt lời chào mừng thành viên mới' },
            { cmd: '!help', desc: 'Xem danh sách lệnh của Bot' },
            { cmd: '!thongtin', desc: 'Xem thông tin của thành viên' },
            { cmd: '!checktt', desc: 'Kiểm tra tương tác của nhóm' },
            { cmd: '!check', desc: 'Kiểm tra thông tin chi tiết một người' },
            { cmd: '!checkingame', desc: 'Xem danh sách tên in-game của nhóm' },
            { cmd: '!ingame', desc: 'Cài đặt tên in-game của bạn' },
            { cmd: '!removeingame', desc: 'Xóa tên in-game của bạn' },
            { cmd: '!chongthuhoi', desc: 'Bật/tắt tính năng chống thu hồi tin nhắn' },
            { cmd: '!note', desc: 'Tạo ghi chú cho nhóm' },
            { cmd: '!xoanote', desc: 'Xóa ghi chú của nhóm' },
            { cmd: '!kick', desc: 'Đuổi một thành viên khỏi nhóm' },
            { cmd: '!mute', desc: 'Cấm chat thành viên' },
            { cmd: '!unmute', desc: 'Bỏ cấm chat thành viên' },
            { cmd: '!camnoibay', desc: 'Bật/tắt kiểm duyệt chửi bậy' },
            { cmd: '!autokick', desc: 'Cài đặt tự động kick người không tương tác' },
            { cmd: '!autokicklist', desc: 'Xem danh sách người bị đánh dấu auto-kick' },
            { cmd: '!autokickremove', desc: 'Gỡ người khỏi danh sách auto-kick' },
            { cmd: '!addbqt', desc: 'Thêm quyền quản trị Bot cho thành viên' },
            { cmd: '!removeqtv', desc: 'Xóa quyền quản trị Bot của thành viên' },
            { cmd: '!xephangchat', desc: 'Xem bảng xếp hạng chat của nhóm' },
            { cmd: '!resetchat', desc: 'Reset thống kê chat của nhóm' },
            { cmd: '!afk', desc: 'Treo máy/Thông báo vắng mặt' },
            { cmd: '!love', desc: 'Ghép đôi ngẫu nhiên' },
            { cmd: '!ask', desc: 'Hỏi đáp AI (ChatGPT)' },
            { cmd: '!nghiep', desc: 'Xem độ nghiệp tụ của bạn' },
            { cmd: '!timso', desc: 'Tra cứu thông tin số điện thoại' },
            { cmd: '!camlenhbe', desc: 'Cấm sử dụng lệnh với người cụ thể' },
            { cmd: '!thiepcuoi', desc: 'Tạo thiệp cưới vui nhộn' },
            { cmd: '!random', desc: 'Vòng quay may mắn chọn người ngẫu nhiên' },
            { cmd: '!find', desc: 'Tìm kiếm và tag thành viên theo tên Ingame' }
        ];
        res.json(commands);
    });

    // Lấy thống kê chat
    app.get("/api/stats", async (req, res) => {
        try {
            const { groupId } = req.query;
            let matchStage = {};
            if (groupId && groupId !== "all") {
                matchStage.groupId = groupId;
            }

            const now = new Date();
            const { dayKey, monthKey } = getVNDateParts(now);
            const { weekKey } = getVNWeekInfo(now);

            // Fetch Total
            const totalStats = await User.aggregate([
                { $match: matchStage },
                { $group: { _id: null, totalAllTime: { $sum: "$totalMsgCount" } } }
            ]);

            // Fetch Daily
            const dailyMatch = { ...matchStage, dayKey };
            const dailyStats = await UserDailyMessage.aggregate([
                { $match: dailyMatch },
                { $group: { _id: null, totalDaily: { $sum: "$msgCount" } } }
            ]);

            // Fetch Weekly
            const weeklyMatch = { ...matchStage, weekKey };
            const weeklyStats = await UserWeeklyMessage.aggregate([
                { $match: weeklyMatch },
                { $group: { _id: null, totalWeekly: { $sum: "$msgCount" } } }
            ]);
            
            // Fetch Monthly
            const monthlyMatch = { ...matchStage, monthKey };
            const monthlyStats = await User.aggregate([
                { $match: monthlyMatch },
                { $group: { _id: null, totalMonthly: { $sum: "$monthlyMsgCount" } } }
            ]);

            res.json({
                totalDaily: dailyStats.length > 0 ? dailyStats[0].totalDaily : 0,
                totalWeekly: weeklyStats.length > 0 ? weeklyStats[0].totalWeekly : 0,
                totalMonthly: monthlyStats.length > 0 ? monthlyStats[0].totalMonthly : 0,
                totalAllTime: totalStats.length > 0 ? totalStats[0].totalAllTime : 0
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Thêm mới hoặc cập nhật alias
    app.post("/api/aliases", async (req, res) => {
        try {
            const { alias, originalCommand, description } = req.body;
            if (!alias || !originalCommand) {
                return res.status(400).json({ error: "Thiếu trường alias hoặc originalCommand" });
            }

            const cleanAlias = alias.toLowerCase().trim();
            const cleanOriginal = originalCommand.toLowerCase().trim();

            await CommandAlias.findOneAndUpdate(
                { alias: cleanAlias },
                { originalCommand: cleanOriginal, description },
                { upsert: true, new: true }
            );

            // Nạp lại vào bộ nhớ để Bot Zalo nhận diện ngay lập tức
            await loadAliases();
            
            res.json({ success: true, message: "Cập nhật lệnh thành công" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Xóa alias
    app.delete("/api/aliases/:id", async (req, res) => {
        try {
            await CommandAlias.findByIdAndDelete(req.params.id);
            await loadAliases();
            res.json({ success: true, message: "Đã xóa lệnh" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Lấy lịch sử Auto Kick
    app.get("/api/autokick", async (req, res) => {
        try {
            const list = await KickHistory.find({}).sort({ lastKickAt: -1 }).lean();
            if (api) {
                const missingAvatarIds = list.filter(i => !i.avatarUrl).map(i => i.userId);
                const uniqueMissing = [...new Set(missingAvatarIds)].slice(0, 50);
                
                let changedProfiles = {};
                if (uniqueMissing.length > 0) {
                    try {
                        const userInfo = await api.getUserInfo(uniqueMissing);
                        changedProfiles = userInfo?.changed_profiles || {};
                    } catch (e) {}
                }

                for (let item of list) {
                    let needsSave = false;

                    const isFallbackName = !item.groupName || item.groupName === ("Nhóm " + item.groupId);
                    if (isFallbackName) {
                        const isCacheFallback = !groupNameCache[item.groupId] || groupNameCache[item.groupId] === ("Nhóm " + item.groupId);
                        if (isCacheFallback) {
                            try {
                                const gInfo = await api.getGroupInfo(item.groupId);
                                const gridInfoMap = gInfo?.gridInfoMap || {};
                                const groupInfo = gridInfoMap[item.groupId] || Object.values(gridInfoMap)[0];
                                groupNameCache[item.groupId] = groupInfo?.name || "Nhóm " + item.groupId;
                            } catch (e) {
                                groupNameCache[item.groupId] = "Nhóm " + item.groupId;
                            }
                        }
                        item.groupName = groupNameCache[item.groupId] || item.groupId;
                        needsSave = true;
                    }

                    if (!item.avatarUrl && uniqueMissing.includes(item.userId)) {
                        const profile = changedProfiles[item.userId] || changedProfiles[`${item.userId}_0`] || Object.values(changedProfiles).find(p => p.zId === item.userId);
                        if (profile && profile.avatar) {
                            item.avatarUrl = profile.avatar;
                            needsSave = true;
                        }
                    }

                    if (needsSave) {
                        KickHistory.updateOne({ _id: item._id }, { $set: { groupName: item.groupName, avatarUrl: item.avatarUrl } }).exec().catch(()=>{});
                    }
                }
            }
            res.json(list);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Xóa record Auto Kick
    app.delete("/api/autokick/:id", async (req, res) => {
        try {
            await KickHistory.findByIdAndDelete(req.params.id);
            res.json({ success: true, message: "Đã xóa khỏi danh sách Auto Kick" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Danh sách nhóm bot đang tham gia
    app.get("/api/groups", async (req, res) => {
        try {
            if (!api) return res.json([]);
            const allGroups = await api.getAllGroups();
            const gridVerMap = allGroups?.gridVerMap || {};
            const groupIds = Object.keys(gridVerMap).map(id => String(id).trim()).filter(Boolean);

            const result = [];
            for (const gid of groupIds) {
                if (!groupNameCache[gid]) {
                    try {
                        const gInfo = await api.getGroupInfo(gid);
                        const gridInfoMap = gInfo?.gridInfoMap || {};
                        const groupInfo = gridInfoMap[gid] || Object.values(gridInfoMap)[0];
                        groupNameCache[gid] = groupInfo?.name || "Nhóm " + gid;
                    } catch (e) {
                        groupNameCache[gid] = "Nhóm " + gid;
                    }
                }
                result.push({ groupId: gid, groupName: groupNameCache[gid] || gid });
            }
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Lời nhắc mặc định
    app.get("/api/reminder-defaults", (req, res) => {
        res.json({
            reminderMessage:
                "⚠️ **THÔNG BÁO ĐUA ĐỘI - LƯU Ý GIỜ VÀO ĐUA**\n\n" +
                "⏰ **Thời gian bắt đầu:** Đúng **20h05**.\n\n" +
                "🚫 **CẢNH BÁO:** Để trải nghiệm tốt nhất cho cả đội, tuyệt đối không vào sớm. Phát hiện vi phạm sẽ bị kick.\n\n" +
                "🙏 *Đây là tin nhắn nhắc nhở tự động. Chúc toàn bộ anh em tổ lái đua tốt!*",
            startMessage: "🚀 **GIỜ G ĐÃ ĐẾN!** Cả nhà vào đua đội ngay thôi nào! Chúc anh em cuối tuần rực rỡ! 🔥"
        });
    });

    app.get("/api/chat-history", (req, res) => {
        res.json(chatHistory);
    });

    // --- REMINDER SETTINGS API ---
    app.get("/api/reminders", async (req, res) => {
        try {
            const list = await ReminderSetting.find({}).lean();
            if (api) {
                for (let item of list) {
                    if (!groupNameCache[item.groupId]) {
                        try {
                            const gInfo = await api.getGroupInfo(item.groupId);
                            const gridInfoMap = gInfo?.gridInfoMap || {};
                            const groupInfo = gridInfoMap[item.groupId] || Object.values(gridInfoMap)[0];
                            groupNameCache[item.groupId] = groupInfo?.name || "Nhóm " + item.groupId;
                        } catch (e) {
                            groupNameCache[item.groupId] = "Nhóm " + item.groupId;
                        }
                    }
                    item.groupName = groupNameCache[item.groupId] || item.groupId;
                }
            }
            res.json(list);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post("/api/reminders", async (req, res) => {
        try {
            const {
                groupId, enabled, reminderType, onceDate, startHour, startMinute, endHour, endMinute,
                intervalMinutes, daysOfWeek, reminderMessage, startMessage
            } = req.body;

            if (!groupId) {
                return res.status(400).json({ error: "Thiếu groupId" });
            }

            await ReminderSetting.findOneAndUpdate(
                { groupId },
                {
                    enabled: !!enabled,
                    reminderType: reminderType || "recurring",
                    onceDate: onceDate || "",
                    startHour: Number(startHour),
                    startMinute: Number(startMinute),
                    endHour: Number(endHour),
                    endMinute: Number(endMinute),
                    intervalMinutes: Number(intervalMinutes),
                    daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek.map(Number) : [0, 6],
                    reminderMessage,
                    startMessage
                },
                { upsert: true, new: true }
            );
            res.json({ success: true, message: "Lưu cấu hình nhắc nhở thành công" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.delete("/api/reminders/:groupId", async (req, res) => {
        try {
            await ReminderSetting.findOneAndDelete({ groupId: req.params.groupId });
            res.json({ success: true, message: "Đã xóa lịch nhắc" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get("/api/test-upload", async (req, res) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const { Zalo } = require('zca-js');
            const { imageMetadataGetter } = require('../media/imageMetadataGetter');
            const { loadCookie } = require('../auth/loadCookie');
            const zalo = new Zalo({ imageMetadataGetter, checkUpdate: false });
            
            const cookies = loadCookie();
            await zalo.loginCookie(cookies);
            
            const result = await zalo.api.uploadAttachment([path.resolve('wheel_1780281149587_478.gif')], '9424168019446271926', 1);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message, stack: e.stack });
        }
    });

    server.listen(port, () => {
        console.log(`[Web Server] Admin Dashboard chạy tại: http://localhost:${port}`);
    });
}

const chatHistory = [];
const MAX_HISTORY = 50;

function broadcastChatMessage(messageData) {
    chatHistory.push(messageData);
    if (chatHistory.length > MAX_HISTORY) {
        chatHistory.shift();
    }
    if (io) {
        io.emit("chat_message", messageData);
    }
}

module.exports = { startWebServer, broadcastChatMessage };
