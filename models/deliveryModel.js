// models/deliveryModel.js
import mongoose from "mongoose";

const deliveryRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  nationalId: {
    type: String,
    required: true,
    unique: true,
  },
  idCardImage: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  workingCity: {
    type: String,
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  adminNotes: String,
}, { timestamps: true });

// Create geo index for location-based queries
deliveryRequestSchema.index({ location: '2dsphere' });

const DeliveryRequest = mongoose.model("DeliveryRequest", deliveryRequestSchema);

// Delivery Assignment Schema - tracks which delivery person is assigned to which order
const deliveryAssignmentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  deliveryPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  acceptedAt: Date,
  pickedUpAt: Date,
  deliveredAt: Date,
  status: {
    type: String,
    enum: ["assigned", "accepted", "picked_up", "on_the_way", "delivered", "cancelled"],
    default: "assigned",
  },
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  deliveryNotes: String,
  customerRating: {
    type: Number,
    min: 1,
    max: 5,
  },
  customerFeedback: String,
}, { timestamps: true });

const DeliveryAssignment = mongoose.model("DeliveryAssignment", deliveryAssignmentSchema);

export { DeliveryRequest, DeliveryAssignment };