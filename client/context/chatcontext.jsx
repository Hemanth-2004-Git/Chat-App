import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authcontext } from "./authcontext.jsx";
import toast from "react-hot-toast";

export const chatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [unseenMessages, setUnseenMessages] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const messagesCache = useRef({}); // Cache messages by userId

    const { socket, axios, onlineUsers, user, auth } = useContext(authcontext);

    // ✅ FIXED: Added useCallback to prevent infinite re-renders
    const getUsers = useCallback(async () => {
        if (isLoading) {
            console.log("⏳ Already loading users, skipping...");
            return;
        }
        if (!axios) {
            console.log("⚠️ Axios not available, skipping getUsers");
            return;
        }
        if (!user) {
            console.log("⚠️ User not authenticated, skipping getUsers");
            return;
        }
        
        // Get token from localStorage
        let token = localStorage.getItem("authToken");
        
        // If no token but we have a Firebase auth user, try to get a fresh one
        if (!token && auth?.currentUser) {
            try {
                token = await auth.currentUser.getIdToken();
                localStorage.setItem("authToken", token);
                console.log("✅ Refreshed token and stored in localStorage");
            } catch (tokenError) {
                console.error("❌ Failed to get token:", tokenError);
            }
        }
        
        if (!token) {
            console.log("⚠️ No auth token, cannot fetch users");
            return;
        }
        
        setIsLoading(true);
        try {
            console.log("📡 Fetching users from /messages/users");
            console.log("🔑 Token present:", !!token, "Token length:", token.length);
            // Manually add token to this request to ensure it's included (in addition to interceptor)
            const { data } = await axios.get("/messages/users", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            console.log("✅ Users response:", data);
            if (data.success) {
                console.log("✅ Users received:", data.users?.length || 0, "users");
                // Fetch groups as well
                try {
                    const groupsResponse = await axios.get("/messages/groups", {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                    
                    if (groupsResponse.data.success) {
                        const allUsersAndGroups = [
                            ...(data.users || []),
                            ...(groupsResponse.data.groups || [])
                        ];
                        setUsers(allUsersAndGroups);
                        // Merge unseen messages from both users and groups
                        setUnseenMessages({
                            ...(data.unseenMessages || {}),
                            ...(groupsResponse.data.unseenmessages || {})
                        });
                        console.log("✅ Groups received:", groupsResponse.data.groups?.length || 0, "groups");
                    } else {
                        // If groups fail, just use users
                        setUsers(data.users || []);
                        setUnseenMessages(data.unseenMessages || {});
                    }
                } catch (groupsError) {
                    console.warn("⚠️ Failed to fetch groups, using users only");
                    setUsers(data.users || []);
                    setUnseenMessages(data.unseenMessages || {});
                }
            } else {
                console.warn("⚠️ API returned success: false", data.message);
            }
        } catch (error) {
            console.error("❌ Error fetching users:", error);
            console.error("❌ Error details:", error.response?.data || error.message);
            console.error("❌ Request config:", error.config);
            if (error.response?.status === 401) {
                console.error("🔑 Auth failed - token may be expired or invalid");
                // Clear invalid token
                localStorage.removeItem("authToken");
            }
            toast.error(error.response?.data?.message || "Failed to load users");
        } finally {
            setIsLoading(false);
        }
    }, [axios, isLoading, user, auth]);

    const getMessages = async (userId, isGroup = false) => {
        if (!userId) return;
        
        const cacheKey = `${userId}_${isGroup ? 'group' : 'user'}`;
        
        // ✅ INSTANT FEEDBACK: Clear messages immediately and show cached if available
        setMessages([]);
        setLoadingMessages(true);
        
        // Check cache first for instant display
        if (messagesCache.current[cacheKey]) {
            setMessages(messagesCache.current[cacheKey]);
            setLoadingMessages(false);
        }
        
        try {
            const endpoint = isGroup ? `/messages/groups/${userId}` : `/messages/${userId}`;
            const { data } = await axios.get(endpoint);
            if (data.success) {
                const fetchedMessages = data.messages || [];
                setMessages(fetchedMessages);
                // Cache messages for instant loading next time
                messagesCache.current[cacheKey] = fetchedMessages;
                // Reset unseen count for this user/group when opening chat
                setUnseenMessages(prev => ({
                    ...prev,
                    [userId]: 0
                }));
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
            toast.error(error.response?.data?.message || "Failed to load messages");
        } finally {
            setLoadingMessages(false);
        }
    };

        const sendMessage = async (messageData) => {
            try {
                if (!selectedUser) {
                    toast.error("No user selected");
                    return;
                }
                
                // ✅ OPTIMISTIC UI UPDATE - Show message immediately for better UX
                // Get current user ID from auth context
                const authUser = user || null;
                const currentUserId = authUser?._id || authUser?.uid || '';
                const isGroup = selectedUser.isGroup === true;
                
                // Create temp message with appropriate fields for group or regular chat
                const tempMessage = {
                    _id: `temp-${Date.now()}`,
                    senderId: currentUserId,
                    text: messageData.text || '',
                    image: messageData.image || null,
                    seen: false,
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString(),
                    isSending: true, // Flag to indicate this is a temporary message
                };

                // Add group-specific or regular chat-specific fields
                if (isGroup) {
                    tempMessage.groupId = selectedUser._id;
                    tempMessage.senderName = authUser?.fullName || 'You';
                    tempMessage.senderPic = authUser?.profilePic || ''; // Include sender's profile pic
                } else {
                    tempMessage.receiverId = selectedUser._id;
                }
                
                // Add message immediately to UI
                setMessages(prev => {
                    const updated = [...prev, tempMessage];
                    // ✅ Update cache
                    const cacheKey = isGroup ? `${selectedUser._id}_group` : `${selectedUser._id}_user`;
                    messagesCache.current[cacheKey] = updated;
                    return updated;
                });
                
                try {
                    const endpoint = isGroup 
                        ? `/messages/groups/send/${selectedUser._id}`
                        : `/messages/send/${selectedUser._id}`;
                    
                    // Send to server in the background
                    const { data } = await axios.post(endpoint, messageData);
                    if (data.success) {
                        // Use newMessage (camelCase) or newmessage (fallback) for compatibility
                        const newMsg = data.newMessage || data.newmessage;
                        
                        // Replace temporary message with real one using ID matching
                        setMessages(prev => {
                            let updated;
                            // First try to replace by temp ID
                            const tempIndex = prev.findIndex(msg => msg._id === tempMessage._id);
                            if (tempIndex >= 0) {
                                updated = [...prev];
                                updated[tempIndex] = { ...newMsg, isSending: false };
                            } else if (prev.findIndex(msg => msg._id === newMsg._id) >= 0) {
                                // If temp message not found, check if real message already exists (socket might have added it)
                                const existsIndex = prev.findIndex(msg => msg._id === newMsg._id);
                                updated = [...prev];
                                updated[existsIndex] = { ...updated[existsIndex], isSending: false };
                            } else {
                                // Neither found, add it (shouldn't happen but safety check)
                                updated = [...prev, { ...newMsg, isSending: false }];
                            }
                            
                            // ✅ Update cache
                            const cacheKey = isGroup ? `${selectedUser._id}_group` : `${selectedUser._id}_user`;
                            messagesCache.current[cacheKey] = updated;
                            
                            return updated;
                        });
                        
                        // Don't emit socket events for group messages - server handles that
                        // Only emit for regular chats if needed
                        if (!isGroup && socket) {
                            socket.emit("sendmessage", {
                                receiverId: selectedUser._id,
                                message: newMsg || data.newMessage || data.newmessage
                            });
                        }
                    } else {
                        // Remove failed message
                        setMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
                        toast.error(data.message);
                    }
                } catch (error) {
                    // Remove failed message on error
                    setMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
                    console.error("Error sending message:", error);
                    toast.error(error.response?.data?.message || "Failed to send message");
                }
            } catch (error) {
                console.error("Error sending message:", error);
                toast.error("Failed to send message");
            }
        };

        const deleteMessage = async (messageId) => {
            try {
                if (!selectedUser || !messageId) {
                    toast.error("Invalid request");
                    return;
                }

                const isGroup = selectedUser.isGroup === true;
                const receiverId = selectedUser._id || selectedUser.uid || selectedUser.id;
                
                console.log("🗑️ Deleting message:", messageId, "isGroup:", isGroup);
                
                // Optimistically remove message from UI - check both _id and id
                setMessages(prev => {
                    const filtered = prev.filter(msg => {
                        const msgId = msg._id || msg.id;
                        return msgId !== messageId;
                    });
                    console.log("📝 Messages before:", prev.length, "after:", filtered.length);
                    return filtered;
                });

                try {
                    const response = await axios.delete(`/messages/delete/${messageId}`, {
                        data: {
                            receiverId: isGroup ? null : receiverId,
                            isGroup: isGroup,
                            groupId: isGroup ? receiverId : null
                        }
                    });

                    if (response.data.success) {
                        console.log("✅ Message deleted successfully from server");
                        // The socket event will also handle removing it, but we already removed it optimistically
                        // Double-check it's removed
                        setMessages(prev => {
                            const filtered = prev.filter(msg => {
                                const msgId = msg._id || msg.id;
                                return msgId !== messageId;
                            });
                            return filtered;
                        });
                    } else {
                        // Re-add message if deletion failed
                        console.warn("⚠️ Deletion failed, reloading messages");
                        getMessages(receiverId, isGroup);
                        toast.error(response.data.message || "Failed to delete message");
                    }
                } catch (error) {
                    // Re-add message if deletion failed
                    console.error("❌ Error deleting message:", error);
                    getMessages(receiverId, isGroup);
                    toast.error(error.response?.data?.message || "Failed to delete message");
                }
            } catch (error) {
                console.error("Error deleting message:", error);
                toast.error("Failed to delete message");
            }
        };

        const editMessage = async (messageId, newText) => {
            try {
                if (!selectedUser || !messageId || !newText) {
                    toast.error("Invalid request");
                    return;
                }

                const isGroup = selectedUser.isGroup === true;
                const receiverId = selectedUser._id || selectedUser.uid || selectedUser.id;
                
                try {
                    const response = await axios.put(`/messages/edit/${messageId}`, {
                        text: newText,
                        receiverId: isGroup ? null : receiverId,
                        isGroup: isGroup,
                        groupId: isGroup ? receiverId : null
                    });

                    if (response.data.success) {
                        // Update message in UI
                        setMessages(prev => prev.map(msg => {
                            const msgId = msg._id || msg.id;
                            if (msgId === messageId) {
                                return { ...response.data.updatedMessage, edited: true };
                            }
                            return msg;
                        }));
                        toast.success("Message edited");
                    } else {
                        toast.error(response.data.message || "Failed to edit message");
                    }
                } catch (error) {
                    console.error("Error editing message:", error);
                    toast.error(error.response?.data?.message || "Failed to edit message");
                }
            } catch (error) {
                console.error("Error editing message:", error);
                toast.error("Failed to edit message");
            }
        };

    // ✅ FIXED: Proper socket subscription with cleanup
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            console.log("📩 New message received:", newMessage);
            
            // Handle regular messages
            if (selectedUser && !selectedUser.isGroup && newMessage.senderId === selectedUser._id) {
                // Message from selected user - add to current chat (may replace optimistic message)
                setMessages(prev => {
                    // First check if message already exists by ID (prevents duplicates)
                    const existsById = prev.some(msg => msg._id === newMessage._id);
                    if (existsById) {
                        console.log("⚠️ Message already exists, skipping duplicate");
                        return prev;
                    }
                    
                    // Try to find and replace optimistic message
                    const optimisticIndex = prev.findIndex(msg => 
                        msg.isSending && 
                        msg.senderId === newMessage.senderId && 
                        msg.receiverId === newMessage.receiverId && 
                        msg.text === newMessage.text
                    );
                    
                    let updated;
                    if (optimisticIndex >= 0) {
                        updated = [...prev];
                        updated[optimisticIndex] = { ...newMessage, seen: true };
                    } else {
                        // Message doesn't exist and no optimistic message found - add it
                        updated = [...prev, { ...newMessage, seen: true }];
                    }
                    
                    // ✅ Update cache
                    const cacheKey = `${selectedUser._id}_user`;
                    messagesCache.current[cacheKey] = updated;
                    
                    return updated;
                });
                
                axios.put(`/messages/mark/${newMessage.senderId}`).catch(console.error);
                
                setUnseenMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: 0
                }));
            } else if (!selectedUser || !selectedUser.isGroup) {
                // Message from another user - increment unseen count if not in current chat
                setUnseenMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1
                }));
            }
        };

            const handleNewGroupMessage = (newMessage) => {
                console.log("📩 New group message received:", newMessage);
                
                // Handle group messages
                if (selectedUser && selectedUser.isGroup && newMessage.groupId === selectedUser._id) {
                    setMessages(prev => {
                        // First check if message already exists by ID (prevents duplicates)
                        const existsById = prev.some(msg => msg._id === newMessage._id);
                        if (existsById) {
                            console.log("⚠️ Group message already exists, skipping duplicate");
                            return prev;
                        }
                        
                        // Check if we have an optimistic message that matches
                        // Match by: senderId, groupId, and text content
                        const optimisticIndex = prev.findIndex(msg => {
                            if (!msg.isSending) return false;
                            const sameSender = msg.senderId === newMessage.senderId;
                            const sameGroup = (msg.groupId === newMessage.groupId) || 
                                             (msg.receiverId === newMessage.groupId); // Handle old format
                            const sameText = (msg.text || '') === (newMessage.text || '');
                            const sameImage = (msg.image || null) === (newMessage.image || null);
                            return sameSender && sameGroup && sameText && sameImage;
                        });
                        
                        let updated;
                        if (optimisticIndex >= 0) {
                            // Replace optimistic message with real one
                            updated = [...prev];
                            updated[optimisticIndex] = { ...newMessage, seen: true, isSending: false };
                            console.log("✅ Replaced optimistic group message with real one");
                        } else {
                            // No optimistic message found - add the new message
                            console.log("➕ Adding new group message from socket");
                            updated = [...prev, { ...newMessage, seen: true }];
                        }
                        
                        // ✅ Update cache
                        const cacheKey = `${selectedUser._id}_group`;
                        messagesCache.current[cacheKey] = updated;
                        
                        return updated;
                    });
                    
                    setUnseenMessages(prev => ({
                        ...prev,
                        [newMessage.groupId]: 0
                    }));
                } else {
                    // Group message from another group - increment unseen count
                    setUnseenMessages(prev => ({
                        ...prev,
                        [newMessage.groupId]: (prev[newMessage.groupId] || 0) + 1
                    }));
                }
            };

            const handleMessageDeleted = (data) => {
                console.log("🗑️ Message deleted:", data);
                const { messageId, groupId, chatId } = data;
                
                setMessages(prev => {
                    // Remove the deleted message from the list - check both _id and id
                    return prev.filter(msg => {
                        const msgId = msg._id || msg.id;
                        return msgId !== messageId;
                    });
                });
                
                console.log("✅ Message removed from UI:", messageId);
            };

            const handleMessageEdited = (data) => {
                console.log("✏️ Message edited:", data);
                const { messageId, updatedMessage } = data;
                
                setMessages(prev => prev.map(msg => {
                    const msgId = msg._id || msg.id;
                    if (msgId === messageId) {
                        return { ...updatedMessage, edited: true };
                    }
                    return msg;
                }));
            };

            socket.on("newmessage", handleNewMessage);
            socket.on("newgroupmessage", handleNewGroupMessage);
            socket.on("messagedeleted", handleMessageDeleted);
            socket.on("messageedited", handleMessageEdited);

            // Cleanup
            return () => {
                socket.off("newmessage", handleNewMessage);
                socket.off("newgroupmessage", handleNewGroupMessage);
                socket.off("messagedeleted", handleMessageDeleted);
                socket.off("messageedited", handleMessageEdited);
            };
    }, [socket, selectedUser, axios]);

    // ✅ FIXED: Load users only when user is authenticated and axios is available
    // Use a ref to track if we've already fetched to prevent multiple calls
    const fetchAttemptedRef = useRef(false);
    
    useEffect(() => {
        // Only fetch users if user is authenticated and axios is available
        // And we haven't already attempted to fetch
        if (axios && user && !fetchAttemptedRef.current) {
            // Check if token exists in localStorage
            const token = localStorage.getItem("authToken");
            if (token) {
                console.log("✅ User authenticated, fetching users. Token exists:", !!token);
                fetchAttemptedRef.current = true;
                getUsers();
            } else {
                console.log("⚠️ No auth token found in localStorage, waiting for authentication...");
            }
        } else {
            if (!axios || !user) {
                console.log("⚠️ Waiting for axios or user authentication...", { hasAxios: !!axios, hasUser: !!user });
            }
        }
        // Reset ref if user logs out
        if (!user) {
            fetchAttemptedRef.current = false;
        }
    }, [axios, user, getUsers]); // Include getUsers since it's memoized

        const forwardMessage = async (messagesToForward, recipientId) => {
            try {
                if (!messagesToForward || messagesToForward.length === 0) {
                    toast.error("No messages to forward");
                    return;
                }

                if (!recipientId) {
                    toast.error("No recipient selected");
                    return;
                }

                // Get recipient info to determine if it's a group
                const recipient = users.find(u => {
                    const userId = u._id || u.uid || u.id;
                    return userId === recipientId;
                });

                const isGroup = recipient?.isGroup === true;

                // Forward each message
                for (const message of messagesToForward) {
                    try {
                        const forwardData = {
                            messageId: message._id || message.id,
                            originalSenderId: message.senderId,
                            originalSenderName: message.senderName || 'Unknown',
                            isGroup: isGroup,
                            fromChatId: selectedUser?._id || null,
                            fromIsGroup: selectedUser?.isGroup === true
                        };

                        // Include the message content
                        if (message.text) {
                            forwardData.text = message.text;
                        }
                        if (message.image) {
                            forwardData.image = message.image;
                        }

                        const endpoint = isGroup 
                            ? `/messages/forward/${recipientId}`
                            : `/messages/forward/${recipientId}`;
                        
                        await axios.post(endpoint, forwardData);
                    } catch (error) {
                        console.error("Error forwarding message:", error);
                        // Continue with other messages even if one fails
                    }
                }
            } catch (error) {
                console.error("Error in forwardMessage:", error);
                toast.error(error.response?.data?.message || "Failed to forward messages");
                throw error;
            }
        };

        // ✅ Optimized setSelectedUser - clear messages immediately
        const handleSetSelectedUser = (user) => {
            // Clear messages immediately for instant feedback
            setMessages([]);
            setSelectedUser(user);
        };

        const value = {
            messages,
            setMessages,
            selectedUser,
            setSelectedUser: handleSetSelectedUser,
            users,
            unseenMessages,
            setUnseenMessages,
            getUsers,
            getMessages,
            sendMessage,
            deleteMessage,
            editMessage,
            forwardMessage,
            isLoading,
            loadingMessages
        };

    return (
        <chatContext.Provider value={value}>
            {children}
        </chatContext.Provider>
    );
};