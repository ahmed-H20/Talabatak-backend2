// models/userModel.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{11}$/.test(v);
      },
      message: 'Phone number must be exactly 11 digits'
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  location: {
    type: String,
    required: true,
    trim: true
  },

  role: {
    type: String,
    enum: ['user', 'delivery', 'admin'],
    default: 'user',
  },
  photo: {
    type: String,
    default: '',
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  // Social authentication fields
  provider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local',
  },
  providerId: {
    type: String,
    sparse: true, // Allows multiple null values
  },
  // OTP fields (if you want to keep them for future use)
  otpCode: {
    type: String,
  },
  otpExpiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for geospatial queries
userSchema.index({ "location.coordinates": "2dsphere" });

// Compound index for social auth
userSchema.index({ provider: 1, providerId: 1 }, { 
  unique: true, 
  partialFilterExpression: { providerId: { $exists: true } } 
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to check if user is social user
userSchema.methods.isSocialUser = function() {
  return this.provider !== 'local';
};

// Method to get user's full location
userSchema.methods.getFullLocation = function() {
  return {
    coordinates: this.location.coordinates,
    address: this.location.address,
    longitude: this.location.coordinates[0],
    latitude: this.location.coordinates[1]
  };
};

const User = mongoose.model('User', userSchema);

export default User;