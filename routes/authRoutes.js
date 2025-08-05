import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  forgetPassword,
  logoutUser,
  googleAuth,
  facebookAuth,
  completeSocialProfile
} from '../controllers/authController.js';
import User from '../models/userModel.js';
import { protectRoute } from "../middlewares/protectRoute.js"
import express from 'express'

const router = express.Router()



// routes/authRoutes.js


// Regular authentication routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forget-password', forgetPassword);
router.post('/logout', logoutUser);

// Social authentication routes
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);
router.post('/complete-social-profile', protectRoute, completeSocialProfile);

// Protected routes
router.get('/profile', protectRoute, getProfile);
router.put('/profile', protectRoute, updateProfile);



export default router
