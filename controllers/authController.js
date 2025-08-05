// controllers/authController.js - Add these methods to your existing controller

import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import { sanitizeUser } from '../utils/sanitize.js';
import bcrypt from 'bcryptjs';

// Helper function to validate phone number (11 digits)
const isValidPhone = (phone) => {
  const phoneRegex = /^\d{11}$/;
  return phoneRegex.test(phone);
};

// Generate a unique phone number for social users (temporary)
const generateTempPhone = async () => {
  let phone;
  let exists = true;
  
  while (exists) {
    // Generate a random 11-digit number starting with 05
    phone = '05' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    exists = await User.findOne({ phone });
  }
  
  return phone;
};

// Google Authentication
export const googleAuth = async (req, res, next) => {
  try {
    const { providerId, name, email, photo } = req.body;

    if (!providerId || !name || !email) {
      return res.status(400).json({ message: 'Missing required Google data' });
    }

    // Check if user exists with this Google ID
    let user = await User.findOne({ 
      $or: [
        { providerId, provider: 'google' },
        { email }
      ]
    });

    if (user) {
      // Existing user - log them in
      const token = generateToken(user._id);
      return res.status(200).json({
        message: 'Login successful',
        user: sanitizeUser(user),
        token,
        isNewUser: false
      });
    }

    // New user - create account with temporary phone
    const tempPhone = await generateTempPhone();
    
    user = await User.create({
      name,
      email,
      phone: tempPhone,
      password: 'social-auth-' + Math.random().toString(36), // Random password for social users
      location: {
        coordinates: [31.2357, 30.0444], // Default Cairo coordinates
        address: 'غير محدد'
      },
      role: 'user', // Default role
      provider: 'google',
      providerId,
      photo,
      isPhoneVerified: false, // Will be verified when they complete profile
    });

    const token = generateToken(user._id);
    
    res.status(201).json({
      message: 'Account created with Google',
      user: sanitizeUser(user),
      token,
      isNewUser: true
    });
  } catch (err) {
    next(err);
  }
};

// Facebook Authentication
export const facebookAuth = async (req, res, next) => {
  try {
    const { providerId, name, email, photo } = req.body;

    if (!providerId || !name) {
      return res.status(400).json({ message: 'Missing required Facebook data' });
    }

    // Check if user exists with this Facebook ID or email
    let user = await User.findOne({ 
      $or: [
        { providerId, provider: 'facebook' },
        ...(email ? [{ email }] : [])
      ]
    });

    if (user) {
      // Existing user - log them in
      const token = generateToken(user._id);
      return res.status(200).json({
        message: 'Login successful',
        user: sanitizeUser(user),
        token,
        isNewUser: false
      });
    }

    // New user - create account with temporary phone
    const tempPhone = await generateTempPhone();
    
    user = await User.create({
      name,
      email: email || `fb_${providerId}@temp.com`,
      phone: tempPhone,
      password: 'social-auth-' + Math.random().toString(36), // Random password for social users
      location: {
        coordinates: [31.2357, 30.0444], // Default Cairo coordinates
        address: 'غير محدد'
      },
      role: 'user', // Default role
      provider: 'facebook',
      providerId,
      photo,
      isPhoneVerified: false, // Will be verified when they complete profile
    });

    const token = generateToken(user._id);
    
    res.status(201).json({
      message: 'Account created with Facebook',
      user: sanitizeUser(user),
      token,
      isNewUser: true
    });
  } catch (err) {
    next(err);
  }
};

// Complete social profile for new social users
export const completeSocialProfile = async (req, res, next) => {
  try {
    const { phone, address, role, location } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!phone || !address || !role || !location?.coordinates) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate phone number (11 digits)
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Check if phone is already taken by another user
    const phoneExists = await User.findOne({ 
      phone, 
      _id: { $ne: userId } 
    });
    
    if (phoneExists) {
      return res.status(400).json({ message: 'Phone number already exists' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user profile
    user.phone = phone;
    user.location = {
      coordinates: location.coordinates,
      address: address
    };
    user.role = role;
    user.isPhoneVerified = true; // Consider phone verified after completion

    await user.save();

    res.status(200).json({
      message: 'Profile completed successfully',
      user: sanitizeUser(user)
    });
  } catch (err) {
    next(err);
  }
};

// Regular registration (existing method updated)
export const registerUser = async (req, res, next) => {
  try {
    const { name, phone, email, password, location, role } = req.body;

    if (!name || !phone || !email || !password || !location || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate phone number (11 digits)
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    const userExists = await User.findOne({ 
      $or: [{ phone }, { email }] 
    });
    
    if (userExists) {
      if (userExists.phone === phone) {
        return res.status(400).json({ message: 'User with this phone number already exists' });
      }
      if (userExists.email === email) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }

    const user = await User.create({
      name,
      phone,
      email,
      password,
      location,
      role,
      provider: 'local',
      isPhoneVerified: true, // Set to true since we're not doing verification
    });

    const token = generateToken(user._id);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
};

// Login user (existing method - no changes needed)
export const loginUser = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    // Validate phone number format
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    // Check if this is a social user trying to login with password
    if (user.provider !== 'local') {
      return res.status(401).json({ 
        message: `Please use ${user.provider} to sign in` 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    const token = generateToken(user._id, res);
    const sanitizedUser = sanitizeUser(user);

    res.status(200).json({
      message: "Login successful",
      user: sanitizedUser,
      token
    });

  } catch (error) {
    next(error);
  }
};

// Get user profile BY token (existing method - no changes needed)
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// Update user profile (existing method - no changes needed)
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, location, photo } = req.body;

    if (name) user.name = name;
    if (location?.coordinates) user.location = location;
    if (photo) user.photo = photo;

    const updatedUser = await user.save();
    res.status(200).json({
      message: "Profile updated successfully",
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    next(err);
  }
};

// Forget password - simplified without OTP (existing method updated)
export const forgetPassword = async (req, res, next) => {
  try {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({ message: "Phone and new password are required" });
    }

    // Validate phone number format
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if this is a social user
    if (user.provider !== 'local') {
      return res.status(400).json({ 
        message: `This account uses ${user.provider} authentication. Password reset is not available.` 
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    next(err);
  }
};

// Logout user (existing method - no changes needed)
export const logoutUser = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logged out successfully" });
};