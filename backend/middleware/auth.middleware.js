import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// Middleware to protect routes by verifying the access token
export const protectRoute = async (req, res, next) => {
  try {
    // Extract the access token from cookies
    const accessToken = req.cookies.accessToken;

    // Check if the access token exists
    if (!accessToken) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No access token provided" });
    }

    try {
      // Verify the access token
      const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      // Find the user associated with the decoded user ID
      const user = await User.findById(decoded.userId).select("-password");

      // If the user is not found, respond with an unauthorized error
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Attach the user object to the request
      req.user = user;

      // Proceed to the next middleware or route handler
      next();
    } catch (error) {
      // Handle token expiration
      if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "Unauthorized - Access token expired" });
      }
      // Re-throw other errors for the outer catch block to handle
      throw error;
    }
  } catch (error) {
    // Log and respond with an unauthorized error for invalid tokens
    console.log("Error in protectRoute middleware", error.message);
    return res
      .status(401)
      .json({ message: "Unauthorized - Invalid access token" });
  }
};

// Middleware to protect admin-only routes
export const adminRoute = (req, res, next) => {
  // Check if the user is authenticated and has the admin role
  if (req.user && req.user.role === "admin") {
    // Proceed to the next middleware or route handler
    next();
  } else {
    // Respond with a forbidden error if the user is not an admin
    return res.status(403).json({ message: "Access denied - Admin only" });
  }
};
