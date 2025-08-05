import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import cookieParser from "cookie-parser"
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import subCategoryRoutes from './routes/subCategoryRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import cartRoutes from './routes/cartRoutes.js';

dotenv.config();

const app = express();

app.use(cookieParser());


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes)
app.use("/api/subcategories", subCategoryRoutes)
app.use("/api/stores", storeRoutes)
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/cart", cartRoutes);
app.use('/uploads', express.static('uploads'));


export default app;