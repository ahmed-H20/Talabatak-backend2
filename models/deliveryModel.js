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
    trim: true,
  },
  nationalId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  idCardImage: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  workingCity: {
    type: String,
    required: true,
    trim: true,
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
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create geo index for location-based queries
deliveryRequestSchema.index({ location: '2dsphere' });
deliveryRequestSchema.index({ user: 1 });
deliveryRequestSchema.index({ status: 1 });

// Virtual for calculating days since application
deliveryRequestSchema.virtual('daysSinceApplication').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Instance method to check if application is pending
deliveryRequestSchema.methods.isPending = function() {
  return this.status === 'pending';
};

// Instance method to check if application is approved
deliveryRequestSchema.methods.isApproved = function() {
  return this.status === 'approved';
};

// Static method to find applications by status
deliveryRequestSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Static method to find pending applications older than X days
deliveryRequestSchema.statics.findOldPendingApplications = function(days = 7) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    status: 'pending',
    createdAt: { $lte: cutoffDate }
  });
};

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
  // Additional tracking fields
  cancelledAt: Date,
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for better query performance
deliveryAssignmentSchema.index({ order: 1 });
deliveryAssignmentSchema.index({ deliveryPerson: 1 });
deliveryAssignmentSchema.index({ status: 1 });
deliveryAssignmentSchema.index({ assignedAt: -1 });
deliveryAssignmentSchema.index({ deliveryPerson: 1, status: 1 });

// Virtual for calculating delivery duration in minutes
deliveryAssignmentSchema.virtual('deliveryDurationMinutes').get(function() {
  if (this.deliveredAt && this.assignedAt) {
    return Math.floor((this.deliveredAt - this.assignedAt) / (1000 * 60));
  }
  return null;
});

// Virtual for calculating pickup duration in minutes
deliveryAssignmentSchema.virtual('pickupDurationMinutes').get(function() {
  if (this.pickedUpAt && this.assignedAt) {
    return Math.floor((this.pickedUpAt - this.assignedAt) / (1000 * 60));
  }
  return null;
});

// Instance method to check if delivery is in progress
deliveryAssignmentSchema.methods.isInProgress = function() {
  return ['assigned', 'accepted', 'picked_up', 'on_the_way'].includes(this.status);
};

// Instance method to check if delivery is completed
deliveryAssignmentSchema.methods.isCompleted = function() {
  return this.status === 'delivered';
};

// Instance method to update status with timestamp
deliveryAssignmentSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  switch (newStatus) {
    case 'accepted':
      this.acceptedAt = new Date();
      break;
    case 'picked_up':
      this.pickedUpAt = new Date();
      break;
    case 'delivered':
      this.deliveredAt = new Date();
      this.actualDeliveryTime = new Date();
      break;
    case 'cancelled':
      this.cancelledAt = new Date();
      break;
  }
  
  return this.save();
};

// Static method to find assignments by delivery person
deliveryAssignmentSchema.statics.findByDeliveryPerson = function(deliveryPersonId) {
  return this.find({ deliveryPerson: deliveryPersonId }).populate('order');
};

// Static method to find active assignments for a delivery person
deliveryAssignmentSchema.statics.findActiveByDeliveryPerson = function(deliveryPersonId) {
  return this.find({
    deliveryPerson: deliveryPersonId,
    status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
  }).populate('order');
};

// Static method to get delivery statistics for a person
deliveryAssignmentSchema.statics.getDeliveryStats = function(deliveryPersonId, startDate, endDate) {
  const matchStage = {
    deliveryPerson: deliveryPersonId,
    assignedAt: { $gte: startDate }
  };
  
  if (endDate) {
    matchStage.assignedAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'orderDetails'
      }
    },
    { $unwind: '$orderDetails' },
    {
      $group: {
        _id: null,
        totalAssignments: { $sum: 1 },
        completedDeliveries: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledDeliveries: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        totalEarnings: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$orderDetails.deliveryFee', 0] }
        },
        averageRating: { $avg: '$customerRating' },
        averageDeliveryTime: {
          $avg: {
            $cond: [
              { $and: ['$deliveredAt', '$assignedAt'] },
              {
                $divide: [
                  { $subtract: ['$deliveredAt', '$assignedAt'] },
                  1000 * 60 // Convert to minutes
                ]
              },
              null
            ]
          }
        }
      }
    }
  ]);
};

// Pre-save middleware to ensure only one active assignment per order
deliveryAssignmentSchema.pre('save', async function(next) {
  if (this.isNew && ['assigned', 'accepted'].includes(this.status)) {
    const existingAssignment = await this.constructor.findOne({
      order: this.order,
      status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
    });
    
    if (existingAssignment) {
      const error = new Error('Order is already assigned to another delivery person');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

const DeliveryAssignment = mongoose.model("DeliveryAssignment", deliveryAssignmentSchema);

export { DeliveryRequest, DeliveryAssignment };