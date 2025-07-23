// routes/authRoutes.js
import express from 'express'
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  forgetPassword,
  resetPassword,
  logoutUser,
} from '../controllers/authController.js'
import protectRoute from '../middlewares/protectRoute.js'

const router = express.Router()

// @route   POST /api/users/register
router.post("/register", registerUser);

// @route   POST /api/users/login
router.post("/login", loginUser);

// @route   GET /api/users/profile
router.get("/profile", protectRoute, getProfile);

// @route   PUT /api/users/profile
router.put("/profile", protectRoute, updateProfile);

// @route   POST /api/users/forgot-password
router.post("/forgot-password", forgetPassword);

// @route   PUT /api/users/reset-password
router.put("/reset-password", resetPassword);

// @route   POST /api/users/logout
router.post("/logout", logoutUser);

export default router
