async function handlePreventRecallCommand(api, message, threadId, GroupSetting, argsText, prefix = "!") {
    const normalizedArgs = String(argsText || "").trim().toLowerCase();
    const messageType = Number(message?.type) || 1;

    const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
    const currentStatus = setting?.preventRecallEnabled === true;

    // Nếu không có args, show trạng thái hiện tại
    if (!normalizedArgs) {
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

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai cú pháp. Dùng \`${prefix}chongthuhoi on\` hoặc \`${prefix}chongthuhoi off\`.`,
            },
            threadId,
            messageType
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { preventRecallEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "✅ Đã bật chế độ 'Chống thu hồi'\n\nTừ giờ, tin nhắn bị thu hồi sẽ được bot gửi lại nội dung."
                : "❌ Đã tắt chế độ 'Chống thu hồi'\n\nTin nhắn bị thu hồi sẽ không được gửi lại nào.",
        },
        threadId,
        messageType
    );
    console.log(`[chongthuhoi] Đổi trạng thái chế độ chống thu hồi thành ${shouldEnable} cho nhóm ${threadId}`);
}

module.exports = {
    handlePreventRecallCommand,
};
