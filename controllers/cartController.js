import asyncHandler from 'express-async-handler';
import { sanitizeCart } from '../utils/sanitize.js';
import Product from '../models/productModel.js';
import Coupon from '../models/couponModel.js';
import Cart from '../models/cartModel.js';


const calcTotalCartPrice = (cart) => {
    let totalPrice = 0;
    cart.cartItems.forEach((item) => {
        totalPrice += item.quantity * item.price;
    });
    cart.totalCartPrice = totalPrice;
    cart.totalPriceAfterDiscount = undefined;
    return totalPrice;
};
// @desc    Add product to  cart
// @route   POST /api/addCartItem
// @access  Private/User
export const addProductToCart = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;
  console.log(productId);
  if (!productId) {
    return res.status(400).json('Product ID is required');
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(400).json('Product not found');
  }

  // Get cart for logged in user
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    // Create new cart
    cart = await Cart.create({
      user: req.user._id,
      cartItems: [{ product: productId, price: product.price, quantity: 1, store: product.store, images: product.images, unit: product.unit }],
    });
  } else {
    // Check if product exists in cart
    const productIndex = cart.cartItems.findIndex(
      (item) => item.product.toString() === productId
    );

    if (productIndex > -1) {
      // Product already exists -> increase quantity
      cart.cartItems[productIndex].quantity += 1;
    } else {
      // Product does not exist -> add new
      cart.cartItems.push({
        store: product.store,
        product: productId,
        price: product.price,
        quantity: 1,
        images: product.images,
        unit: product.unit
      });
    }
  }

  // Recalculate total price
  calcTotalCartPrice(cart);

  await cart.populate([
    {
      path: 'cartItems.product',
      select: 'name _id store images unit',
      populate: {
        path: 'store',
        select: 'name _id'
      }      
    },
    {
      path: 'user',
      select: 'name _id',
    },
  ]);


  await cart.save();

  res.status(200).json({
    status: 'success',
    message: 'Product added to cart successfully',
    numOfCartItems: cart.cartItems.length,
    data: sanitizeCart(cart),
  });
});

// @desc    Get logged user cart
// @route   GET /api/cartUser
// @access  Private/User
export const getLoggedUserCart = asyncHandler(async (req, res, next) => {
    const cart = await Cart.findOne({ user: req.user._id })
    .populate([{
        path: 'cartItems.product',
        select: 'name _id images unit store',
        populate: {
          path: 'store',
          select: 'name _id'
        }
      },{
        path: 'user',
        select: 'name _id'
      }
    ]);
    if (!cart) {
            return res.status(400).json(`There is no cart for this user id : ${req.user._id}`);
    }

    res.status(200).json({
        status: 'success',
        numOfCartItems: cart.cartItems.length,
        data: sanitizeCart(cart),
    });
});

// @desc    Remove specific cart item
// @route   DELETE /api/deletecart/:itemId
// @access  Private/User
export const removeSpecificCartItem = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  const itemId = req.params.itemId;

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === itemId
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  // حذف العنصر بالكامل من السلة
  cart.cartItems.splice(itemIndex, 1);

  calcTotalCartPrice(cart);

  await cart.populate([
    {
      path: 'cartItems.product',
      select: 'name _id',
    },
    {
      path: 'user',
      select: 'name _id',
    },
  ]);
  
  await cart.save();

  res.status(200).json({
    status: 'success',
    message: 'Item removed completely from cart',
    numOfCartItems: cart.cartItems.length,
    data: sanitizeCart(cart),
  });
});

// @desc    clear logged user cart
// @route   DELETE /api/clearCart
// @access  Private/User
export const clearCart = asyncHandler(async (req, res, next) => {
    await Cart.findOneAndDelete({ user: req.user._id });
    res.status(200).json('Cart cleared successfully');
    next();
});

// @desc    Apply coupon on logged user cart
// @route   PUT /api/v1/cart/applyCoupon
// @access  Private/User
export const applyCoupon = asyncHandler(async (req, res, next) => {
    const { couponId } = req.body;

    if (!couponId) {
        return res.status(400).json('Coupon ID is required');
    }

    // 1) Get coupon by ID
    const coupon = await Coupon.findOne({
        _id: couponId,
        expire: { $gt: Date.now() },
    });

    if (!coupon) {
        return res.status(400).json('Coupon is invalid or expired');
    }
     const userId = req.user._id;
     const cart = await Cart.findOne({ user: userId });
       if (!cart) return res.status(404).json({ message: 'Cart not found' });
       cart.totalPriceAfterDiscount = Number(
           (cart.totalCartPrice * (1 - coupon.couponDiscount / 100)).toFixed(2)
         );  
    await cart.populate([
        {
          path: 'cartItems.product',
          select: '_id name ',
        },
        {
          path: 'user',
          select: '_id name',
        },
      ]);
    // 4) Save and respond
    await cart.save();

    res.status(200).json({
        status: 'success',
        numOfCartItems: cart.cartItems.length,
        data: sanitizeCart(cart),
    });
});


// @desc    Update quantity for specific cart item
// @route   PUT /api/updateCartItem/:itemId
// @access  Private/User
export const updateCartItemQuantity = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  const { itemId } = req.params;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ message: 'Quantity must be at least 1' });
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === itemId
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  cart.cartItems[itemIndex].quantity = quantity;

  // Recalculate price
  calcTotalCartPrice(cart);

  await cart.populate([
    {
      path: 'cartItems.product',
      select: 'name _id images unit',
    },
    {
      path: 'user',
      select: 'name _id',
    },
  ]);

  await cart.save();

  res.status(200).json({
    status: 'success',
    message: 'Item quantity updated successfully',
    numOfCartItems: cart.cartItems.length,
    data: sanitizeCart(cart),
  });
});

// export const applyCoupon = asyncHandler(async (req, res, next) => {
//     // 1) Get coupon based on coupon name
//     const coupon = await Coupon.findOne({
//         name: req.body.coupon,
//         expire: { $gt: Date.now() },
//     });

//     if (!coupon) {
//         return res.status(400).json('Coupon is invalid or expired');
//     }

//     // 2) Get logged user cart
//     const cart = await Cart.findOne({ user: req.user._id });
//     if (!cart) {
//         return res.status(400).json('Cart not found');
//     }

//     // 6) Apply discount to totalCartPrice
//     cart.totalPriceAfterDiscount = (cart.totalCartPrice * (1 - coupon.discount / 100)).toFixed(2);

//     // 7) Save the cart
//     await cart.save();

//     // 8) Send response
//     res.status(200).json({
//         status: 'success',
//         numOfCartItems: cart.cartItems.length,
//         data: sanitizeCart(cart),
//     });
// });


// // @desc    Update specific cart item quantity
// // @route   PUT /api/v1/cart/:itemId
// // @access  Private/User
// export const updateCartItemQuantity = asyncHandler(async (req, res, next) => {
//     const { quantity } = req.body;

//     if (quantity < 1) {
//         return res.status(400).json('Quantity must be at least 1');
//     }

//     const cart = await Cart.findOne({ user: req.user._id });
//     if (!cart) {
//         return res.status(400).json(`there is no cart for user ${req.user._id}`);
//     }

//     const itemIndex = cart.cartItems.findIndex(
//         (item) => item._id.toString() === req.params.itemId
//     );
//     if (itemIndex > -1) {
//         const cartItem = cart.cartItems[itemIndex];
//         cartItem.quantity = quantity;
//         cart.cartItems[itemIndex] = cartItem;
//     } else {
//             return res.status(400).json(`there is no item for this id :${req.params.itemId}`);
//     }

//     calcTotalCartPrice(cart);
//     await cart.populate([{
//         path: 'cartItems.product',
//         select: 'name _id' 
//       },{
//         path: 'user',
//         select: 'name _id'
//       }
//     ]);
//     await cart.save();

//     res.status(200).json({
//         status: 'success',
//         numOfCartItems: cart.cartItems.length,
//         data: sanitizeCart(cart),
//     });
// });