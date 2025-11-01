import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// SIGNUP CONTROLLER
export const signup = async (req, res) => {
    try {
        console.log("📝 Signup request received:", req.body);
        
        const { fullName, email, password, bio } = req.body;

        // Validate required fields
        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, and password are required"
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("❌ User already exists:", email);
            return res.status(400).json({
                success: false,
                message: "User already exists with this email"
            });
        }

        // Create new user
        const user = new User({
            fullName,
            email,
            password,
            bio: bio || ""
        });

        await user.save();
        console.log("✅ User created successfully:", user._id);

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || "fallback-secret-key-123",
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "User created successfully",
            userData: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                bio: user.bio,
                profilePic: user.profilePic
            },
            token
        });

    } catch (error) {
        console.error("❌ Signup error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// LOGIN CONTROLLER
export const login = async (req, res) => {
    try {
        console.log("🔐 Login request received:", req.body);
        
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            console.log("❌ User not found:", email);
            return res.status(400).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log("❌ Invalid password for user:", email);
            return res.status(400).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || "fallback-secret-key-123",
            { expiresIn: "7d" }
        );

        console.log("✅ Login successful for user:", user._id);
        
        res.json({
            success: true,
            message: "Login successful",
            userData: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                bio: user.bio,
                profilePic: user.profilePic
            },
            token
        });

    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// UPDATE PROFILE CONTROLLER
export const updateprofile = async (req, res) => {
    try {
        const { fullName, bio, profilePic } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { fullName, bio, profilePic },
            { new: true }
        ).select("-password");

        res.json({
            success: true,
            message: "Profile updated successfully",
            user
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// CHECK AUTH CONTROLLER
export const checkAuth = (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
}