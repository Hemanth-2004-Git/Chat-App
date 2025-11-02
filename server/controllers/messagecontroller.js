// server/controllers/messagecontroller.js

import { db, admin } from "../lib/firebase.js";
import cloudinary from "../lib/cloudinary.js";
import { io, usersocketmap } from "../server.js";

// Helper to create a consistent chat ID
const getChatId = (uid1, uid2) => {
    return [uid1, uid2].sort().join('_');
}

export const getuserforsidebar = async (req, res) => {
    try {
        const myId = req.user.uid;
        
        // 1. Get all users
        const usersSnapshot = await db.ref('users').once('value');
        const allUsers = usersSnapshot.val() || {};
        
        const filteredusers = [];
        const unseenmessages = {};
        const chatQueries = [];

        // 2. Iterate over all users
        for (const uid in allUsers) {
            if (uid === myId) {
                continue;
            }
            
            const user = allUsers[uid];
            user.id = uid; // Add the uid to the user object
            user._id = uid; // Also add _id for frontend compatibility
            user.uid = uid; // Also add uid for consistency
            filteredusers.push(user);
            
            // 3. For each user, create a promise to check for unseen messages
            const chatId = getChatId(myId, uid);
            chatQueries.push(
                db.ref(`chats/${chatId}/messages`)
                  .orderByChild('receiverId')
                  .equalTo(myId)
                  .once('value')
                  .then(snapshot => {
                      let count = 0;
                      snapshot.forEach(child => {
                          if (child.val().seen === false) {
                              count++;
                          }
                      });
                      if (count > 0) {
                          unseenmessages[uid] = count;
                      }
                  })
            );
        }

        // 4. Wait for all unseen message queries to finish
        await Promise.all(chatQueries);

        res.json({ success: true, users: filteredusers, unseenmessages });
    }
    catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const getmessages = async (req, res) => {
    try {
        const { id: selecteduserId } = req.params;
        const myId = req.user.uid;
        const chatId = getChatId(myId, selecteduserId);

        const messagesRef = db.ref(`chats/${chatId}/messages`);
        
        // 1. Get all messages for the chat
        const snapshot = await messagesRef.orderByChild('timestamp').once('value');
        
        const messages = [];
        const updates = {};
        
        // 2. Iterate, build messages array, and find messages to mark as seen
        snapshot.forEach(child => {
            const msg = child.val();
            messages.push({ ...msg, id: child.key });
            
            // If message was sent to me and is unseen, add to update list
            if (msg.receiverId === myId && msg.seen === false) {
                updates[`${child.key}/seen`] = true;
            }
        });

        // 3. Perform a multi-path update to mark all as seen
        if (Object.keys(updates).length > 0) {
            await messagesRef.update(updates);
        }

        res.json({ success: true, messages });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const markmessageasseen = async (req, res) => {
    try {
        const { id: senderId } = req.params;
        const myId = req.user.uid;
        const chatId = getChatId(myId, senderId);

        const messagesRef = db.ref(`chats/${chatId}/messages`);
        
        // 1. Get all messages where I'm the receiver and sender is the other user
        const snapshot = await messagesRef
            .orderByChild('receiverId')
            .equalTo(myId)
            .once('value');
        
        const updates = {};
        
        // 2. Find messages from the sender that are unseen
        snapshot.forEach(child => {
            const msg = child.val();
            if (msg.senderId === senderId && msg.seen === false) {
                updates[`${child.key}/seen`] = true;
            }
        });

        // 3. Perform a multi-path update to mark all as seen
        if (Object.keys(updates).length > 0) {
            await messagesRef.update(updates);
        }

        res.json({ success: true, message: 'Messages marked as seen' });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const sendmessage = async (req, res) => {
        try {
            const { text, image, replyTo } = req.body;
            const receiverId = req.params.id;
            const senderId = req.user.uid;
        
        // Validate that we have either text or image
        if (!text && !image) {
            return res.status(400).json({
                success: false,
                message: "Message must contain either text or image"
            });
        }
        
        const chatId = getChatId(senderId, receiverId);
        
        let imageData = null;
        if (image) {
            // Check if it's already a URL (from previous uploads)
            if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
                imageData = image;
                console.log("✅ Using existing image URL");
            } else {
                // It's a base64 image - try Cloudinary first, fallback to base64
                const cloudinaryConfig = cloudinary.config();
                const hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                
                // Check image size (base64 is ~33% larger than original)
                // For base64: estimate original size by dividing by 1.33
                const base64Size = image.length;
                const estimatedOriginalSize = Math.round(base64Size / 1.33);
                const maxBase64Size = 7 * 1024 * 1024; // ~5MB original = ~6.65MB base64, allow up to 7MB base64
                
                if (hasCloudinary) {
                    try {
                        console.log("📤 Uploading chat image to Cloudinary...");
                        console.log(`📏 Image size: ~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB`);
                        const uploadresponse = await cloudinary.uploader.upload(image, {
                            folder: "chat-app-messages",
                            resource_type: "image",
                        });
                        imageData = uploadresponse.secure_url;
                        console.log("✅ Image uploaded to Cloudinary successfully");
                    } catch (cloudinaryError) {
                        console.warn("⚠️ Cloudinary upload failed, using base64 storage");
                        console.warn("⚠️ Error:", cloudinaryError.message);
                        
                        // Check if image is too large for base64 storage
                        if (base64Size > maxBase64Size) {
                            return res.status(400).json({
                                success: false,
                                message: `Image too large for base64 storage (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Please configure Cloudinary for larger images or compress the image.`
                            });
                        }
                        
                        // Fall through to base64 storage
                        imageData = image; // Store as base64
                        console.log("📤 Storing image as base64");
                    }
                } else {
                    // No Cloudinary, check if image is too large for base64 storage
                    if (base64Size > maxBase64Size) {
                        return res.status(400).json({
                            success: false,
                            message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB. Please compress the image or configure Cloudinary.`
                        });
                    }
                    
                    // No Cloudinary, store as base64 directly
                    console.log("📤 Storing image as base64 (Cloudinary not configured)");
                    console.log(`📏 Image size: ~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB`);
                    imageData = image;
                }
            }
        }

            // Build message object - only include fields that have values (Firebase doesn't allow undefined)
            const newMessage = {
                senderId,
                receiverId,
                timestamp: admin.database.ServerValue.TIMESTAMP,
                seen: false
            };

            // Only add text if it exists and is not empty
            if (text && text.trim()) {
                newMessage.text = text.trim();
            }

            // Only add image if it exists
            if (imageData) {
                newMessage.image = imageData;
            }

            // Add replyTo if it exists
            if (replyTo && replyTo.messageId) {
                newMessage.replyTo = replyTo;
            }

        // 1. Push the new message to the chat
        const newMessageRef = db.ref(`chats/${chatId}/messages`).push();
        await newMessageRef.set(newMessage);
        
        const newmessageForClient = {
            ...newMessage,
            _id: newMessageRef.key, // Add _id for frontend compatibility
            id: newMessageRef.key,
            createdAt: new Date().toISOString(), // Add createdAt for frontend
            timestamp: new Date().toISOString() // Approximate timestamp for client
        };

        // 2. Emit via Socket.IO to receiver
        const receiversocketid = usersocketmap[receiverId];
        if (receiversocketid) {
            io.to(receiversocketid).emit("newmessage", newmessageForClient); // Fixed: singular "newmessage"
        }

        // 3. Also emit to sender so they see their own message in real-time
        const sendersocketid = usersocketmap[senderId];
        if (sendersocketid) {
            io.to(sendersocketid).emit("newmessage", { ...newmessageForClient, seen: true });
        }

        res.json({ success: true, newMessage: newmessageForClient }); // Fixed: camelCase newMessage

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// GROUP CONTROLLERS
export const creategroup = async (req, res) => {
    try {
        const { name, members, groupPic } = req.body;
        const adminId = req.user.uid;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required"
            });
        }

        if (!members || !Array.isArray(members) || members.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Group must have at least 2 members (excluding creator)"
            });
        }

        // Validate that all members are users (not groups)
        const usersSnapshot = await db.ref('users').once('value');
        const groupsSnapshot = await db.ref('groups').once('value');
        const allUsers = usersSnapshot.val() || {};
        const allGroups = groupsSnapshot.val() || {};
        
        const validatedMembers = [];
        for (const memberId of members) {
            // Only allow users, not groups
            if (allUsers[memberId] && !allUsers[memberId].isGroup) {
                validatedMembers.push(memberId);
            }
            // Explicitly reject groups
            else if (allGroups[memberId]) {
                // Skip groups - they cannot be participants
                continue;
            }
        }
        
        if (validatedMembers.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Group must have at least 2 valid user members (excluding creator). Groups cannot be added as participants."
            });
        }

        // Add admin to validated members list
        const allMembers = [adminId, ...validatedMembers];

        // Handle group profile picture upload
        let groupPicUrl = null;
        if (groupPic) {
            if (typeof groupPic === 'string' && (groupPic.startsWith('http://') || groupPic.startsWith('https://'))) {
                groupPicUrl = groupPic;
            } else {
                // It's a base64 image - try Cloudinary first
                const cloudinaryConfig = cloudinary.config();
                const hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                
                const base64Size = groupPic.length;
                const estimatedOriginalSize = Math.round(base64Size / 1.33);
                const maxBase64Size = 7 * 1024 * 1024;

                if (hasCloudinary) {
                    try {
                        const uploadresponse = await cloudinary.uploader.upload(groupPic, {
                            folder: "chat-app-groups",
                            resource_type: "image",
                            transformation: [
                                { width: 400, height: 400, crop: "fill", gravity: "center" }
                            ]
                        });
                        groupPicUrl = uploadresponse.secure_url;
                    } catch (cloudinaryError) {
                        if (base64Size > maxBase64Size) {
                            return res.status(400).json({
                                success: false,
                                message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                            });
                        }
                        groupPicUrl = groupPic; // Fallback to base64
                    }
                } else {
                    if (base64Size > maxBase64Size) {
                        return res.status(400).json({
                            success: false,
                            message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                        });
                    }
                    groupPicUrl = groupPic; // Fallback to base64
                }
            }
        }

        // Create group data
        const groupData = {
            name: name.trim(),
            adminId: adminId,
            members: allMembers,
            createdAt: admin.database.ServerValue.TIMESTAMP,
            isGroup: true
        };

        if (groupPicUrl) {
            groupData.groupPic = groupPicUrl;
        }

        // Create group in Firebase
        const groupRef = db.ref('groups').push();
        await groupRef.set(groupData);

        const groupId = groupRef.key;
        
        // Create initial message to notify members
        const systemMessage = {
            senderId: 'system',
            senderName: 'System',
            text: `${req.user.fullName || 'Admin'} created this group`,
            timestamp: admin.database.ServerValue.TIMESTAMP,
            type: 'system'
        };
        await db.ref(`groups/${groupId}/messages`).push().set(systemMessage);

        res.json({
            success: true,
            group: {
                _id: groupId,
                id: groupId,
                ...groupData
            }
        });
    } catch (error) {
        console.error("Create group error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const getgroups = async (req, res) => {
    try {
        const myId = req.user.uid;

        // Get all groups where user is a member
        const groupsSnapshot = await db.ref('groups').once('value');
        const allGroups = groupsSnapshot.val() || {};
        
        const myGroups = [];
        const unseenmessages = {};

        for (const groupId in allGroups) {
            const group = allGroups[groupId];
            
            // Check if user is a member
            if (group.members && group.members.includes(myId)) {
                const groupData = {
                    ...group,
                    _id: groupId,
                    id: groupId,
                    uid: groupId,
                    isGroup: true,
                    fullName: group.name,
                    profilePic: group.groupPic || null
                };
                myGroups.push(groupData);

                // Check for unseen messages
                const messagesRef = db.ref(`groups/${groupId}/messages`);
                const messagesSnapshot = await messagesRef
                    .orderByChild('timestamp')
                    .once('value');
                
                let count = 0;
                messagesSnapshot.forEach(child => {
                    const msg = child.val();
                    if (msg.senderId !== myId && msg.senderId !== 'system') {
                        const seenBy = msg.seenBy || {};
                        if (!seenBy[myId]) {
                            count++;
                        }
                    }
                });
                
                if (count > 0) {
                    unseenmessages[groupId] = count;
                }
            }
        }

        res.json({ success: true, groups: myGroups, unseenmessages });
    } catch (error) {
        console.error("Get groups error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const getgroupmessages = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const myId = req.user.uid;

        // Verify user is a member of the group
        const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
        if (!groupSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        const group = groupSnapshot.val();
        if (!group.members || !group.members.includes(myId)) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group"
            });
        }

        // Get all messages for the group
        const messagesRef = db.ref(`groups/${groupId}/messages`);
        const snapshot = await messagesRef.orderByChild('timestamp').once('value');
        
        const messages = [];
        const updates = {};

        snapshot.forEach(child => {
            const msg = child.val();
            const messageData = {
                ...msg,
                id: child.key,
                _id: child.key,
                groupId: groupId
            };
            
            // If message doesn't have senderPic, try to fetch it from users
            if (!messageData.senderPic && msg.senderId && msg.senderId !== 'system') {
                // We'll fetch sender profile pic asynchronously if needed
                // For now, it will be included in new messages, existing messages might not have it
                // This is okay - frontend will use fallback
            }
            
            messages.push(messageData);

            // Mark message as seen by current user
            if (msg.senderId !== myId && msg.senderId !== 'system') {
                const seenBy = msg.seenBy || {};
                if (!seenBy[myId]) {
                    updates[`${child.key}/seenBy/${myId}`] = true;
                }
            }
        });

        // Update seen status
        if (Object.keys(updates).length > 0) {
            await messagesRef.update(updates);
        }

        res.json({ success: true, messages });
    } catch (error) {
        console.error("Get group messages error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

    export const sendgroupmessage = async (req, res) => {
        try {
            const { text, image, replyTo } = req.body;
            const { id: groupId } = req.params;
            const senderId = req.user.uid;

        if (!text && !image) {
            return res.status(400).json({
                success: false,
                message: "Message must contain either text or image"
            });
        }

        // Verify user is a member of the group
        const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
        if (!groupSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        const group = groupSnapshot.val();
        if (!group.members || !group.members.includes(senderId)) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group"
            });
        }

        // Handle image upload
        let imageData = null;
        if (image) {
            if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
                imageData = image;
            } else {
                const cloudinaryConfig = cloudinary.config();
                const hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                
                const base64Size = image.length;
                const estimatedOriginalSize = Math.round(base64Size / 1.33);
                const maxBase64Size = 7 * 1024 * 1024;

                if (hasCloudinary) {
                    try {
                        const uploadresponse = await cloudinary.uploader.upload(image, {
                            folder: "chat-app-messages",
                            resource_type: "image",
                        });
                        imageData = uploadresponse.secure_url;
                    } catch (cloudinaryError) {
                        if (base64Size > maxBase64Size) {
                            return res.status(400).json({
                                success: false,
                                message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                            });
                        }
                        imageData = image;
                    }
                } else {
                    if (base64Size > maxBase64Size) {
                        return res.status(400).json({
                            success: false,
                            message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                        });
                    }
                    imageData = image;
                }
            }
        }

        // Get sender's profile picture
        const senderProfilePic = req.user.profilePic || req.user.photoURL || '';

            // Build message object
            const newMessage = {
                senderId,
                senderName: req.user.fullName || 'Unknown',
                senderPic: senderProfilePic, // Add sender's profile picture
                timestamp: admin.database.ServerValue.TIMESTAMP,
                seenBy: { [senderId]: true },
                groupId: groupId
            };

            if (text && text.trim()) {
                newMessage.text = text.trim();
            }

            if (imageData) {
                newMessage.image = imageData;
            }

            // Add replyTo if it exists
            if (replyTo && replyTo.messageId) {
                newMessage.replyTo = replyTo;
            }

        // Save message to group
        const messagesRef = db.ref(`groups/${groupId}/messages`);
        const newMessageRef = messagesRef.push();
        await newMessageRef.set(newMessage);

        const newmessageForClient = {
            ...newMessage,
            _id: newMessageRef.key,
            id: newMessageRef.key,
            createdAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        // Emit to all group members via Socket.IO
        group.members.forEach(memberId => {
            if (memberId !== senderId) {
                const membersocketid = usersocketmap[memberId];
                if (membersocketid) {
                    io.to(membersocketid).emit("newgroupmessage", {
                        ...newmessageForClient,
                        groupId: groupId
                    });
                }
            }
        });

        // Also emit to sender
        const sendersocketid = usersocketmap[senderId];
        if (sendersocketid) {
            io.to(sendersocketid).emit("newgroupmessage", {
                ...newmessageForClient,
                seen: true
            });
        }

        res.json({ success: true, newMessage: newmessageForClient });
    } catch (error) {
        console.error("Send group message error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// UPDATE GROUP INFO
export const updategroup = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const { name, groupPic } = req.body;
        const myId = req.user.uid;

        // Verify user is admin of the group
        const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
        if (!groupSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        const group = groupSnapshot.val();
        if (group.adminId !== myId) {
            return res.status(403).json({
                success: false,
                message: "Only group admin can update group info"
            });
        }

        const updates = {};

        if (name && name.trim()) {
            updates.name = name.trim();
        }

        // Handle group profile picture upload
        if (groupPic) {
            if (typeof groupPic === 'string' && (groupPic.startsWith('http://') || groupPic.startsWith('https://'))) {
                updates.groupPic = groupPic;
            } else {
                // It's a base64 image - try Cloudinary first
                const cloudinaryConfig = cloudinary.config();
                const hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                
                const base64Size = groupPic.length;
                const estimatedOriginalSize = Math.round(base64Size / 1.33);
                const maxBase64Size = 7 * 1024 * 1024;

                if (hasCloudinary) {
                    try {
                        const uploadresponse = await cloudinary.uploader.upload(groupPic, {
                            folder: "chat-app-groups",
                            resource_type: "image",
                            transformation: [
                                { width: 400, height: 400, crop: "fill", gravity: "center" }
                            ]
                        });
                        updates.groupPic = uploadresponse.secure_url;
                    } catch (cloudinaryError) {
                        if (base64Size > maxBase64Size) {
                            return res.status(400).json({
                                success: false,
                                message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                            });
                        }
                        updates.groupPic = groupPic; // Fallback to base64
                    }
                } else {
                    if (base64Size > maxBase64Size) {
                        return res.status(400).json({
                            success: false,
                            message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                        });
                    }
                    updates.groupPic = groupPic; // Fallback to base64
                }
            }
        }

        // Update group in Firebase
        await db.ref(`groups/${groupId}`).update(updates);

        // Fetch updated group
        const updatedGroupSnapshot = await db.ref(`groups/${groupId}`).once('value');
        const updatedGroup = {
            ...updatedGroupSnapshot.val(),
            _id: groupId,
            id: groupId,
            uid: groupId,
            fullName: updatedGroupSnapshot.val().name,
            profilePic: updatedGroupSnapshot.val().groupPic || null
        };

        res.json({ success: true, group: updatedGroup });
    } catch (error) {
        console.error("Update group error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// ADD PARTICIPANTS TO GROUP
export const addparticipants = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const { memberIds } = req.body;
        const myId = req.user.uid;

        // Verify user is admin of the group
        const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
        if (!groupSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        const group = groupSnapshot.val();
        if (group.adminId !== myId) {
            return res.status(403).json({
                success: false,
                message: "Only group admin can add participants"
            });
        }

        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide member IDs to add"
            });
        }

        // Get current members
        const currentMembers = group.members || [];
        
        // Validate that memberIds are valid user IDs (not groups)
        const usersSnapshot = await db.ref('users').once('value');
        const groupsSnapshot = await db.ref('groups').once('value');
        const allUsers = usersSnapshot.val() || {};
        const allGroups = groupsSnapshot.val() || {};
        
        const validatedMemberIds = [];
        
        for (const memberId of memberIds) {
            // Only allow users, not groups
            if (allUsers[memberId]) {
                // Double check it's not actually a group
                const user = allUsers[memberId];
                // Users don't have isGroup property, groups do
                if (!user.isGroup) {
                    validatedMemberIds.push(memberId);
                }
            }
            // Explicitly reject groups
            else if (allGroups[memberId]) {
                // Skip groups - they cannot be added as participants
                continue;
            }
        }
        
        if (validatedMemberIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid users found to add. Groups cannot be added as participants."
            });
        }
        
        // Add new members (avoid duplicates)
        const newMembers = [...new Set([...currentMembers, ...validatedMemberIds])];

        // Update group members
        await db.ref(`groups/${groupId}/members`).set(newMembers);

        // Create system message for new participants
        const addedCount = validatedMemberIds.length;
        const systemMessage = {
            senderId: 'system',
            senderName: 'System',
            text: `${req.user.fullName || 'Admin'} added ${addedCount} participant(s)`,
            timestamp: admin.database.ServerValue.TIMESTAMP,
            type: 'system'
        };
        await db.ref(`groups/${groupId}/messages`).push().set(systemMessage);

        res.json({ success: true, message: "Participants added successfully" });
    } catch (error) {
        console.error("Add participants error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// REMOVE PARTICIPANT FROM GROUP
    export const removeparticipant = async (req, res) => {
        try {
            const { id: groupId, userId } = req.params;
            const myId = req.user.uid;

            // Verify user is admin of the group
            const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
            if (!groupSnapshot.exists()) {
                return res.status(404).json({
                    success: false,
                    message: "Group not found"
                });
            }

            const group = groupSnapshot.val();
            if (group.adminId !== myId) {
                return res.status(403).json({
                    success: false,
                    message: "Only group admin can remove participants"
                });
            }

            // Cannot remove admin
            if (userId === group.adminId) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot remove group admin"
                });
            }

            // Get current members
            const currentMembers = group.members || [];
            
            // Remove the participant
            const updatedMembers = currentMembers.filter(memberId => memberId !== userId);

            if (updatedMembers.length === currentMembers.length) {
                return res.status(404).json({
                    success: false,
                    message: "Participant not found in group"
                });
            }

            // Update group members
            await db.ref(`groups/${groupId}/members`).set(updatedMembers);

            // Get user data for system message
            const userSnapshot = await db.ref(`users/${userId}`).once('value');
            const userName = userSnapshot.exists() ? userSnapshot.val().fullName : 'User';

            // Create system message
            const systemMessage = {
                senderId: 'system',
                senderName: 'System',
                text: `${req.user.fullName || 'Admin'} removed ${userName}`,
                timestamp: admin.database.ServerValue.TIMESTAMP,
                type: 'system'
            };
            await db.ref(`groups/${groupId}/messages`).push().set(systemMessage);

            res.json({ success: true, message: "Participant removed successfully" });
        } catch (error) {
            console.error("Remove participant error:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // DELETE MESSAGE (UNSEND) FOR REGULAR CHAT
    export const deletemessage = async (req, res) => {
        try {
            const { messageId } = req.params;
            const { receiverId, isGroup } = req.body;
            const senderId = req.user.uid;

            if (!receiverId && !isGroup) {
                return res.status(400).json({
                    success: false,
                    message: "Receiver ID or group flag is required"
                });
            }

            if (isGroup) {
                // Handle group message deletion
                const { groupId } = req.body;
                if (!groupId) {
                    return res.status(400).json({
                        success: false,
                        message: "Group ID is required"
                    });
                }

                // Verify user is a member of the group
                const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
                if (!groupSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Group not found"
                    });
                }

                const group = groupSnapshot.val();
                if (!group.members || !group.members.includes(senderId)) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not a member of this group"
                    });
                }

                // Get the message to verify ownership
                const messageSnapshot = await db.ref(`groups/${groupId}/messages/${messageId}`).once('value');
                if (!messageSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Message not found"
                    });
                }

                const message = messageSnapshot.val();

                // Only allow deleting own messages (unless admin)
                if (message.senderId !== senderId && group.adminId !== senderId) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only delete your own messages"
                    });
                }

                // Delete the message
                await db.ref(`groups/${groupId}/messages/${messageId}`).remove();

                // Emit deletion event to all group members
                group.members.forEach(memberId => {
                    const membersocketid = usersocketmap[memberId];
                    if (membersocketid) {
                        io.to(membersocketid).emit("messagedeleted", {
                            messageId,
                            groupId,
                            deletedBy: senderId
                        });
                    }
                });

                res.json({ success: true, message: "Message deleted successfully" });
            } else {
                // Handle regular chat message deletion
                const chatId = getChatId(senderId, receiverId);

                // Get the message to verify ownership
                const messageSnapshot = await db.ref(`chats/${chatId}/messages/${messageId}`).once('value');
                if (!messageSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Message not found"
                    });
                }

                const message = messageSnapshot.val();

                // Only allow deleting own messages
                if (message.senderId !== senderId) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only delete your own messages"
                    });
                }

                // Delete the message
                await db.ref(`chats/${chatId}/messages/${messageId}`).remove();

                // Emit deletion event to receiver
                const receiversocketid = usersocketmap[receiverId];
                if (receiversocketid) {
                    io.to(receiversocketid).emit("messagedeleted", {
                        messageId,
                        chatId,
                        deletedBy: senderId
                    });
                }

                // Also emit to sender
                const sendersocketid = usersocketmap[senderId];
                if (sendersocketid) {
                    io.to(sendersocketid).emit("messagedeleted", {
                        messageId,
                        chatId,
                        deletedBy: senderId
                    });
                }

                res.json({ success: true, message: "Message deleted successfully" });
            }
        } catch (error) {
            console.error("Delete message error:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // EDIT MESSAGE FOR REGULAR AND GROUP CHAT
    export const editmessage = async (req, res) => {
        try {
            const { messageId } = req.params;
            const { text, isGroup, receiverId, groupId } = req.body;
            const senderId = req.user.uid;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Message text is required"
                });
            }

            if (isGroup) {
                if (!groupId) {
                    return res.status(400).json({
                        success: false,
                        message: "Group ID is required"
                    });
                }

                // Verify user is a member of the group
                const groupSnapshot = await db.ref(`groups/${groupId}`).once('value');
                if (!groupSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Group not found"
                    });
                }

                const group = groupSnapshot.val();
                if (!group.members || !group.members.includes(senderId)) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not a member of this group"
                    });
                }

                // Get the message to verify ownership
                const messageSnapshot = await db.ref(`groups/${groupId}/messages/${messageId}`).once('value');
                if (!messageSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Message not found"
                    });
                }

                const message = messageSnapshot.val();

                // Only allow editing own messages
                if (message.senderId !== senderId) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only edit your own messages"
                    });
                }

                // Update the message
                await db.ref(`groups/${groupId}/messages/${messageId}`).update({
                    text: text.trim(),
                    edited: true,
                    editedAt: admin.database.ServerValue.TIMESTAMP
                });

                // Get updated message
                const updatedMessageSnapshot = await db.ref(`groups/${groupId}/messages/${messageId}`).once('value');
                const updatedMessage = {
                    ...updatedMessageSnapshot.val(),
                    _id: messageId,
                    id: messageId
                };

                // Emit update event to all group members
                group.members.forEach(memberId => {
                    const membersocketid = usersocketmap[memberId];
                    if (membersocketid) {
                        io.to(membersocketid).emit("messageedited", {
                            messageId,
                            groupId,
                            updatedMessage,
                            editedBy: senderId
                        });
                    }
                });

                res.json({ success: true, message: "Message edited successfully", updatedMessage });
            } else {
                if (!receiverId) {
                    return res.status(400).json({
                        success: false,
                        message: "Receiver ID is required"
                    });
                }

                const chatId = getChatId(senderId, receiverId);

                // Get the message to verify ownership
                const messageSnapshot = await db.ref(`chats/${chatId}/messages/${messageId}`).once('value');
                if (!messageSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Message not found"
                    });
                }

                const message = messageSnapshot.val();

                // Only allow editing own messages
                if (message.senderId !== senderId) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only edit your own messages"
                    });
                }

                // Update the message
                await db.ref(`chats/${chatId}/messages/${messageId}`).update({
                    text: text.trim(),
                    edited: true,
                    editedAt: admin.database.ServerValue.TIMESTAMP
                });

                // Get updated message
                const updatedMessageSnapshot = await db.ref(`chats/${chatId}/messages/${messageId}`).once('value');
                const updatedMessage = {
                    ...updatedMessageSnapshot.val(),
                    _id: messageId,
                    id: messageId
                };

                // Emit update event to receiver
                const receiversocketid = usersocketmap[receiverId];
                if (receiversocketid) {
                    io.to(receiversocketid).emit("messageedited", {
                        messageId,
                        chatId,
                        updatedMessage,
                        editedBy: senderId
                    });
                }

                // Also emit to sender
                const sendersocketid = usersocketmap[senderId];
                if (sendersocketid) {
                    io.to(sendersocketid).emit("messageedited", {
                        messageId,
                        chatId,
                        updatedMessage,
                        editedBy: senderId
                    });
                }

                res.json({ success: true, message: "Message edited successfully", updatedMessage });
            }
        } catch (error) {
            console.error("Edit message error:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // FORWARD MESSAGE TO ANOTHER USER OR GROUP
    export const forwardmessage = async (req, res) => {
        try {
            const { id: recipientId } = req.params;
            const { 
                messageId, 
                text, 
                image, 
                originalSenderId, 
                originalSenderName,
                isGroup: recipientIsGroup,
                fromChatId,
                fromIsGroup 
            } = req.body;
            const senderId = req.user.uid;

            // Validate required fields
            if (!text && !image) {
                return res.status(400).json({
                    success: false,
                    message: "Message must contain either text or image"
                });
            }

            // Determine if recipient is a group
            let isGroupRecipient = false;
            if (recipientIsGroup !== undefined) {
                isGroupRecipient = recipientIsGroup;
            } else {
                // Check if recipient is a group
                const recipientSnapshot = await db.ref(`groups/${recipientId}`).once('value');
                isGroupRecipient = recipientSnapshot.exists();
            }

            if (isGroupRecipient) {
                // Forward to group
                const groupSnapshot = await db.ref(`groups/${recipientId}`).once('value');
                if (!groupSnapshot.exists()) {
                    return res.status(404).json({
                        success: false,
                        message: "Group not found"
                    });
                }

                const group = groupSnapshot.val();
                if (!group.members || !group.members.includes(senderId)) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not a member of this group"
                    });
                }

                // Handle image if present
                let imageData = null;
                if (image) {
                    // If image is already a URL, use it directly
                    if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
                        imageData = image;
                    } else {
                        // It's a base64 image - try Cloudinary first
                        const cloudinaryConfig = cloudinary.config();
                        const hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                        
                        const base64Size = image.length;
                        const estimatedOriginalSize = Math.round(base64Size / 1.33);
                        const maxBase64Size = 7 * 1024 * 1024;

                        if (hasCloudinary) {
                            try {
                                const uploadresponse = await cloudinary.uploader.upload(image, {
                                    folder: "chat-app-messages",
                                    resource_type: "image",
                                });
                                imageData = uploadresponse.secure_url;
                            } catch (cloudinaryError) {
                                if (base64Size > maxBase64Size) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                                    });
                                }
                                imageData = image; // Fallback to base64
                            }
                        } else {
                            if (base64Size > maxBase64Size) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                                });
                            }
                            imageData = image; // Fallback to base64
                        }
                    }
                }

                // Get sender's profile picture
                const senderProfilePic = req.user.profilePic || req.user.photoURL || '';

                // Build forwarded message object
                const newMessage = {
                    senderId,
                    senderName: req.user.fullName || 'Unknown',
                    senderPic: senderProfilePic,
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                    seenBy: { [senderId]: true },
                    groupId: recipientId,
                    forwarded: true,
                    forwardedFrom: {
                        senderId: originalSenderId || senderId,
                        senderName: originalSenderName || 'Unknown'
                    }
                };

                if (text && text.trim()) {
                    newMessage.text = text.trim();
                }

                if (imageData) {
                    newMessage.image = imageData;
                }

                // Save message to group
                const messagesRef = db.ref(`groups/${recipientId}/messages`);
                const newMessageRef = messagesRef.push();
                await newMessageRef.set(newMessage);

                const newmessageForClient = {
                    ...newMessage,
                    _id: newMessageRef.key,
                    id: newMessageRef.key,
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString()
                };

                // Emit to all group members via Socket.IO
                group.members.forEach(memberId => {
                    if (memberId !== senderId) {
                        const membersocketid = usersocketmap[memberId];
                        if (membersocketid) {
                            io.to(membersocketid).emit("newgroupmessage", {
                                ...newmessageForClient,
                                groupId: recipientId
                            });
                        }
                    }
                });

                // Also emit to sender
                const sendersocketid = usersocketmap[senderId];
                if (sendersocketid) {
                    io.to(sendersocketid).emit("newgroupmessage", {
                        ...newmessageForClient,
                        seen: true
                    });
                }

                res.json({ success: true, newMessage: newmessageForClient });
            } else {
                // Forward to regular user
                const chatId = getChatId(senderId, recipientId);

                // Handle image if present
                let imageData = null;
                if (image) {
                    // If image is already a URL, use it directly
                    if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
                        imageData = image;
                    } else {
                        // It's a base64 image - try Cloudinary first
                        const cloudinaryConfig = cloudinary.config();
                        const hasCloudinary = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key;
                        
                        const base64Size = image.length;
                        const estimatedOriginalSize = Math.round(base64Size / 1.33);
                        const maxBase64Size = 7 * 1024 * 1024;

                        if (hasCloudinary) {
                            try {
                                const uploadresponse = await cloudinary.uploader.upload(image, {
                                    folder: "chat-app-messages",
                                    resource_type: "image",
                                });
                                imageData = uploadresponse.secure_url;
                            } catch (cloudinaryError) {
                                if (base64Size > maxBase64Size) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                                    });
                                }
                                imageData = image; // Fallback to base64
                            }
                        } else {
                            if (base64Size > maxBase64Size) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Image too large (~${(estimatedOriginalSize / (1024 * 1024)).toFixed(2)}MB). Maximum size: 5MB.`
                                });
                            }
                            imageData = image; // Fallback to base64
                        }
                    }
                }

                // Build forwarded message object
                const newMessage = {
                    senderId,
                    receiverId: recipientId,
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                    seen: false,
                    forwarded: true,
                    forwardedFrom: {
                        senderId: originalSenderId || senderId,
                        senderName: originalSenderName || 'Unknown'
                    }
                };

                if (text && text.trim()) {
                    newMessage.text = text.trim();
                }

                if (imageData) {
                    newMessage.image = imageData;
                }

                // Push the new message to the chat
                const newMessageRef = db.ref(`chats/${chatId}/messages`).push();
                await newMessageRef.set(newMessage);

                const newmessageForClient = {
                    ...newMessage,
                    _id: newMessageRef.key,
                    id: newMessageRef.key,
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString()
                };

                // Emit via Socket.IO to receiver
                const receiversocketid = usersocketmap[recipientId];
                if (receiversocketid) {
                    io.to(receiversocketid).emit("newmessage", newmessageForClient);
                }

                // Also emit to sender so they see their own message in real-time
                const sendersocketid = usersocketmap[senderId];
                if (sendersocketid) {
                    io.to(sendersocketid).emit("newmessage", { ...newmessageForClient, seen: true });
                }

                res.json({ success: true, newMessage: newmessageForClient });
            }
        } catch (error) {
            console.error("Forward message error:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }