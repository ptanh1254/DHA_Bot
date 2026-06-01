const { getMessageType, normalizeId } = require("../utils/commonHelpers");

async function handleFindCommand(api, message, threadId, User, argsText, prefix) {
    const messageType = getMessageType(message);

    if (!argsText) {
        return api.sendMessage({ msg: `Vui lòng nhập tên Ingame. VD: ${prefix}find DHA.Enji` }, threadId, messageType);
    }

    const searchQuery = argsText.trim();
    
    // Tìm kiếm không phân biệt hoa thường và chứa từ khóa
    const regex = new RegExp(searchQuery, "i");

    const users = await User.find({
        groupId: threadId,
        ingameName: regex
    }).lean();

    if (users.length === 0) {
        return api.sendMessage({ msg: `Không tìm thấy Ingame chứa "${searchQuery}".` }, threadId, messageType);
    }

    let msg = `Tìm thấy ${users.length} người có Ingame "${searchQuery}":\n\n`;
    let mentions = [];
    
    users.forEach((u, i) => {
        const safeName = String(u.displayName || "Thành viên").replace(/\n/g, " ").trim();
        const mentionText = `@${safeName}`;
        
        const prefixStr = `${i + 1}. `;
        msg += prefixStr;
        const posAt = Array.from(msg).length;
        
        msg += mentionText;
        msg += ` (Ingame: ${u.ingameName})\n`;
        
        mentions.push({
            uid: String(normalizeId(u.userId) || u.userId),
            pos: posAt,
            len: Array.from(mentionText).length,
        });
    });

    try {
        await api.sendMessage({ msg, mentions }, threadId, messageType);
    } catch (error) {
        await api.sendMessage({ msg: `Lỗi khi tag.` }, threadId, messageType);
    }
}

module.exports = {
    handleFindCommand
};
