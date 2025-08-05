import mongoose from "mongoose";

const dayTimeSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    required: true
  },
  open: {
    type: String, // e.g., "09:00"
    required: true
  },
  close: {
    type: String, // e.g., "17:00"
    required: true
  },
  isClosed: {
    type: Boolean
  }
}, { _id: false });

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Store name is required"]
  },
  description: {
    type: String,
    default: ""
  },
  location: {
    address: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  phone:{
    type: String
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }],
  city: {
    type: String,
    required: true
  },
  discount: {
    type: Number, 
    default: 0,
  },
  deliveryRangeKm: {
    type: Number,
    default: 5
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  workingHours: [dayTimeSchema],
}, { timestamps: true });

const Store = mongoose.models.Store || mongoose.model('Store', storeSchema);
export default Store;
