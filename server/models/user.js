import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    profilePic: {
        type: String,
        default: ""
    },
    bio: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

// Remove password from JSON output
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

// ✅ FIXED: Check if model already exists before creating
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;