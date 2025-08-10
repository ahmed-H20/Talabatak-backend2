import Store from '../models/StoreModel.js';
import asyncHandler from "../middlewares/asyncHandler.js"
import { getCityNameFromCoordinates } from '../utils/geocode.js'; // لو بتستخدم العنوان أو اسم المدينة
import Product from '../models/productModel.js';
// @desc    Create new store
export const createStore = asyncHandler(async (req, res) => {
  const newStore = await Store.create(req.body);
  res.status(201).json({ message: 'Store created', data: newStore });
});

// @desc    Get all stores
export const getAllStores = asyncHandler(async (req, res) => {
  const stores = await Store.find()
  .populate('products', 'name price quantity images discount');
  const formattedStores = stores.map(store => {
    const formattedProducts = store.products.map(product => {
      const discount = product.discount || 0;
      const discountedPrice = product.price * (1 - discount / 100);
      return {
        ...product.toObject(),
        discountedPrice: +discountedPrice.toFixed(2),
      };
    });
    return {
      ...store.toObject(),
      products: formattedProducts,
    };
  });
  res.status(200).json({ data: formattedStores });
});

// @desc    Get single store
export const getSingleStore = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id)
    .populate('products', 'name price quantity images discount');

  if (!store) throw new Error('Store not found');

  const formattedProducts = store.products.map(product => {
    const discount = product.discount || 0;
    const discountedPrice = product.price * (1 - discount / 100);

    return {
      ...product.toObject(),
      discountedPrice: +discountedPrice.toFixed(2),
    };
  });

  const formattedStore = {
    ...store.toObject(),
    products: formattedProducts,
  };

  res.status(200).json({ data: formattedStore });
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // المسافة بالكيلومتر
  }

// @desc Get nearby stores with products
export const getNearbyStores = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    res.status(400);
    throw new Error('Latitude and longitude are required');
  }

  const userLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };

  // Get all open stores
  const allStores = await Store.find({ isOpen: true });

  const nearbyStores = allStores.filter((store) => {
    const distance = calculateDistance(userLocation, store.location.coordinates);
    return distance <= store.deliveryRangeKm;
  });

  console.log("User location:", userLocation);

  if (nearbyStores.length > 0) {
    // Get products for nearby stores using the store field in Product
    const storeIds = nearbyStores.map(store => store._id);
    const nearbyProducts = await Product.find({ 
      store: { $in: storeIds } 
    })
    .populate('category', 'name')
    .populate('subCategory', 'name')
    .populate('store', 'name');

    // Process products
    const processedProducts = nearbyProducts.map(product => {
      const discount = product.discount || 0;
      const discountedPrice = +(product.price * (1 - discount / 100)).toFixed(2);
      
      return {
        _id: product._id,
        name: product.name,
        description: product.description,
        images: product.images,
        price: product.price,
        quantity: product.quantity,
        discount: product.discount,
        unit: product.unit,
        category: product.category,
        subCategory: product.subCategory,
        discountedPrice,
        storeId: product.store._id,
        storeName: product.store.name
      };
    });

    return res.status(200).json({
      message: 'Nearby stores found',
      stores: nearbyStores,
      products: processedProducts,
    });
  }

  // Fallback
  const userCity = await getCityNameFromCoordinates(lat, lng);
  const fallbackStores = await Store.find({ city: userCity, isOpen: true });
  const fallbackStoreIds = fallbackStores.map(store => store._id);
  
  const fallbackProducts = await Product.find({ 
    store: { $in: fallbackStoreIds } 
  })
  .populate('category', 'name')
  .populate('subCategory', 'name')
  .populate('store', 'name');

  const processedFallbackProducts = fallbackProducts.map(product => {
    const discount = product.discount || 0;
    const discountedPrice = +(product.price * (1 - discount / 100)).toFixed(2);
    
    return {
      _id: product._id,
      name: product.name,
      description: product.description,
      images: product.images,
      price: product.price,
      quantity: product.quantity,
      discount: product.discount,
      unit: product.unit,
      category: product.category,
      subCategory: product.subCategory,
      discountedPrice,
      storeId: product.store._id,
      storeName: product.store.name
    };
  });

  res.status(200).json({
    message: 'Fallback to city stores',
    stores: fallbackStores,
    products: processedFallbackProducts,
  });
});

// @desc    Update store
export const updateStore = asyncHandler(async (req, res) => {
  const updatedStore = await Store.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updatedStore) throw new Error('Store not found');
  res.status(200).json({ message: 'Store updated', data: updatedStore });
});

// @desc    Delete store
export const deleteStore = asyncHandler(async (req, res) => {
  const store = await Store.findByIdAndDelete(req.params.id);
  if (!store) throw new Error('Store not found');
  res.status(200).json({ message: 'Store deleted' });
});
