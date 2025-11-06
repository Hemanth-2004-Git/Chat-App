import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authcontext } from "./authcontext.jsx";
import toast from "react-hot-toast";

export const chatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [recentChats, setRecentChats] = useState([]);
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

    // ✅ Get recent chats - users and groups the user has chatted with
    const getRecentChats = useCallback(async () => {
        if (!axios || !user) {
            console.log("⚠️ Axios or user not available, skipping getRecentChats");
            return;
        }
        
        let token = localStorage.getItem("authToken");
        if (!token && auth?.currentUser) {
            try {
                token = await auth.currentUser.getIdToken();
                localStorage.setItem("authToken", token);
            } catch (tokenError) {
                console.error("❌ Failed to get token:", tokenError);
                return;
            }
        }
        
        if (!token) {
            console.log("⚠️ No auth token, cannot fetch recent chats");
            return;
        }
        
        try {
            const { data } = await axios.get("/messages/recent", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            if (data.success) {
                setRecentChats(data.recentChats || []);
                // Merge unseen messages
                setUnseenMessages(prev => ({
                    ...prev,
                    ...(data.unseenmessages || {})
                }));
                console.log("✅ Recent chats received:", data.recentChats?.length || 0, "chats");
            }
        } catch (error) {
            console.error("❌ Error fetching recent chats:", error);
            // Don't show error toast for this, it's not critical
        }
    }, [axios, user, auth]);

    const getMessages = async (userId, isGroup = false) => {
        if (!userId) return;
        
        const cacheKey = `${userId}_${isGroup ? 'group' : 'user'}`;
        
        // ✅ INSTANT FEEDBACK: Clear messages immediately and show cached if available
        setMessages([]);
        setLoadingMessages(true);
        
        // Check cache first for instant display
        if (messagesCache.current[cacheKey] && messagesCache.current[cacheKey].length > 0) {
            setMessages(messagesCache.current[cacheKey]);
            setLoadingMessages(false);
            console.log("✅ Showing cached messages:", messagesCache.current[cacheKey].length);
        }
        
        try {
            const endpoint = isGroup ? `/messages/groups/${userId}` : `/messages/${userId}`;
            const { data } = await axios.get(endpoint);
            if (data.success) {
                const fetchedMessages = data.messages || [];
                
                // ✅ Merge cached messages with fetched messages to ensure we have all real-time messages
                const cachedMessages = messagesCache.current[cacheKey] || [];
                
                // Create a map of fetched messages by ID for quick lookup
                const fetchedMap = new Map();
                fetchedMessages.forEach(msg => {
                    const msgId = msg._id || msg.id;
                    if (msgId) fetchedMap.set(msgId, msg);
                });
                
                // Merge: use fetched messages as base, but keep any cached messages that aren't in fetched
                // This ensures real-time messages received while not viewing the chat are included
                const mergedMessages = [...fetchedMessages];
                cachedMessages.forEach(cachedMsg => {
                    const cachedId = cachedMsg._id || cachedMsg.id;
                    if (cachedId && !fetchedMap.has(cachedId)) {
                        // This is a real-time message that hasn't been fetched yet - add it
                        mergedMessages.push(cachedMsg);
                    }
                });
                
                // Sort by timestamp/createdAt
                mergedMessages.sort((a, b) => {
                    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
                    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
                    return timeA - timeB;
                });
                
                setMessages(mergedMessages);
                // Update cache with merged messages
                messagesCache.current[cacheKey] = mergedMessages;
                
                // Reset unseen count for this user/group when opening chat
                setUnseenMessages(prev => ({
                    ...prev,
                    [userId]: 0
                }));
                
                console.log("✅ Messages loaded and merged. Fetched:", fetchedMessages.length, "Cached:", cachedMessages.length, "Merged:", mergedMessages.length);
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
                        
                        // ✅ Refresh recent chats to update order after sending message
                        getRecentChats();
                        
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
            
            // Determine sender and receiver IDs
            const senderId = newMessage.senderId;
            const receiverId = newMessage.receiverId;
            const currentUserId = user?._id || user?.uid;
            
            // Determine which chat this message belongs to
            const chatUserId = senderId === currentUserId ? receiverId : senderId;
            const cacheKey = `${chatUserId}_user`;
            
            // ✅ ALWAYS cache the message, even if not viewing that chat
            if (messagesCache.current[cacheKey]) {
                const cachedMessages = messagesCache.current[cacheKey];
                // Check if message already exists
                const existsById = cachedMessages.some(msg => msg._id === newMessage._id);
                if (!existsById) {
                    // Add to cache
                    messagesCache.current[cacheKey] = [...cachedMessages, { ...newMessage, seen: senderId === currentUserId }];
                    console.log("✅ Message cached for chat:", chatUserId);
                }
            } else {
                // Initialize cache with this message
                messagesCache.current[cacheKey] = [{ ...newMessage, seen: senderId === currentUserId }];
                console.log("✅ Cache initialized with message for chat:", chatUserId);
            }
            
            // Handle regular messages
            if (selectedUser && !selectedUser.isGroup && chatUserId === selectedUser._id) {
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
                    
                    // ✅ Update cache with the updated messages
                    messagesCache.current[cacheKey] = updated;
                    
                    return updated;
                });
                
                // Mark as seen if we're viewing this chat
            if (senderId !== currentUserId) {
                axios.put(`/messages/mark/${newMessage.senderId}`).catch(console.error);
                
                // Emit delivery confirmation
                if (socket && newMessage._id) {
                    socket.emit("messagedelivered", {
                        messageId: newMessage._id,
                        senderId: newMessage.senderId
                    });
                }
            }
                
                setUnseenMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: 0
                }));
                
                // ✅ Refresh recent chats to update order
                getRecentChats();
            } else {
                // Message from another user/chat - increment unseen count if not in current chat
                if (senderId !== currentUserId) {
                    setUnseenMessages(prev => ({
                        ...prev,
                        [chatUserId]: (prev[chatUserId] || 0) + 1
                    }));
                }
                // ✅ Refresh recent chats to update order when message received
                getRecentChats();
            }
        };

            const handleNewGroupMessage = (newMessage) => {
                console.log("📩 New group message received:", newMessage);
                
                const groupId = newMessage.groupId;
                const currentUserId = user?._id || user?.uid;
                const cacheKey = `${groupId}_group`;
                
                // ✅ ALWAYS cache the message, even if not viewing that group
                if (messagesCache.current[cacheKey]) {
                    const cachedMessages = messagesCache.current[cacheKey];
                    // Check if message already exists
                    const existsById = cachedMessages.some(msg => msg._id === newMessage._id);
                    if (!existsById) {
                        // Add to cache
                        messagesCache.current[cacheKey] = [...cachedMessages, { ...newMessage, seen: newMessage.senderId === currentUserId }];
                        console.log("✅ Group message cached for group:", groupId);
                    }
                } else {
                    // Initialize cache with this message
                    messagesCache.current[cacheKey] = [{ ...newMessage, seen: newMessage.senderId === currentUserId }];
                    console.log("✅ Cache initialized with group message for group:", groupId);
                }
                
                // Handle group messages
                if (selectedUser && selectedUser.isGroup && groupId === selectedUser._id) {
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
                        
                        // ✅ Update cache with the updated messages
                        messagesCache.current[cacheKey] = updated;
                        
                        return updated;
                    });
                    
                    setUnseenMessages(prev => ({
                        ...prev,
                        [newMessage.groupId]: 0
                    }));
                    
                    // ✅ Refresh recent chats to update order
                    getRecentChats();
                } else {
                    // Group message from another group - increment unseen count
                    if (newMessage.senderId !== currentUserId) {
                        setUnseenMessages(prev => ({
                            ...prev,
                            [newMessage.groupId]: (prev[newMessage.groupId] || 0) + 1
                        }));
                    }
                    // ✅ Refresh recent chats to update order when message received from another group
                    getRecentChats();
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
            
            // Handle delivery confirmation
            const handleMessageDelivered = (data) => {
                const { messageId, delivered } = data;
                if (delivered) {
                    setMessages(prev => prev.map(msg => {
                        const msgId = msg._id || msg.id;
                        if (msgId === messageId) {
                            return { ...msg, delivered: true };
                        }
                        return msg;
                    }));
                }
            };
            
            // Handle read confirmation
            const handleMessageRead = (data) => {
                const { messageId, read } = data;
                if (read) {
                    setMessages(prev => prev.map(msg => {
                        const msgId = msg._id || msg.id;
                        if (msgId === messageId) {
                            return { ...msg, seen: true, delivered: true };
                        }
                        return msg;
                    }));
                }
            };
            
            socket.on("messagedelivered", handleMessageDelivered);
            socket.on("messageread", handleMessageRead);
            socket.on("newgroupmessage", handleNewGroupMessage);
            socket.on("messagedeleted", handleMessageDeleted);
            socket.on("messageedited", handleMessageEdited);

            // Cleanup
            return () => {
                socket.off("newmessage", handleNewMessage);
                socket.off("newgroupmessage", handleNewGroupMessage);
                socket.off("messagedeleted", handleMessageDeleted);
                socket.off("messageedited", handleMessageEdited);
                socket.off("messagedelivered", handleMessageDelivered);
                socket.off("messageread", handleMessageRead);
            };
    }, [socket, selectedUser, axios, getRecentChats]);

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
                console.log("✅ User authenticated, fetching users and recent chats. Token exists:", !!token);
                fetchAttemptedRef.current = true;
                getUsers();
                getRecentChats(); // Also fetch recent chats
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
            setRecentChats([]);
        }
    }, [axios, user, getUsers, getRecentChats]); // Include getUsers and getRecentChats since they're memoized

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
            recentChats,
            unseenMessages,
            setUnseenMessages,
            getUsers,
            getRecentChats,
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