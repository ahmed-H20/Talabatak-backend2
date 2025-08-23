export const sanitizeUser = (user) => {
  return {
    _id: user._id?.toString?.() || null,
    name: user.name,
    phone: user.phone,
    email: user.email,
    location: {
      coordinates: user.geoLocation?.coordinates || [0, 0],
      address: user.location
    },
    role: user.role,
    isPhoneVerified: user.isPhoneVerified || false,
    photo: user.profile_picture,
    provider: user.provider || 'local',
    providerId: user.providerId || null,
    profileComplete: user.profileComplete || false,
    createdAt: normalizeDate(user.createdAt),
    // Add delivery info if user is delivery person
    ...(user.role === 'delivery' && {
      deliveryStatus: user.deliveryStatus,
      deliveryInfo: user.deliveryInfo
    })
  };
};

const normalizeDate = (date) => {
  if (!date) return null;
  if (typeof date === "string") return date;
  if (date instanceof Date) return date.toISOString();
  if (typeof date === "object" && "$date" in date) return date.$date;
  return new Date().toISOString();
};

export const sanitizeCoupon = (coupon) => {
  return {
    id: coupon._id?.toString() || null,
    name: coupon.name || null,
    expire: coupon.expire || null,
    discount: coupon.discount || null,
    stores: coupon.stores?.map(store => store) || [],
    usageLimit: coupon.usageLimit || null,
    allStores: coupon.allStores || false,
    usedBy: coupon.usedBy?.map(user => user) || [],
    allUsers: coupon.allUsers || false,
    createdAt: coupon.createdAt || null,

  };
};

export const sanitizeCart = (cart) => {
  return {
    id: cart._id?.toString() || null,
    cartItems: cart.cartItems?.map(item => {
      // Check if product exists before accessing its properties
      if (!item.product) {
        return {
          id: item._id?.toString() || null,
          product: {
            id: null,
            name: "منتج محذوف",
            store: null,
            images: [],
            unit: "قطعة"
          },
          quantity: item.quantity || 1,
          price: item.price || 0,
        };
      }

      return {
        id: item._id?.toString() || null,
        product: {
          id: item.product._id?.toString() || null,
          name: item.product.name || "منتج غير محدد",
          store: item.product.store || null,
          images: item.product.images || [],
          unit: item.product.unit || "قطعة"
        },
        quantity: item.quantity || 1,
        price: item.price || 0,
      };
    }).filter(item => item.product.id !== null) || [], // Optional: Remove deleted products
    totalCartPrice: cart.totalCartPrice || 0,
    totalPriceAfterDiscount: cart.totalPriceAfterDiscount || 0,
    user: {
      id: cart.user?._id?.toString() || null,
      name: cart.user?.name || null,
    },
    createdAt: normalizeDate(cart.createdAt),
  };
};


export const sanitizeOrder = (order) => {
  return {
    id: order._id?.toString() || null,
    orderItems: order.orderItems.map(item => ({
      product: {
        id: item.product?._id?.toString() || null,
        name: item.product?.name || null,
        image: item.product?.image || null,
      },
      quantity: item.quantity || 1,
      price: item.price || 0,
    })),
    totalPrice: order.totalPrice || 0,
    user: {
      id: order.user?._id?.toString() || null,
      name: order.user?.name || null,
    },
    store: {
      id: order.store?._id?.toString() || null,
      name: order.store?.name || null,
    },
    status: order.status || 'pending',
    createdAt: normalizeDate(order.createdAt),
  };
}
