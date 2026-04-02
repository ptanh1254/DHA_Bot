const mongoose = require("mongoose");

const bannedWordStrikeSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true },
        userId: { type: String, required: true },
        strikeCount: { type: Number, default: 0 },
        lastViolationAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
    }
);

bannedWordStrikeSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const BannedWordStrike =
    mongoose.models.BannedWordStrike ||
    mongoose.model("BannedWordStrike", bannedWordStrikeSchema);

module.exports = {
    BannedWordStrike,
};
