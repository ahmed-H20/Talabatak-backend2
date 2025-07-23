import jwt from "jsonwebtoken"
import User from "../models/userModel.js"

const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.token

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
}

export default protectRoute
