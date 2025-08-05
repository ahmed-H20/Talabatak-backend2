// models/userModel.js
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
      required: true,
      unique: true,
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
    city: String,
    state: String,
    country: String,

    location: {
        type: String,
    },
    resetPasswordToken: String,
    resetPasswordTokenExpiration: Date,
    passwordResetVerified : Boolean,

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

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPass) {
  return await bcrypt.compare(enteredPass, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
