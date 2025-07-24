import express from "express";
import {
  createOrdersFromCart,
  getMyOrders,
  cancelOrderIfPending,
  updateOrderStatus,
  updateOrderIfPending
} from "../controllers/orderController.js";
import protectRoute from "../middlewares/protectRoute.js";
import { getGroupedOrders } from "../controllers/orderController.js";
const router = express.Router();

// Routes
router.post("/", protectRoute, createOrdersFromCart);                   
router.get("/", protectRoute, getMyOrders);                    
router.patch("/:id/cancel", protectRoute, cancelOrderIfPending);       
router.patch("/:id/status", protectRoute, updateOrderStatus);       
router.patch("/:id/update", protectRoute, updateOrderIfPending);
router.get("/grouped", protectRoute, getGroupedOrders);

export default router;
