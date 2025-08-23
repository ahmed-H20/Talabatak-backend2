// orderController.js - Fixed version

import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import { Order } from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { ORDER_NOTIFICATION_TEMPLATE } from "../utils/emailTemplates.js";
import { sendEmail } from "../utils/emails.js";
import { getIO } from "../socket/socket.js";
import Store from "../models/StoreModel.js";
import { addOrderToDeliveryQueue } from '../services/deliveryQueueService.js';

// Update order status - FIXED VERSION
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['pending', 'processing', 'delivered', 'cancelled', 'rejected', 'assigned_to_delivery', 'on_the_way'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ 
      message: "Invalid status. Valid statuses are: " + validStatuses.join(', ') 
    });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  // Check authorization (only admins or the order owner)
  if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Unauthorized to update this order" });
  }

  // Validate status transitions
  const allowedTransitions = {
    'pending': ['processing', 'cancelled', 'rejected'],
    'processing': ['assigned_to_delivery', 'cancelled'],
    'assigned_to_delivery': ['on_the_way', 'cancelled'],
    'on_the_way': ['delivered', 'cancelled'],
    'delivered': [], // Final state
    'cancelled': [], // Final state
    'rejected': [] // Final state
  };

  if (!allowedTransitions[order.status].includes(status)) {
    return res.status(400).json({ 
      message: `Cannot change status from ${order.status} to ${status}` 
    });
  }

  // Update order status
  order.status = status;
  await order.save();

  // Real-time update status via Socket.IO
  try {
    const io = getIO();
    const populatedOrder = await Order.findById(order._id)
      .populate({ path: "user", select: "name phone" })
      .populate({ path: "orderItems.product", select: "name images" })
      .populate({ path: "store", select: "name phone" })
      .populate({ path: "assignedDeliveryPerson", select: "name phone" });

    io.emit("orderStatusUpdated", populatedOrder);
  } catch (socketError) {
    console.error("Socket.IO error:", socketError);
    // Don't fail the request if socket fails
  }

  res.status(200).json({ 
    message: "Order status updated successfully", 
    order: order 
  });
});

// Cancel order - ENHANCED VERSION
export const cancelOrderIfPending = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body; // Optional cancellation reason

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  // Check authorization
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Unauthorized to cancel this order" });
  }

  // Check if order can be cancelled
  const cancellableStatuses = ['pending', 'processing', 'assigned_to_delivery'];
  if (!cancellableStatuses.includes(order.status)) {
    return res.status(400).json({ 
      message: `Cannot cancel order with status: ${order.status}. Only orders with status ${cancellableStatuses.join(', ')} can be cancelled.` 
    });
  }

  // Update order
  order.status = "cancelled";
  if (reason) {
    order.failureReason = reason;
  }
  order.cancelledAt = new Date();
  await order.save();

  // Real-time cancellation via Socket.IO
  try {
    const io = getIO();
    const populatedOrder = await Order.findById(order._id)
      .populate({ path: "user", select: "name phone" })
      .populate({ path: "orderItems.product", select: "name images" })
      .populate({ path: "store", select: "name phone" })
      .populate({ path: "assignedDeliveryPerson", select: "name phone" });

    io.emit("orderStatusUpdated", populatedOrder);
    io.emit("orderCancelled", populatedOrder);
  } catch (socketError) {
    console.error("Socket.IO error:", socketError);
  }

  res.status(200).json({ 
    message: "Order cancelled successfully", 
    order: order 
  });
});

// Update order if "pending" - ENHANCED VERSION
export const updateOrderIfPending = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { orderItems, deliveryAddress, deliveryCoordinates } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  // Check authorization
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Unauthorized to update this order" });
  }

  // Check if order can be updated
  if (order.status !== "pending") {
    return res.status(400).json({ 
      message: `Cannot update order with status: ${order.status}. Only pending orders can be updated.` 
    });
  }

  // Update order items if provided
  if (orderItems && Array.isArray(orderItems)) {
    const updatedItems = await Promise.all(orderItems.map(async (item) => {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product with ID ${item.product} not found`);
      }
      return {
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      };
    }));

    const itemsTotal = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    order.orderItems = updatedItems;
    order.totalPrice = itemsTotal + (order.deliveryFee || 30);
  }

  // Update delivery address if provided
  if (deliveryAddress) {
    order.deliveryAddress = deliveryAddress;
  }

  // Update delivery coordinates if provided
  if (deliveryCoordinates && Array.isArray(deliveryCoordinates) && deliveryCoordinates.length === 2) {
    order.deliveryLocation = {
      type: "Point",
      coordinates: deliveryCoordinates
    };
  }

  order.updatedAt = new Date();
  await order.save();

  // Real-time update via Socket.IO
  try {
    const io = getIO();
    const populatedOrder = await Order.findById(order._id)
      .populate({ path: "user", select: "name phone" })
      .populate({ path: "orderItems.product", select: "name images" })
      .populate({ path: "store", select: "name phone" })
      .populate({ path: "assignedDeliveryPerson", select: "name phone" });

    io.emit("orderUpdated", populatedOrder);
  } catch (socketError) {
    console.error("Socket.IO error:", socketError);
  }

  res.status(200).json({ 
    message: "Order updated successfully", 
    order: order 
  });
});

// Get user's orders - ENHANCED VERSION
export const getMyOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const orders = await Order.find({ user: req.user._id })
    .populate([
      {
        path: 'orderItems.product',
        select: 'name images'
      },
      {
        path: 'store',
        select: 'name location phone'
      },
      {
        path: 'user',
        select: 'name location phone'
      },
      {
        path: 'assignedDeliveryPerson',
        select: 'name phone'
      }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments({ user: req.user._id });

  res.status(200).json({
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Get all orders (Admin function)
export const getOrders = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Fetch orders and populate fields
    const orders = await Order.find()
      .populate('store', 'name location phone')
      .populate('user', 'name location phone')
      .populate({
        path: 'orderItems.product',
        select: 'name images',
        match: { _id: { $ne: null } }
      })
      .populate({
        path: 'assignedDeliveryPerson',
        select: 'name phone'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments();

    // Check for missing products and assign defaults
    if (orders && orders.length) {
      orders.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (!item.product) {
            item.product = { name: 'Product not found', description: '', price: 0 };
          }
        });
      });
    }

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message,
    });
  }
});
export const createOrdersFromCart = async (req, res) => {
  try {
    const { cartItems, deliveryAddress, deliveryCoordinates } = req.body;
    const userId = req.user._id;
    const io = getIO();

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (!deliveryCoordinates || deliveryCoordinates.length !== 2) {
      return res.status(400).json({ message: "Delivery coordinates are required [lng, lat]" });
    }

    const orders = [];
    const storesMap = {};
    
    // Group items by store
    for (const item of cartItems) {
      if (!storesMap[item.store]) {
        storesMap[item.store] = [];
      }
      storesMap[item.store].push(item);
    }

    // Create orders for each store
    for (const storeId of Object.keys(storesMap)) {
      const store = await Store.findById(storeId);
      if (!store) continue;

      const storeLocationGeoJSON = {
        type: "Point",
        coordinates: store.location.coordinates
      };

      const deliveryFee = 30;
      const totalPrice = storesMap[storeId].reduce((sum, i) => sum + i.price * i.quantity, 0) + deliveryFee;

      // Create order with enhanced fields
      const order = new Order({
        user: userId,
        store: storeId,
        orderItems: storesMap[storeId].map(i => ({
          product: i.product,
          quantity: i.quantity,
          price: i.price,
        })),
        deliveryAddress,
        deliveryLocation: {
          type: "Point",
          coordinates: deliveryCoordinates
        },
        storeLocation: storeLocationGeoJSON,
        totalPrice: totalPrice,
        deliveryFee: deliveryFee,
        status: 'pending',
        priority: 0,
        estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000) // 45 minutes
      });

      await order.save();

      // Add to delivery queue for automatic assignment
      await addOrderToDeliveryQueue(order._id);

      const populatedOrder = await Order.findById(order._id)
        .populate({ path: "user", select: "name phone" })
        .populate({ path: "orderItems.product", select: "name images" })
        .populate({ path: "store", select: "name phone" });

      orders.push(populatedOrder);

      // Emit order created event
      io.emit("orderCreated", populatedOrder);

      // Send admin notification emails (existing code)...
    }

    res.status(201).json({ 
      orders,
      message: "Orders created successfully. Delivery assignments in progress."
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};