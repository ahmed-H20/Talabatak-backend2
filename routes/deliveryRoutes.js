// // routes/deliveryRoutes.js
// import express from 'express';
// import {
//   registerDeliveryPerson,
//   getDeliveryApplications,
//   approveDeliveryApplication,
//   rejectDeliveryApplication,
//   getAvailableOrders,
//   acceptDeliveryOrder,
//   updateDeliveryStatus,
//   getMyDeliveryOrders,
//   toggleAvailability,
//   getDeliveryStats,
//   rateDelivery
// } from '../controllers/deliveryController.js';
// import { protectRoute } from '../middlewares/protectRoute.js';
// import authorizeRoles from '../middlewares/authorizeRoles.js';
// import { uploadProductImages } from '../middlewares/uploadImages.js';
// import { updateDeliveryLocation } from '../controllers/deliveryController.js';

// const router = express.Router();

// // Public routes (protected by auth but no role restriction)
// router.post('/register',uploadProductImages, registerDeliveryPerson);

// // Admin only routes
// router.get('/applications', protectRoute, authorizeRoles('admin'), getDeliveryApplications);
// router.patch('/approve/:id', protectRoute, authorizeRoles('admin'), approveDeliveryApplication);
// router.patch('/reject/:id', protectRoute, authorizeRoles('admin'), rejectDeliveryApplication);

// // Delivery person routes
// router.get('/available-orders', protectRoute, authorizeRoles('delivery'), getAvailableOrders);
// router.patch('/accept-order/:orderId', protectRoute, authorizeRoles('delivery'), acceptDeliveryOrder);
// router.patch('/update-status/:orderId', protectRoute, authorizeRoles('delivery'), updateDeliveryStatus);
// router.get('/my-orders', protectRoute, authorizeRoles('delivery'), getMyDeliveryOrders);
// router.patch('/toggle-availability', protectRoute, authorizeRoles('delivery'), toggleAvailability);
// router.get('/stats', protectRoute, authorizeRoles('delivery'), getDeliveryStats);

// router.patch('/update-location', protectRoute, authorizeRoles('delivery'), updateDeliveryLocation);

// // Customer routes (for rating delivery)
// router.patch('/rate/:orderId', protectRoute, authorizeRoles('user'), rateDelivery);

// export default router;
// routes/deliveryRoutes.js
import express from 'express';
import {
  registerDeliveryPerson,
  getDeliveryApplications,
  approveDeliveryApplication,
  rejectDeliveryApplication,
  getAvailableOrders,
  acceptDeliveryOrder,
  updateDeliveryStatus,
  getMyDeliveryOrders,
  toggleAvailability,
  getDeliveryStats,
  rateDelivery,
  updateDeliveryLocation,
  getDeliveryQueueDashboard,
  toggleAvailabilityEnhanced
} from '../controllers/deliveryController.js';
import { protectRoute } from '../middlewares/protectRoute.js';
import authorizeRoles from '../middlewares/authorizeRoles.js';
import { uploadProductImages } from '../middlewares/uploadImages.js';

const router = express.Router();

// Delivery registration route (requires authentication but no specific role)
router.post('/register', protectRoute, uploadProductImages, registerDeliveryPerson);

// Admin only routes
router.get('/applications', protectRoute, authorizeRoles('admin'), getDeliveryApplications);
router.patch('/approve/:id', protectRoute, authorizeRoles('admin'), approveDeliveryApplication);
router.patch('/reject/:id', protectRoute, authorizeRoles('admin'), rejectDeliveryApplication);

// Delivery person routes
router.get('/available-orders', protectRoute, authorizeRoles('delivery'), getAvailableOrders);
router.patch('/accept-order/:orderId', protectRoute, authorizeRoles('delivery'), acceptDeliveryOrder);
router.patch('/update-status/:orderId', protectRoute, authorizeRoles('delivery'), updateDeliveryStatus);
router.get('/my-orders', protectRoute, authorizeRoles('delivery'), getMyDeliveryOrders);
router.patch('/toggle-availability', protectRoute, authorizeRoles('delivery'), toggleAvailability);
router.get('/stats', protectRoute, authorizeRoles('delivery'), getDeliveryStats);
router.patch('/update-location', protectRoute, authorizeRoles('delivery'), updateDeliveryLocation);

// Customer routes (for rating delivery)
router.patch('/rate/:orderId', protectRoute, authorizeRoles('user'), rateDelivery);

router.get('/queue-stats', protectRoute, authorizeRoles('admin'), getDeliveryQueueDashboard);
router.patch('/toggle-availability-enhanced', protectRoute, authorizeRoles('delivery'), toggleAvailabilityEnhanced);
export default router;