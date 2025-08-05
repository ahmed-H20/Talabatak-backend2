import sharp from 'sharp';
import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';
import asyncHandler from 'express-async-handler';

export const resizeAndUploadProductImages = asyncHandler(async (req, res, next) => {
  // Check if this is an Excel upload (single file, not image processing)
  if (req.file && req.file.mimetype && 
      (req.file.mimetype.includes('spreadsheet') || 
       req.file.mimetype.includes('csv'))) {
    return next(); // Skip image processing for Excel/CSV files
  }

  // No files to process
  if (!req.files || req.files.length === 0) return next();

  const uploadPromises = req.files.map(async (file) => {
    const buffer = await sharp(file.buffer)
      .resize(800, 800)
      .jpeg({ quality: 80 })
      .toBuffer();

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'products',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );

      streamifier.createReadStream(buffer).pipe(stream);
    });
  });

  try {
    const uploadedUrls = await Promise.all(uploadPromises);
    req.body.images = uploadedUrls;
    next();
  } catch (err) {
    next(err);
  }
});