import jwt from "jsonwebtoken"
import asyncHandler from 'express-async-handler';
import User from "../models/userModel.js"

export const protectRoute = asyncHandler(async(req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId).select("-password")
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" })
    }

    req.user = user
    next()

  } catch (error) {
    return res.status(401).json({ message: "Not authorized, invalid token" })
  }
});

