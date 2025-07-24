import express from "express"
import {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subCategoryController.js"
import protectRoute from "../middlewares/protectRoute.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";

const router = express.Router()

router
  .route("/")
  .post(protectRoute, authorizeRoles("admin"), createSubCategory)
  .get(getAllSubCategories)

router
  .route("/:id")
  .put(protectRoute, authorizeRoles("admin"), updateSubCategory)
  .delete(protectRoute, authorizeRoles("admin"), deleteSubCategory)

export default router
