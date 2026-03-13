async function handlePreventRecallCommand(api, message, threadId, GroupSetting, prefix = "!") {
    const messageType = Number(message?.type) || 1;
    const userId = String(message?.data?.uidFrom || "").trim();
    
    if (!userId) {
        await api.sendMessage(
            {
                msg: "Không thể xác định người dùng.",
            },
            threadId,
            messageType
        );
        return;
    }

    const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
    const currentStatus = setting?.preventRecallEnabled !== false;

    // Nếu không có args, show trạng thái hiện tại
    if (!message?.data?.content || typeof message.data.content !== "string") {
        await api.sendMessage(
            {
                msg: [
                    `Chế độ "Chống thu hồi" hiện tại: ${currentStatus ? "BẬT" : "TẮT"}`,
                    "",
                    `Dùng \`${prefix}chongthuhoi on\` để bật`,
                    `Dùng \`${prefix}chongthuhoi off\` để tắt`,
                    "",
                    "Khi bật: Tin nhắn bị thu hồi sẽ được gửi lại nội dung",
                    "Ví dụ: 'Người X vừa thu hồi: [nội dung tin nhắn]'",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const rawText = message.data.content.trim();
    const normalized = rawText.toLowerCase();

    if (normalized === `${prefix}chongthuhoi on` || normalized === `${prefix}chongthuhoi on `) {
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            {
                $set: { preventRecallEnabled: true },
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        await api.sendMessage(
            {
                msg: [
                    "✅ Đã bật chế độ 'Chống thu hồi'",
                    "",
                    "Từ giờ, tin nhắn bị thu hồi sẽ được bot gửi lại nội dung.",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        console.log(`[chongthuhoi] Bật chế độ chống thu hồi cho nhóm ${threadId}`);
        return;
    }

    if (normalized === `${prefix}chongthuhoi off` || normalized === `${prefix}chongthuhoi off `) {
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            {
                $set: { preventRecallEnabled: false },
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        await api.sendMessage(
            {
                msg: [
                    "❌ Đã tắt chế độ 'Chống thu hồi'",
                    "",
                    "Tin nhắn bị thu hồi sẽ không được gửi lại nào.",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        console.log(`[chongthuhoi] Tắt chế độ chống thu hồi cho nhóm ${threadId}`);
        return;
    }

    // Nếu args không hợp lệ
    await api.sendMessage(
        {
            msg: [
                "Sai cú pháp!",
                "",
                `${prefix}chongthuhoi - Xem trạng thái`,
                `${prefix}chongthuhoi on - Bật`,
                `${prefix}chongthuhoi off - Tắt`,
            ].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handlePreventRecallCommand,
};
