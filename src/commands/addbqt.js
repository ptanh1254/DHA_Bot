const { getMentionedTargets, formatNameList, getMessageType, normalizeId } = require("../utils/commonHelpers");

async function handleAddQTVCommand(api, message, threadId, GroupKeyMember, prefix = "!") {
    const messageType = getMessageType(message);
    const targets = getMentionedTargets(message);
    
    // Normalize IDs to ensure consistent format (remove _0, _1, etc suffixes)
    const normalizedTargets = targets.map(target => ({
        ...target,
        userId: normalizeId(target.userId) || target.userId,
    }));
    
    console.log(`[addqtv] threadId=${threadId}, targets.length=${targets.length}, targets=${JSON.stringify(targets)}`);
    
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: `Hãy tag người cần thêm vào danh sách dùng lệnh. Ví dụ: ${prefix}addqtv @TenNguoiDung`,
            },
            threadId,
            messageType
        );
        return;
    }

    const operations = normalizedTargets.map((target) => ({
        updateOne: {
            filter: { groupId: threadId, userId: target.userId },
            update: {
                $set: {
                    userName: target.displayName,
                    verifiedAt: new Date(),
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId: target.userId,
                },
            },
            upsert: true,
        },
    }));

    try {
        await GroupKeyMember.bulkWrite(operations, { ordered: false });
        console.log(`[addqtv] Thêm thành công ${targets.length} người`);
    } catch (error) {
        console.error(`[addqtv] Lỗi bulkWrite:`, error);
        throw error;
    }

    await api.sendMessage(
        {
            msg: [
                "Đã thêm vào danh sách được dùng lệnh:",
                formatNameList(normalizedTargets),
            ].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleAddQTVCommand,
};

const handleaddqtvCommand = handleAddQTVCommand;
