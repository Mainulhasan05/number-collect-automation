// index.js
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const OrderHistory = require("./models/orderHistorySchema");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });

const app = express();
const PORT = 5000;

app.use(express.json());

// Define a route to handle POST requests
app.post("/order-history", async (req, res) => {
  const { phone, customerName, customerEmail, orders } = req.body;

  if (!phone || !orders) {
    return res
      .status(400)
      .json({ error: "Phone number and orders are required" });
  }

  try {
    // Create or update the order history record in MongoDB
    const orderHistory = await OrderHistory.findOneAndUpdate(
      { phone },
      {
        phone,
        customerName,
        customerEmail,
        orders,
      },
      { upsert: true, new: true }
    );

    res.status(200).json(orderHistory);
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: "Error saving data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
