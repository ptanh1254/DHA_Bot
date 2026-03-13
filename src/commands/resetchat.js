const { formatCount } = require("../design/chatRanking/template");

async function handleResetChatCommand(api, message, threadId, User) {
    const result = await User.updateMany({ groupId: threadId }, { $set: { msgCount: 0 } });
    const affected = result?.matchedCount ?? result?.modifiedCount ?? 0;
    await api.sendMessage(
        {
            msg: `Đã reset chat về 0 cho ${formatCount(affected)} thành viên trong nhóm này.`,
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleResetChatCommand,
};

