// server/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// Load .env file from server directory
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __serverDir = dirname(__filename);
dotenv.config({ path: join(__serverDir, ".env") });
import http from "http";
import userrouter from "./routes/userroute.js";
import { Server } from "socket.io";
import { initializeFirebase } from "./lib/firebase.js"; // Import Firebase initializer
import messagerouter from "./routes/messageroute.js";

const app = express();
const server = http.createServer(app);

// Connect to Firebase Admin
initializeFirebase();

const PORT = process.env.PORT || 5000;

// CORS configuration - allow multiple localhost ports for development and Render URLs
const allowedOrigins = process.env.FRONTEND_URL 
    ? [process.env.FRONTEND_URL]
    : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:5175"];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow Render and Vercel URLs (including all subdomains)
        if (origin.includes('onrender.com') || 
            origin.includes('vercel.app') || 
            origin.includes('netlify.app') ||
            allowedOrigins.indexOf(origin) !== -1 || 
            origin.includes('localhost')) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Favicon handler - return 204 No Content to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('📦 Request body:', req.body);
    }
    next();
});

// Test route
app.get("/api/test", (req, res) => {
    res.json({ 
        success: true, 
        message: "Backend server is working with Firebase!",
        timestamp: new Date().toISOString()
    });
});

app.get("/api/status", (req, res) => res.send("server is live"));

// Routes
app.use("/api/auth", userrouter);
app.use("/api/messages", messagerouter);

// ✅ FIXED: Proper 404 handler - remove the problematic "*" route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error("🚨 Unhandled error:", error);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Socket.io configuration - allow Render URLs
const socketOrigins = process.env.FRONTEND_URL 
    ? [process.env.FRONTEND_URL]
    : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:5175"];

export const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            // Allow requests with no origin
            if (!origin) return callback(null, true);
            
            // Allow Render, Vercel, and Netlify URLs (including all subdomains)
            if (origin.includes('onrender.com') || 
                origin.includes('vercel.app') || 
                origin.includes('netlify.app') ||
                socketOrigins.indexOf(origin) !== -1 || 
                origin.includes('localhost')) {
                callback(null, true);
            } else {
                console.log('❌ Socket.IO CORS blocked origin:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST']
    }
});
 
export const usersocketmap = {};

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("🔗 User connected - User ID:", userId, "Socket ID:", socket.id);

    if (userId) {
        usersocketmap[userId] = socket.id;
        console.log("📊 Current online users:", Object.keys(usersocketmap));
        
        // Broadcast to ALL connected clients
        io.emit("getonlineusers", Object.keys(usersocketmap));
    }

    socket.on("userOnline", (userId) => {
        console.log("🟢 User explicitly online:", userId);
        if (userId) {
            usersocketmap[userId] = socket.id;
            io.emit("getonlineusers", Object.keys(usersocketmap));
        }
    });

    // Typing indicators
    socket.on("typing", (data) => {
        const { receiverId, isGroup, senderId } = data;
        
        if (isGroup) {
            // For groups, emit to all members except sender
            const groupMembers = Object.keys(usersocketmap).filter(id => id !== senderId);
            groupMembers.forEach(memberId => {
                const memberSocketId = usersocketmap[memberId];
                if (memberSocketId) {
                    io.to(memberSocketId).emit("usertyping", {
                        senderId,
                        senderName: data.senderName || 'Someone',
                        groupId: receiverId
                    });
                }
            });
        } else {
            // For direct messages, emit to receiver
            const receiverSocketId = usersocketmap[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("usertyping", {
                    senderId,
                    senderName: data.senderName || 'Someone'
                });
            }
        }
    });

    socket.on("stoptyping", (data) => {
        const { receiverId, isGroup, senderId } = data;
        
        if (isGroup) {
            // For groups, emit to all members except sender
            const groupMembers = Object.keys(usersocketmap).filter(id => id !== senderId);
            groupMembers.forEach(memberId => {
                const memberSocketId = usersocketmap[memberId];
                if (memberSocketId) {
                    io.to(memberSocketId).emit("userstoptyping", {
                        senderId,
                        groupId: receiverId
                    });
                }
            });
        } else {
            // For direct messages, emit to receiver
            const receiverSocketId = usersocketmap[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("userstoptyping", {
                    senderId
                });
            }
        }
    });

    // Message delivery confirmation
    socket.on("messagedelivered", (data) => {
        const { messageId, senderId } = data;
        const senderSocketId = usersocketmap[senderId];
        if (senderSocketId) {
            io.to(senderSocketId).emit("messagedelivered", {
                messageId,
                delivered: true
            });
        }
    });

    // Message read confirmation
    socket.on("messageread", (data) => {
        const { messageId, senderId } = data;
        const senderSocketId = usersocketmap[senderId];
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageread", {
                messageId,
                read: true
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected - User ID:", userId);
        if (userId) {
            delete usersocketmap[userId];
            console.log("📊 Remaining online users:", Object.keys(usersocketmap));
            io.emit("getonlineusers", Object.keys(usersocketmap));
        }
    });
});

server.listen(PORT, () => {
    console.log("🚀 Server is running on port " + PORT);
    console.log("📡 Test server at: http://localhost:" + PORT + "/api/test");
});