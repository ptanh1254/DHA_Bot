const mongoose = require("mongoose");

const commandAliasSchema = new mongoose.Schema(
    {
        // Bí danh người dùng muốn (ví dụ: '!chao')
        alias: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        // Lệnh gốc của hệ thống (ví dụ: '!hello')
        originalCommand: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        description: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true,
    }
);

const CommandAlias = mongoose.model("CommandAlias", commandAliasSchema);

module.exports = {
    CommandAlias,
};
