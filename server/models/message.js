import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, "Message cannot exceed 1000 characters"]
    },
    seen: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for better query performance
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ createdAt: 1 });

// ✅ FIXED: Check if model already exists
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;