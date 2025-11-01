import React, { useContext, useEffect, useState } from 'react';
import assets from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import { authcontext } from '../../context/authcontext';
import { chatContext } from '../../context/chatcontext';

const Sidebar = () => {
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
    const otherUsers = filteredUsers.filter(user => 
        user && user._id && user._id !== authuser?._id
    );

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
            {/* Logo + Menu */}
            <div className="pb-5">
                <div className="flex justify-between items-center">
                    <img src={assets.logo} alt="logo" className="max-w-40" />
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
            </div>

            {/* User List */}
            <div className="flex flex-col">
                {otherUsers.length > 0 ? (
                    otherUsers.map((user) => {
                        // ✅ Safe checks with fallbacks
                        const userId = user?._id;
                        const userName = user?.fullName || 'Unknown User';
                        const userProfilePic = user?.profilePic || assets.avatar_icon;
                        
                        const isSelected = selectedUser?._id === userId;
                        const isOnline = isUserOnline(userId);
                        const unseenCount = getUnseenCount(userId);
                        const hasUnseenMessages = unseenCount > 0;

                        return (
                            <div
                                key={userId || Math.random()}
                                onClick={() => user && setSelectedUser(user)}
                                className={`relative flex items-center gap-2 p-2 pl-4 rounded cursor-pointer max-sm:text-sm ${
                                    isSelected ? 'bg-[#282142]/50' : 'hover:bg-[#282142]/30'
                                } transition-colors`}
                            >
                                <div className="relative">
                                    <img
                                        src={userProfilePic}
                                        alt="avatar"
                                        className="w-[35px] aspect-square rounded-full object-cover"
                                    />
                                    {isOnline && (
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#8185B2]/10"></div>
                                    )}
                                </div>
                                <div className="flex flex-col leading-5 flex-1 min-w-0">
                                    <p className="font-medium truncate">{userName}</p>
                                    <span
                                        className={`text-xs ${
                                            isOnline ? 'text-green-400' : 'text-neutral-400'
                                        }`}
                                    >
                                        {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                                {hasUnseenMessages && (
                                    <div className="flex-shrink-0 text-xs h-5 w-5 flex justify-center items-center rounded-full bg-violet-500 text-white">
                                        {unseenCount}
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
    );
};

export default Sidebar;