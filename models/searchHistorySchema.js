const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
  {
    startPhone: String,
    range: Number,
    resultsCount: Number,
    count: Number,
    lastPhone: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const SearchHistory = mongoose.model("SearchHistory", searchHistorySchema);

module.exports = SearchHistory;
