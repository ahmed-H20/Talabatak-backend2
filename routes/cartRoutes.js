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
    .post(protectRoute,authorizeRoles('user',"delivery"),addProductToCart)
router.route("/cartUser")
    .get(protectRoute,authorizeRoles('user',"delivery"),getLoggedUserCart)
router.route("/deletecart/:itemId")
    .delete(protectRoute,authorizeRoles('user', "delivery"),removeSpecificCartItem)
router.route("/clearCart")
    .delete(protectRoute,authorizeRoles('user', "delivery"),clearCart)
router.route("/updateCartItem/:itemId")
    .put(protectRoute,authorizeRoles('user', "delivery"),updateCartItemQuantity)
router.route("/applyCoupon")
    .put(protectRoute,authorizeRoles('user', "delivery"),applyCoupon)
export default router
