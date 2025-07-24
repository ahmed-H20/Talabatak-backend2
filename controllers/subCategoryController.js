import SubCategory from '../models/subCategoryModel.js';
import asyncHandler from "../middlewares/asyncHandler.js"

// @desc    Create subcategory
export const createSubCategory = asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  const newSubCategory = await SubCategory.create({ name, category });
  res.status(201).json({ message: 'Subcategory created', data: newSubCategory });
});

// @desc    Get all subcategories
export const getAllSubCategories = asyncHandler(async (req, res) => {
  const subCategories = await SubCategory.find().populate('category', 'name');
  res.status(200).json({ data: subCategories });
});

// @desc    Update subcategory
export const updateSubCategory = asyncHandler(async (req, res) => {
  const subCategory = await SubCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!subCategory) throw new Error('Subcategory not found');
  res.status(200).json({ message: 'Subcategory updated', data: subCategory });
});

// @desc    Delete subcategory
export const deleteSubCategory = asyncHandler(async (req, res) => {
  const subCategory = await SubCategory.findByIdAndDelete(req.params.id);
  if (!subCategory) throw new Error('Subcategory not found');
  res.status(200).json({ message: 'Subcategory deleted' });
});
