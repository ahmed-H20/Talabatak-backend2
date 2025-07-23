import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import cookieParser from "cookie-parser"

dotenv.config();

const app = express();

app.use(cookieParser());


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes)



export default app;