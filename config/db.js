import { connect } from 'mongoose'

const connectDB = async () => {
  try {
    await connect(process.env.MONGO_URI)
    console.log('✅ MongoDB Connected')
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err)
    process.exit(1)
  }
}

export default connectDB
