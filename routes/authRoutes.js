// routes/authRoutes.js - Updated with Google auth
import express from 'express'
import {
  registerUser,
  loginUser,
  googleAuth,
  completeSocialProfile,
  getProfile,
  updateProfile,
  forgetPassword,
  verifyResetPassword,
  resetPassword,
  logoutUser,
} from '../controllers/authController.js'
import {protectRoute} from '../middlewares/protectRoute.js'
import authorizeRoles from '../middlewares/authorizeRoles.js';

const router = express.Router()

// @route   POST /api/auth/register
router.post("/register", registerUser);

// @route   POST /api/auth/login
router.post("/login", loginUser);

// @route   POST /api/auth/google
router.post("/google", googleAuth);

// @route   POST /api/auth/complete-social-profile
router.post("/complete-social-profile", protectRoute, completeSocialProfile);

// @route   GET /api/auth/profile
router.get("/profile", protectRoute, getProfile);

// @route   PUT /api/auth/profile
router.put("/profile", protectRoute, updateProfile);

// @route   POST /api/auth/forget-password
router.post("/forget-password", forgetPassword);

// @route   POST /api/auth/verify-reset-password
router.post("/verify-reset-password", verifyResetPassword);

// @route   POST /api/auth/reset-password
router.post("/reset-password", resetPassword);

// @route   POST /api/auth/logout
router.post("/logout", logoutUser);

// @route   GET /api/auth/dashboard (Admin only)
router.get("/dashboard", protectRoute, authorizeRoles("admin"), (req, res) => {
  res.status(200).json({ message: "Welcome to the admin dashboard!" });
});

export default router