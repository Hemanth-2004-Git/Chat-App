// client/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// These variables MUST be defined in your client/.env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize auth with explicit LOCAL persistence
// This ensures users stay logged in even after closing the app
export const auth = getAuth(app);

// Set persistence to LOCAL (persists across app restarts)
// This is the default for web, but we set it explicitly for clarity and mobile compatibility
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✅ Firebase Auth persistence set to LOCAL - users will stay logged in");
  })
  .catch((error) => {
    console.error("❌ Error setting auth persistence:", error);
  });

export const db = getDatabase(app);