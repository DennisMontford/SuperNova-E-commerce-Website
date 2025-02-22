import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import { stripe } from "../lib/stripe.js";

// Controller to create a Stripe checkout session
export const createCheckoutSession = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    // Validate the products array
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid or empty products array" });
    }

    let totalAmount = 0;

    // Create line items for Stripe checkout
    const lineItems = products.map((product) => {
      // Convert price to cents
      const amount = Math.round(product.price * 100);
      // Calculate total amount
      totalAmount += amount * product.quantity;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            images: [product.image],
          },
          unit_amount: amount,
        },
        quantity: product.quantity || 1,
      };
    });

    let coupon = null;
    // Apply coupon discount if provided
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode,
        userId: req.user._id,
        isActive: true,
      });
      if (coupon) {
        // Apply discount percentage
        totalAmount -= Math.round(
          (totalAmount * coupon.discountPercentage) / 100
        );
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/purchase-cancel`,
      discounts: coupon
        ? [
            {
              coupon: await createStripeCoupon(coupon.discountPercentage),
            },
          ]
        : [],
      metadata: {
        userId: req.user._id.toString(),
        couponCode: couponCode || "",
        products: JSON.stringify(
          products.map((p) => ({
            id: p._id,
            quantity: p.quantity,
            price: p.price,
          }))
        ),
      },
    });

    // Create a new coupon if total amount exceeds 20000 cents ($200)
    if (totalAmount >= 20000) {
      await createNewCoupon(req.user._id);
    }
    // Respond with session ID and total amount in dollars
    res.status(200).json({ id: session.id, totalAmount: totalAmount / 100 });
  } catch (error) {
    // Log and respond with the error
    console.error("Error processing checkout:", error);
    res
      .status(500)
      .json({ message: "Error processing checkout", error: error.message });
  }
};

// Controller to handle successful checkout
export const checkoutSuccess = async (req, res) => {
  try {
    const { sessionId } = req.body;
    // Retrieve Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    if (session.payment_status === "paid") {
      // Deactivate coupon if used
      if (session.metadata.couponCode) {
        await Coupon.findOneAndUpdate(
          {
            code: session.metadata.couponCode,
            userId: session.metadata.userId,
          },
          {
            isActive: false,
          }
        );
      }

      // Create a new Order
      const products = JSON.parse(session.metadata.products);
      const newOrder = new Order({
        user: session.metadata.userId,
        products: products.map((product) => ({
          product: product.id,
          quantity: product.quantity,
          price: product.price,
        })),
        totalAmount: session.amount_total / 100, // Convert from cents to dollars
        stripeSessionId: sessionId,
      });

      await newOrder.save();

      // Respond with success message and order ID
      res.status(200).json({
        success: true,
        message:
          "Payment successful, order created, and coupon deactivated if used.",
        orderId: newOrder._id,
      });
    }
  } catch (error) {
    // Log and respond with the error
    console.error("Error processing successful checkout:", error);
    res.status(500).json({
      message: "Error processing successful checkout",
      error: error.message,
    });
  }
};

// Helper function to create a Stripe coupon
async function createStripeCoupon(discountPercentage) {
  const coupon = await stripe.coupons.create({
    percent_off: discountPercentage,
    duration: "once",
  });

  return coupon.id;
}

// Helper function to create a new coupon for the user
async function createNewCoupon(userId) {
  // Delete any existing coupon for the user
  await Coupon.findOneAndDelete({ userId });

  // Create a new coupon
  const newCoupon = new Coupon({
    code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    userId: userId,
  });

  await newCoupon.save();

  return newCoupon;
}
