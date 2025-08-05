import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import { sendPasswordResetEmail } from '../utils/emails.js';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import { sanitizeUser } from '../utils/sanitize.js';


// @desc    Sign Up
// @route   POST/api/v1/auth/signup
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, phone, email, password, location , role } = req.body;

    if (!name || !phone || !email|| !password || !location || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      phone,
      email,
      password,
      location,
      role,
    });
    const token = generateToken(user._id, res)
    if (!token) {
      return res.status(500).json({ message: 'Token generation failed' });
    }
    res.status(201).json({
      message: 'User registered. Please verify your phone number.',
      user: sanitizeUser(user),
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error' });
    next(error);
  }
};
// @desc    Login
// @route   POST/api/v1/auth/login
// @access  Publi
export const loginUser = async (req, res, next) => {
  try {
    const { phone, password } = req.body

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" })
    }

    const user = await User.findOne({ phone })

    if (!user) {
      return res.status(401).json({ message: "Invalid phone or password" })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid phone or password" })
    }

    const token = generateToken(user._id, res)

    res.status(200).json({
      message: "Login successful",
      user: sanitizeUser(user),
      token
    })

  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Internal server error' })
    next(error)
  }
}

// Get user profile BY token
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.status(200).json({ user: sanitizeUser(user) })
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Internal server error' })
    next(err)
  }
}

// Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, location, photo } = req.body;

    if (name) user.name = name;
    if (location) user.location = location;
    if (photo) user.photo = photo;

    const updatedUser = await user.save();
    res.status(200).json({
      message: "Profile updated successfully",
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ message: "Internal server error" });
    next(err);
  }
};

// @desc   Forget password
// @route  POST/api/v1/auth/forget-password
// @access private
export const forgetPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto.createHash('sha256').update(resetCode).digest('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

  user.resetPasswordToken = hashedResetCode;
  user.resetPasswordTokenExpiration = expiresAt;
  user.passwordResetVerified = false;

  await user.save();

  try {
    await sendPasswordResetEmail(user.email, user.name, resetCode);
    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email',
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiration = undefined;
    user.passwordResetVerified = undefined;
    await user.save();

    res.status(500).json({
      success: false,
      message: 'Failed to send reset code',
      error: error.message,
    });
  }
});

// @desc    Verify Password Reset Code
// @route   POST/api/auth/verify-resetCode
// @access  Private
export const verifyResetPassword = (async (req, res, next) => {
  const { resetCode , email } = req.body;
  const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');

  const user = await User.findOne({ resetPasswordToken: hashedResetCode , email });
    if (!user || user.resetPasswordTokenExpiration < Date.now()) {
      return res.status(500).json('Reset code invalid or expired');
  }
  user.passwordResetVerified = true;
  await user.save();
  res.status(200).json({
      status: 'Success'
  });
});


// @desc    Reset Password
// @route   POST/api/auth/reset-password
// @access  Private
export const resetPassword = (async (req, res, next) => {
  const { email, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json('Invalid User email')
  }

  if (!user.passwordResetVerified) {
    return res.status(400).json('Reset code not verified')
  }
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpiration = undefined;
  user.passwordResetVerified = undefined

  await user.save();

  res.status(200).json({
      stasus: 'Success',
      message: 'Password has been reset successfully. Please log in with your new password.'
  });
});  

// Logout user
export const logoutUser = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logged out successfully" });
};



