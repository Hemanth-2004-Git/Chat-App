import express from "express";
import { protectroute } from "../middleware/auth.js"; // ✅ Added .js
import { getmessages, getuserforsidebar, sendmessage, markmessageasseen } from "../controllers/messagecontroller.js"; // ✅ Added .js and fixed function name

const messagerouter = express.Router();

messagerouter.get('/users', protectroute, getuserforsidebar);
messagerouter.get('/:id', protectroute, getmessages); // ✅ Fixed route parameter
messagerouter.put('/mark/:id', protectroute, markmessageasseen);
messagerouter.post("/send/:id", protectroute, sendmessage);

export default messagerouter;