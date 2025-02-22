import express from "express";
import { adminRoute, protectRoute } from "../middleware/auth.middleware.js";
import {
  getAnalyticsData,
  getDailySalesData,
} from "../controllers/analytics.controller.js";

const router = express.Router();

// Route to get analytics data, protected for admin users only
router.get("/", protectRoute, adminRoute, async (req, res) => {
  try {
    // Fetch overall analytics data
    const analyticsData = await getAnalyticsData();

    // Calculate the date range for daily sales data (last 7 days)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch daily sales data within the calculated date range
    const dailySalesData = await getDailySalesData(startDate, endDate);

    // Respond with both analytics and daily sales data
    res.json({
      analyticsData,
      dailySalesData,
    });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in analytics route", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
