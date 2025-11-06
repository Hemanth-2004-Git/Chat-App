export function formatMessageTime(date){
    return new Date(date).toLocaleTimeString("en-US",{
        hour: '2-digit',
        minute: '2-digit',
        hour12:false,
    })
}

export function formatLastSeen(date) {
    if (!date) return 'Never';
    
    const now = new Date();
    const lastSeen = new Date(date);
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return lastSeen.toLocaleDateString("en-US", {
        month: 'short',
        day: 'numeric',
        year: lastSeen.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

export function formatMessageDate(date) {
    if (!date) return '';
    
    const now = new Date();
    const msgDate = new Date(date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    
    if (msgDateOnly.getTime() === today.getTime()) {
        return 'Today';
    } else if (msgDateOnly.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    } else {
        return msgDate.toLocaleDateString("en-US", {
            month: 'short',
            day: 'numeric',
            year: msgDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}