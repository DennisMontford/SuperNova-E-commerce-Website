import Coupon from "../models/coupon.model.js";

// Controller to retrieve a coupon for the authenticated user
export const getCoupon = async (req, res) => {
  try {
    // Find an active coupon associated with the user's ID
    const coupon = await Coupon.findOne({
      userId: req.user._id,
      isActive: true,
    });
    // Respond with the coupon data or null if no coupon is found
    res.json(coupon || null);
  } catch (error) {
    // Log and respond with the error
    console.log("Error in getCoupon controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to validate a coupon code
export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    // Find a coupon with the given code, associated with the user, and active
    const coupon = await Coupon.findOne({
      code: code,
      userId: req.user._id,
      isActive: true,
    });

    // If no coupon is found, respond with a 404 error
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // Check if the coupon has expired
    if (coupon.expirationDate < new Date()) {
      // If expired, set isActive to false and save the coupon
      coupon.isActive = false;
      await coupon.save();
      // Respond with a 404 error indicating the coupon has expired
      return res.status(404).json({ message: "Coupon expired" });
    }

    // If the coupon is valid, respond with the coupon details
    res.json({
      message: "Coupon is valid",
      code: coupon.code,
      discountPercentage: coupon.discountPercentage,
    });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in validateCoupon controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
