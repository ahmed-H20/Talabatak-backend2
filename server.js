import app from './app.js'
import connectDB from './config/db.js'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 5000

connectDB()

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
