// server/lib/firebase.js

import admin from "firebase-admin";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { existsSync } from "fs";

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
  // Try multiple possible paths (in order of preference)
  const possiblePaths = [
    join(process.cwd(), "serviceAccountKey.json"),   // Current working dir (most reliable)
    resolve(process.cwd(), "serviceAccountKey.json"), // Absolute path from CWD
    join(__dirname, "..", "serviceAccountKey.json"),  // Relative to lib directory
    resolve(__dirname, "..", "serviceAccountKey.json"), // Absolute from lib directory
  ];
  
  for (const serviceAccountPath of possiblePaths) {
    if (existsSync(serviceAccountPath)) {
      try {
        const serviceAccountContent = readFileSync(serviceAccountPath, "utf8");
        const parsed = JSON.parse(serviceAccountContent);
        console.log(`✅ Using serviceAccountKey.json file from: ${serviceAccountPath}`);
        return parsed;
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error(`❌ Failed to parse serviceAccountKey.json at ${serviceAccountPath}:`, error.message);
        } else {
          console.error(`❌ Failed to read serviceAccountKey.json at ${serviceAccountPath}:`, error.message);
        }
      }
    }
  }
  
  // If we get here, file wasn't found in any location
  console.error(`❌ serviceAccountKey.json not found in any of these locations:`);
  possiblePaths.forEach(path => console.error(`   - ${path}`));
  console.error(`   Current working directory: ${process.cwd()}`);
  console.error(`   __dirname: ${__dirname}`);

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