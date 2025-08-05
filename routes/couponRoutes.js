import express from 'express';
import { 
    createCoupon,
    getCoupons,
    getCoupon,
    updateCoupon,
    deleteCoupon,
    useCoupon
    } 
from '../controllers/couponController.js';
//import { getCouponValidator, createCouponValidator, updateCouponValidator, deleteCouponValidator } from '../utils/validators/CouponValidator.js';
import {protectRoute} from "../middlewares/protectRoute.js";
import authorizeRoles from '../middlewares/authorizeRoles.js';
const router = express.Router();

router.use(protectRoute);

router.route('/create')
    .post( authorizeRoles('admin'),createCoupon);
router.route('/getCoupons')
    .get( authorizeRoles('admin'),getCoupons);
router.route('/:id')
    .get( authorizeRoles('admin'),getCoupon);
router.route('/update/:id')
    .put( authorizeRoles('admin'),updateCoupon)
router.route('/delete/:id')
    .delete( authorizeRoles('admin'),deleteCoupon);
router.route('/useCoupon')
    .post( authorizeRoles('user'),useCoupon);


export default router;