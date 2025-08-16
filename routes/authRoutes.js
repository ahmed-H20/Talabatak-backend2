// routes/authRoutes.js
import express from 'express'
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  forgetPassword,
  verifyResetPassword,
  resetPassword,
  logoutUser,
} from '../controllers/authController.js'
import {protectRoute} from '../middlewares/protectRoute.js'
import authorizeRoles from '../middlewares/authorizeRoles.js';
import generateToken from '../utils/generateToken.js';

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
router.post("/forget-password", forgetPassword);
// @route   POST /api/users/verify-reset-password
router.post("/verify-reset-password", verifyResetPassword);
// @route   PUT /api/users/reset-password
router.post("/reset-password", resetPassword);

// @route   POST /api/users/logout
router.post("/logout", logoutUser);


router.get("/dashboard", protectRoute, authorizeRoles("admin"), (req, res) => {
  res.status(200).json({ message: "Welcome to the admin dashboard!" });
});

router.post('/auth/google', async (req, res) => {
  try {
    const { providerId, name, email, photo } = req.body;

    // Check if user exists with this Google ID or email
    let user = await User.findOne({
      $or: [
        { providerId: providerId, provider: 'google' },
        { email: email }
      ]
    });

    if (user) {
      // Update existing user's Google info if needed
      if (!user.providerId || !user.provider) {
        user.providerId = providerId;
        user.provider = 'google';
        user.photo = photo || user.photo;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        name,
        email,
        photo,
        provider: 'google',
        providerId,
        role: 'user', // Default role
        isPhoneVerified: false, // They'll need to add phone later
        // You might want to set a flag for incomplete profile
        profileComplete: false
      });
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user._id, user.phone)

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        location: user.location,
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
        photo: user.photo,
        provider: user.provider,
        providerId: user.providerId
      },
      token,
      isNewUser: !user.phone // Flag if they need to complete profile
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول' });
  }
});


export default router
