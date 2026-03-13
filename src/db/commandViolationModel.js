const mongoose = require("mongoose");

const commandViolationSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true },
        userId: { type: String, required: true },
        strikeCount: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
    }
);

commandViolationSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const CommandViolation =
    mongoose.models.CommandViolation ||
    mongoose.model("CommandViolation", commandViolationSchema);

module.exports = {
    CommandViolation,
};
