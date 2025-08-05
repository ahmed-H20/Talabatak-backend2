import express from "express"
import {
    addProductToCart,
    getLoggedUserCart,
    removeSpecificCartItem,
    clearCart,
    applyCoupon,
    updateCartItemQuantity
} from "../controllers/cartController.js"
 import {protectRoute} from "../middlewares/protectRoute.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";

const router = express.Router()

router.route("/addCartItem")
    .post(protectRoute,authorizeRoles('user'),addProductToCart)
router.route("/cartUser")
    .get(protectRoute,authorizeRoles('user'),getLoggedUserCart)
router.route("/deletecart/:itemId")
    .delete(protectRoute,authorizeRoles('user'),removeSpecificCartItem)
router.route("/clearCart")
    .delete(protectRoute,authorizeRoles('user'),clearCart)
router.route("/updateCartItem/:itemId")
    .put(protectRoute,authorizeRoles('user'),updateCartItemQuantity)
router.route("/applyCoupon")
    .put(protectRoute,authorizeRoles('user'),applyCoupon)
export default router
