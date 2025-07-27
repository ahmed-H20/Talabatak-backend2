import Product from "../models/productModel.js"
import asyncHandler from "../middlewares/asyncHandler.js"

// @desc    Create a new product (Admin)
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, quantity, store, subCategory , category } = req.body;

  if (!name || !description || !price || !quantity || !store ) {
    throw new apiError("All required fields must be provided", 400);
  }

  const product = await Product.create({
    name,
    description,
    price,
    quantity,
    store,
    category: req.body.category, // Assuming category is also provided
    subCategory: req.body.subCategory, // Assuming subCategory is also provided
    discount: req.body.discount || 0, // Default to 0 if not provided
    images: req.body.images || [],
  });

  res.status(201).json({
    message: "Product created successfully",
    data: product,
  });
});


// @desc    Get all products (Public)
// @route   GET /api/products
export const getAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find()
    .populate("store", "name location") // populate store
    .populate("category", "name") // populate category
    .populate("subCategory", "name"); // populate subCategory

  res.status(200).json({
    message: "All products fetched",
    data: products,
  });
});


// @desc    Get single product by ID
// @route   GET /api/products/:id
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("store", "name location")
    .populate("subCategory", "name");

  if (!product) {
    throw new apiError("Product not found", 404);
  }

  res.status(200).json({
    message: "Product fetched successfully",
    data: product,
  });
});


// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const {
    name,
    description,
    images,
    price,
    quantity,
    discount,
    store,
    category,
    subCategory
  } = req.body;

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (images !== undefined) product.images = images;
  if (price !== undefined) product.price = price;
  if (quantity !== undefined) product.quantity = quantity;
  if (discount !== undefined) product.discount = discount;
  if (store !== undefined) product.store = store;
  if (category !== undefined) product.category = category;
  if (subCategory !== undefined) product.subCategory = subCategory;

  const updatedProduct = await product.save();

  res.status(200).json(updatedProduct);
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)

  if (!product) {
    res.status(404)
    throw new Error("Product not found")
  }

  await product.remove()
  res.status(200).json({ message: "Product deleted" })
})
