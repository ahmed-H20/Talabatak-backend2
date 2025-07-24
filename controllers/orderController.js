import asyncHandler from "express-async-handler";
import  {Order}  from "../models/orderModel.js";
import  Product  from "../models/productModel.js";
import mongoose from "mongoose";

// Create orders from cart items
export const createOrdersFromCart = asyncHandler(async (req, res) => {
  const { orderItems, deliveryAddress } = req.body;

  if (!orderItems || orderItems.length === 0) {
    res.status(400);
    throw new Error("No order items provided");
  }

  const groupOrderId = new mongoose.Types.ObjectId();

  const storeMap = new Map();

  for (const item of orderItems) {
    const product = await Product.findById(item.product).populate("store");
    if (!product) throw new Error("Product not found");

    const storeId = product.store._id.toString();

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, []);
    }

    storeMap.get(storeId).push({
      product: product._id,
      quantity: item.quantity,
      price: product.price,
    });
  }

  const orders = [];

  for (const [storeId, items] of storeMap.entries()) {
    const deliveryFee = 20; // ثابت
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0) + deliveryFee;

    const order = new Order({
      user: req.user._id,
      store: storeId,
      orderItems: items,
      deliveryAddress,
      deliveryFee,
      totalPrice,
      groupOrderId,
    });

    await order.save();
    orders.push(order);
  }

  res.status(201).json({ message: "Orders created", orders });
});

// get user's orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).populate("store").sort({ createdAt: -1 });
  res.status(200).json(orders);
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  order.status = status;
  await order.save();

  res.status(200).json({ message: "Order status updated", order });
});

// Update order if "pending"
export const updateOrderIfPending = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { orderItems, deliveryAddress } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  if (order.user.toString() !== req.user._id.toString()) throw new Error("Unauthorized");

  if (order.status !== "pending") throw new Error("Only pending orders can be updated");

  if (orderItems && Array.isArray(orderItems)) {
    const updatedItems = await Promise.all(orderItems.map(async (item) => {
      const product = await Product.findById(item.product);
      if (!product) throw new Error("Product not found");
      return {
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      };
    }));

    const total = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    order.orderItems = updatedItems;
    order.totalPrice = total + order.deliveryFee;
  }

  if (deliveryAddress) order.deliveryAddress = deliveryAddress;

  await order.save();
  res.status(200).json({ message: "Order updated", order });
});

// Cancel order if "pending"
export const cancelOrderIfPending = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new Error("Order not found");

  if (order.user.toString() !== req.user._id.toString()) throw new Error("Unauthorized");

  if (order.status !== "pending") throw new Error("Only pending orders can be cancelled");

  order.status = "cancelled";
  await order.save();

  res.status(200).json({ message: "Order cancelled", order });
});

// Get grouped orders by groupOrderId
export const getGroupedOrders = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const groupedOrders = await Order.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$groupOrderId",
          createdAt: { $first: "$createdAt" },
          orders: { $push: "$$ROOT" },
        },
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({ message: "Grouped orders fetched successfully", data: groupedOrders });
  } catch (err) {
    next(err);
  }
};

