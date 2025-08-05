export const ORDER_NOTIFICATION_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Order Received</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 700px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
    h2 { color: #333; text-align: center; }
    p { font-size: 16px; color: #555; margin-bottom: 10px; }
    .info { margin-bottom: 20px; }
    .order-item { border-bottom: 1px solid #eee; padding: 10px 0; }
    .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; }
    .signature { margin-top: 30px; text-align: center; font-size: 14px; color: #333; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h2>📦 New Order Received</h2>
    <div class="info">
      <p><strong>Customer Name:</strong> {customerName}</p>
      <p><strong>Order ID:</strong> {orderId}</p>
      <p><strong>Store:</strong> {storeName}</p>
      <p><strong>Delivery Address:</strong> {deliveryAddress}</p>
    </div>

    <h3>Order Items:</h3>
    {orderItems}

    <p class="total">Delivery Fee: {deliveryFee} EGP</p>
    <p class="total">Total Price: {totalPrice} EGP</p>

    <p class="footer">This is an automated message. Please do not reply to this email.</p>
<div class="signature">Thank you,<br/>Talabtak Team</div>
</div>
</body>
</html>
`;