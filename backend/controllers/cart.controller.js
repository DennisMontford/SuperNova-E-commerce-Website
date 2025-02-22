import Product from "../models/product.model.js";

// Controller to get products in the user's cart
export const getCartProducts = async (req, res) => {
  try {
    // Find products in the database based on the product IDs in the user's cart
    const products = await Product.find({ _id: { $in: req.user.cartItems } });

    // Add quantity information to each product in the cart
    const cartItems = products.map((product) => {
      // Find the corresponding cart item in the user's cart to get the quantity
      const item = req.user.cartItems.find(
        (cartItem) => cartItem.id === product.id
      );
      // Return the product data along with the quantity
      return { ...product.toJSON(), quantity: item.quantity };
    });

    // Respond with the cart items
    res.json(cartItems);
  } catch (error) {
    // Log and respond with the error
    console.log("Error in getCartProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to add a product to the user's cart
export const addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    // Check if the product already exists in the cart
    const existingItem = user.cartItems.find((item) => item.id === productId);
    if (existingItem) {
      // If the product exists, increment the quantity
      existingItem.quantity += 1;
    } else {
      // If the product doesn't exist, add it to the cart with quantity 1
      user.cartItems.push(productId);
    }

    // Save the updated user data
    await user.save();
    // Respond with the updated cart items
    res.json(user.cartItems);
  } catch (error) {
    // Log and respond with the error
    console.log("Error in addToCart controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to remove a product from the user's cart or clear the entire cart
export const removeAllFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;
    // If productId is not provided, clear the entire cart
    if (!productId) {
      user.cartItems = [];
    } else {
      // If productId is provided, remove the specific product from the cart
      user.cartItems = user.cartItems.filter((item) => item.id !== productId);
    }
    // Save the updated user data
    await user.save();
    // Respond with the updated cart items
    res.json(user.cartItems);
  } catch (error) {
    // Respond with a server error
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to update the quantity of a product in the user's cart
export const updateQuantity = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { quantity } = req.body;
    const user = req.user;
    // Find the product in the user's cart
    const existingItem = user.cartItems.find((item) => item.id === productId);

    if (existingItem) {
      // If quantity is 0, remove the product from the cart
      if (quantity === 0) {
        user.cartItems = user.cartItems.filter((item) => item.id !== productId);
        await user.save();
        return res.json(user.cartItems);
      }

      // Update the quantity of the product
      existingItem.quantity = quantity;
      // Save the updated user data
      await user.save();
      // Respond with the updated cart items
      res.json(user.cartItems);
    } else {
      // Respond with a product not found message
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    // Log and respond with the error
    console.log("Error in updateQuantity controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
