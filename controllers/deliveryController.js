// controllers/deliveryController.js
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import { Order } from '../models/orderModel.js';
import { DeliveryRequest, DeliveryAssignment } from '../models/deliveryModel.js';
import { getIO } from '../socket/socket.js';
import { sendEmail } from '../utils/emails.js';

// @desc    Register as delivery person
// @route   POST /api/delivery/register
// @access  Private
export const registerDeliveryPerson = asyncHandler(async (req, res) => {
  const { fullName, nationalId, workingCity, coordinates, phone } = req.body;
  const userId = req.user._id;

  // Get ID card image from uploaded files
  const idCardImage = req.files?.idCardImage?.[0]?.path || req.body.idCardImage;
  
  if (!idCardImage) {
    return res.status(400).json({
      message: 'صورة بطاقة الهوية مطلوبة'
    });
  }

  // Check if user already has a delivery application
  const existingApplication = await DeliveryRequest.findOne({ user: userId });
  if (existingApplication) {
    return res.status(400).json({
      message: 'لديك طلب توصيل مسجل بالفعل',
      status: existingApplication.status
    });
  }

  // Check if national ID is already used
  const existingNationalId = await DeliveryRequest.findOne({ nationalId });
  if (existingNationalId) {
    return res.status(400).json({
      message: 'رقم الهوية الوطنية مستخدم بالفعل'
    });
  }

  // Create delivery request
  const deliveryRequest = new DeliveryRequest({
    user: userId,
    fullName,
    nationalId,
    idCardImage,
    phone,
    workingCity,
    ...(coordinates && {
      location: {
        type: 'Point',
        coordinates: coordinates // [longitude, latitude]
      }
    })
  });

  await deliveryRequest.save();

  // Update user location if coordinates provided
  if (coordinates) {
    await User.findByIdAndUpdate(userId, {
      geoLocation: {
        type: 'Point',
        coordinates: coordinates
      }
    });
  }

  // Notify admins about new delivery application
  const admins = await User.find({ role: 'admin' });
  const io = getIO();
  
  admins.forEach(admin => {
    io.to(`user_${admin._id}`).emit('newDeliveryApplication', {
      applicationId: deliveryRequest._id,
      applicantName: fullName,
      workingCity,
      message: `طلب توصيل جديد من ${fullName} في ${workingCity}`
    });
  });

  res.status(201).json({
    message: 'تم تقديم طلب التوصيل بنجاح، سيتم مراجعته من قبل الإدارة',
    application: {
      id: deliveryRequest._id,
      fullName: deliveryRequest.fullName,
      status: deliveryRequest.status,
      workingCity: deliveryRequest.workingCity,
      createdAt: deliveryRequest.createdAt
    }
  });
});

// @desc    Get all delivery applications (Admin only)
// @route   GET /api/delivery/applications
// @access  Private (Admin)
export const getDeliveryApplications = asyncHandler(async (req, res) => {
  const { status = 'all', page = 1, limit = 10 } = req.query;
  
  const filter = {};
  if (status !== 'all') {
    filter.status = status;
  }

  const applications = await DeliveryRequest.find(filter)
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await DeliveryRequest.countDocuments(filter);

  res.status(200).json({
    applications,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total
  });
});

// @desc    Approve delivery application
// @route   PATCH /api/delivery/approve/:id
// @access  Private (Admin)
export const approveDeliveryApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user._id;

  const deliveryRequest = await DeliveryRequest.findById(id).populate('user');
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'طلب التوصيل غير موجود' });
  }

  if (deliveryRequest.status !== 'pending') {
    return res.status(400).json({ 
      message: `لا يمكن الموافقة على هذا الطلب، الحالة الحالية: ${deliveryRequest.status}` 
    });
  }

  // Update delivery request status
  deliveryRequest.status = 'approved';
  deliveryRequest.approvedBy = adminId;
  deliveryRequest.approvedAt = new Date();
  await deliveryRequest.save();

  // Update user to delivery role
  const user = deliveryRequest.user;
  await User.findByIdAndUpdate(user._id, {
    role: 'delivery',
    deliveryStatus: 'approved',
    deliveryInfo: {
      fullName: deliveryRequest.fullName,
      nationalId: deliveryRequest.nationalId,
      idCardImage: deliveryRequest.idCardImage,
      workingCity: deliveryRequest.workingCity,
      isAvailable: true,
      rating: 5,
      totalDeliveries: 0,
      approvedBy: adminId,
      approvedAt: new Date()
    }
  });

  // Send notification to delivery person
  const io = getIO();
  io.to(`user_${user._id}`).emit('deliveryApplicationApproved', {
    message: 'تم الموافقة على طلب التوصيل الخاص بك',
    status: 'approved'
  });

  // Send email notification if email exists
  if (user.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: 'تم الموافقة على طلب التوصيل',
        html: `
          <h2>مبروك! تم الموافقة على طلبك</h2>
          <p>عزيزي ${deliveryRequest.fullName},</p>
          <p>يسعدنا إبلاغك بأنه تم الموافقة على طلب انضمامك كمندوب توصيل.</p>
          <p>يمكنك الآن تسجيل الدخول والبدء في استقبال طلبات التوصيل.</p>
          <p>مع تحيات فريق الإدارة</p>
        `
      });
    } catch (error) {
      console.error('Error sending approval email:', error);
    }
  }

  res.status(200).json({
    message: 'تم الموافقة على طلب التوصيل بنجاح',
    application: {
      id: deliveryRequest._id,
      fullName: deliveryRequest.fullName,
      status: deliveryRequest.status,
      approvedAt: deliveryRequest.approvedAt
    }
  });
});

// @desc    Reject delivery application
// @route   PATCH /api/delivery/reject/:id
// @access  Private (Admin)
export const rejectDeliveryApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  const deliveryRequest = await DeliveryRequest.findById(id).populate('user');
  if (!deliveryRequest) {
    return res.status(404).json({ message: 'طلب التوصيل غير موجود' });
  }

  if (deliveryRequest.status !== 'pending') {
    return res.status(400).json({ 
      message: `لا يمكن رفض هذا الطلب، الحالة الحالية: ${deliveryRequest.status}` 
    });
  }

  // Update delivery request status
  deliveryRequest.status = 'rejected';
  deliveryRequest.rejectedAt = new Date();
  deliveryRequest.rejectionReason = reason;
  await deliveryRequest.save();

  const user = deliveryRequest.user;

  // Send notification to delivery person
  const io = getIO();
  io.to(`user_${user._id}`).emit('deliveryApplicationRejected', {
    message: 'تم رفض طلب التوصيل الخاص بك',
    reason,
    status: 'rejected'
  });

  // Send email notification if email exists
  if (user.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: 'تم رفض طلب التوصيل',
        html: `
          <h2>نأسف لإبلاغك برفض طلبك</h2>
          <p>عزيزي ${deliveryRequest.fullName},</p>
          <p>نأسف لإبلاغك بأنه تم رفض طلب انضمامك كمندوب توصيل.</p>
          ${reason ? `<p><strong>السبب:</strong> ${reason}</p>` : ''}
          <p>يمكنك إعادة التقديم مرة أخرى بعد معالجة الأسباب المذكورة أعلاه.</p>
          <p>مع تحيات فريق الإدارة</p>
        `
      });
    } catch (error) {
      console.error('Error sending rejection email:', error);
    }
  }

  res.status(200).json({
    message: 'تم رفض طلب التوصيل',
    application: {
      id: deliveryRequest._id,
      fullName: deliveryRequest.fullName,
      status: deliveryRequest.status,
      rejectionReason: reason,
      rejectedAt: deliveryRequest.rejectedAt
    }
  });
});

// @desc    Get available orders for delivery person
// @route   GET /api/delivery/available-orders
// @access  Private (Delivery)
export const getAvailableOrders = asyncHandler(async (req, res) => {
  const deliveryPersonId = req.user._id;
  const { page = 1, limit = 10, maxDistance = 10000 } = req.query;

  // Check if delivery person is approved
  const deliveryPerson = await User.findById(deliveryPersonId);
  if (deliveryPerson.role !== 'delivery' || deliveryPerson.deliveryStatus !== 'approved') {
    return res.status(403).json({ 
      message: 'غير مصرح لك بعرض الطلبات، يجب الموافقة على طلب التوصيل أولاً' 
    });
  }

  // Check if delivery person is available
  if (!deliveryPerson.deliveryInfo?.isAvailable) {
    return res.status(400).json({ 
      message: 'يجب تفعيل حالة الإتاحة لعرض الطلبات المتاحة' 
    });
  }

  let availableOrders;

  // Find orders that are ready for delivery and not assigned to anyone
  const baseFilter = {
    status: { $in: ['ready_for_pickup', 'processing'] }
  };

  // Check if order is not already assigned
  const assignedOrderIds = await DeliveryAssignment.find({
    status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
  }).distinct('order');

  baseFilter._id = { $nin: assignedOrderIds };

  if (deliveryPerson.geoLocation && deliveryPerson.geoLocation.coordinates) {
    // Find orders near delivery person location using geospatial query
    availableOrders = await Order.find({
      ...baseFilter,
      'store.location': {
        $near: {
          $geometry: deliveryPerson.geoLocation,
          $maxDistance: maxDistance
        }
      }
    })
    .populate([
      { path: 'user', select: 'name phone location city' },
      { path: 'store', select: 'name location phone city' },
      { path: 'orderItems.product', select: 'name images' }
    ])
    .sort({ priority: -1, createdAt: 1 });
  } else {
    // Fallback: find orders in the same city
    availableOrders = await Order.find(baseFilter)
    .populate([
      { path: 'user', select: 'name phone location city' },
      { path: 'store', select: 'name location phone city' },
      { path: 'orderItems.product', select: 'name images' }
    ])
    .sort({ priority: -1, createdAt: 1 });

    // Filter by city if available
    if (deliveryPerson.deliveryInfo?.workingCity) {
      availableOrders = availableOrders.filter(order => 
        order.store?.city === deliveryPerson.deliveryInfo.workingCity ||
        order.user?.city === deliveryPerson.deliveryInfo.workingCity
      );
    }
  }

  // Implement pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedOrders = availableOrders.slice(startIndex, endIndex);

  res.status(200).json({
    orders: paginatedOrders,
    totalOrders: availableOrders.length,
    totalPages: Math.ceil(availableOrders.length / limit),
    currentPage: parseInt(page),
    hasMore: endIndex < availableOrders.length
  });
});

// @desc    Accept delivery order
// @route   PATCH /api/delivery/accept-order/:orderId
// @access  Private (Delivery)
export const acceptDeliveryOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const deliveryPersonId = req.user._id;

  // Check if delivery person is approved
  const deliveryPerson = await User.findById(deliveryPersonId);
  if (deliveryPerson.role !== 'delivery' || deliveryPerson.deliveryStatus !== 'approved') {
    return res.status(403).json({ message: 'غير مصرح لك بقبول الطلبات' });
  }

  const order = await Order.findById(orderId)
    .populate('user', 'name phone')
    .populate('store', 'name phone location');
    
  if (!order) {
    return res.status(404).json({ message: 'الطلب غير موجود' });
  }

  // Check if order is already assigned
  const existingAssignment = await DeliveryAssignment.findOne({ order: orderId });
  if (existingAssignment) {
    return res.status(400).json({ message: 'هذا الطلب مخصص لمندوب آخر بالفعل' });
  }

  if (!['ready_for_pickup', 'processing'].includes(order.status)) {
    return res.status(400).json({ message: 'هذا الطلب غير متاح للتوصيل' });
  }

  // Create delivery assignment
  const deliveryAssignment = new DeliveryAssignment({
    order: orderId,
    deliveryPerson: deliveryPersonId,
    status: 'accepted',
    acceptedAt: new Date()
  });

  await deliveryAssignment.save();

  // Update order status
  order.status = 'assigned_to_delivery';
  await order.save();

  // Notify customer and admin
  const io = getIO();
  io.to(`user_${order.user._id}`).emit('orderAssignedToDelivery', {
    orderId: order._id,
    deliveryPerson: {
      name: deliveryPerson.name,
      phone: deliveryPerson.phone
    },
    message: 'تم تخصيص طلبك لمندوب التوصيل'
  });

  // Notify admins
  const admins = await User.find({ role: 'admin' });
  admins.forEach(admin => {
    io.to(`user_${admin._id}`).emit('orderAcceptedByDelivery', {
      orderId: order._id,
      deliveryPersonName: deliveryPerson.name,
      customerName: order.user.name
    });
  });

  res.status(200).json({
    message: 'تم قبول الطلب بنجاح',
    order: {
      id: order._id,
      status: order.status,
      customer: order.user.name,
      store: order.store.name,
      totalPrice: order.totalPrice,
      deliveryAddress: order.deliveryAddress,
      assignedAt: deliveryAssignment.assignedAt
    }
  });
});

// @desc    Update delivery status
// @route   PATCH /api/delivery/update-status/:orderId
// @access  Private (Delivery)
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, notes } = req.body;
  const deliveryPersonId = req.user._id;

  const order = await Order.findById(orderId)
    .populate('user', 'name phone')
    .populate('store', 'name phone');

  if (!order) {
    return res.status(404).json({ message: 'الطلب غير موجود' });
  }

  // Find delivery assignment
  const deliveryAssignment = await DeliveryAssignment.findOne({
    order: orderId,
    deliveryPerson: deliveryPersonId
  });

  if (!deliveryAssignment) {
    return res.status(403).json({ message: 'هذا الطلب غير مخصص لك' });
  }

  // Update delivery assignment status
  deliveryAssignment.status = status;
  deliveryAssignment.deliveryNotes = notes;

  // Set timestamps based on status
  switch (status) {
    case 'picked_up':
      deliveryAssignment.pickedUpAt = new Date();
      order.status = 'picked_up';
      break;
    case 'on_the_way':
      order.status = 'on_the_way';
      break;
    case 'delivered':
      deliveryAssignment.deliveredAt = new Date();
      deliveryAssignment.actualDeliveryTime = new Date();
      order.status = 'delivered';
      
      // Update delivery person's total deliveries
      await User.findByIdAndUpdate(deliveryPersonId, {
        $inc: { 'deliveryInfo.totalDeliveries': 1 }
      });
      break;
  }

  await deliveryAssignment.save();
  await order.save();

  // Send real-time notifications
  const io = getIO();
  const statusMessages = {
    accepted: 'قبل مندوب التوصيل طلبك',
    picked_up: 'تم استلام طلبك من المتجر',
    on_the_way: 'مندوب التوصيل في الطريق إليك',
    delivered: 'تم تسليم طلبك بنجاح'
  };

  // Notify customer
  io.to(`user_${order.user._id}`).emit('deliveryStatusUpdated', {
    orderId: order._id,
    status: order.status,
    message: statusMessages[status] || 'تم تحديث حالة التوصيل',
    deliveryPerson: req.user.name,
    notes
  });

  // Notify admins
  const admins = await User.find({ role: 'admin' });
  admins.forEach(admin => {
    io.to(`user_${admin._id}`).emit('deliveryStatusUpdated', {
      orderId: order._id,
      status: order.status,
      deliveryPersonName: req.user.name,
      customerName: order.user.name
    });
  });

  res.status(200).json({
    message: 'تم تحديث حالة التوصيل بنجاح',
    order: {
      id: order._id,
      status: order.status,
      deliveryStatus: status,
      updatedAt: new Date(),
      notes
    }
  });
});

// @desc    Get delivery person's assigned orders
// @route   GET /api/delivery/my-orders
// @access  Private (Delivery)
export const getMyDeliveryOrders = asyncHandler(async (req, res) => {
  const deliveryPersonId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const filter = {
    deliveryPerson: deliveryPersonId
  };

  if (status) {
    filter.status = status;
  }

  const assignments = await DeliveryAssignment.find(filter)
    .populate({
      path: 'order',
      populate: [
        { path: 'user', select: 'name phone location' },
        { path: 'store', select: 'name location phone' },
        { path: 'orderItems.product', select: 'name images' }
      ]
    })
    .sort({ assignedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await DeliveryAssignment.countDocuments(filter);

  res.status(200).json({
    assignments,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total
  });
});

// @desc    Toggle delivery person availability
// @route   PATCH /api/delivery/toggle-availability
// @access  Private (Delivery)
export const toggleAvailability = asyncHandler(async (req, res) => {
  const deliveryPersonId = req.user._id;
  const { isAvailable } = req.body;

  const deliveryPerson = await User.findByIdAndUpdate(
    deliveryPersonId,
    { 'deliveryInfo.isAvailable': isAvailable },
    { new: true }
  );

  res.status(200).json({
    message: `تم ${isAvailable ? 'تفعيل' : 'إيقاف'} حالة الإتاحة`,
    isAvailable: deliveryPerson.deliveryInfo.isAvailable
  });
});

// @desc    Get delivery statistics
// @route   GET /api/delivery/stats
// @access  Private (Delivery)
export const getDeliveryStats = asyncHandler(async (req, res) => {
  const deliveryPersonId = req.user._id;
  const { period = 'week' } = req.query;

  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  // Get delivery statistics
  const stats = await DeliveryAssignment.aggregate([
    {
      $match: {
        deliveryPerson: deliveryPersonId,
        assignedAt: { $gte: startDate }
      }
    },
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'orderDetails'
      }
    },
    {
      $unwind: '$orderDetails'
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        totalEarnings: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$orderDetails.deliveryFee', 0] }
        },
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

  const deliveryPerson = await User.findById(deliveryPersonId).select('deliveryInfo');

  res.status(200).json({
    period,
    stats: stats[0] || {
      totalOrders: 0,
      deliveredOrders: 0,
      totalEarnings: 0,
      averageDeliveryTime: 0
    },
    overallStats: {
      totalDeliveries: deliveryPerson.deliveryInfo?.totalDeliveries || 0,
      rating: deliveryPerson.deliveryInfo?.rating || 5,
      isAvailable: deliveryPerson.deliveryInfo?.isAvailable || false
    }
  });
});

// @desc    Rate delivery by customer (called from order completion)
// @route   PATCH /api/delivery/rate/:orderId
// @access  Private (Customer)
export const rateDelivery = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { rating, feedback } = req.body;
  const customerId = req.user._id;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'الطلب غير موجود' });
  }

  if (order.user.toString() !== customerId.toString()) {
    return res.status(403).json({ message: 'غير مصرح لك بتقييم هذا الطلب' });
  }

  if (order.status !== 'delivered') {
    return res.status(400).json({ message: 'لا يمكن تقييم طلب غير مكتمل' });
  }

  // Find delivery assignment
  const deliveryAssignment = await DeliveryAssignment.findOne({ order: orderId });
  if (!deliveryAssignment) {
    return res.status(404).json({ message: 'تفاصيل التوصيل غير موجودة' });
  }

  if (deliveryAssignment.customerRating) {
    return res.status(400).json({ message: 'تم تقييم هذا الطلب بالفعل' });
  }

  // Update delivery assignment rating
  deliveryAssignment.customerRating = rating;
  deliveryAssignment.customerFeedback = feedback;
  await deliveryAssignment.save();

  // Update delivery person's overall rating
  const deliveryPersonId = deliveryAssignment.deliveryPerson;
  const ratedAssignments = await DeliveryAssignment.find({
    deliveryPerson: deliveryPersonId,
    customerRating: { $exists: true }
  });

  const totalRatings = ratedAssignments.reduce((sum, assignment) => sum + assignment.customerRating, 0);
  const averageRating = totalRatings / ratedAssignments.length;

  await User.findByIdAndUpdate(deliveryPersonId, {
    'deliveryInfo.rating': Math.round(averageRating * 10) / 10
  });

  res.status(200).json({
    message: 'تم تقييم مندوب التوصيل بنجاح',
    rating,
    feedback
  });
});

// @desc    Update delivery person location
// @route   PATCH /api/delivery/update-location
// @access  Private (Delivery)
export const updateDeliveryLocation = asyncHandler(async (req, res) => {
  const { coordinates, accuracy } = req.body;
  const deliveryPersonId = req.user._id;

  await User.findByIdAndUpdate(deliveryPersonId, {
    geoLocation: {
      type: 'Point',
      coordinates: coordinates // [longitude, latitude]
    },
    'deliveryInfo.lastLocationUpdate': new Date(),
    'deliveryInfo.locationAccuracy': accuracy
  });

  res.status(200).json({ message: 'تم تحديث الموقع بنجاح' });
});