import express from "express";
import multer from "multer";
import path from "path";
import { 
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  getProductById,
  increasePricesByPercentage,
  uploadProductsFromExcel 
}
 from "../controllers/productController.js";
import {protectRoute} from "../middlewares/protectRoute.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import { resizeAndUploadProductImages } from "../utils/multer.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router
  .route("/")
  .post(protectRoute, authorizeRoles("admin"), upload.array('images'),resizeAndUploadProductImages,createProduct) // فقط admin يضيف منتج
  .get(getAllProducts); // أي حد يقدر يشوف المنتجات

router
  .route("/:id")
  .get(getProductById) // أي حد يقدر يشوف منتج معين
  .put(protectRoute, authorizeRoles("admin"), updateProduct) // فقط admin يقدر يعدل
  .delete(protectRoute, authorizeRoles("admin"), deleteProduct); // فقط admin يقدر يحذف
router.route("/increasePrices/:storeId")
  .put(protectRoute, authorizeRoles("admin"), increasePricesByPercentage); 

router.post("/upload", upload.single("file"), uploadProductsFromExcel);

export default router;
