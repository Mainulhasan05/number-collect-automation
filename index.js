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

  let searchHistoryId;
  let totalResults = 0;
  const phoneNumbers = [];
  let resultsBatch = [];

  try {
    // Create search history entry at the beginning
    const searchHistory = new SearchHistory({
      startPhone,
      range,
      resultsCount: 0, // Initial count will be updated later
      lastPhone: null,
    });
    const savedSearchHistory = await searchHistory.save();
    searchHistoryId = savedSearchHistory._id;
    let searchCount = 0;
    // Generate phone numbers and fetch data
    for (let i = 0; i < range; i++) {
      const phone =
        // convert to integer, add i, convert back to string
        "0" + (parseInt(startPhone) + i).toString();

      phoneNumbers.push(phone);

      try {
        const response = await axios.get(
          `https://uddoktabd.com/ajax.php?phone=${phone}`
        );
        searchCount++;

        if (searchCount % 10 == 0) {
          await SearchHistory.findByIdAndUpdate(searchHistoryId, {
            count: searchCount,
            resultsCount: totalResults,
          });
        }

        const { customerName, customerEmail, data: orders } = response.data;

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
          if (resultsBatch.length >= 5) {
            await OrderHistory.insertMany(resultsBatch);
            totalResults += resultsBatch.length;
            resultsBatch.length = 0; // Clear the batch

            // Update search history with the current count
            await SearchHistory.findByIdAndUpdate(searchHistoryId, {
              resultsCount: totalResults,
              lastPhone: phone, // Update with the last processed phone number
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching data for phone ${phone}:`, error);
      }
    }

    // Insert remaining results if there are any
    if (resultsBatch.length > 0) {
      await OrderHistory.insertMany(resultsBatch);
      totalResults += resultsBatch.length;
    }

    // Final update of search history
    await SearchHistory.findByIdAndUpdate(searchHistoryId, {
      resultsCount: totalResults,
      lastPhone: phoneNumbers[phoneNumbers.length - 1], // Update with the last processed phone number
    });

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
