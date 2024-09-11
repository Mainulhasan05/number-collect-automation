const mongoose = require("mongoose");

const orderHistorySchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true },
    customerName: String,
    customerEmail: String,
    orders: [
      {
        courier: String,
        delivered: Number,
        returned: Number,
        total: Number,
        ratio: String,
      },
    ],
    collectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const OrderHistory = mongoose.model("OrderHistory", orderHistorySchema);

module.exports = OrderHistory;
