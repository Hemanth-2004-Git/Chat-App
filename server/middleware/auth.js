import jwt from "jsonwebtoken";
import User from "../models/user.js"; // unified casing to match other imports

export const protectroute = async (req, res, next) => {
    try {
        const token = req.headers.token;

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: "No token provided" 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET); // ✅ Fixed variable name

        const user = await User.findById(decoded.userId).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.log("Auth error:", error.message);
        res.status(401).json({ 
            success: false, 
            message: "Invalid token" 
        });
    }
}

export const checkAuth = (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
}