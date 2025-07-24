import Store from '../models/StoreModel.js';
import asyncHandler from "../middlewares/asyncHandler.js"

// @desc    Create new store
export const createStore = asyncHandler(async (req, res) => {
  const newStore = await Store.create(req.body);
  res.status(201).json({ message: 'Store created', data: newStore });
});

// @desc    Get all stores
export const getAllStores = asyncHandler(async (req, res) => {
  const stores = await Store.find();
  res.status(200).json({ data: stores });
});

// @desc    Get single store
export const getSingleStore = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id);
  if (!store) throw new Error('Store not found');
  res.status(200).json({ data: store });
});

// @desc    Update store
export const updateStore = asyncHandler(async (req, res) => {
  const updatedStore = await Store.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updatedStore) throw new Error('Store not found');
  res.status(200).json({ message: 'Store updated', data: updatedStore });
});

// @desc    Delete store
export const deleteStore = asyncHandler(async (req, res) => {
  const store = await Store.findByIdAndDelete(req.params.id);
  if (!store) throw new Error('Store not found');
  res.status(200).json({ message: 'Store deleted' });
});
