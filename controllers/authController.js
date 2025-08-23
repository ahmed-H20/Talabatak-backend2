// controllers/authController.js - Updated with Google Auth
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import { sendPasswordResetEmail } from '../utils/emails.js';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import { sanitizeUser } from '../utils/sanitize.js';

// @desc    Sign Up with optional delivery registration
// @route   POST/api/v1/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { 
      name, 
      phone, 
      email, 
      password, 
      location, 
      role,
      // Delivery-specific fields
      deliveryInfo,
      coordinates
    } = req.body;

    if (!name || !phone || !email || !password || !location || !role) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this phone number' });
    }

    // Check email uniqueness
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // If registering as delivery, validate delivery info
    if (role === 'delivery') {
      if (!deliveryInfo || !deliveryInfo.fullName || !deliveryInfo.nationalId || !deliveryInfo.workingCity) {
        return res.status(400).json({ 
          message: 'Delivery registration requires full name, national ID, and working city' 
        });
      }

      // Check if national ID is already used
      const existingNationalId = await User.findOne({ 'deliveryInfo.nationalId': deliveryInfo.nationalId });
      if (existingNationalId) {
        return res.status(400).json({ 
          message: 'National ID is already registered' 
        });
      }
    }

    // Prepare user data
    const userData = {
      name,
      phone,
      email,
      password,
      location,
      role,
    };

    // Add delivery-specific data if role is delivery
    if (role === 'delivery') {
      userData.deliveryStatus = 'pending';
      userData.deliveryInfo = {
        fullName: deliveryInfo.fullName,
        nationalId: deliveryInfo.nationalId,
        idCardImage: deliveryInfo.idCardImage || '',
        workingCity: deliveryInfo.workingCity,
        isAvailable: true,
        rating: 5,
        totalDeliveries: 0
      };

      // Add geolocation if coordinates provided
      if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
        userData.geoLocation = {
          type: 'Point',
          coordinates: coordinates // [longitude, latitude]
        };
      }
    }

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id, res);
    if (!token) {
      return res.status(500).json({ message: 'Token generation failed' });
    }

    // Prepare response message
    let message = 'User registered successfully.';
    if (role === 'delivery') {
      message = 'Delivery person registration submitted. Please wait for admin approval.';
    } else {
      message += ' Please verify your phone number.';
    }

    res.status(201).json({
      message,
      user: sanitizeUser(user),
      token,
      role: user.role,
      ...(role === 'delivery' && {
        deliveryStatus: user.deliveryStatus,
        requiresApproval: true
      })
    });
  } catch (error) {
    console.error('Error registering user:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} is already registered` 
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
    next(error);
  }
};

// @desc    Login with role-based response
// @route   POST/api/v1/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    // Check delivery person status
    if (user.role === 'delivery') {
      if (user.deliveryStatus === 'pending') {
        return res.status(403).json({ 
          message: "Your delivery application is pending approval",
          deliveryStatus: 'pending',
          canLogin: false
        });
      } else if (user.deliveryStatus === 'rejected') {
        return res.status(403).json({ 
          message: "Your delivery application has been rejected",
          deliveryStatus: 'rejected',
          rejectionReason: user.deliveryInfo?.rejectionReason,
          canLogin: false
        });
      }
    }

    const token = generateToken(user._id, res);

    // Prepare response data based on role
    const responseData = {
      message: "Login successful",
      user: sanitizeUser(user),
      token,
      role: user.role
    };

    // Add delivery-specific data if applicable
    if (user.role === 'delivery') {
      responseData.deliveryInfo = {
        status: user.deliveryStatus,
        rating: user.deliveryInfo?.rating,
        totalDeliveries: user.deliveryInfo?.totalDeliveries,
        isAvailable: user.deliveryInfo?.isAvailable,
        workingCity: user.deliveryInfo?.workingCity
      };
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Internal server error' });
    next(error);
  }
};

// @desc    Google OAuth Authentication
// @route   POST /api/v1/auth/google
// @access  Public
export const googleAuth = async (req, res, next) => {
  try {
    const { providerId, name, email, photo, provider } = req.body;

    if (!providerId || !name || !email || !provider) {
      return res.status(400).json({ message: 'Missing required Google auth data' });
    }

    // Check if user exists with this Google ID
    let user = await User.findOne({
      providerId: providerId,
      provider: 'google'
    });

    if (user) {
      // Existing Google user - log them in
      
      // Check delivery person status if applicable
      if (user.role === 'delivery') {
        if (user.deliveryStatus === 'pending') {
          return res.status(403).json({ 
            message: "Your delivery application is pending approval",
            deliveryStatus: 'pending',
            canLogin: false
          });
        } else if (user.deliveryStatus === 'rejected') {
          return res.status(403).json({ 
            message: "Your delivery application has been rejected",
            deliveryStatus: 'rejected',
            rejectionReason: user.deliveryInfo?.rejectionReason,
            canLogin: false
          });
        }
      }

      // Update photo if needed
      if (photo && photo !== user.profile_picture) {
        user.profile_picture = photo;
        await user.save();
      }

      const token = generateToken(user._id, res);

      const responseData = {
        message: "تم تسجيل الدخول بنجاح",
        user: sanitizeUser(user),
        token,
        role: user.role,
        isNewUser: false
      };

      // Add delivery-specific data if applicable
      if (user.role === 'delivery') {
        responseData.deliveryInfo = {
          status: user.deliveryStatus,
          rating: user.deliveryInfo?.rating,
          totalDeliveries: user.deliveryInfo?.totalDeliveries,
          isAvailable: user.deliveryInfo?.isAvailable,
          workingCity: user.deliveryInfo?.workingCity
        };
      }

      return res.status(200).json(responseData);
    }

    // Check if user exists with same email but different provider
    const existingEmailUser = await User.findOne({ email: email });
    if (existingEmailUser) {
      // Link Google account to existing user
      existingEmailUser.provider = 'google';
      existingEmailUser.providerId = providerId;
      if (photo) existingEmailUser.profile_picture = photo;
      
      await existingEmailUser.save();

      const token = generateToken(existingEmailUser._id, res);

      const responseData = {
        message: "تم ربط حساب جوجل بحسابك الموجود",
        user: sanitizeUser(existingEmailUser),
        token,
        role: existingEmailUser.role,
        isNewUser: false
      };

      return res.status(200).json(responseData);
    }

    // Create new Google user with minimal profile
    const newUser = new User({
      name,
      email,
      phone: '', // Will be completed later
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), // Random password
      location: '', // Will be completed later
      role: 'user',
      provider: 'google',
      providerId,
      profile_picture: photo || 'https://res.cloudinary.com/dhddxcwcr/image/upload/v1700416252/6558f05c2841e64561ce75d1_Cover.jpg',
      isPhoneVerified: false,
      profileComplete: false
    });

    await newUser.save();

    const token = generateToken(newUser._id, res);

    const responseData = {
      message: "مرحباً بك! يرجى إكمال ملفك الشخصي",
      user: sanitizeUser(newUser),
      token,
      role: newUser.role,
      isNewUser: true,
      needsProfileCompletion: true
    };

    res.status(201).json(responseData);

  } catch (error) {
    console.error('Google auth error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'This Google account is already registered' 
      });
    }
    
    res.status(500).json({ message: 'Internal server error during Google authentication' });
    next(error);
  }
};

// @desc    Complete Social Profile (for Google users)
// @route   POST /api/v1/auth/complete-social-profile
// @access  Private
export const completeSocialProfile = async (req, res, next) => {
  try {
    const { phone, address, role, location } = req.body;

    if (!phone || !address || !role) {
      return res.status(400).json({ message: 'Phone, address, and role are required' });
    }

    // Validate phone number (11 digits)
    const phoneRegex = /^\d{11}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Check if phone is already used
    const existingPhone = await User.findOne({ 
      phone: phone,
      _id: { $ne: req.user._id }
    });

    if (existingPhone) {
      return res.status(400).json({ message: 'Phone number is already registered' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user wants to be delivery, validate additional requirements
    if (role === 'delivery') {
      return res.status(400).json({ 
        message: 'To become a delivery person, please use the delivery registration form' 
      });
    }

    // Update user profile
    user.phone = phone;
    user.location = address;
    user.role = role;
    user.isPhoneVerified = true;
    user.profileComplete = true;

    // Add location coordinates if provided
    if (location && location.coordinates && Array.isArray(location.coordinates)) {
      user.geoLocation = {
        type: 'Point',
        coordinates: location.coordinates
      };
    }

    await user.save();

    // IMPORTANT: Generate new JWT token after profile completion
    const token = generateToken(user._id, res);

    const responseData = {
      message: "تم إكمال الملف الشخصي بنجاح",
      user: sanitizeUser(user),
      token, // Include the new token in response
      role: user.role
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error completing social profile:', error);
    res.status(500).json({ message: 'Internal server error' });
    next(error);
  }
};

// Get user profile BY token
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const userProfile = sanitizeUser(user);
    
    // Add delivery info if user is delivery person
    if (user.role === 'delivery') {
      userProfile.deliveryInfo = user.deliveryInfo;
      userProfile.deliveryStatus = user.deliveryStatus;
    }
    
    res.status(200).json({ user: userProfile });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Internal server error' });
    next(err);
  }
};

// Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, location, photo, deliveryInfo } = req.body;

    if (name) user.name = name;
    if (location) user.location = location;
    if (photo) user.profile_picture = photo;

    // Allow delivery persons to update their delivery info (if not yet approved)
    if (user.role === 'delivery' && deliveryInfo && user.deliveryStatus === 'pending') {
      if (deliveryInfo.fullName) user.deliveryInfo.fullName = deliveryInfo.fullName;
      if (deliveryInfo.workingCity) user.deliveryInfo.workingCity = deliveryInfo.workingCity;
      if (deliveryInfo.idCardImage) user.deliveryInfo.idCardImage = deliveryInfo.idCardImage;
    }

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
// @access public
export const forgetPassword = asyncHandler(async (req, res, next) => {
  const { phone, newPassword } = req.body;

  if (!phone || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Phone number and new password are required",
    });
  }

  // Validate phone number format
  const phoneRegex = /^\d{11}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Phone number must be exactly 11 digits",
    });
  }

  const user = await User.findOne({ phone });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found with this phone number",
    });
  }

  // For simplicity, directly update password
  // In production, you might want to add SMS verification
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully',
  });
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