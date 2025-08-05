import Product from "../models/productModel.js"
import fs from "fs";
import csv from "csv-parser";
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import cloudinary from '../utils/cloudinary.js';
import Store from "../models/StoreModel.js";
import Category from "../models/categoryModel.js";
import SubCategory from "../models/SubCategoryModel.js"; // Add this import
import asyncHandler from "../middlewares/asyncHandler.js"
import { Readable } from 'stream';
import * as XLSX from 'xlsx';

const uploadToCloudinary = (buffer, filename, folder) => {
  return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
          {
              folder, // Folder in Cloudinary
              public_id: filename, // File name in Cloudinary
              resource_type: 'image', // Force image type
              format: 'jpeg',
              quality: 'auto', // Optimize quality dynamically
          },
          (error, result) => (error ? reject(error) : resolve(result))
      ).end(buffer);
  });
};

export const resizeProductImages = asyncHandler(async (req, res, next) => {
  try {
    // Array لتجميع كل الصور النهائية
    let finalImages = [];

    // ✅ 1. الصور الجاية من form-data (مرفوعة فعليًا)
    if (req.files?.images) {
      const uploadedImages = await Promise.all(
        req.files.images.map(async (img, index) => {
          const imageName = `product-${uuidv4()}-${index + 1}`;

          const buffer = await sharp(img.buffer)
            .resize(1200, 1600, {
              fit: sharp.fit.cover,
              position: sharp.strategy.center
            })
            .toFormat('jpeg')
            .jpeg({ quality: 95 })
            .toBuffer();

          const result = await uploadToCloudinary(buffer, imageName, 'products');

          return { url: result.secure_url };
        })
      );

      finalImages.push(...uploadedImages);
    }

    // ✅ 2. الصور الجاية كـ روابط (مثلاً من Postman أو Excel)
    if (req.body.images) {
      const imageLinks = Array.isArray(req.body.images)
        ? req.body.images
        : [req.body.images]; // لو جاية كـ string واحدة

      const validLinks = imageLinks
        .filter(link => typeof link === "string" && link.startsWith("http"))
        .map(link => ({ url: link }));

      finalImages.push(...validLinks);
    }

    // ✅ 3. احفظ كل الصور النهائية في req.body.images
    if (finalImages.length > 0) {
      req.body.images = finalImages;
    }

    // ✅ 4. صورة الغلاف imageCover
    if (req.files?.imageCover) {
      const imageCoverFileName = `product-${uuidv4()}-cover`;

      const buffer = await sharp(req.files.imageCover[0].buffer)
        .resize(1200, 1600, {
          fit: sharp.fit.cover,
          position: sharp.strategy.center
        })
        .toFormat('jpeg')
        .jpeg({ quality: 95 })
        .toBuffer();

      const result = await uploadToCloudinary(buffer, imageCoverFileName, 'products');
      req.body.imageCover = result.secure_url;
    } else if (req.body.imageCover?.startsWith("http")) {
      req.body.imageCover = req.body.imageCover; // اقبلها كما هي
    }

    next();
  } catch (error) {
    next(new Error('Error processing images', 500));
  }
});

// Helper function to validate category and subcategory relationship
const validateCategorySubcategory = async (categoryId, subCategoryId) => {
  // Check if category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error("Category not found", 404);
  }

  // If subcategory is provided, validate it belongs to the category
  if (subCategoryId) {
    const subCategory = await SubCategory.findById(subCategoryId);
    if (!subCategory) {
      throw new Error("Subcategory not found", 404);
    }

    // Check if subcategory belongs to the specified category
    if (subCategory.category.toString() !== categoryId.toString()) {
      throw new Error("Subcategory does not belong to the specified category", 400);
    }
  }

  return true;
};

// @desc    Create a new product (Admin)
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, quantity, discount, store, category, subCategory, unit } = req.body;

  // Validate required fields
  if (!name || !description || !price || !category || !store) {
    throw new Error("Please provide all required fields: name, description, price, category, store", 400);
  }

  // Validate store exists
  const storeExists = await Store.findById(store);
  if (!storeExists) {
    throw new Error("Store not found", 404);
  }

  // Validate category and subcategory relationship
  await validateCategorySubcategory(category, subCategory);

  // Create product data object
  const productData = {
    name,
    description,
    price: Number(price),
    quantity: Number(quantity) || 0,
    discount: Number(discount) || 0,
    store,
    category,
    images: req.body.images || [],
    unit: unit || 'كيلو'
  };

  // Add subcategory only if provided
  if (subCategory) {
    productData.subCategory = subCategory;
  }

  const product = await Product.create(productData);

  // 🔥 IMPORTANT: Add the product to the store's products array
  await Store.findByIdAndUpdate(
    store,
    { $push: { products: product._id } },
    { new: true }
  );

  // Populate the created product
  await product.populate([
    { path: 'category', select: 'name' },
    { path: 'store', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]);

  res.status(201).json({
    message: 'Product created successfully',
    data: product,
  });
});

// // @desc    Upload products from Excel file (Admin)
// // @route   POST /api/products/uploadExcel
// // @access  Private/Admin
// export const uploadProductsFromExcel = asyncHandler(async (req, res) => {
//   if (!req.file) {
//     throw new Error("No file uploaded", 400);
//   }

//   const filePath = req.file.path;
//   const ext = filePath.split(".").pop().toLowerCase();

//   let jsonData = [];

//   if (ext === "xlsx") {
//     const workbook = XLSX.readFile(filePath);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     jsonData = XLSX.utils.sheet_to_json(sheet);
//   } else if (ext === "csv") {
//     const csvData = await new Promise((resolve, reject) => {
//       const results = [];
//       fs.createReadStream(filePath)
//         .pipe(csv())
//         .on("data", (data) => results.push(data))
//         .on("end", () => resolve(results))
//         .on("error", (err) => reject(err));
//     });
//     jsonData = csvData;
//   } else {
//     throw new Error("Unsupported file format. Please use XLSX or CSV", 400);
//   }

//   const formattedData = [];
//   const errors = [];

//   for (let i = 0; i < jsonData.length; i++) {
//     const item = jsonData[i];
    
//     try {
//       // Validate required fields
//       if (!item.name || !item.category || !item.store) {
//         errors.push(`Row ${i + 1}: Missing required fields (name, category, store)`);
//         continue;
//       }

//       // Validate category and subcategory if provided
//       if (item.subCategory) {
//         await validateCategorySubcategory(item.category, item.subCategory);
//       }

//       // Process images
//       const images = [];
//       let index = 0;
//       while (item[`images[${index}].url`]) {
//         images.push({
//           url: item[`images[${index}].url`] || "",
//         });
//         index++;
//       }

//       const productData = {
//         name: item.name,
//         description: item.description || '',
//         price: Number(item.price) || 0,
//         quantity: Number(item.quantity) || 0,
//         discount: Number(item.discount) || 0,
//         store: item.store,
//         category: item.category,
//         images,
//         unit: item.unit || 'كيلو'
//       };

//       // Add subcategory only if provided
//       if (item.subCategory) {
//         productData.subCategory = item.subCategory;
//       }

//       formattedData.push(productData);
//     } catch (error) {
//       errors.push(`Row ${i + 1}: ${error.message}`);
//     }
//   }

//   if (errors.length > 0) {
//     return res.status(400).json({
//       message: "Some products could not be processed",
//       errors,
//       processedCount: formattedData.length
//     });
//   }

//   await Product.insertMany(formattedData);

//   res.status(201).json({
//     message: "Products uploaded successfully",
//     count: formattedData.length
//   });
// });

// @desc    Upload products from Excel file (Admin)
// @route   POST /api/products/uploadExcel
// @access  Private/Admin
export const uploadProductsFromExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new Error("No file uploaded", 400);
  }

  // Get file extension from original filename instead of path
  const ext = req.file.originalname.split(".").pop().toLowerCase();
  let jsonData = [];

  if (ext === "xlsx") {
    // Read from buffer instead of file path
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    jsonData = XLSX.utils.sheet_to_json(sheet);
  } else if (ext === "csv") {
    // Convert buffer to string and parse CSV using csv-parser
    const csvString = req.file.buffer.toString('utf8');
    const csvData = await new Promise((resolve, reject) => {
      const results = [];
      const readable = Readable.from([csvString]);
      
      readable
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });
    jsonData = csvData;
  } else {
    throw new Error("Unsupported file format. Please use XLSX or CSV", 400);
  }

  const formattedData = [];
  const errors = [];

  for (let i = 0; i < jsonData.length; i++) {
    const item = jsonData[i];
    
    try {
      // Validate required fields
      if (!item.name || !item.category || !item.store) {
        errors.push(`Row ${i + 1}: Missing required fields (name, category, store)`);
        continue;
      }

      // Find store by name (handle whitespace issues)
      let store = await Store.findOne({ name: item.store.trim() });
      if (!store) {
        store = await Store.findOne({ name: item.store });
      }
      if (!store) {
        errors.push(`Row ${i + 1}: Store '${item.store}' not found`);
        continue;
      }

      // Find category by name (handle whitespace issues)
      let category = await Category.findOne({ name: item.category.trim() });
      if (!category) {
        category = await Category.findOne({ name: item.category });
      }
      if (!category) {
        errors.push(`Row ${i + 1}: Category '${item.category}' not found`);
        continue;
      }

      // Find subcategory by name if provided (handle whitespace issues)
      let subCategory = null;
      if (item.subCategory) {
        subCategory = await SubCategory.findOne({ 
          name: item.subCategory.trim(),
          category: category._id 
        });
        if (!subCategory) {
          subCategory = await SubCategory.findOne({ 
            name: item.subCategory,
            category: category._id 
          });
        }
        if (!subCategory) {
          errors.push(`Row ${i + 1}: SubCategory '${item.subCategory}' not found in category '${item.category}'`);
          continue;
        }
      }

      // Process images
      const images = [];
      let index = 0;
      while (item[`images[${index}].url`]) {
        const imageUrl = item[`images[${index}].url`];
        if (imageUrl && imageUrl.trim()) {
          images.push(imageUrl.trim());
        }
        index++;
      }

      const productData = {
        name: item.name,
        description: item.description || '',
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
        discount: Number(item.discount) || 0,
        store: store._id, // Use the found store's ID
        category: category._id, // Use the found category's ID
        images,
        unit: item.unit || 'كيلو'
      };

      // Add subcategory ID if found
      if (subCategory) {
        productData.subCategory = subCategory._id;
      }

      formattedData.push(productData);
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Some products could not be processed",
      errors,
      processedCount: formattedData.length
    });
  }

  // Insert products
  const createdProducts = await Product.insertMany(formattedData);

  // 🔥 IMPORTANT: Update store products arrays
  const storeUpdates = new Map();
  
  createdProducts.forEach(product => {
    const storeId = product.store.toString();
    if (!storeUpdates.has(storeId)) {
      storeUpdates.set(storeId, []);
    }
    storeUpdates.get(storeId).push(product._id);
  });

  // Update each store with its new products
  const updatePromises = Array.from(storeUpdates.entries()).map(([storeId, productIds]) => {
    return Store.findByIdAndUpdate(
      storeId,
      { $push: { products: { $each: productIds } } },
      { new: true }
    );
  });

  await Promise.all(updatePromises);

  res.status(201).json({
    message: "Products uploaded successfully",
    count: formattedData.length
  });
});

// @desc    Get all products (Public)
// @route   GET /api/products
// @access  Public
export const getAllProducts = asyncHandler(async (req, res) => {
  const { category, subCategory, store } = req.query;
  
  // Build filter object
  const filter = {};
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;
  if (store) filter.store = store;

  const products = await Product.find(filter).populate([
    { path: 'category', select: 'name' },
    { path: 'store', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]);

  const formattedProducts = products.map((product) => {
    const discount = product.discount || 0;
    const discountedPrice = product.price * (1 - discount / 100);

    return {
      ...product.toObject(),
      discountedPrice: +discountedPrice.toFixed(2),
    };
  });
  
  res.status(200).json({
    message: "All products fetched",
    count: formattedProducts.length,
    data: formattedProducts,
  });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate([
    { path: 'category', select: 'name' },
    { path: 'store', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]);

  if (!product) {
    throw new Error("Product not found", 404);
  }

  const discount = product.discount || 0;
  const discountedPrice = product.price * (1 - discount / 100);

  res.status(200).json({
    message: "Product fetched successfully",
    data: {
      ...product.toObject(),
      discountedPrice: +discountedPrice.toFixed(2),
    },
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new Error("Product not found", 404);
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
    subCategory,
    unit
  } = req.body;

  // Validate category and subcategory relationship if they are being updated
  if (category || subCategory) {
    const categoryToValidate = category || product.category;
    const subCategoryToValidate = subCategory !== undefined ? subCategory : product.subCategory;
    
    if (subCategoryToValidate) {
      await validateCategorySubcategory(categoryToValidate, subCategoryToValidate);
    }
  }

  // Validate store if being updated
  if (store) {
    const storeExists = await Store.findById(store);
    if (!storeExists) {
      throw new Error("Store not found", 404);
    }
  }

  // Update fields
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (images !== undefined) product.images = images;
  if (price !== undefined) product.price = Number(price);
  if (quantity !== undefined) product.quantity = Number(quantity);
  if (discount !== undefined) product.discount = Number(discount);
  if (store !== undefined) product.store = store;
  if (category !== undefined) product.category = category;
  if (subCategory !== undefined) product.subCategory = subCategory;
  if (unit !== undefined) product.unit = unit;
  
  const updatedProduct = await product.save();

  await updatedProduct.populate([
    { path: 'category', select: 'name' },
    { path: 'store', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]);

  res.status(200).json({
    message: "Product updated successfully",
    data: updatedProduct
  });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new Error("Product not found", 404);
  }

  // Remove product from store's products array
  await Store.findByIdAndUpdate(
    product.store,
    { $pull: { products: product._id } },
    { new: true }
  );

  // Delete the product
  await Product.findByIdAndDelete(req.params.id);

  res.status(200).json({ message: "Product deleted successfully" });
});

// @desc    Increase all product prices for a specific store by a given percentage
// @route   PUT /api/products/increase-prices/:storeId
// @access  Private/Admin
export const increasePricesByPercentage = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { percentage } = req.body;

  if (!percentage || isNaN(percentage) || percentage <= 0) {
    throw new Error("Please provide a valid percentage greater than 0", 400);
  }

  // Verify store exists
  const store = await Store.findById(storeId);
  if (!store) {
    throw new Error("Store not found", 404);
  }

  const factor = 1 + percentage / 100;

  const result = await Product.updateMany(
    { store: storeId },
    [
      {
        $set: {
          price: { $multiply: ["$price", factor] }
        }
      }
    ]
  );

  res.status(200).json({
    message: `Prices increased by ${percentage}% for ${result.modifiedCount} product(s) in store: ${store.name}`,
    modifiedCount: result.modifiedCount
  });
});

// @desc    Get products by category with subcategories
// @route   GET /api/products/category/:categoryId
// @access  Public
export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { includeSubcategories = true } = req.query;

  // Verify category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error("Category not found", 404);
  }

  let filter = { category: categoryId };
  
  const products = await Product.find(filter).populate([
    { path: 'category', select: 'name' },
    { path: 'store', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]);

  const formattedProducts = products.map((product) => {
    const discount = product.discount || 0;
    const discountedPrice = product.price * (1 - discount / 100);

    return {
      ...product.toObject(),
      discountedPrice: +discountedPrice.toFixed(2),
    };
  });

  res.status(200).json({
    message: `Products in category: ${category.name}`,
    category: category.name,
    count: formattedProducts.length,
    data: formattedProducts,
  });
});

// @desc    Get products by subcategory
// @route   GET /api/products/subcategory/:subCategoryId
// @access  Public
export const getProductsBySubCategory = asyncHandler(async (req, res) => {
  const { subCategoryId } = req.params;

  // Verify subcategory exists
  const subCategory = await SubCategory.findById(subCategoryId).populate('category', 'name');
  if (!subCategory) {
    throw new Error("Subcategory not found", 404);
  }

  const products = await Product.find({ subCategory: subCategoryId }).populate([
    { path: 'category', select: 'name' },
    { path: 'store', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]);

  const formattedProducts = products.map((product) => {
    const discount = product.discount || 0;
    const discountedPrice = product.price * (1 - discount / 100);

    return {
      ...product.toObject(),
      discountedPrice: +discountedPrice.toFixed(2),
    };
  });

  res.status(200).json({
    message: `Products in subcategory: ${subCategory.name}`,
    category: subCategory.category.name,
    subCategory: subCategory.name,
    count: formattedProducts.length,
    data: formattedProducts,
  });
});