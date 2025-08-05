// routes/deliveryRoutes.js
import express from "express";
import {
  registerDeliveryPerson,
  getDeliveryRequests,
  approveDeliveryRequest,
  rejectDeliveryRequest,
  getAvailableOrders,
  acceptDeliveryOrder,
  updateDeliveryStatus,
  getMyDeliveryOrders,
  updateDeliveryPersonStatus,
} from "../controllers/deliveryController.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import { protectRoute } from "../middlewares/protectRoute.js";

const router = express.Router();

// Public/User routes
router.post("/register", protectRoute, registerDeliveryPerson);

// Admin routes
router.get("/requests", protectRoute, authorizeRoles("admin"), getDeliveryRequests);
router.patch("/approve/:id", protectRoute, authorizeRoles("admin"), approveDeliveryRequest);
router.patch("/reject/:id", protectRoute, authorizeRoles("admin"), rejectDeliveryRequest);

// Delivery person routes
router.get("/available-orders", protectRoute, authorizeRoles("delivery"), getAvailableOrders);
router.patch("/accept-order/:orderId", protectRoute, authorizeRoles("delivery"), acceptDeliveryOrder);
router.patch("/update-status/:orderId", protectRoute, authorizeRoles("delivery"), updateDeliveryStatus);
router.get("/my-orders", protectRoute, authorizeRoles("delivery"), getMyDeliveryOrders);
router.patch("/status", protectRoute, authorizeRoles("delivery"), updateDeliveryPersonStatus);

export default router;