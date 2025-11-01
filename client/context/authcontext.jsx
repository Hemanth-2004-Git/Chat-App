import { createContext, useEffect, useState, useRef } from "react";
import axios from 'axios';
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendurl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: backendurl,
});

export const authcontext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authuser, setAuthuser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef(null);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        api.defaults.headers.common["token"] = token;
        const { data } = await api.get("/api/auth/check");
        if (data.success) {
          setAuthuser(data.user);
          initializeSocket(data.user);
          setToken(token);
        }
      }
    } catch (error) {
      console.error("Auth check error:", error);
      localStorage.removeItem("token");
      delete api.defaults.headers.common["token"];
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (mode, credentials) => {
    try {
      const { data } = await api.post(`/api/auth/${mode}`, credentials);
      
      if (data.success) {
        if (mode === 'login') {
          setAuthuser(data.userData);
          initializeSocket(data.userData);
          api.defaults.headers.common["token"] = data.token;
          setToken(data.token);
          localStorage.setItem("token", data.token);
        }
        toast.success(data.message);
        return true;
      } else {
        toast.error(data.message);
        return false;
      }
    } catch (error) {
      console.error("Auth error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Authentication failed";
      toast.error(errorMessage);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      setToken(null);
      setAuthuser(null);
      setOnlineUsers([]);
      setSocket(null);
      delete api.defaults.headers.common["token"];
      toast.success("Logged out successfully");
    }
  };

  const updateprofile = async (body) => {
    try {
      const { data } = await api.put("/api/auth/update-profile", body);
      if (data.success) {
        setAuthuser(data.user);
        toast.success("Profile updated successfully");
        return true;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  const initializeSocket = (userData) => {
    if (!userData?._id) return;

    // Prevent duplicate connections
    if (socketRef.current?.connected) {
      console.log("✅ Socket already connected");
      return;
    }

    console.log("🔌 Connecting socket for user:", userData._id);
    
    const newSocket = io(backendurl, {
      query: {
        userId: userData._id.toString(),
      },
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("✅ Socket connected successfully");
      newSocket.emit("userOnline", userData._id);
    });

    newSocket.on("getonlineusers", (userIds) => {
      console.log("📱 Online users:", userIds);
      setOnlineUsers(Array.isArray(userIds) ? userIds : []);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
    });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    axios: api,
    authuser,
    onlineUsers,
    socket,
    login,
    logout,
    updateprofile,
    isLoading
  };

  return (
    <authcontext.Provider value={value}>
      {children}
    </authcontext.Provider>
  );
};