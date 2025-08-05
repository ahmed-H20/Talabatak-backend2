import express from "express"
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js"
import {protectRoute} from "../middlewares/protectRoute.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";

const router = express.Router()

router
  .route("/")
  .post(protectRoute, authorizeRoles("admin"), createCategory)
  .get(getAllCategories)

router
  .route("/:id")
  .put(protectRoute, authorizeRoles("admin"), updateCategory)
  .delete(protectRoute, authorizeRoles("admin"), deleteCategory)

export default router
