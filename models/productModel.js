import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
  },
  description: {
    type: String,
    required: [true, "Product description is required"],
  },
  images:
  {
      type: [String],
      required: true
  },
  price: {
    type: Number,
    required: [true, "Product price is required"],
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  unit:{
    type: String,
    default: 'كيلو',
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
    // default: new mongoose.Types.ObjectId("store_id")  ← لو عايز تضيف قيمة افتراضية فعلًا، حط ID حقيقي للمتجر
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },

  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
    // default: new mongoose.Types.ObjectId("subCategory_id")
  },

}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
export default Product;


// Add this to your Product model file (productModel.js)

// After saving a new product, add it to the store's products array
productSchema.post('save', async function(doc) {
  if (this.isNew) { // Only for new products
    await mongoose.model('Store').findByIdAndUpdate(
      doc.store,
      { $addToSet: { products: doc._id } }, // $addToSet prevents duplicates
      { new: true }
    );
  }
});

// After deleting a product, remove it from the store's products array
productSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await mongoose.model('Store').findByIdAndUpdate(
      doc.store,
      { $pull: { products: doc._id } },
      { new: true }
    );
  }
});

// Handle bulk operations like insertMany
productSchema.post('insertMany', async function(docs) {
  if (docs && docs.length > 0) {
    const storeUpdates = new Map();
    
    docs.forEach(doc => {
      const storeId = doc.store.toString();
      if (!storeUpdates.has(storeId)) {
        storeUpdates.set(storeId, []);
      }
      storeUpdates.get(storeId).push(doc._id);
    });

    const updatePromises = Array.from(storeUpdates.entries()).map(([storeId, productIds]) => {
      return mongoose.model('Store').findByIdAndUpdate(
        storeId,
        { $addToSet: { products: { $each: productIds } } },
        { new: true }
      );
    });

    await Promise.all(updatePromises);
  }
});