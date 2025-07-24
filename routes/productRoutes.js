import express from "express";
import { createProduct, getAllProducts, updateProduct, deleteProduct, getProductById } from "../controllers/productController.js";
import protectRoute from "../middlewares/protectRoute.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";

const router = express.Router();

router
  .route("/")
  .post(protectRoute, authorizeRoles("admin"), createProduct) // فقط admin يضيف منتج
  .get(getAllProducts); // أي حد يقدر يشوف المنتجات

router
  .route("/:id")
  .get(getProductById) // أي حد يقدر يشوف منتج معين
  .put(protectRoute, authorizeRoles("admin"), updateProduct) // فقط admin يقدر يعدل
  .delete(protectRoute, authorizeRoles("admin"), deleteProduct); // فقط admin يقدر يحذف

export default router;
