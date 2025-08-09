import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import cookieParser from "cookie-parser"
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import subCategoryRoutes from './routes/SubCategoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import protectedRoutes from './routes/protectedRoute.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import storeRoutes from './routes/storeRoutes.js'

dotenv.config();

const app = express();

app.use(cookieParser());


// //Middleware
// app.use(cors({
//   origin: ['http://localhost:8080', 'https://your-frontend-url.com'],
//   credentials: true,
//   methods: ['GET', 'POST', 'PATCH','PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));


app.use(cors({
  origin: "*", 
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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
app.use('/api/protect', protectedRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/delivery', deliveryRoutes); 


export default app;