import mongoose from "mongoose";

const orderItemSchema = mongoose.Schema(
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

const orderSchema = mongoose.Schema(
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
    deliveryAddress: {
      type: String,
      required: true,
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
    groupOrderId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
