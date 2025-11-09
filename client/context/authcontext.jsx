// client/context/authcontext.jsx

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../src/libs/firebase.js";
import axios from "axios";
import { io } from "socket.io-client";

export const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api";
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL?.replace('/api', '') || "http://localhost:5000";
console.log("AuthContext API_URL:", API_URL);
console.log("AuthContext SOCKET_URL:", SOCKET_URL);

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  // Create axios instance with interceptors (memoized to prevent recreation)
  const axiosInstance = useMemo(() => {
    console.log("Creating axios instance with baseURL:", API_URL);
    const instance = axios.create({
      baseURL: API_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor to include auth token
    instance.interceptors.request.use(
      async (config) => {
        const token = localStorage.getItem("authToken");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log("🔑 Token added to request:", config.url, "Token length:", token.length);
        } else {
          console.warn("⚠️ No token found in localStorage for request:", config.url);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle token refresh
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear auth
          console.warn("⚠️ 401 Unauthorized - Token expired or invalid");
          localStorage.removeItem("authToken");
          // Note: State updates should be handled in the component/context, not here
          // The error will be caught by the calling code which can handle state updates
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, []);

  // Firebase auth state listener
  useEffect(() => {
    let currentSocket = null;
    let tokenRefreshInterval = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      // Clean up existing socket and token refresh interval before creating new one
      if (currentSocket) {
        currentSocket.disconnect();
        currentSocket = null;
        setSocket(null);
      }
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
      }

      if (firebaseUser) {
        try {
          // Get the Firebase ID token (automatically refreshes if expired)
          // This ensures tokens are always fresh, even after app restart
          const token = await firebaseUser.getIdToken(true); // Force refresh on app restart
          
          // Send token to backend to verify and get user data
          console.log("Axios instance baseURL:", axiosInstance.defaults.baseURL);
          console.log("Calling /auth/check with baseURL:", axiosInstance.defaults.baseURL);
          const { data } = await axiosInstance.get("/auth/check", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (data.success) {
            // Store the ID token for future requests
            localStorage.setItem("authToken", token);
            // Set user data from our backend (include uid for socket)
            const userData = { ...data.user, uid: firebaseUser.uid, _id: data.user.uid || firebaseUser.uid };
            setUser(userData);
            
            // Set up automatic token refresh (Firebase tokens expire after 1 hour)
            // Refresh token every 50 minutes to prevent expiration
            tokenRefreshInterval = setInterval(async () => {
              try {
                const currentUser = auth.currentUser;
                if (currentUser) {
                  const newToken = await currentUser.getIdToken(true);
                  localStorage.setItem("authToken", newToken);
                  console.log("✅ Token refreshed automatically");
                } else {
                  clearInterval(tokenRefreshInterval);
                  tokenRefreshInterval = null;
                }
              } catch (error) {
                console.error("Error refreshing token:", error);
                clearInterval(tokenRefreshInterval);
                tokenRefreshInterval = null;
              }
            }, 50 * 60 * 1000); // 50 minutes

            // Initialize socket connection
            const newSocket = io(SOCKET_URL, {
              query: {
                userId: userData.uid || userData._id,
              },
              transports: ["websocket"],
            });

            newSocket.on("connect", () => {
              console.log("Socket connected:", newSocket.id);
            });

            newSocket.on("getonlineusers", (users) => {
              setOnlineUsers(users || []);
            });

            newSocket.on("disconnect", () => {
              console.log("Socket disconnected");
            });

            currentSocket = newSocket;
            setSocket(newSocket);
          } else {
            throw new Error(data.message || "Auth check failed");
          }
        } catch (err) {
          console.error("Auth context error:", err);
          console.error("Error details:", {
            message: err.message,
            response: err.response?.data,
            status: err.response?.status,
            url: err.config?.url,
            baseURL: err.config?.baseURL
          });
          
          // More specific error handling
          if (err.response?.status === 401) {
            console.warn("⚠️ Authentication failed - Token expired or invalid");
            console.warn("💡 User needs to log in again");
          } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
            console.error("❌ Network error - Backend server may not be running");
            console.error("💡 Check if backend server is running on:", API_URL);
          } else if (err.response?.status === 404) {
            console.error("❌ Route not found - Check backend routes");
          }
          
          setUser(null);
          localStorage.removeItem("authToken");
          setOnlineUsers([]);
          if (tokenRefreshInterval) {
            clearInterval(tokenRefreshInterval);
            tokenRefreshInterval = null;
          }
        }
      } else {
        // User logged out - clean up
        setUser(null);
        localStorage.removeItem("authToken");
        setOnlineUsers([]);
        if (tokenRefreshInterval) {
          clearInterval(tokenRefreshInterval);
          tokenRefreshInterval = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (currentSocket) {
        currentSocket.disconnect();
      }
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
    };
  }, [axiosInstance]);


  // Login function (optional - LoginPage uses Firebase directly)
  const login = async (email, password) => {
    try {
      // This is just for compatibility - LoginPage handles Firebase login directly
      // If you need backend login, implement it here
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No auth token found");
      }
      
      const { data } = await axiosInstance.get("/auth/check");
      if (data.success) {
        setUser(data.user);
        return { success: true, user: data.user };
      }
      throw new Error(data.message || "Login failed");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem("authToken");
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setOnlineUsers([]);
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear local state even if signOut fails
      setUser(null);
      localStorage.removeItem("authToken");
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  };

  // Update profile function
  const updateprofile = async (profileData) => {
    try {
      console.log("Updating profile with data:", {
        ...profileData,
        profilePic: profileData.profilePic ? (profileData.profilePic.length > 50 ? profileData.profilePic.substring(0, 50) + '...' : profileData.profilePic) : 'none'
      });
      
      const { data } = await axiosInstance.put("/auth/update", profileData);
      
      console.log("Profile update response:", data);
      
      if (data.success) {
        setUser(data.user);
        console.log("✅ Profile updated successfully, user state updated");
        return { success: true, user: data.user };
      }
      throw new Error(data.message || "Profile update failed");
    } catch (error) {
      console.error("Update profile error:", error);
      console.error("Error response:", error.response?.data);
      throw error;
    }
  };

  const value = {
    // User state
    user,
    authuser: user, // Alias for compatibility
    setUser,
    loading,
    isLoading: loading, // Alias for compatibility
    
    // Functions
    login,
    logout,
    updateprofile,
    
    // Socket and network
    socket,
    axios: axiosInstance,
    onlineUsers,
    
    // Firebase auth instance
    auth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Export both named and default context for compatibility
export const authcontext = AuthContext;

// Custom hook for easier usage
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthContextProvider");
  }
  return context;
};

// Export provider with alias
export const AuthProvider = AuthContextProvider;
