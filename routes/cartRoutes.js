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
    .post(protectRoute,addProductToCart)
router.route("/cartUser")
    .get(protectRoute,getLoggedUserCart)
router.route("/deletecart/:itemId")
    .delete(protectRoute,removeSpecificCartItem)
router.route("/clearCart")
    .delete(protectRoute,clearCart)
router.route("/updateCartItem/:itemId")
    .put(protectRoute,updateCartItemQuantity)
router.route("/applyCoupon")
    .put(protectRoute,applyCoupon)
export default router
