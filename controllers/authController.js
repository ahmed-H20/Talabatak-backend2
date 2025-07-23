// controllers/authController.js
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import { sanitizeUser } from '../utils/sanitize.js';
import bcrypt from 'bcryptjs';

// Register a new user
export const registerUser = async (req, res, next) => {
  try {
    const { name, phone, password, location } = req.body;

    if (!name || !phone || !password || !location?.coordinates) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 mins

    const user = await User.create({
      name,
      phone,
      password,
      location,
      otpCode,
      otpExpiresAt,
    });

    res.status(201).json({
      message: 'User registered. Please verify your phone number.',
      user: sanitizeUser(user),
    });

    // You can log or send the OTP here (SMS API)
    console.log(`OTP for ${phone}: ${otpCode}`);
  } catch (err) {
    next(err);
  }
};

// Verify phone number with OTP
export const verifyPhone = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.isPhoneVerified) {
      return res.status(400).json({ message: 'Phone number already verified' });
    }

    if (
      user.otpCode !== otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < Date.now()
    ) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isPhoneVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = generateToken(user._id);
    res.status(200).json({
      message: 'Phone verified successfully',
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
};

// Login user
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
    const sanitizedUser = sanitizeUser(user)

    res.status(200).json({
      message: "Login successful",
      user: sanitizedUser,
      token
    })

  } catch (error) {
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

// Forget password and send OTP
export const forgetPassword = async (req, res, next) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.otpCode = otpCode;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    console.log(`OTP for ${phone}: ${otpCode}`);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    next(err);
  }
};


// Reset password using OTP
export const resetPassword = async (req, res, next) => {
  try {
    const { phone, otp, newPassword } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user.otpCode !== otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.password = newPassword;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error('Error resetting password:', err);
    next(err);
  }
};

// Logout user
export const logoutUser = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logged out successfully" });
};



