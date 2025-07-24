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
  images: [
    {
      url: String,
      public_id: String,
    },
  ],
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
    default: () => new mongoose.Types.ObjectId("64b5fa6c76a7e6cc1c1f3f59"),
    // default: new mongoose.Types.ObjectId("category_id")
  },

  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
    // default: new mongoose.Types.ObjectId("subCategory_id")
  },

}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
