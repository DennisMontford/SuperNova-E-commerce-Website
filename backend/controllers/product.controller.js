import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/product.model.js";

// Controller to get all products
export const getAllProducts = async (req, res) => {
  try {
    // Find all products in the database
    const products = await Product.find({});
    // Respond with the products
    res.json({ products });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in getAllProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to get featured products
export const getFeaturedProducts = async (req, res) => {
  try {
    // Check if featured products are cached in Redis
    let featuredProducts = await redis.get("featured_products");
    if (featuredProducts) {
      // If cached, respond with the cached data
      return res.json(JSON.parse(featuredProducts));
    }

    // If not cached, fetch featured products from the database
    featuredProducts = await Product.find({ isFeatured: true }).lean();

    // If no featured products are found, respond with a 404 error
    if (!featuredProducts) {
      return res.status(404).json({ message: "No featured products found" });
    }

    // Cache the featured products in Redis
    await redis.set("featured_products", JSON.stringify(featuredProducts));

    // Respond with the featured products
    res.json(featuredProducts);
  } catch (error) {
    // Log and respond with the error
    console.log("Error in getFeaturedProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to create a new product
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, image, category } = req.body;

    let cloudinaryResponse = null;

    // Upload image to Cloudinary if provided
    if (image) {
      cloudinaryResponse = await cloudinary.uploader.upload(image, {
        folder: "products",
      });
    }

    // Create a new product in the database
    const product = await Product.create({
      name,
      description,
      price,
      image: cloudinaryResponse?.secure_url
        ? cloudinaryResponse.secure_url
        : "",
      category,
    });

    // Respond with the created product
    res.status(201).json(product);
  } catch (error) {
    // Log and respond with the error
    console.log("Error in createProduct controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to delete a product
export const deleteProduct = async (req, res) => {
  try {
    // Find the product by ID
    const product = await Product.findById(req.params.id);

    // If the product is not found, respond with a 404 error
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete the image from Cloudinary if it exists
    if (product.image) {
      const publicId = product.image.split("/").pop().split(".")[0];
      try {
        await cloudinary.uploader.destroy(`products/${publicId}`);
        console.log("deleted image from cloduinary");
      } catch (error) {
        console.log("error deleting image from cloduinary", error);
      }
    }

    // Delete the product from the database
    await Product.findByIdAndDelete(req.params.id);

    // Respond with a success message
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in deleteProduct controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to get recommended products
export const getRecommendedProducts = async (req, res) => {
  try {
    // Aggregate products to get a random sample of 4 products
    const products = await Product.aggregate([
      {
        $sample: { size: 4 },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          image: 1,
          price: 1,
        },
      },
    ]);

    // Respond with the recommended products
    res.json(products);
  } catch (error) {
    // Log and respond with the error
    console.log("Error in getRecommendedProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to get products by category
export const getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    // Find products by category
    const products = await Product.find({ category });
    // Respond with the products
    res.json({ products });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in getProductsByCategory controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller to toggle the featured status of a product
export const toggleFeaturedProduct = async (req, res) => {
  try {
    // Find the product by ID
    const product = await Product.findById(req.params.id);
    if (product) {
      // Toggle the featured status
      product.isFeatured = !product.isFeatured;
      // Save the updated product
      const updatedProduct = await product.save();
      // Update the featured products cache
      await updateFeaturedProductsCache();
      // Respond with the updated product
      res.json(updatedProduct);
    } else {
      // If the product is not found, respond with a 404 error
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    // Log and respond with the error
    console.log("Error in toggleFeaturedProduct controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper function to update the featured products cache
async function updateFeaturedProductsCache() {
  try {
    // Fetch featured products from the database
    const featuredProducts = await Product.find({ isFeatured: true }).lean();
    // Cache the featured products in Redis
    await redis.set("featured_products", JSON.stringify(featuredProducts));
  } catch (error) {
    // Log the error
    console.log("error in update cache function");
  }
}
