const { CommandAlias } = require("../db/commandAliasModel");

const aliasMap = {}; // In-memory map to serve message handler with zero DB latency

async function loadAliases() {
    try {
        const aliases = await CommandAlias.find({}).lean();
        
        // Clear existing properties
        for (const key in aliasMap) {
            delete aliasMap[key];
        }
        
        for (const a of aliases) {
            aliasMap[a.alias] = a.originalCommand;
        }
        
        console.log(`[AliasManager] Nạp thành công ${aliases.length} aliases vào bộ nhớ.`);
    } catch (e) {
        console.error("[AliasManager] Lỗi nạp aliases từ DB:", e);
    }
}

function getAliasMap() {
    return aliasMap;
}

// Kiểm tra xem lệnh gốc này có đang bị thay thế bởi một alias nào đó không
function isOriginalCommandDisabled(originalCommand) {
    const values = Object.values(aliasMap);
    return values.includes(originalCommand.toLowerCase().trim());
}

module.exports = {
    loadAliases,
    getAliasMap,
    isOriginalCommandDisabled
};
