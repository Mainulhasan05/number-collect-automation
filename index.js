const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const OrderHistory = require("./models/orderHistorySchema");
const SearchHistory = require("./models/searchHistorySchema");
const axios = require("axios");
const cors = require("cors");

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

app.use(cors());
app.use(express.json());

app.post("/order-history", async (req, res) => {
  const { startPhone, range } = req.body;

  if (!startPhone || !range) {
    return res
      .status(400)
      .json({ error: "Starting phone number and range are required" });
  }

  try {
    let totalResults = 0;
    const phoneNumbers = [];
    let resultsBatch = [];
    const promises = [];

    // Generate phone numbers and fetch data
    for (let i = 0; i < range; i++) {
      const phone =
        startPhone.slice(0, -1) + (parseInt(startPhone.slice(-1), 10) + i);
      phoneNumbers.push(phone);

      // Fetch data for each phone number
      promises.push(
        axios
          .get(`https://uddoktabd.com/ajax.php?phone=${phone}`)
          .then(async (response) => {
            const { customerName, customerEmail, data: orders } = response.data;

            // Check if customerName is present or if any delivered count is greater than 0
            const hasResults =
              customerName || orders.some((order) => order.delivered > 0);

            if (hasResults) {
              // Collect results
              resultsBatch.push({
                phone,
                customerName,
                customerEmail,
                orders,
              });

              // Insert into MongoDB in batches of 10
              if (resultsBatch.length >= 10) {
                await OrderHistory.insertMany(resultsBatch);
                totalResults += resultsBatch.length;
                resultsBatch.length = 0; // Clear the batch
              }
            }
          })
          .catch((error) =>
            console.error(`Error fetching data for phone ${phone}:`, error)
          )
      );
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    // Insert remaining results if there are any
    if (resultsBatch.length > 0) {
      await OrderHistory.insertMany(resultsBatch);
      totalResults += resultsBatch.length;
    }

    // Determine the last phone number
    const lastPhone = phoneNumbers[phoneNumbers.length - 1];

    // Save search history to MongoDB
    const searchHistory = new SearchHistory({
      startPhone,
      range,
      resultsCount: totalResults,
      lastPhone,
    });
    await searchHistory.save();

    res
      .status(200)
      .json({ message: "Search completed", resultsCount: totalResults });
  } catch (error) {
    console.error("Error processing data:", error);
    res.status(500).json({ error: "Error processing data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
