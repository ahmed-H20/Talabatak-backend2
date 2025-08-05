import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import  {Order}  from "../models/orderModel.js";
import  Product  from "../models/productModel.js";
import User from "../models/userModel.js";
import {ORDER_NOTIFICATION_TEMPLATE} from "../utils/emailTemplates.js";
import { sendEmail } from "../utils/emails.js";
import { getIO } from "../socket/socket.js"; // Import Socket.IO instance

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
  const io = getIO();

  for (const [storeId, items] of storeMap.entries()) {
    const deliveryFee = 30;
    const totalPrice =
      items.reduce((sum, item) => sum + item.price * item.quantity, 0) +
      deliveryFee;

    const order = new Order({
      user: req.user,
      store: storeId,
      orderItems: items,
      deliveryAddress,
      deliveryFee,
      totalPrice,
      groupOrderId,
    });

    await order.save();
    orders.push(order);
    const populatedOrder = await Order.findById(order._id).populate([
      { path: "orderItems.product", select: "name" },
      { path: "store", select: "name" },
    ]);

    const orderItemsHtml = populatedOrder.orderItems
      .map(
        (item) => `
        <div class="order-item">
          <p>🛒 <strong>Product:</strong> ${item.product?.name || "Unknown"}</p>
          <p>📦 <strong>Quantity:</strong> ${item.quantity}</p>
          <p>💰 <strong>Price:</strong> ${item.price} EGP</p>
        </div>
      `
      )
      .join("");

    const emailHtml = ORDER_NOTIFICATION_TEMPLATE
      .replace("{customerName}", req.user.name)
      .replace("{orderId}", order._id)
      .replace("{storeName}", populatedOrder.store.name)
      .replace("{deliveryAddress}", deliveryAddress)
      .replace("{orderItems}", orderItemsHtml)
      .replace("{deliveryFee}", deliveryFee)
      .replace("{totalPrice}", totalPrice);

      const admins = await User.find({ role: "admin", email: { $exists: true, $ne: "" } });

      for (const admin of admins) {
        const adminEmail = admin.email;
        console.log("Sending to admin:", adminEmail);
      
        try {
          await sendEmail({
            to: adminEmail,
            subject: "New Order Received",
            html: emailHtml,
          });
        } catch (error) {
          console.error("Error sending to admin:", adminEmail, error.message);
        }
      }

    io.emit("orderCreated", order);
  }
  res.status(201).json({ message: "Orders created", orders });
});


// get user's orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).
  populate([{
    path: 'orderItems.product',
    select: 'name images', // Select the specific fields you need, including `name
  },
  {
    path: 'store',
    select: 'name location ' // Populate the `store` field, only fetching `
  }
  , {path: 'user',
    select: 'name location phone' // Populate the `user` field
  }
]).
  sort({ createdAt: -1 });
  res.status(200).json(orders);
});

// get orders
// get orders with product name
export const getOrders = asyncHandler(async (req, res) => {
  try {
    // Fetch orders and populate `store` and `user` fields
    const orders = await Order.find()
      .populate('store', 'name location ') // Populate the `store` field, only fetching `name`
      .populate('user', 'name location phone') // Populate the `user` field, fetching `name` and `email`
      .populate({
        path: 'orderItems.product', // Populate the product details for each item
        select: 'name images', // Select the specific fields you need, including `name`
        match: { _id: { $ne: null } } // Ensure the product exists
      })
      .sort({ createdAt: -1 }); // Sort orders by creation date, most recent first

    // Check if any product is missing and assign a default if necessary
    if (orders && orders.length) {
      orders.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (!item.product) {
            item.product = { name: 'Product not found', description: '', price: 0 };
          }
        });
      });
    }

    // Return the orders
    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message,
    });
  }
});


// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  order.status = status;
  await order.save();

  // Real-time update status via Socket.IO
  const io = getIO();
  io.emit("orderStatusUpdated", order);

 
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

  // Real-time update via Socket.IO
  const io = getIO();
  io.emit("orderUpdated", order);

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

  // Real-time cancellation via Socket.IO
  const io = getIO();
  io.emit("orderCancelled", order);

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


//----------------------------------
// SOCKET.IO HANDLERS
// ----------------------------------
// import {
//   emitOrderCreated,
//   emitOrderUpdated,
//   emitOrderCancelled,
//     getIO
// } from "../socket/socket.js";

// // Create Order
// export const createOrder = async (req, res, next) => {
//   const order = await Order.create(req.body);
//   emitOrderCreated(order); // 🔔 Real-time event
//   res.status(201).json({ data: order });
// };

// // Update Order
// export const updateOrder = async (req, res, next) => {
//   const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//   });
//   if (!order) return next(new apiError("Order not found", 404));

//   emitOrderUpdated(order); // 🔔
//   res.status(200).json({ data: order });
// };

// // Cancel Order
// export const cancelOrder = async (req, res, next) => {
//   const order = await Order.findByIdAndDelete(req.params.id);
//   if (!order) return next(new apiError("Order not found", 404));

//   emitOrderCancelled(order._id); // 🔔
//   res.status(200).json({ message: "Order cancelled", data: order });
// };
