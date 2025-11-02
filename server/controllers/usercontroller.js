// server/controllers/usercontroller.js

import { admin, db } from "../lib/firebase.js";
import cloudinary from "../lib/cloudinary.js";

// SIGNUP CONTROLLER
export const signup = async (req, res) => {
    try {
        console.log("📝 Signup request received:", req.body);
        
        const { fullName, email, password, bio } = req.body;

        // Check if user is authenticated (Google signup case or client-created Firebase user)
        let uid = null;
        if (req.user && req.user.uid) {
            // User is already authenticated (e.g., Google sign-in or client created in Firebase Auth)
            uid = req.user.uid;
            console.log("✅ User already authenticated, using existing UID:", uid);
        } else {
            // Traditional email/password signup - need to validate fields
            if (!fullName || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Full name, email, and password are required. If you created an account in Firebase, please ensure you're sending the authentication token."
                });
            }

            // Create user in Firebase Auth
            try {
                const userRecord = await admin.auth().createUser({
                    email: email,
                    password: password,
                    displayName: fullName
                });
                uid = userRecord.uid;
                console.log("✅ Firebase Auth user created successfully:", uid);
            } catch (createError) {
                if (createError.code === 'auth/email-already-exists') {
                    return res.status(400).json({
                        success: false,
                        message: "User already exists. Please send authentication token if you created the account in Firebase."
                    });
                }
                throw createError;
            }
        }

        // Check if user data already exists in RTDB
        const existingUserSnapshot = await db.ref(`users/${uid}`).once("value");
        
        if (existingUserSnapshot.exists()) {
            console.log("ℹ️ User data already exists in RTDB, returning existing user");
            const existingUser = existingUserSnapshot.val();
            return res.status(200).json({
                success: true,
                message: "User data already exists",
                user: { ...existingUser, uid: uid }
            });
        }

        // Get Firebase user data for profile picture (if available)
        let profilePic = "";
        try {
            const firebaseUser = await admin.auth().getUser(uid);
            profilePic = firebaseUser.photoURL || "";
        } catch (err) {
            console.log("Could not fetch Firebase user data for profile pic");
        }

        // Create user data in Realtime Database
        const userData = {
            fullName: fullName || req.user?.displayName || "User",
            email: email || req.user?.email || "",
            bio: bio || "",
            profilePic: profilePic
        };

        await db.ref(`users/${uid}`).set(userData);
        
        console.log("✅ User data created in RTDB");

        res.status(201).json({
            success: true,
            message: "User created successfully.",
            user: { ...userData, uid: uid }
        });

    } catch (error) {
        console.error("❌ Signup error:", error);
        let message = error.message;
        if (error.code === 'auth/email-already-exists') {
            message = "User already exists with this email";
            return res.status(400).json({ success: false, message: message });
        }
        res.status(500).json({
            success: false,
            message: message
        });
    }
}

// LOGIN CONTROLLER - REMOVED
// Client should handle login via Firebase Client SDK
// and receive an ID token.

// UPDATE PROFILE CONTROLLER
export const updateprofile = async (req, res) => {
    try {
        console.log("📝 Update profile request received for user:", req.user?.uid);
        console.log("📦 Request body:", {
            hasFullName: !!req.body.fullName,
            hasBio: !!req.body.bio,
            hasProfilePic: !!req.body.profilePic,
            profilePicType: req.body.profilePic ? (typeof req.body.profilePic) : 'none',
            profilePicLength: req.body.profilePic ? req.body.profilePic.length : 0
        });
        
        const { fullName, bio, profilePic } = req.body;
        const uid = req.user?.uid; // Get UID from our protectroute middleware
        
        if (!uid) {
            console.error("❌ No UID found in req.user");
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }
        
        // Validate required fields
        if (!fullName || fullName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Full name is required"
            });
        }
        
        const updates = {
            fullName: fullName.trim(),
            bio: bio ? bio.trim() : ""
        };

        // Handle image upload - try Cloudinary first, fallback to base64 storage
        if (profilePic) {
            try {
                // Check if it's already a URL (from Google auth or previous upload)
                if (typeof profilePic === 'string' && (profilePic.startsWith('http://') || profilePic.startsWith('https://'))) {
                    updates.profilePic = profilePic;
                    console.log("✅ Using existing profile picture URL");
                } else if (typeof profilePic === 'string') {
                    // It's a base64 image - check size limit (500KB max for Firebase storage)
                    const maxSize = 500 * 1024; // 500KB
                    const imageSize = profilePic.length;
                    
                    // Check if Cloudinary is available
                    const cloudinaryConfig = cloudinary.config();
                    let hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                    let uploadSuccess = false;
                    
                    if (hasCloudinary) {
                        // Cloudinary is configured, use it (preferred method)
                        console.log("📤 Uploading image to Cloudinary...");
                        console.log("📏 Image data length:", imageSize);
                        
                        try {
                            const uploadresponse = await cloudinary.uploader.upload(profilePic, {
                                folder: "chat-app-profiles",
                                resource_type: "image",
                                transformation: [
                                    { width: 400, height: 400, crop: "fill", gravity: "face" }
                                ]
                            });
                            
                            updates.profilePic = uploadresponse.secure_url;
                            uploadSuccess = true;
                            console.log("✅ Image uploaded to Cloudinary successfully:", uploadresponse.secure_url);
                        } catch (cloudinaryError) {
                            console.warn("⚠️ Cloudinary upload failed, falling back to base64 storage");
                            console.warn("⚠️ Error:", cloudinaryError.message);
                            // Will fall through to base64 storage
                        }
                    }
                    
                    // Fallback: Store as base64 in Firebase (for small images only)
                    if (!uploadSuccess) {
                        if (imageSize > maxSize) {
                            console.warn(`⚠️ Image too large (${Math.round(imageSize/1024)}KB). Max size: 500KB`);
                            console.warn("⚠️ Profile will be updated without picture. Please configure Cloudinary for larger images.");
                            // Continue without updating profilePic
                        } else {
                            // Store base64 directly in Firebase (works for small images)
                            updates.profilePic = profilePic;
                            console.log("✅ Storing image as base64 in Firebase (small image)");
                            console.log("📏 Image size:", Math.round(imageSize/1024), "KB");
                        }
                    }
                } else {
                    console.warn("⚠️ Invalid profilePic format:", typeof profilePic);
                }
            } catch (uploadError) {
                console.error("❌ Image processing error:", uploadError);
                console.error("❌ Error details:", uploadError.message);
                // Don't fail the entire update if image processing fails - just skip it
                console.warn("⚠️ Skipping profile picture update due to error");
                // Continue without updating profilePic - the profile update will still succeed
            }
        }

        console.log("📝 Updating user data in Firebase RTDB:", updates);
        await db.ref(`users/${uid}`).update(updates);

        // Fetch the updated user data to return
        const userSnapshot = await db.ref(`users/${uid}`).once("value");

        if (!userSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "User not found in database"
            });
        }

        const updatedUser = { ...userSnapshot.val(), uid: uid };
        console.log("✅ Profile updated successfully");

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("❌ Update profile error:", error);
        console.error("❌ Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
}

// CHECK AUTH CONTROLLER
export const checkAuth = async (req, res) => {
    try {
        // req.user is populated by the protectroute middleware
        const uid = req.user.uid;
        
        // Check if user exists in RTDB
        const userSnapshot = await db.ref(`users/${uid}`).once("value");
        
        if (userSnapshot.exists()) {
            // User exists, return user data
            const userData = userSnapshot.val();
            return res.json({ 
                success: true, 
                user: { ...userData, uid: uid }
            });
        } else {
            // User doesn't exist in RTDB (e.g., Google user first login)
            // Create user data automatically
            const firebaseUser = await admin.auth().getUser(uid);
            
            const userData = {
                fullName: firebaseUser.displayName || "User",
                email: firebaseUser.email || "",
                bio: "",
                profilePic: firebaseUser.photoURL || ""
            };

            await db.ref(`users/${uid}`).set(userData);
            console.log("✅ Auto-created user data in RTDB for:", uid);
            
            return res.json({ 
                success: true, 
                user: { ...userData, uid: uid }
            });
        }
    } catch (error) {
        console.error("❌ Check auth error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}