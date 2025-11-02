// server/lib/firebase.js

import admin from "firebase-admin";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

let db;

// Helper function to get service account credentials
const getServiceAccount = () => {
  // Option 1: Try environment variable (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT from environment:", error.message);
    }
  }

  // Option 2: Try serviceAccountKey.json file
  const serviceAccountPath = join(__dirname, "..", "serviceAccountKey.json");
  try {
    const serviceAccountContent = readFileSync(serviceAccountPath, "utf8");
    return JSON.parse(serviceAccountContent);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("❌ serviceAccountKey.json file not found");
    } else {
      console.error("❌ Failed to read serviceAccountKey.json:", error.message);
    }
  }

  // If neither option works, throw an error
  throw new Error(
    "Firebase service account credentials not found. " +
    "Please either:\n" +
    "1. Set FIREBASE_SERVICE_ACCOUNT environment variable with your service account JSON, or\n" +
    "2. Place serviceAccountKey.json in the server directory"
  );
};

export const initializeFirebase = () => {
  try {
    const serviceAccount = getServiceAccount();

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    db = admin.database();
    console.log("✅ Firebase Admin SDK Initialized");
    console.log(`🔥 Connected to Firebase Realtime Database: ${process.env.FIREBASE_DATABASE_URL}`);
  } catch (error) {
    console.error("❌ Firebase Admin SDK initialization failed:", error.message);
    process.exit(1);
  }
};

// Export the admin and db instances for use in other files
export { admin, db };