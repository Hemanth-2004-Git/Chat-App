import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authcontext } from "./authcontext.jsx";
import toast from "react-hot-toast";

export const chatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [unseenMessages, setUnseenMessages] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const { socket, axios, onlineUsers } = useContext(authcontext);

    // ✅ FIXED: Added useCallback to prevent infinite re-renders
    const getUsers = useCallback(async () => {
        if (isLoading) return;
        
        setIsLoading(true);
        try {
            const { data } = await axios.get("/api/messages/users");
            if (data.success) {
                setUsers(data.users || []);
                setUnseenMessages(data.unseenMessages || {});
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error(error.response?.data?.message || "Failed to load users");
        } finally {
            setIsLoading(false);
        }
    }, [axios, isLoading]);

    const getMessages = async (userId) => {
        try {
            const { data } = await axios.get(`/api/messages/${userId}`);
            if (data.success) {
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
            toast.error(error.response?.data?.message || "Failed to load messages");
        }
    };

    const sendMessage = async (messageData) => {
        try {
            if (!selectedUser) {
                toast.error("No user selected");
                return;
            }
            
            const { data } = await axios.post(`/api/messages/send/${selectedUser._id}`, messageData);
            if (data.success) {
                setMessages(prev => [...prev, data.newMessage]);
                
                // Emit socket event for real-time messaging
                if (socket) {
                    socket.emit("sendmessage", {
                        receiverId: selectedUser._id,
                        message: data.newMessage
                    });
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error(error.response?.data?.message || "Failed to send message");
        }
    };

    // ✅ FIXED: Proper socket subscription with cleanup
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            console.log("📩 New message received:", newMessage);
            
            if (selectedUser && newMessage.senderId === selectedUser._id) {
                // Mark as seen and add to current chat
                setMessages(prev => [...prev, { ...newMessage, seen: true }]);
                
                // Mark as read in backend
                axios.put(`/api/messages/mark/${newMessage._id}`).catch(console.error);
                
                // Update unseen messages count
                setUnseenMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: 0
                }));
            } else {
                // Increment unseen count for other users
                setUnseenMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1
                }));
            }
        };

        socket.on("newmessage", handleNewMessage);

        // Cleanup
        return () => {
            socket.off("newmessage", handleNewMessage);
        };
    }, [socket, selectedUser, axios]);

    // ✅ FIXED: Load users only when socket connects or on mount
    useEffect(() => {
        if (socket?.connected) {
            getUsers();
        }
    }, [socket?.connected, getUsers]);

    const value = {
        messages,
        setMessages,
        selectedUser,
        setSelectedUser,
        users,
        unseenMessages,
        setUnseenMessages,
        getUsers,
        getMessages,
        sendMessage,
        isLoading
    };

    return (
        <chatContext.Provider value={value}>
            {children}
        </chatContext.Provider>
    );
};