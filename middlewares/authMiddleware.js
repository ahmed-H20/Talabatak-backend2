import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

// Enhanced protect route middleware that handles both regular and Google auth
export const protectRoute = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      // Fallback to cookie if available
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    // Handle Google temporary tokens
    if (token.startsWith('google_temp_')) {
      return res.status(401).json({ 
        message: 'Google authentication is temporary, please complete your profile',
        needsProfileCompletion: true
      });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database (get fresh data)
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check if Google user needs profile completion (but allow profile completion route)
      if (user.provider === 'google' && !user.profileComplete) {
        // Allow access to profile completion endpoint
        if (req.originalUrl.includes('complete-social-profile') || req.originalUrl.includes('profile')) {
          req.user = user;
          return next();
        }
        
        return res.status(403).json({
          message: 'Profile completion required',
          needsProfileCompletion: true
        });
      }

      // Add user to request object
      req.user = user;
      next();

    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      
      // More specific error messages
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired, please login again' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      } else {
        return res.status(401).json({ message: 'Not authorized, token failed' });
      }
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error in authentication' });
  }
};

// Middleware to check if user has completed profile
export const requireCompleteProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has completed their profile
    if (req.user.provider === 'google' && !req.user.profileComplete) {
      return res.status(403).json({
        message: 'Please complete your profile to access this feature',
        needsProfileCompletion: true
      });
    }

    // Check if required fields are present
    if (!req.user.phone || !req.user.location) {
      return res.status(403).json({
        message: 'Complete profile information required',
        needsProfileCompletion: true
      });
    }

    next();
  } catch (error) {
    console.error('Profile completion check error:', error);
    res.status(500).json({ message: 'Server error in profile validation' });
  }
};

// Middleware specifically for delivery person routes
export const requireDeliveryApproval = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'delivery') {
      return res.status(403).json({ message: 'Delivery person access required' });
    }

    if (req.user.deliveryStatus !== 'approved') {
      const statusMessages = {
        'pending': 'Your delivery application is pending approval',
        'rejected': 'Your delivery application has been rejected',
        'suspended': 'Your delivery account has been suspended'
      };

      return res.status(403).json({
        message: statusMessages[req.user.deliveryStatus] || 'Delivery approval required',
        deliveryStatus: req.user.deliveryStatus,
        canAccess: false
      });
    }

    next();
  } catch (error) {
    console.error('Delivery approval check error:', error);
    res.status(500).json({ message: 'Server error in delivery validation' });
  }
};

// Optional: Middleware to log authentication attempts
export const logAuth = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.headers['user-agent'];
  
  console.log(`[${timestamp}] Auth attempt: ${method} ${url} - ${userAgent}`);
  
  next();
};