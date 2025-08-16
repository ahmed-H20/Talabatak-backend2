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
      enum: ["pending", "processing", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// علشان نقدر نعمل حساب مسافة
orderSchema.index({ deliveryLocation: "2dsphere" });
orderSchema.index({ storeLocation: "2dsphere" });

export const Order = mongoose.model("Order", orderSchema);
