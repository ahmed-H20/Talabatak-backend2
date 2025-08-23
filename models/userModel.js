import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: function() {
        // Phone is only required for non-Google users or completed Google profiles
        return !this.provider || this.profileComplete;
      },
      unique: true,
      sparse: true // Only unique if not null/undefined
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
    },
    role: {
      type: String,
      enum: ["user", "admin", "delivery"],
      default: "user",
    },
    // Social login fields
    provider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local'
    },
    providerId: {
      type: String,
      sparse: true // Only unique if not null
    },
    profileComplete: {
      type: Boolean,
      default: function() {
        return this.provider === 'local'; // Local users start complete
      }
    },
    isPhoneVerified: {
      type: Boolean,
      default: function() {
        return this.provider === 'local'; // Local users considered verified
      }
    },
    // Delivery-specific fields
    deliveryStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: function() {
        return this.role === "delivery" ? "pending" : undefined;
      }
    },
    deliveryInfo: {
      fullName: String,
      nationalId: {
        type: String,
        unique: true,
        sparse: true // Only unique if not null
      },
      idCardImage: String,
      workingCity: String,
      isAvailable: {
        type: Boolean,
        default: true
      },
      rating: {
        type: Number,
        default: 5,
        min: 1,
        max: 5
      },
      totalDeliveries: {
        type: Number,
        default: 0
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedAt: Date,
      rejectedAt: Date,
      rejectionReason: String
    },
    city: String,
    state: String,
    country: String,
    location: {
      type: String,
      required: function() {
        // Location is required for non-Google users or completed Google profiles
        return this.provider === 'local' || this.profileComplete;
      }
    },
    // GeoJSON location for delivery persons and location-based features
    geoLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    resetPasswordToken: String,
    resetPasswordTokenExpiration: Date,
    passwordResetVerified: Boolean,
    profile_picture: {
      type: String,
      default:
        'https://res.cloudinary.com/dhddxcwcr/image/upload/v1700416252/6558f05c2841e64561ce75d1_Cover.jpg',
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes (only non-duplicate ones)
userSchema.index({ geoLocation: '2dsphere' }); // Geospatial index for location-based queries
userSchema.index({ provider: 1, providerId: 1 }); // Compound index for social login

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Validate that Google users have required fields when profile is marked complete
userSchema.pre('save', function(next) {
  if (this.provider === 'google' && this.profileComplete) {
    if (!this.phone || !this.location) {
      const error = new Error('Phone and location are required for completed Google profiles');
      return next(error);
    }
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPass) {
  return await bcrypt.compare(enteredPass, this.password);
};

// Method to check if delivery person is approved
userSchema.methods.isApprovedDelivery = function() {
  return this.role === 'delivery' && this.deliveryStatus === 'approved';
};

// Method to check if user needs to complete profile
userSchema.methods.needsProfileCompletion = function() {
  return this.provider === 'google' && !this.profileComplete;
};

// Method to get user's full location
userSchema.methods.getFullLocation = function() {
  return {
    address: this.location,
    coordinates: this.geoLocation?.coordinates || null,
    hasGeoLocation: !!this.geoLocation
  };
};

const User = mongoose.model('User', userSchema);

export default User;
