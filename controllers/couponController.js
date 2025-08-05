import asyncHandler from 'express-async-handler';
import { sanitizeCoupon } from '../utils/sanitize.js';
import Coupon from '../models/couponModel.js';
import Cart from "../models/cartModel.js"

// @desc    Create a coupon
// @route   POST /api/coupons/create
// @access  Private/Admin
export const createCoupon = asyncHandler(async (req, res) => {
    const { name, expire, couponDiscount, stores, usageLimit, allStores, usedBy, allUsers } = req.body;
  
    if (!name || !expire || !couponDiscount) {
      return res.status(400).json({ message: 'Name, expire date, and discount are required' });
    }
  
    const coupon = await Coupon.create({
      name,
      expire,
      couponDiscount,
      usageLimit,
      stores: stores || [],
      allStores: allStores || false,
      usedBy: usedBy || [],
      allUsers: allUsers || false
    });
  
    if (!allStores) {
      if (!stores || stores.length === 0) {
        return res.status(400).json({ message: 'Please specify at least one store or set allStores = true' });
      }
      coupon.stores = stores;
    }
  
    if (!allUsers) {
      if (!usedBy || usedBy.length === 0) {
        return res.status(400).json({ message: 'Please specify at least one user or set allUsers = true' });
      }
      coupon.usedBy = usedBy;
    }
  
    await coupon.save();
  
    const populatedCoupon = await coupon.populate([
      { path: 'stores', select: '-_id name' },
      { path: 'usedBy', select: '-_id name' }
    ]);
  
    res.status(201).json({
      data: populatedCoupon,
      message: 'Coupon created successfully',
    });
  });
// @desc    Get all coupons
// @route   GET /api/coupons/getCoupons
// @access  Private/Admin-Manager
export const getCoupons = asyncHandler(async (req, res) => {
    const { storeId } = req.query;
    const filter = storeId ? { store: storeId } : {};

    const totalCoupons = await Coupon.countDocuments(filter);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const coupons = await Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
            path: 'stores',
            select: '-_id name'
        });

    res.status(200).json({
        totalCoupons,
        data: coupons.map(sanitizeCoupon)
    });
});

// @desc    Get a coupon
// @route   GET /api/coupons/:id
// @access  Private/Admin
export const getCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const coupon = await Coupon.findById(id)
    .populate({
        path: 'stores',
        select: '-_id name'
    });
    if (!coupon) {
        return res.status(404).json({ message: `No coupon found with ID ${id}` });
    }

    res.status(200).json({
        data: sanitizeCoupon(coupon)
    });
});

// @desc    Update a coupon
// @route   PUT /api/coupons/update/:id
// @access  Private/Admin
export const updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
    ).populate({
        path: 'stores',
        select: '-_id name'
    });
    if (!coupon) {
        return res.status(404).json({ message: `No coupon found with ID ${req.params.id}` });
    }

    res.status(200).json({
        data: sanitizeCoupon(coupon),
        message: 'Coupon updated successfully'
    });
});

// @desc    Delete a coupon
// @route   DELETE /api/coupons/delete/:id
// @access  Private/Admin
export const deleteCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
        return res.status(404).json({ message: `No coupon found with ID ${id}` });
    }

    res.status(200).json({ message: 'Coupon deleted successfully' });
});

// @desc    Use a coupon 
// @route   POST /api/coupons/useCoupon
// @access  Private/User
export const useCoupon = asyncHandler(async (req, res) => {
    const { couponName, storeId } = req.body;

    const userId = req.user._id;
    if(!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!couponName ) {
        return res.status(400).json({ message: 'Coupon name is required' });
    }
    const coupon = await Coupon.findOne({ name: couponName });

    if (!coupon) {
        return res.status(404).json({ message: 'Coupon not found' });
    }
    if (new Date(coupon.expire) < new Date()) {
        return res.status(400).json({ message: 'Coupon expired' });
    }
    if (!coupon.allStores) {
        if (!storeId) {
            return res.status(400).json({ message: 'Store ID is required when coupon is not for all stores' });
          } 
          const isStoreAllowed = coupon.stores
              .map(id => id.toString())
              .includes(storeId.toString());

        if (!isStoreAllowed) {
            return res.status(400).json({ message: 'Coupon not valid for this store' });
        }
     }
    if (coupon.usedBy.includes(userId)) {
        return res.status(400).json({ message: 'You have already used this coupon' });
    }
    if (coupon.usageLimit > 0 && coupon.usedBy.length >= coupon.usageLimit) {
        return res.status(400).json({ message: 'Coupon usage limit exceeded' });
    }
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    cart.totalPriceAfterDiscount = Number(
        (cart.totalCartPrice * (1 - coupon.couponDiscount / 100)).toFixed(2)
      );
    await cart.save();
    coupon.usedBy.push(userId);
    await coupon.save();
    res.status(200).json({
        discount: coupon.couponDiscount,
        totalPriceAfterDiscount: cart.totalPriceAfterDiscount,
        message: 'Coupon applied successfully'
    });
});


