import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import  {Order}  from "../models/orderModel.js";
import  Product  from "../models/productModel.js";
import User from "../models/userModel.js";
import {ORDER_NOTIFICATION_TEMPLATE} from "../utils/emailTemplates.js";
import { sendEmail } from "../utils/emails.js";
import { getIO } from "../socket/socket.js"; // Import Socket.IO i
import Store from "../models/StoreModel.js"


// Create orders from cart items
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

    // تقسيم الطلبات حسب المتجر
    const storesMap = {};
    for (const item of cartItems) {
      if (!storesMap[item.store]) {
        storesMap[item.store] = [];
      }
      storesMap[item.store].push(item);
    }

    for (const storeId of Object.keys(storesMap)) {
      const store = await Store.findById(storeId);
      if (!store) continue;

      const storeLocationGeoJSON = {
        type: "Point",
        coordinates: store.location.coordinates
      };

      const deliveryFee = 30
      const totalPrice = storesMap[storeId].reduce((sum, i) => sum + i.price * i.quantity, 30) +
        deliveryFee;

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
          coordinates: deliveryCoordinates // [lng, lat]
        },

        storeLocation: storeLocationGeoJSON,
        totalPrice: storesMap[storeId].reduce((sum, i) => sum + i.price * i.quantity, 30)
      });

      await order.save();

      const populatedOrder = await Order.findById(order._id)
        .populate({ path: "user", select : "name phone"})
        .populate({ path: "orderItems.product", select: "name images" })
        .populate({ path: "store", select: "name phone " });

      orders.push(populatedOrder);

      io.emit("orderCreated", populatedOrder);

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
      .replace("{deliveryFee}", 30)
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

      

    
  }

     
    res.status(201).json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


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
  const populatedOrder = await Order.findById(order._id)
  .populate({ path: "user", select : "name phone"})
  .populate({ path: "orderItems.product", select: "name images" })
  .populate({ path: "store", select: "name phone" });
  io.emit("orderStatusUpdated", populatedOrder);

 
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
  const populatedOrder = await Order.findById(order._id)
  .populate({ path: "user", select : "name phone"})
  .populate({ path: "orderItems.product", select: "name images" })
  .populate({ path: "store", select: "name phone" });
  io.emit("orderUpdated", populatedOrder);

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
