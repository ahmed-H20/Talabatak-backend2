import Category from '../models/categoryModel.js';
import asyncHandler from "../middlewares/asyncHandler.js"
import SubCategory from '../models/SubCategoryModel.js';

// @desc Create new category
export const createCategory = asyncHandler(async (req, res) => {
  const { name, image } = req.body;
  const newCategory = await Category.create({ name, image });
  res.status(201).json({ message: 'Category created', data: newCategory });
});

// @desc  Get all categories
export const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find();

  const categoriesWithSub = await Promise.all(
    categories.map(async (cat) => {
      const subCategories = await SubCategory.find({ category: cat._id });
      return {
        ...cat._doc,
        subCategories
      };
    })
  );

  res.status(200).json({ data: categoriesWithSub });
});

// @desc Update category
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) throw new Error('Category not found');
  res.status(200).json({ message: 'Category updated', data: category });
});

// @desc Delete category
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new Error('Category not found');
  res.status(200).json({ message: 'Category deleted' });
});
