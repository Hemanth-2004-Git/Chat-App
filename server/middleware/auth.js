// server/middleware/auth.js

import { admin, db } from "../lib/firebase.js";

export const protectroute = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        let token;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: "No token provided. Authorization header is missing or malformed." 
            });
        }

        // Verify the ID token
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // Get Firebase user data (for Google users who might not be in RTDB yet)
        const firebaseUser = await admin.auth().getUser(uid);

        // Get user data from Realtime Database
        const userSnapshot = await db.ref(`users/${uid}`).once("value");
        
        if (userSnapshot.exists()) {
            // User exists in RTDB, use that data
            req.user = { ...userSnapshot.val(), uid: uid };
        } else {
            // User doesn't exist in RTDB yet (e.g., Google user first login)
            // Attach minimal user info from Firebase Auth so routes can handle it
            req.user = {
                uid: uid,
                email: firebaseUser.email || "",
                displayName: firebaseUser.displayName || "User",
                photoURL: firebaseUser.photoURL || ""
            };
        }
        
        next();
    } catch (error) {
        console.log("Auth error:", error.message);
        let message = "Invalid token";
        if (error.code === 'auth/id-token-expired') {
            message = "Token expired, please log in again.";
        }
        res.status(401).json({ 
            success: false, 
            message: message 
        });
    }
}

// Optional auth middleware - doesn't fail if no token is provided
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        let token;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (token) {
            // Verify the ID token
            const decodedToken = await admin.auth().verifyIdToken(token);
            const uid = decodedToken.uid;

            // Get Firebase user data
            const firebaseUser = await admin.auth().getUser(uid);

            // Get user data from Realtime Database
            const userSnapshot = await db.ref(`users/${uid}`).once("value");
            
            if (userSnapshot.exists()) {
                req.user = { ...userSnapshot.val(), uid: uid };
            } else {
                req.user = {
                    uid: uid,
                    email: firebaseUser.email || "",
                    displayName: firebaseUser.displayName || "User",
                    photoURL: firebaseUser.photoURL || ""
                };
            }
        }
        // If no token, req.user will be undefined, which is fine for signup
        next();
    } catch (error) {
        // If token verification fails, just continue without req.user
        console.log("Optional auth: token invalid or missing, continuing without auth");
        next();
    }
}

export const checkAuth = (req, res) => {
    // This function is now just a simple pass-through
    // if protectroute middleware was successful.
    res.json({ 
        success: true, 
        user: req.user 
    });
}