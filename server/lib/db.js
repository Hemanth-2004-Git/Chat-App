import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('🔌 MongoDB disconnected');
        });

    } catch (error) {
        console.error("❌ MongoDB connection failed:", error.message);
        console.log("💡 Make sure your MongoDB Atlas credentials are correct and IP is whitelisted");
        process.exit(1);
    }
};