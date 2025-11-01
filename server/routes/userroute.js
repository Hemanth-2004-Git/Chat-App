import express from "express";
import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// Remove the verifyToken middleware for signup/login routes
// Signup
router.post("/signup", async (req, res) => {
    try {
        console.log("📝 Signup request received:", req.body);
        
        const { fullName, email, password, bio } = req.body;

        // Validation
        if (!fullName || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "All fields are required" 
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: "User already exists with this email" 
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        const newUser = new User({
            fullName,
            email: email.toLowerCase(),
            password: hashedPassword,
            bio: bio || ""
        });

        await newUser.save();

        console.log("✅ User created successfully:", newUser._id);

        res.status(201).json({
            success: true,
            message: "User created successfully",
            userData: {
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                bio: newUser.bio,
                profilePic: newUser.profilePic
            }
        });

    } catch (error) {
        console.error("❌ Signup error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during signup: " + error.message 
        });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        console.log("🔐 Login request received:", { email: req.body.email });
        
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Email and password are required" 
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid email or password" 
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid email or password" 
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "30d" }
        );

        console.log("✅ Login successful for user:", user._id);

        res.json({
            success: true,
            message: "Login successful",
            token,
            userData: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                bio: user.bio,
                profilePic: user.profilePic
            }
        });

    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during login: " + error.message 
        });
    }
});

// Check authentication
router.get("/check", async (req, res) => {
    try {
        const token = req.headers.token;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: "No token provided" 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
        const user = await User.findById(decoded.userId).select("-password");
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }
        
        res.json({ 
            success: true, 
            user 
        });
    } catch (error) {
        console.error("Auth check error:", error);
        res.status(401).json({ 
            success: false, 
            message: "Invalid token" 
        });
    }
});

// Update profile
router.put("/update-profile", async (req, res) => {
    try {
        const token = req.headers.token;
        if (!token) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
        const { fullName, bio, profilePic } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(
            decoded.userId,
            { 
                fullName, 
                bio,
                ...(profilePic && { profilePic })
            },
            { new: true }
        ).select("-password");

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during profile update" 
        });
    }
});

export default router;