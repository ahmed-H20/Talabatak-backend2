import app from './app.js'
import connectDB from './config/db.js'
import dotenv from 'dotenv'
import http from "http";
import { initSocket } from './socket/socket.js';

dotenv.config()

const PORT = process.env.PORT || 5000

connectDB()

const server = http.createServer(app);

initSocket(server); // Initialize Socket.io

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
