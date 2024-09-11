const mongoose = require("mongoose");

// Schema to track operator progress
const operatorProgressSchema = new mongoose.Schema(
  {
    operator: String, // e.g., 'Grameenphone', 'Banglalink', etc.
    prefix: String, // e.g., '017', '013'
    currentNumberIncreasing: Number, // The current phone number being processed (increasing)
    currentNumberDecreasing: Number, // The current phone number being processed (decreasing)
    limitNumber: Number, // The limit number (e.g., 01799999999 for GP)
  },
  { timestamps: true }
);

const OperatorProgress = mongoose.model(
  "OperatorProgress",
  operatorProgressSchema
);

module.exports = OperatorProgress;
