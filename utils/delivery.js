// utils/deliveryUtils.js
import { DeliveryAssignment } from '../models/deliveryModel.js';
import { Order } from '../models/orderModel.js';
import User from '../models/userModel.js';

/**
 * Calculate distance between two coordinates in meters
 * @param {Array} coord1 - [longitude, latitude]
 * @param {Array} coord2 - [longitude, latitude]
 * @returns {Number} Distance in meters
 */
export const calculateDistance = (coord1, coord2) => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

/**
 * Find available delivery persons near a location
 * @param {Array} coordinates - [longitude, latitude]
 * @param {Number} maxDistance - Maximum distance in meters
 * @param {String} city - City name for fallback
 * @returns {Array} Available delivery persons
 */
export const findNearbyDeliveryPersons = async (coordinates, maxDistance = 10000, city = null) => {
  let query = {
    role: 'delivery',
    deliveryStatus: 'approved',
    'deliveryInfo.isAvailable': true
  };

  let deliveryPersons;

  if (coordinates) {
    // Use geospatial query if coordinates are available
    deliveryPersons = await User.find({
      ...query,
      geoLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: maxDistance
        }
      }
    }).select('name phone deliveryInfo geoLocation');
  } else if (city) {
    // Fallback to city-based search
    query['deliveryInfo.workingCity'] = city;
    deliveryPersons = await User.find(query)
      .select('name phone deliveryInfo geoLocation');
  } else {
    // Get all available delivery persons
    deliveryPersons = await User.find(query)
      .select('name phone deliveryInfo geoLocation');
  }

  return deliveryPersons;
};

/**
 * Get orders available for delivery assignment
 * @param {Array} coordinates - Delivery person coordinates [longitude, latitude]
 * @param {Number} maxDistance - Maximum distance in meters
 * @param {String} city - Working city
 * @returns {Array} Available orders
 */
export const getAvailableOrdersForDelivery = async (coordinates, maxDistance = 10000, city = null) => {
  // Get orders that are not assigned to any delivery person
  const assignedOrderIds = await DeliveryAssignment.find({
    status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
  }).distinct('order');

  let baseQuery = {
    status: { $in: ['ready_for_pickup', 'processing'] },
    _id: { $nin: assignedOrderIds }
  };

  let orders;

  if (coordinates) {
    // Find orders near the delivery person
    orders = await Order.find(baseQuery)
      .populate([
        { path: 'user', select: 'name phone location city' },
        { path: 'store', select: 'name location phone city' },
        { path: 'orderItems.product', select: 'name images price' }
      ])
      .sort({ priority: -1, createdAt: 1 });

    // Filter by distance if store has location
    if (orders.length > 0) {
      orders = orders.filter(order => {
        if (order.store?.location?.coordinates) {
          const distance = calculateDistance(coordinates, order.store.location.coordinates);
          return distance <= maxDistance;
        }
        // If no store location, include if in same city
        return city ? (order.store?.city === city || order.user?.city === city) : true;
      });
    }
  } else if (city) {
    // City-based filtering
    orders = await Order.find(baseQuery)
      .populate([
        { path: 'user', select: 'name phone location city' },
        { path: 'store', select: 'name location phone city' },
        { path: 'orderItems.product', select: 'name images price' }
      ])
      .sort({ priority: -1, createdAt: 1 });

    orders = orders.filter(order => 
      order.store?.city === city || order.user?.city === city
    );
  } else {
    orders = await Order.find(baseQuery)
      .populate([
        { path: 'user', select: 'name phone location city' },
        { path: 'store', select: 'name location phone city' },
        { path: 'orderItems.product', select: 'name images price' }
      ])
      .sort({ priority: -1, createdAt: 1 });
  }

  return orders;
};

/**
 * Check if delivery person can accept more orders
 * @param {String} deliveryPersonId 
 * @param {Number} maxActiveOrders - Maximum active orders per delivery person
 * @returns {Boolean}
 */
export const canAcceptMoreOrders = async (deliveryPersonId, maxActiveOrders = 3) => {
  const activeOrders = await DeliveryAssignment.countDocuments({
    deliveryPerson: deliveryPersonId,
    status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
  });

  return activeOrders < maxActiveOrders;
};

/**
 * Estimate delivery time based on distance and traffic
 * @param {Number} distance - Distance in meters
 * @param {String} timeOfDay - 'peak' | 'normal' | 'off-peak'
 * @returns {Number} Estimated time in minutes
 */
export const estimateDeliveryTime = (distance, timeOfDay = 'normal') => {
  // Base speed in km/h depending on traffic
  const speeds = {
    'off-peak': 40,
    'normal': 25,
    'peak': 15
  };

  const speed = speeds[timeOfDay] || speeds.normal;
  const distanceKm = distance / 1000;
  const timeHours = distanceKm / speed;
  const timeMinutes = timeHours * 60;

  // Add preparation time (5-15 minutes)
  const prepTime = Math.max(5, Math.min(15, distance / 1000));
  
  return Math.ceil(timeMinutes + prepTime);
};

/**
 * Get delivery person performance metrics
 * @param {String} deliveryPersonId 
 * @param {Number} days - Number of days to look back
 * @returns {Object} Performance metrics
 */
export const getDeliveryPersonMetrics = async (deliveryPersonId, days = 30) => {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await DeliveryAssignment.getDeliveryStats(deliveryPersonId, startDate);
  
  if (stats.length === 0) {
    return {
      totalDeliveries: 0,
      completionRate: 0,
      averageRating: 0,
      averageDeliveryTime: 0,
      onTimeRate: 0,
      totalEarnings: 0
    };
  }

  const data = stats[0];
  
  return {
    totalDeliveries: data.completedDeliveries || 0,
    completionRate: data.totalAssignments > 0 ? 
      ((data.completedDeliveries || 0) / data.totalAssignments * 100).toFixed(1) : 0,
    averageRating: data.averageRating ? data.averageRating.toFixed(1) : 0,
    averageDeliveryTime: data.averageDeliveryTime ? 
      Math.round(data.averageDeliveryTime) : 0,
    totalEarnings: data.totalEarnings || 0
  };
};

/**
 * Auto-assign orders to nearby available delivery persons
 * @param {String} orderId 
 * @param {Number} radius - Search radius in meters
 * @returns {Object} Assignment result
 */
export const autoAssignOrder = async (orderId, radius = 5000) => {
  const order = await Order.findById(orderId).populate('store', 'location city');
  
  if (!order) {
    throw new Error('Order not found');
  }

  if (!['ready_for_pickup', 'processing'].includes(order.status)) {
    throw new Error('Order is not ready for delivery assignment');
  }

  // Check if already assigned
  const existingAssignment = await DeliveryAssignment.findOne({ 
    order: orderId,
    status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
  });

  if (existingAssignment) {
    throw new Error('Order is already assigned');
  }

  // Find nearby delivery persons
  let coordinates = null;
  let city = null;

  if (order.store?.location?.coordinates) {
    coordinates = order.store.location.coordinates;
  }
  if (order.store?.city) {
    city = order.store.city;
  }

  const availableDeliveryPersons = await findNearbyDeliveryPersons(coordinates, radius, city);

  if (availableDeliveryPersons.length === 0) {
    throw new Error('No available delivery persons found');
  }

  // Filter delivery persons who can accept more orders
  const eligibleDeliveryPersons = [];
  for (const person of availableDeliveryPersons) {
    const canAccept = await canAcceptMoreOrders(person._id);
    if (canAccept) {
      eligibleDeliveryPersons.push(person);
    }
  }

  if (eligibleDeliveryPersons.length === 0) {
    throw new Error('No delivery persons available to accept more orders');
  }

  // Select the best delivery person (closest with highest rating)
  let selectedDeliveryPerson = eligibleDeliveryPersons[0];
  
  if (coordinates && eligibleDeliveryPersons.length > 1) {
    let bestScore = 0;
    
    for (const person of eligibleDeliveryPersons) {
      if (person.geoLocation?.coordinates) {
        const distance = calculateDistance(coordinates, person.geoLocation.coordinates);
        const rating = person.deliveryInfo?.rating || 5;
        
        // Score based on proximity (closer is better) and rating
        const score = (rating / 5) * 0.7 + (1 - (distance / radius)) * 0.3;
        
        if (score > bestScore) {
          bestScore = score;
          selectedDeliveryPerson = person;
        }
      }
    }
  }

  // Create assignment
  const assignment = new DeliveryAssignment({
    order: orderId,
    deliveryPerson: selectedDeliveryPerson._id,
    status: 'assigned'
  });

  await assignment.save();

  return {
    success: true,
    assignment,
    deliveryPerson: {
      id: selectedDeliveryPerson._id,
      name: selectedDeliveryPerson.name,
      phone: selectedDeliveryPerson.phone,
      rating: selectedDeliveryPerson.deliveryInfo?.rating
    }
  };
};

/**
 * Send notification to delivery persons about available orders
 * @param {String} orderId 
 * @param {Array} deliveryPersonIds 
 */
export const notifyDeliveryPersonsAboutOrder = async (orderId, deliveryPersonIds) => {
  // This would integrate with your socket/notification system
  const order = await Order.findById(orderId)
    .populate('store', 'name location')
    .populate('user', 'name location');

  const notification = {
    type: 'new_order_available',
    orderId: order._id,
    storeName: order.store?.name,
    customerLocation: order.user?.location,
    deliveryFee: order.deliveryFee,
    estimatedTime: order.estimatedDeliveryTime,
    message: `طلب جديد متاح للتوصيل من ${order.store?.name}`
  };

  // Send to all nearby delivery persons
  // Implementation depends on your notification system
  return notification;
};