const fs = require("fs");
const path = require("path");

function loadConfig() {
    const configPath = path.resolve("config.json");
    if (!fs.existsSync(configPath)) {
        return { PREFIX: "!" };
    }

    const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
}

module.exports = {
    loadConfig,
};
