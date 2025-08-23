// deliveryQueueSystem.js - Advanced queue management for delivery orders
import { EventEmitter } from 'events';
import { Order } from '../models/orderModel.js';
import User from '../models/userModel.js';
import { DeliveryAssignment } from '../models/deliveryModel.js';
import { getIO } from '../socket/socket.js';
import { sendEmail } from '../utils/emails.js';

class DeliveryQueueManager extends EventEmitter {
  constructor() {
    super();
    this.orderQueue = new Map(); // orderId -> order data
    this.deliveryPersons = new Map(); // deliveryPersonId -> availability
    this.orderTimeouts = new Map(); // orderId -> timeoutId
    this.assignmentAttempts = new Map(); // orderId -> attempt count
    
    // Configuration
    this.config = {
      maxAssignmentAttempts: 3,
      initialTimeoutMinutes: 10,
      retryTimeoutMinutes: 10,
      maxTimeoutMinutes: 30,
      bonusPerAttempt: 10,
      criticalWaitingTime: 20 // minutes
    };

    this.setupEventHandlers();
    this.startPeriodicCleanup();
  }

  setupEventHandlers() {
    // this.on('orderCreated', this.handleOrderCreated.bind(this));
    this.on('orderAccepted', this.handleOrderAccepted.bind(this));
    this.on('orderTimeout', this.handleOrderTimeout.bind(this));
    this.on('deliveryPersonAvailable', this.handleDeliveryPersonAvailable.bind(this));
    this.on('orderCancelled', this.handleOrderCancelled.bind(this));
  }

  // Add new order to queue
  async addOrderToQueue(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate('user', 'name phone email')
        .populate('store', 'name location phone');

      if (!order) {
        console.error(`Order ${orderId} not found`);
        return;
      }

      if (!order.canBeAssigned()) {
        console.log(`Order ${orderId} cannot be assigned (status: ${order.status})`);
        return;
      }

      // Add to queue
      this.orderQueue.set(orderId.toString(), {
        order,
        addedAt: new Date(),
        attempts: 0,
        lastAttemptAt: null
      });

      // Set initial timeout
      this.setOrderTimeout(orderId, this.config.initialTimeoutMinutes);

      // Immediately try to assign
      await this.attemptOrderAssignment(orderId);

      console.log(`Order ${orderId} added to delivery queue`);
      this.emit('orderCreated', orderId);

    } catch (error) {
      console.error(`Error adding order ${orderId} to queue:`, error);
    }
  }

  // Attempt to assign order to available delivery persons
  async attemptOrderAssignment(orderId) {
    const queueItem = this.orderQueue.get(orderId.toString());
    if (!queueItem) return;

    try {
      const availableDeliveryPersons = await this.findAvailableDeliveryPersons(queueItem.order);
      
      if (availableDeliveryPersons.length === 0) {
        console.log(`No available delivery persons for order ${orderId}`);
        return;
      }

      // Sort delivery persons by priority (distance, rating, availability)
      const sortedDeliveryPersons = await this.prioritizeDeliveryPersons(
        availableDeliveryPersons, 
        queueItem.order
      );

      // Notify all available delivery persons
      const io = getIO();
      const bonusAmount = queueItem.attempts * this.config.bonusPerAttempt;
      
      sortedDeliveryPersons.forEach(async(deliveryPerson, index) => {
        const priority = index === 0 ? 'high' : 'normal';
        
        io.to(`user_${deliveryPerson._id}`).emit('orderAvailable', {
          orderId: queueItem.order._id,
          priority: priority,
          bonusAmount: bonusAmount,
          waitingTime: Math.floor((Date.now() - queueItem.order.createdAt) / (1000 * 60)),
          customerLocation: queueItem.order.deliveryAddress,
          storeLocation: queueItem.order.store.name,
          orderValue: queueItem.order.totalPrice,
          estimatedDistance: await this.calculateDistance(
            deliveryPerson.geoLocation?.coordinates,
            queueItem.order.storeLocation.coordinates
          ),
          isUrgent: queueItem.attempts > 0
        });
      });

      queueItem.attempts++;
      queueItem.lastAttemptAt = new Date();

      console.log(`Order ${orderId} broadcast to ${sortedDeliveryPersons.length} delivery persons (attempt #${queueItem.attempts})`);

    } catch (error) {
      console.error(`Error attempting assignment for order ${orderId}:`, error);
    }
  }

  // Find available delivery persons near the order
  async findAvailableDeliveryPersons(order) {
    try {
      const query = {
        role: 'delivery',
        deliveryStatus: 'approved',
        'deliveryInfo.isAvailable': true
      };

      // If store has location, find nearby delivery persons
      if (order.storeLocation && order.storeLocation.coordinates) {
        query.geoLocation = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: order.storeLocation.coordinates
            },
            $maxDistance: 15000 // 15km radius
          }
        };
      }

      const deliveryPersons = await User.find(query)
        .select('name phone geoLocation deliveryInfo')
        .limit(20); // Limit to top 20 nearest

      // Filter out delivery persons who are currently busy
      const busyDeliveryPersons = await DeliveryAssignment.find({
        status: { $in: ['accepted', 'picked_up', 'on_the_way'] }
      }).distinct('deliveryPerson');

      return deliveryPersons.filter(dp => 
        !busyDeliveryPersons.some(busy => busy.toString() === dp._id.toString())
      );

    } catch (error) {
      console.error('Error finding available delivery persons:', error);
      return [];
    }
  }

  // Prioritize delivery persons based on various factors
  async prioritizeDeliveryPersons(deliveryPersons, order) {
    const prioritized = await Promise.all(
      deliveryPersons.map(async (dp) => {
        const distance = await this.calculateDistance(
          dp.geoLocation?.coordinates,
          order.storeLocation.coordinates
        );

        const rating = dp.deliveryInfo?.rating || 5;
        const totalDeliveries = dp.deliveryInfo?.totalDeliveries || 0;
        
        // Calculate priority score
        const distanceScore = Math.max(0, 100 - (distance / 100)); // Closer = higher score
        const ratingScore = rating * 20; // Rating * 20
        const experienceScore = Math.min(totalDeliveries * 2, 50); // Experience bonus
        
        const totalScore = distanceScore + ratingScore + experienceScore;

        return {
          ...dp.toObject(),
          distance,
          priorityScore: totalScore
        };
      })
    );

    return prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // Calculate distance between two coordinates (in meters)
  async calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return Infinity;

    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Handle order timeout
  async handleOrderTimeout(orderId) {
    const queueItem = this.orderQueue.get(orderId.toString());
    if (!queueItem) return;

    console.log(`Order ${orderId} timed out (attempt #${queueItem.attempts})`);

    try {
      // Check if order was assigned in the meantime
      const assignment = await DeliveryAssignment.findOne({
        order: orderId,
        status: { $in: ['accepted', 'picked_up', 'on_the_way'] }
      });

      if (assignment) {
        console.log(`Order ${orderId} was assigned during timeout, removing from queue`);
        this.removeOrderFromQueue(orderId);
        return;
      }

      // Check if we've exceeded max attempts
      if (queueItem.attempts >= this.config.maxAssignmentAttempts) {
        await this.handleOrderFailure(orderId, queueItem);
        return;
      }

      // Update order priority and retry
      await Order.findByIdAndUpdate(orderId, {
        $inc: { priority: 1, timeoutCount: 1 },
        lastTimeoutAt: new Date()
      });

      // Set next timeout with backoff
      const nextTimeoutMinutes = Math.min(
        this.config.retryTimeoutMinutes * queueItem.attempts,
        this.config.maxTimeoutMinutes
      );
      
      this.setOrderTimeout(orderId, nextTimeoutMinutes);

      // Retry assignment
      await this.attemptOrderAssignment(orderId);

      this.emit('orderTimeout', orderId, queueItem.attempts);

    } catch (error) {
      console.error(`Error handling timeout for order ${orderId}:`, error);
    }
  }

  // Handle order failure after max attempts
  async handleOrderFailure(orderId, queueItem) {
    try {
      console.log(`Order ${orderId} failed after ${queueItem.attempts} attempts`);

      // Update order status
      await Order.findByIdAndUpdate(orderId, {
        status: 'delivery_failed',
        failureReason: 'لا يوجد مندوبين متاحين في منطقتك',
        failedAt: new Date()
      });

      // Remove from queue
      this.removeOrderFromQueue(orderId);

      // Notify customer
      const io = getIO();
      io.to(`user_${queueItem.order.user._id}`).emit('orderDeliveryFailed', {
        orderId: orderId,
        message: 'نأسف، لم نتمكن من العثور على مندوب توصيل متاح. سيتم التواصل معك لترتيب بديل.',
        refundEligible: true,
        supportPhone: '+201234567890'
      });

      // Send email to customer
      if (queueItem.order.user.email) {
        await sendEmail({
          to: queueItem.order.user.email,
          subject: 'تعذر توصيل طلبك - نحتاج لترتيب بديل',
          html: `
            <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
              <h2>نأسف لعدم توفر خدمة التوصيل</h2>
              <p>عزيزي/عزيزتي ${queueItem.order.user.name},</p>
              <p>نأسف لإبلاغك بأنه تعذر علينا العثور على مندوب توصيل متاح لطلبك رقم <strong>${orderId}</strong></p>
              
              <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <h3>تفاصيل الطلب:</h3>
                <p><strong>المتجر:</strong> ${queueItem.order.store.name}</p>
                <p><strong>العنوان:</strong> ${queueItem.order.deliveryAddress}</p>
                <p><strong>القيمة:</strong> ${queueItem.order.totalPrice} جنيه</p>
              </div>

              <h3>الخطوات التالية:</h3>
              <ul>
                <li>يمكنك إعادة طلب التوصيل في وقت لاحق</li>
                <li>أو يمكنك الاستلام من المتجر مباشرة</li>
                <li>أو طلب استرداد كامل للمبلغ</li>
              </ul>

              <p>للمساعدة، تواصل معنا على: <strong>+201234567890</strong></p>
              <p>نعتذر عن الإزعاج ونقدر تفهمك.</p>
              
              <p>مع تحيات فريق الدعم</p>
            </div>
          `
        });
      }

      // Notify admin
      const admins = await User.find({ role: 'admin' });
      admins.forEach(admin => {
        io.to(`user_${admin._id}`).emit('orderDeliveryFailed', {
          orderId: orderId,
          customerName: queueItem.order.user.name,
          reason: 'No available delivery persons',
          attempts: queueItem.attempts,
          orderValue: queueItem.order.totalPrice
        });
      });

    } catch (error) {
      console.error(`Error handling order failure for ${orderId}:`, error);
    }
  }

  // Handle successful order acceptance
  async handleOrderAccepted(orderId, deliveryPersonId) {
    console.log(`Order ${orderId} accepted by delivery person ${deliveryPersonId}`);
    
    // Remove from queue and clear timeout
    this.removeOrderFromQueue(orderId);
    
    // Notify other delivery persons that order is no longer available
    const io = getIO();
    io.emit('orderTaken', { orderId: orderId });
  }

  // Handle delivery person becoming available
  async handleDeliveryPersonAvailable(deliveryPersonId) {
    console.log(`Delivery person ${deliveryPersonId} became available`);
    
    // Try to assign any waiting orders
    for (const [orderId, queueItem] of this.orderQueue) {
      if (queueItem.attempts > 0) { // Only retry orders that have been attempted
        await this.attemptOrderAssignment(orderId);
        break; // Only assign one order at a time
      }
    }
  }

  // Set timeout for order
  setOrderTimeout(orderId, timeoutMinutes) {
    // Clear existing timeout
    this.clearOrderTimeout(orderId);

    const timeoutId = setTimeout(() => {
      this.handleOrderTimeout(orderId);
    }, timeoutMinutes * 60 * 1000);

    this.orderTimeouts.set(orderId.toString(), {
      timeoutId,
      scheduledFor: new Date(Date.now() + timeoutMinutes * 60 * 1000)
    });

    console.log(`Order ${orderId} timeout set for ${timeoutMinutes} minutes`);
  }

  // Clear timeout for order
  clearOrderTimeout(orderId) {
    const timeout = this.orderTimeouts.get(orderId.toString());
    if (timeout) {
      clearTimeout(timeout.timeoutId);
      this.orderTimeouts.delete(orderId.toString());
    }
  }

  // Remove order from queue
  removeOrderFromQueue(orderId) {
    this.orderQueue.delete(orderId.toString());
    this.clearOrderTimeout(orderId);
    this.assignmentAttempts.delete(orderId.toString());
    console.log(`Order ${orderId} removed from delivery queue`);
  }

  // Handle order cancellation
  handleOrderCancelled(orderId) {
    console.log(`Order ${orderId} cancelled, removing from queue`);
    this.removeOrderFromQueue(orderId);
  }

  // Get queue statistics
  getQueueStats() {
    const totalOrders = this.orderQueue.size;
    const criticalOrders = Array.from(this.orderQueue.values()).filter(item => {
      const waitingTime = (Date.now() - item.order.createdAt) / (1000 * 60);
      return waitingTime > this.config.criticalWaitingTime;
    }).length;

    const averageAttempts = Array.from(this.orderQueue.values())
      .reduce((sum, item) => sum + item.attempts, 0) / totalOrders || 0;

    return {
      totalOrdersInQueue: totalOrders,
      criticalOrders: criticalOrders,
      averageAttempts: Math.round(averageAttempts * 10) / 10,
      activeTimeouts: this.orderTimeouts.size
    };
  }

  // Periodic cleanup of stale data
  startPeriodicCleanup() {
    setInterval(async () => {
      await this.cleanupStaleOrders();
    }, 10 * 60 * 1000); // Run every 10 minutes
  }

  async cleanupStaleOrders() {
    try {
      const staleOrders = [];
      
      for (const [orderId, queueItem] of this.orderQueue) {
        // Check if order still exists and is in correct state
        const order = await Order.findById(orderId);
        
        if (!order || !order.canBeAssigned()) {
          staleOrders.push(orderId);
          continue;
        }

        // Check for orders stuck in queue too long
        const hoursInQueue = (Date.now() - queueItem.addedAt) / (1000 * 60 * 60);
        if (hoursInQueue > 4) { // 4 hours max in queue
          console.log(`Order ${orderId} stuck in queue for ${hoursInQueue} hours, removing`);
          staleOrders.push(orderId);
        }
      }

      // Remove stale orders
      staleOrders.forEach(orderId => {
        this.removeOrderFromQueue(orderId);
      });

      if (staleOrders.length > 0) {
        console.log(`Cleaned up ${staleOrders.length} stale orders from queue`);
      }

    } catch (error) {
      console.error('Error during queue cleanup:', error);
    }
  }
}

// Create singleton instance
const deliveryQueueManager = new DeliveryQueueManager();

// Export functions for use in controllers
export const addOrderToDeliveryQueue = (orderId) => {
  return deliveryQueueManager.addOrderToQueue(orderId);
};

export const notifyOrderAccepted = (orderId, deliveryPersonId) => {
  deliveryQueueManager.handleOrderAccepted(orderId, deliveryPersonId);
};

export const notifyDeliveryPersonAvailable = (deliveryPersonId) => {
  deliveryQueueManager.handleDeliveryPersonAvailable(deliveryPersonId);
};

export const notifyOrderCancelled = (orderId) => {
  deliveryQueueManager.handleOrderCancelled(orderId);
};

export const getDeliveryQueueStats = () => {
  return deliveryQueueManager.getQueueStats();
};

export default deliveryQueueManager;