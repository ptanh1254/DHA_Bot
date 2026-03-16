const mongoose = require("mongoose");

const userNoteSchema = new mongoose.Schema({
    groupId: String,
    userId: String,
    note: { type: String, default: "" },
    createdBy: String,
    createdByName: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const UserNote = mongoose.models.UserNote || mongoose.model("UserNote", userNoteSchema);

module.exports = {
    UserNote,
};
