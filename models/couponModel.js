import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    name: { 
        type: String,
        required: true,
        unique: true 
    },
    expire: {
        type: Date,
        required: true
    },
    couponDiscount: { 
        type: Number,
        required: true 
    },
    stores: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store' 
    }],
    allStores: {
        type: Boolean,
        default: false
      },
    usageLimit: {
        type: Number,
        default: 1
    },
    usedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' 
    }],
    allUsers: {
        type: Boolean,
        default: false
    }

  }, { timestamps: true });


export default mongoose.model('Coupon', couponSchema);
