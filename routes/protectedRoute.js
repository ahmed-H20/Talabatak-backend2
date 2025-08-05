// routes/protectedRoute.js
import express from "express";

const router = express.Router();

import {verifyFirebaseToken} from "../middlewares/firebaseMiddlewares.js";
import { getProtectedData } from "../controllers/protectedController.js";

router.get("/protected-route", verifyFirebaseToken, getProtectedData);

export default router;