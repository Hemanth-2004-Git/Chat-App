import express from "express";
import { protectroute } from "../middleware/auth.js"; // ✅ Added .js
import { 
    getmessages, 
    getuserforsidebar, 
    sendmessage, 
    markmessageasseen,
    creategroup,
    getgroups,
    getgroupmessages,
    sendgroupmessage,
    updategroup,
    addparticipants,
    removeparticipant,
    deletemessage,
    editmessage,
    forwardmessage,
    getrecentchats
} from "../controllers/messagecontroller.js"; // ✅ Added .js and fixed function name

const messagerouter = express.Router();

// User-related routes
messagerouter.get('/users', protectroute, getuserforsidebar);
messagerouter.get('/recent', protectroute, getrecentchats);

// Group routes (must come before /:id routes)
messagerouter.post('/groups/create', protectroute, creategroup);
messagerouter.get('/groups', protectroute, getgroups);
messagerouter.get('/groups/:id', protectroute, getgroupmessages);
messagerouter.post('/groups/send/:id', protectroute, sendgroupmessage);
messagerouter.put('/groups/update/:id', protectroute, updategroup);
messagerouter.post('/groups/add/:id', protectroute, addparticipants);
messagerouter.delete('/groups/remove/:id/:userId', protectroute, removeparticipant);

// Regular chat routes
messagerouter.get('/:id', protectroute, getmessages); // ✅ Fixed route parameter
messagerouter.put('/mark/:id', protectroute, markmessageasseen);
messagerouter.post("/send/:id", protectroute, sendmessage);
messagerouter.delete("/delete/:messageId", protectroute, deletemessage);
messagerouter.put("/edit/:messageId", protectroute, editmessage);
messagerouter.post("/forward/:id", protectroute, forwardmessage);

export default messagerouter;