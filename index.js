const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();
const OrderHistory = require("./models/orderHistorySchema");

// Connect to MongoDB using MONGO_URI from environment variables
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

// Static operators data
const operators = {
  Grameenphone: ["013", "017"],
  Banglalink: ["014", "019"],
  Teletalk: ["015"],
  Robi: ["016", "018"],
};

// Variable for setting after how many records to insert into MongoDB
const batchSize = 10;

// Operator progress schema
const operatorProgressSchema = new mongoose.Schema({
  operator: String,
  prefix: String,
  currentNumberIncreasing: Number,
  currentNumberDecreasing: Number,
  limitNumber: Number,
  isRunningIncreasing: { type: Boolean, default: false },
  isRunningDecreasing: { type: Boolean, default: false },
  collectedCount: { type: Number, default: 0 },
  lastEntryTime: Date,
});

const OperatorProgress = mongoose.model(
  "OperatorProgress",
  operatorProgressSchema
);

// Initialize progress for all operators if not already present
const initializeOperatorProgress = async () => {
  for (const [operator, prefixes] of Object.entries(operators)) {
    for (const prefix of prefixes) {
      const existingProgress = await OperatorProgress.findOne({ prefix });
      if (!existingProgress) {
        await new OperatorProgress({
          operator,
          prefix,
          currentNumberIncreasing: Number(`${prefix}00000000`),
          currentNumberDecreasing: Number(`${prefix}99999999`),
          limitNumber: Number(`${prefix}99999999`),
          collectedCount: 0,
        }).save();
      }
    }
  }
};

// Fetch phone data
const fetchPhoneData = async (phone) => {
  try {
    const response = await axios.get(
      `https://uddoktabd.com/ajax.php?phone=${phone}`
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching data for phone: ${phone}`, error);
    return null;
  }
};

// Validation function for response data
const isValidData = (data) => {
  if (!data.customerName) return false;

  return data.data.some((courier) => courier.total > 0);
};

// Batch saving to MongoDB
const saveBatchToMongoDB = async (dataBatch, progress) => {
  if (dataBatch.length === 0) return;

  // MongoDB insert logic here (e.g., insertMany)
  await OrderHistory.insertMany(dataBatch);
  console.log("Saved batch to MongoDB:", dataBatch.length);

  // Update operator progress after saving
  progress.collectedCount += dataBatch.length;
  progress.lastEntryTime = new Date();
  await progress.save();
};

// Increasing automation
const runAutomationIncreasing = async (progress) => {
  let { currentNumberIncreasing, limitNumber } = progress;
  const dataBatch = [];

  while (currentNumberIncreasing <= limitNumber) {
    const phone = currentNumberIncreasing.toString().padStart(11, "0");
    const result = await fetchPhoneData(phone);

    if (result && isValidData(result)) {
      dataBatch.push({
        phone,
        customerName: result.customerName,
        customerEmail: result.customerEmail,
        orders: result.data,
      });

      progress.currentNumberIncreasing = currentNumberIncreasing;
    }

    currentNumberIncreasing++;

    if (dataBatch.length >= batchSize) {
      await saveBatchToMongoDB(dataBatch, progress);
    }
  }

  // Save remaining data in case it's less than batchSize
  await saveBatchToMongoDB(dataBatch, progress);
};

// Decreasing automation
const runAutomationDecreasing = async (progress) => {
  let { currentNumberDecreasing, currentNumberIncreasing } = progress;
  const dataBatch = [];

  while (currentNumberDecreasing >= currentNumberIncreasing) {
    const phone = currentNumberDecreasing.toString().padStart(11, "0");

    const result = await fetchPhoneData(phone);

    if (result && isValidData(result)) {
      dataBatch.push({
        phone,
        customerName: result.customerName,
        customerEmail: result.customerEmail,
        orders: result.data,
      });

      progress.currentNumberDecreasing = currentNumberDecreasing;
    } else {
      console.log(`No data found for phone: ${phone}`);
    }

    currentNumberDecreasing--;

    if (dataBatch.length >= batchSize) {
      await saveBatchToMongoDB(dataBatch, progress);
    }
  }

  // Save remaining data in case it's less than batchSize
  await saveBatchToMongoDB(dataBatch, progress);
};

// API to start increasing automation for a specific operator
app.get("/start-operator-increasing/:prefix", async (req, res) => {
  const { prefix } = req.params;

  const progress = await OperatorProgress.findOne({ prefix });

  if (!progress) {
    return res.status(404).send("Operator prefix not found.");
  }

  if (progress.isRunningIncreasing) {
    return res
      .status(400)
      .send(`${prefix} increasing automation is already running.`);
  }

  // Mark the increasing automation as running
  progress.isRunningIncreasing = true;
  await progress.save();

  // Start the automation for increasing numbers
  runAutomationIncreasing(progress).then(async () => {
    progress.isRunningIncreasing = false;
    await progress.save();
  });

  res.send(`Started increasing automation for ${prefix}.`);
});

// API to start decreasing automation for a specific operator
app.get("/start-operator-decreasing/:prefix", async (req, res) => {
  const { prefix } = req.params;

  const progress = await OperatorProgress.findOne({ prefix });

  if (!progress) {
    return res.status(404).send("Operator prefix not found.");
  }

  if (progress.isRunningDecreasing) {
    return res
      .status(400)
      .send(`${prefix} decreasing automation is already running.`);
  }

  // Mark the decreasing automation as running
  progress.isRunningDecreasing = true;
  await progress.save();

  // Start the automation for decreasing numbers
  runAutomationDecreasing(progress).then(async () => {
    progress.isRunningDecreasing = false;
    await progress.save();
  });

  res.send(`Started decreasing automation for ${prefix}.`);
});

// API to get automation status
app.get("/get-automation-status", async (req, res) => {
  const progressList = await OperatorProgress.find();

  const status = progressList.map((progress) => ({
    operator: progress.operator,
    prefix: progress.prefix,
    isRunningIncreasing: progress.isRunningIncreasing,
    isRunningDecreasing: progress.isRunningDecreasing,
    collectedCount: progress.collectedCount,
    currentNumberIncreasing: progress.currentNumberIncreasing,
    currentNumberDecreasing: progress.currentNumberDecreasing,
    lastEntryTime: progress.lastEntryTime
      ? progress.lastEntryTime.toISOString()
      : "N/A",
  }));

  res.json(status);
});

// Initialize operator progress and start the server
initializeOperatorProgress().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
