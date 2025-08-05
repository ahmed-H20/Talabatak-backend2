import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
    {
        cartItems: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product'
                },
                quantity: {
                    type: Number,
                    default: 1,
                    min: [1, 'Quantity cannot be less than 1']
                },
                price: {
                    type: Number,
                    required: true
                },
                //color: String
            },
        ],
        totalCartPrice: {
            type: Number,
            default: 0
        },
        totalPriceAfterDiscount: {
            type: Number,
            default: 0
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: '7d'
        }
    },
    { timestamps: true }
);

export default mongoose.model('Cart', cartSchema);