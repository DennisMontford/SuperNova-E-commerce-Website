import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";

// Function to get overall analytics data
export const getAnalyticsData = async () => {
  // Count the total number of users
  const totalUsers = await User.countDocuments();
  // Count the total number of products
  const totalProducts = await Product.countDocuments();

  // Aggregate order data to calculate total sales and revenue
  const salesData = await Order.aggregate([
    {
      $group: {
        _id: null, // Group all orders into a single group
        totalSales: { $sum: 1 }, // Count the total number of orders
        totalRevenue: { $sum: "$totalAmount" }, // Sum the total amount of all orders
      },
    },
  ]);

  // Extract total sales and revenue from the aggregated data
  const { totalSales, totalRevenue } = salesData[0] || {
    totalSales: 0, // Default to 0 if no orders exist
    totalRevenue: 0, // Default to 0 if no orders exist
  };

  // Return the analytics data
  return {
    users: totalUsers,
    products: totalProducts,
    totalSales,
    totalRevenue,
  };
};

// Function to get daily sales data within a specified date range
export const getDailySalesData = async (startDate, endDate) => {
  try {
    // Aggregate order data to calculate daily sales and revenue
    const dailySalesData = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate, // Filter orders created after or on the start date
            $lte: endDate, // Filter orders created before or on the end date
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // Group orders by date (YYYY-MM-DD)
          sales: { $sum: 1 }, // Count the number of orders for each day
          revenue: { $sum: "$totalAmount" }, // Sum the total amount of orders for each day
        },
      },
      { $sort: { _id: 1 } }, // Sort the results by date in ascending order
    ]);
    // Generate an array of dates within the specified range
    const dateArray = getDatesInRange(startDate, endDate);

    // Map the date array to include sales and revenue data for each date
    return dateArray.map((date) => {
      // Find the corresponding data from the aggregated results
      const foundData = dailySalesData.find((item) => item._id === date);

      // Return the date, sales, and revenue data (default to 0 if no data found)
      return {
        date,
        sales: foundData?.sales || 0,
        revenue: foundData?.revenue || 0,
      };
    });
  } catch (error) {
    // Throw any errors that occur during the aggregation process
    throw error;
  }
};

// Function to generate an array of dates within a specified range
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);

  // Loop through the dates from start to end
  while (currentDate <= endDate) {
    // Add the current date (YYYY-MM-DD format) to the array
    dates.push(currentDate.toISOString().split("T")[0]);
    // Increment the current date by one day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Return the array of dates
  return dates;
}
