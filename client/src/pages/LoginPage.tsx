// client/src/pages/LoginPage.tsx

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/authcontext.jsx";
import { auth } from "../libs/firebase.js";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import axios from "axios";
import assets from "../assets/assets";

const API_URL = (import.meta.env as any).VITE_BACKEND_URL || "http://localhost:5000/api";
console.log("LoginPage API_URL:", API_URL);

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      toast.error("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // The onAuthStateChanged listener in AuthContextProvider
      // will handle fetching user data and setting the user state.
      console.log("Firebase login successful:", userCredential.user.uid);
      
      // ✅ Navigate immediately for faster UX - auth context will handle the rest
      navigate("/");
      toast.success("Logged in successfully!");
    } catch (err: any) {
      console.error("Firebase login error:", err);
      let errorMessage = "Failed to log in.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in our database, if not create them
      try {
        const token = await user.getIdToken();
        const checkUrl = `${API_URL}/auth/check`;
        console.log("Checking auth at:", checkUrl);
        
        const checkResponse = await axios.get(checkUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // If user doesn't exist in our database, create them
        if (!checkResponse.data.success || !checkResponse.data.user) {
          const signupUrl = `${API_URL}/auth/signup`;
          console.log("Creating user at:", signupUrl);
          
          await axios.post(signupUrl, {
            fullName: user.displayName || "User",
            email: user.email || "",
            bio: "",
          }, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
        
        // ✅ Navigate immediately for faster UX
        navigate("/");
        toast.success("Signed in with Google successfully!");
      } catch (dbError: any) {
        console.error("Database error:", dbError);
        console.error("Error details:", dbError.response?.data || dbError.message);
        const errorMsg = dbError.response?.data?.message || dbError.message || "Failed to load profile";
        toast.error(`Login successful but ${errorMsg}. The auth context will handle the rest.`);
        // Let the auth context handle the user state from Firebase
        navigate("/");
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      let errorMessage = "Failed to sign in with Google.";
      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-in cancelled.";
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen relative"
      style={{
        backgroundImage: `url(${assets.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay for better readability */}
      <div className='absolute inset-0 bg-black/30 backdrop-blur-sm'></div>
      
      {/* Content with relative positioning */}
      <div className="relative z-10 w-full max-w-md p-8 space-y-6 bg-gray-900/80 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50">
        <h1 className="text-3xl font-bold text-center text-white">
          Welcome Back!
        </h1>
        <p className="text-center text-gray-300">
          Sign in to continue to your account
        </p>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-600 rounded-lg shadow-sm bg-gray-800/50 backdrop-blur-sm text-sm font-medium text-white hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900/80 text-gray-400">Or continue with email</span>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              placeholder="Enter your email"
              required
              className="w-full px-3 py-2 mt-1 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              placeholder="Enter your password"
              required
              className="w-full px-3 py-2 mt-1 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-3 font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:from-violet-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 transition-all shadow-lg"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="text-sm text-center text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;