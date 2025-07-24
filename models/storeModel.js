import mongoose from "mongoose";

const dayTimeSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    required: true
  },
  from: {
    type: String, // e.g., "09:00"
    required: true
  },
  to: {
    type: String, // e.g., "17:00"
    required: true
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
  city: {
    type: String,
    required: true
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

const Store = mongoose.model("Store", storeSchema);
export default Store;
