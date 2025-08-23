// import mongoose from "mongoose";

// const dayTimeSchema = new mongoose.Schema({
//   day: {
//     type: String,
//     enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
//     required: true
//   },
//   open: {
//     type: String, // e.g., "09:00"
//     required: true
//   },
//   close: {
//     type: String, // e.g., "17:00"
//     required: true
//   },
//   isClosed: {
//     type: Boolean
//   }
// }, { _id: false });

// const storeSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: [true, "Store name is required"]
//   },
//   description: {
//     type: String,
//     default: ""
//   },
//    location: {
//     address: { type: String, required: true },
//     type: {
//       type: String,
//       enum: ['Point'],
//       required: true
//     },
//     coordinates: {
//       type: [Number], // [longitude, latitude]
//       required: true
//     }
//   },
//   phone:{
//     type: String
//   },
//   products: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Product"
//   }],
//   city: {
//     type: String,
//     required: true
//   },
//   discount: {
//     type: Number, 
//     default: 0,
//   },
//   deliveryRangeKm: {
//     type: Number,
//     default: 5
//   },
//   isOpen: {
//     type: Boolean,
//     default: true
//   },
//   workingHours: [dayTimeSchema],
// }, { timestamps: true });

// storeSchema.index({ location: '2dsphere' });

// const Store = mongoose.models.Store || mongoose.model('Store', storeSchema);
// export default Store;
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
    address: { 
      type: String, 
      required: true 
    },
    type: {
      type: String,
      enum: ['Point'],
      required: false, // Changed to false to handle existing data
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: false, // Changed to false to handle existing data
      validate: {
        validator: function(v) {
          // If coordinates exist, they must be valid
          return !v || (Array.isArray(v) && v.length === 2 && 
                       typeof v[0] === 'number' && typeof v[1] === 'number' &&
                       !isNaN(v[0]) && !isNaN(v[1]));
        },
        message: 'Coordinates must be an array of two numbers [longitude, latitude]'
      }
    }
  },
  phone: {
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

// Only create 2dsphere index if coordinates exist
storeSchema.index({ 
  "location.coordinates": '2dsphere' 
}, { 
  sparse: true // Only index documents that have coordinates
});

// Virtual to check if store has valid coordinates
storeSchema.virtual('hasValidCoordinates').get(function() {
  return this.location && 
         this.location.coordinates && 
         Array.isArray(this.location.coordinates) && 
         this.location.coordinates.length === 2 &&
         typeof this.location.coordinates[0] === 'number' &&
         typeof this.location.coordinates[1] === 'number' &&
         !isNaN(this.location.coordinates[0]) &&
         !isNaN(this.location.coordinates[1]);
});

// Method to safely get coordinates
storeSchema.methods.getCoordinates = function() {
  if (this.hasValidCoordinates) {
    const [lng, lat] = this.location.coordinates;
    return { lat, lng };
  }
  return null;
};

const Store = mongoose.models.Store || mongoose.model('Store', storeSchema);
export default Store;