// server/routes/userroute.js

import express from "express";
import { signup, updateprofile, checkAuth } from "../controllers/usercontroller.js";
import { protectroute, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", optionalAuth, signup);
// LOGIN route is removed. Client handles login with Firebase client SDK.
router.put("/update", protectroute, updateprofile);
router.get("/check", protectroute, checkAuth);

export default router;