import Store from '../models/StoreModel.js';
import asyncHandler from "../middlewares/asyncHandler.js"
import { getCityNameFromCoordinates } from '../utils/geocode.js';
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

// Fixed calculateDistance function with proper parameter validation
function calculateDistance(lat1, lng1, lat2, lng2) {
  try {
    // Validate inputs
    if (!lat1 || !lng1 || !lat2 || !lng2 || 
        isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
      console.error('Invalid coordinates provided to calculateDistance:', { lat1, lng1, lat2, lng2 });
      return Infinity;
    }

    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers
    
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Log for debugging
    console.log(`Distance calculation: [${lat1}, ${lng1}] to [${lat2}, ${lng2}] = ${distance.toFixed(2)}km`);
    
    return distance;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return Infinity;
  }
}

// Helper function to safely get store coordinates
function getStoreCoordinates(store) {
  try {
    if (store.location && store.location.coordinates && Array.isArray(store.location.coordinates)) {
      // GeoJSON format: [longitude, latitude]
      const [lng, lat] = store.location.coordinates;
      
      // Validate coordinates
      if (typeof lng === 'number' && typeof lat === 'number' && 
          !isNaN(lng) && !isNaN(lat) && 
          lng !== 0 && lat !== 0 && // Exclude placeholder coordinates
          lng >= -180 && lng <= 180 && // Valid longitude range
          lat >= -90 && lat <= 90) { // Valid latitude range
        
        console.log(`Store ${store.name} coordinates: lng=${lng}, lat=${lat}`);
        return { lat, lng };
      } else {
        console.log(`Store ${store.name} has invalid coordinates: [${lng}, ${lat}]`);
      }
    }
    
    // Alternative coordinate formats
    if (store.location && typeof store.location.lat === 'number' && typeof store.location.lng === 'number') {
      const { lat, lng } = store.location;
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        console.log(`Store ${store.name} coordinates (alt format): lat=${lat}, lng=${lng}`);
        return { lat, lng };
      }
    }
    
    console.log(`Store ${store.name} has no valid coordinates`);
    return null;
  } catch (error) {
    console.error(`Error getting store coordinates for ${store.name}:`, error);
    return null;
  }
}

// Helper function to determine city from coordinates with better accuracy
async function determineCityFromCoordinates(lat, lng) {
  try {
    // First try the existing geocode function
    const detectedCity = await getCityNameFromCoordinates(lat, lng);
    
    // If it returns القاهرة but coordinates suggest otherwise, do manual check
    if (detectedCity === 'القاهرة') {
      // Rough coordinate ranges for Egyptian cities
      const cityRanges = {
        'الإسماعيلية': { latMin: 30.5, latMax: 30.7, lngMin: 32.2, lngMax: 32.4 },
        'بورسعيد': { latMin: 31.2, latMax: 31.4, lngMin: 32.2, lngMax: 32.4 },
        'السويس': { latMin: 29.9, latMax: 30.1, lngMin: 32.4, lngMax: 32.7 },
        'الإسكندرية': { latMin: 31.1, latMax: 31.3, lngMin: 29.8, lngMax: 30.1 },
        'طنطا': { latMin: 30.7, latMax: 30.9, lngMin: 30.9, lngMax: 31.1 },
        'المنصورة': { latMin: 31.0, latMax: 31.1, lngMin: 31.3, lngMax: 31.4 },
      };
      
      for (const [city, range] of Object.entries(cityRanges)) {
        if (lat >= range.latMin && lat <= range.latMax && 
            lng >= range.lngMin && lng <= range.lngMax) {
          console.log(`Coordinates [${lat}, ${lng}] manually mapped to ${city}`);
          return city;
        }
      }
    }
    
    console.log(`City detection result for [${lat}, ${lng}]: ${detectedCity}`);
    return detectedCity;
  } catch (error) {
    console.error('Error determining city from coordinates:', error);
    return 'القاهرة'; // Default fallback
  }
}

// @desc Get nearby stores with products
export const getNearbyStores = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    res.status(400);
    throw new Error('Latitude and longitude are required');
  }

  const userLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
  
  if (isNaN(userLocation.lat) || isNaN(userLocation.lng)) {
    res.status(400);
    throw new Error('Invalid latitude or longitude values');
  }

  console.log("User location:", userLocation);

  // Get all open stores
  const allStores = await Store.find({ isOpen: true });

  // Filter nearby stores only by distance
  const nearbyStores = allStores.filter((store) => {
    const storeCoords = getStoreCoordinates(store);
    if (!storeCoords) return false;

    const distance = calculateDistance(
      userLocation.lat, 
      userLocation.lng, 
      storeCoords.lat, 
      storeCoords.lng
    );
    
    const deliveryRange = store.deliveryRangeKm || 10;
    return distance <= deliveryRange;
  });

  if (nearbyStores.length > 0) {
    const storeIds = nearbyStores.map(store => store._id);
    const nearbyProducts = await Product.find({ 
      store: { $in: storeIds } 
    })
    .populate('category', 'name')
    .populate('subCategory', 'name')
    .populate('store', 'name');

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

  // لو مفيش متاجر جوه الرينج -> مايرجعش حاجة
  return res.status(200).json({
    message: 'No nearby stores found in range',
    stores: [],
    products: [],
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