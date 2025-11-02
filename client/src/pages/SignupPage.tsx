// client/src/pages/SignupPage.tsx

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { auth } from "../libs/firebase.js";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import axios from "axios";
import assets from "../assets/assets";

const API_URL = (import.meta.env as any).VITE_BACKEND_URL || "http://localhost:5000/api";
console.log("SignupPage API_URL:", API_URL);

const SignupPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const bio = formData.get("bio") as string;

    if (!fullName || !email || !password) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      // First create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Get the ID token to send to backend
      const token = await userCredential.user.getIdToken();
      
      // Then create user data in backend with authentication token
      const response = await axios.post(`${API_URL}/auth/signup`, {
        fullName,
        email,
        bio: bio || ""
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        toast.success("Account created successfully!");
        // The auth context will handle user state, navigate to home
        navigate("/");
      } else {
        // If backend signup fails, delete the Firebase user
        await userCredential.user.delete();
        toast.error(response.data.message || "Signup failed");
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      let errorMessage = "Failed to create account.";
      
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "Email is already registered.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in our database
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
        
        toast.success("Signed up with Google successfully!");
        navigate("/");
      } catch (dbError: any) {
        console.error("Database error:", dbError);
        console.error("Error details:", dbError.response?.data || dbError.message);
        const errorMsg = dbError.response?.data?.message || dbError.message || "Failed to initialize profile";
        toast.error(`Account created but ${errorMsg}. The auth context will handle the rest.`);
        // Let the auth context handle the user state from Firebase
        navigate("/login");
      }
    } catch (err: any) {
      console.error("Google signup error:", err);
      let errorMessage = "Failed to sign up with Google.";
      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-up cancelled.";
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
          Create Account
        </h1>
        <p className="text-center text-gray-300">
          Sign up to start chatting with your friends!
        </p>

        {/* Google Sign Up Button */}
        <button
          type="button"
          onClick={handleGoogleSignup}
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
          {loading ? "Signing up..." : "Sign up with Google"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900/80 text-gray-400">Or sign up with email</span>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSignup}>
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-300"
            >
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              id="fullName"
              placeholder="Enter your full name"
              required
              className="w-full px-3 py-2 mt-1 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>
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
              placeholder="Enter your password (min. 6 characters)"
              required
              minLength={6}
              className="w-full px-3 py-2 mt-1 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-gray-300"
            >
              Bio (Optional)
            </label>
            <textarea
              name="bio"
              id="bio"
              placeholder="Tell us about yourself"
              rows={3}
              className="w-full px-3 py-2 mt-1 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-3 font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:from-violet-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 transition-all shadow-lg"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="text-sm text-center text-gray-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;

