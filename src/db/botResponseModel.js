const mongoose = require("mongoose");

const botResponseSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    description: { type: String },
    category: { type: String, default: "Khác" }
}, {
    timestamps: true
});

const BotResponse = mongoose.model("BotResponse", botResponseSchema);

module.exports = { BotResponse };
