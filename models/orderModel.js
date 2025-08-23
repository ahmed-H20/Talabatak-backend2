// Enhanced orderModel.js with timeout and assignment tracking
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    orderItems: [orderItemSchema],

    // عنوان العميل وإحداثياته وقت الطلب
    deliveryAddress: {
      type: String,
      required: true,
    },
    deliveryLocation: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    // إحداثيات المتجر وقت الطلب (snapshot)
    storeLocation: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    deliveryFee: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    appliedCoupon: String,
    subtotal: Number,
    discountAmount: { type: Number, default: 0 },
    groupOrderId: String,
    
    status: {
      type: String,
      enum: [
        "pending", 
        "processing", 
        "ready_for_pickup",
        "assigned_to_delivery",
        "picked_up",
        "on_the_way",
        "delivered", 
        "cancelled",
        "delivery_failed"  // New status for failed deliveries
      ],
      default: "pending",
    },

    // Enhanced delivery tracking fields
    assignedDeliveryPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: Date,
    
    // Timeout and retry mechanism
    priority: {
      type: Number,
      default: 0,
      index: true
    },
    timeoutCount: {
      type: Number,
      default: 0
    },
    lastTimeoutAt: Date,
    
    // Failure tracking
    failureReason: String,
    failedAt: Date,
    
    // Delivery estimates
    estimatedDeliveryTime: Date,
    
    // Customer communication
    specialInstructions: String,
    customerNotes: String,
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
orderSchema.index({ deliveryLocation: "2dsphere" });
orderSchema.index({ storeLocation: "2dsphere" });
orderSchema.index({ status: 1, priority: -1, createdAt: 1 });
orderSchema.index({ assignedDeliveryPerson: 1 });
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ store: 1, status: 1 });

// Compound index for finding available orders efficiently
orderSchema.index({ 
  status: 1, 
  assignedDeliveryPerson: 1, 
  priority: -1, 
  createdAt: 1 
});

// Virtual for calculating waiting time
orderSchema.virtual('waitingTimeMinutes').get(function() {
  if (this.status === 'delivered' || this.status === 'cancelled') {
    return null;
  }
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for urgency level
orderSchema.virtual('urgencyLevel').get(function() {
  const waiting = this.waitingTimeMinutes;
  const timeouts = this.timeoutCount || 0;
  
  if (timeouts > 2 || waiting > 60) return 'critical';
  if (timeouts > 0 || waiting > 30) return 'high';
  if (waiting > 15) return 'medium';
  return 'normal';
});

// Instance method to check if order can be assigned
orderSchema.methods.canBeAssigned = function() {
  return [
    'pending', 
    'processing', 
    'ready_for_pickup'
  ].includes(this.status) && !this.assignedDeliveryPerson;
};

// Instance method to check if order is overdue
orderSchema.methods.isOverdue = function() {
  if (!this.estimatedDeliveryTime) return false;
  return Date.now() > this.estimatedDeliveryTime.getTime();
};

// Static method to find orders needing attention
orderSchema.statics.findOrdersNeedingAttention = function() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  return this.find({
    status: { $in: ['pending', 'processing', 'ready_for_pickup'] },
    assignedDeliveryPerson: { $exists: false },
    createdAt: { $lt: thirtyMinutesAgo }
  }).sort({ priority: -1, createdAt: 1 });
};

// Static method to get delivery statistics
orderSchema.statics.getDeliveryStats = function(startDate, endDate) {
  const matchStage = {
    createdAt: { $gte: startDate }
  };
  
  if (endDate) {
    matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        failedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivery_failed'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        averageTimeouts: { $avg: '$timeoutCount' },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$totalPrice', 0] }
        },
        averageDeliveryTime: {
          $avg: {
            $cond: [
              { $and: ['$assignedAt', '$deliveredAt'] },
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

// Pre-save middleware to update priority based on waiting time
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set initial estimated delivery time
    this.estimatedDeliveryTime = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes
  }
  
  // Auto-increase priority for orders waiting too long
  if (!this.assignedDeliveryPerson) {
    const waitingTime = Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
    if (waitingTime > 30 && this.priority < 2) {
      this.priority = 2;
    } else if (waitingTime > 15 && this.priority < 1) {
      this.priority = 1;
    }
  }
  
  next();
});

export const Order = mongoose.model("Order", orderSchema);