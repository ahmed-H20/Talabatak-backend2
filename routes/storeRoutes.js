import express from "express"
import {
  createStore,
  getAllStores,
  getSingleStore,
  updateStore,
  deleteStore,
  getNearbyStores,
} from "../controllers/storeController.js"
import {protectRoute} from "../middlewares/protectRoute.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";

const router = express.Router()

router
  .route("/")
  .post(protectRoute, authorizeRoles("admin"), createStore)
  .get(getAllStores)

router.get('/nearby', getNearbyStores);


router
  .route("/:id")
  .get(getSingleStore)
  .put(protectRoute, authorizeRoles("admin"), updateStore)
  .delete(protectRoute, authorizeRoles("admin"), deleteStore)

export default router
