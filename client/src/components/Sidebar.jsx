import React, { useContext, useEffect, useState } from 'react';
import assets from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import { authcontext } from '../../context/authcontext';
import { chatContext } from '../../context/chatcontext';
import CreateGroupModal from './CreateGroupModal';

const Sidebar = () => {
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const { 
        getUsers, 
        users, 
        selectedUser, 
        setSelectedUser, 
        unseenMessages 
    } = useContext(chatContext);

    const { logout, onlineUsers = [], authuser } = useContext(authcontext);

    const [input, setInput] = useState('');
    const navigate = useNavigate();

    // ✅ FIXED: Remove infinite loop - call getUsers only once on mount
    useEffect(() => {
        getUsers();
    }, []); // Empty dependency array

    // ✅ Safe filtering with fallbacks
    const filteredUsers = input 
        ? (users || []).filter((user) => 
            user?.fullName?.toLowerCase().includes(input.toLowerCase())
          ) 
        : (users || []);

    // ✅ Don't show current user in the list with safe filtering
    // Check both _id and uid to handle different user object structures
    const currentUserId = authuser?._id || authuser?.uid;
    const otherUsers = filteredUsers.filter(user => {
        if (!user) return false;
        const userId = user._id || user.uid || user.id;
        return userId && userId !== currentUserId;
    });

    // ✅ Safe online check function
    const isUserOnline = (userId) => {
        if (!Array.isArray(onlineUsers) || !userId) return false;
        
        // ✅ Convert both to string for safe comparison
        const userIdStr = userId.toString();
        const onlineUsersStr = onlineUsers.map(id => id?.toString());
        
        return onlineUsersStr.includes(userIdStr);
    };

    // ✅ Safe unseen messages check
    const getUnseenCount = (userId) => {
        return unseenMessages && typeof unseenMessages[userId] === 'number' 
            ? unseenMessages[userId] 
            : 0;
    };

    return (
        <div
            className={`bg-[#8185B2]/10 h-full p-5 rounded-r-xl overflow-y-scroll text-white ${
                selectedUser ? 'max-md:hidden' : ''
            }`}
        >
                {/* Logo + Menu + New Group */}
                <div className="pb-5">
                    <div className="flex justify-between items-center mb-5">
                        <img src={assets.logo} alt="logo" className="max-w-40" />
                        <div className="flex items-center gap-2">
                            {/* New Group Icon Button */}
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                className="p-2 bg-violet-600/20 hover:bg-violet-600/30 rounded-full transition-all hover:scale-110"
                                title="New Group"
                            >
                                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </button>
                            <div className="relative py-2 group">
                                <img
                                    src={assets.menu_icon}
                                    alt="Menu"
                                    className="max-h-5 cursor-pointer"
                                />
                                <div className="absolute top-full right-0 z-50 w-32 p-3 rounded-md bg-[#282142] border border-gray-600 text-gray-100 hidden group-hover:block shadow-lg">
                                    <p
                                        onClick={() => navigate('/profile')}
                                        className="cursor-pointer text-sm hover:text-purple-400 py-1"
                                    >
                                        Edit Profile
                                    </p>
                                    <hr className="my-2 border-t border-gray-500" />
                                    <p 
                                        onClick={() => logout()} 
                                        className="cursor-pointer text-sm hover:text-red-400 py-1"
                                    >
                                        Logout
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                {/* Search Box */}
                <div className="bg-[#282142] rounded-full flex items-center gap-2 py-3 px-4 mt-5">
                    <img src={assets.search_icon} alt="search" className="w-3" />
                    <input 
                        onChange={(e) => setInput(e.target.value)}
                        value={input}
                        type="text"
                        placeholder="Search user..."
                        className="bg-transparent border-none outline-none text-white text-xs placeholder-[#c8c8c8] flex-1"
                    />
                </div>

                {/* User List */}
            <div className="flex flex-col">
                {otherUsers.length > 0 ? (
                    otherUsers.map((user) => {
                        // ✅ Safe checks with fallbacks
                        const userId = user?._id || user?.uid || user?.id;
                        const userName = user?.fullName || 'Unknown User';
                        const userProfilePic = user?.profilePic || assets.avatar_icon;
                        
                        const selectedUserId = selectedUser?._id || selectedUser?.uid || selectedUser?.id;
                        const isSelected = selectedUserId === userId;
                        const isOnline = isUserOnline(userId);
                        const unseenCount = getUnseenCount(userId);
                        const hasUnseenMessages = unseenCount > 0;
                        const isGroup = user.isGroup === true;
                            
                            return (
                                <div
                                    key={userId || Math.random()}
                                    onClick={() => user && setSelectedUser(user)}
                                    className={`relative flex items-center gap-2 p-2 pl-4 rounded cursor-pointer max-sm:text-sm ${
                                        isSelected ? 'bg-[#282142]/50' : 'hover:bg-[#282142]/30'
                                    } transition-colors`}
                                >
                                    <div className="relative">
                                        {isGroup ? (
                                            // Group avatar with icon overlay
                                            <div className="w-[35px] h-[35px] rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center relative">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <>
                                                <img
                                                    src={userProfilePic}
                                                    alt="avatar"
                                                    className="w-[35px] aspect-square rounded-full object-cover"
                                                />
                                                {isOnline && (
                                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#8185B2]/10"></div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-col leading-5 flex-1 min-w-0">
                                        <p className="font-medium truncate">{userName}</p>
                                        {!isGroup && (
                                            <span
                                                className={`text-xs ${
                                                    isOnline ? 'text-green-400' : 'text-neutral-400'
                                                }`}
                                            >
                                                {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        )}
                                        {isGroup && (
                                            <span className="text-xs text-neutral-400">
                                                Group
                                            </span>
                                        )}
                                    </div>
                                    {hasUnseenMessages && (
                                        <div className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex justify-center items-center rounded-full bg-[#25D366] text-white text-[11px] font-bold shadow-md">
                                            {unseenCount > 99 ? '99+' : unseenCount}
                                        </div>
                                    )}
                                </div>
                            );
                    })
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        <p>No users found</p>
                        <p className="text-sm mt-1">
                            {input ? 'Try a different search' : 'Start chatting with others'}
                        </p>
                    </div>
                )}
            </div>
        </div>
        
        {/* Create Group Modal */}
        <CreateGroupModal 
            isOpen={showCreateGroup} 
            onClose={() => setShowCreateGroup(false)} 
        />
    </div>
    );
};

export default Sidebar;