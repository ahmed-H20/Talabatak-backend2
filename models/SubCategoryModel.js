import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Subcategory name is required"],
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  image: {
    type: String,
    default: "",
  }
}, { timestamps: true });

const SubCategory = mongoose.model("SubCategory", subCategorySchema);
export default SubCategory;
