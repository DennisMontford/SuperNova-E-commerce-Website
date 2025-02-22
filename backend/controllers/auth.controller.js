import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Function to generate access and refresh tokens for a user
const generateTokens = (userId) => {
  // Generate an access token with a 15-minute expiration
  const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
  // Generate a refresh token with a 7-day expiration
  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

// Function to store the refresh token in Redis
const storeRefreshToken = async (userId, refreshToken) => {
  // Store the refresh token in Redis with a 7-day expiration
  await redis.set(
    `refresh_token:${userId}`,
    refreshToken,
    "EX", // Set the key to expire
    7 * 24 * 60 * 60 // Expiration time in seconds (7 days)
  );
};

// Function to set access and refresh tokens as HTTP-only cookies
const setCookies = (res, accessToken, refreshToken) => {
  // Set the access token cookie
  res.cookie("accessToken", accessToken, {
    httpOnly: true, // Prevent client-side JavaScript access
    secure: process.env.NODE_ENV === "production", // Set secure flag in production
    sameSite: "strict", // Prevent cross-site request forgery
    maxAge: 15 * 60 * 1000, // Cookie expiration time (15 minutes)
  });
  // Set the refresh token cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Prevent client-side JavaScript access
    secure: process.env.NODE_ENV === "production", // Set secure flag in production
    sameSite: "strict", // Prevent cross-site request forgery
    maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expiration time (7 days)
  });
};

// Signup controller
export const signup = async (req, res) => {
  const { email, password, name } = req.body;
  try {
    // Check if a user with the given email already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    // Create a new user
    const user = await User.create({ name, email, password });

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    // Store the refresh token in Redis
    await storeRefreshToken(user._id, refreshToken);

    // Set the tokens as cookies
    setCookies(res, accessToken, refreshToken);

    // Respond with the created user's data
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Find the user by email
    const user = await User.findOne({ email });

    // Check if the user exists and the password is correct
    if (user && (await user.comparePassword(password))) {
      // Generate access and refresh tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      // Store the refresh token in Redis
      await storeRefreshToken(user._id, refreshToken);
      // Set the tokens as cookies
      setCookies(res, accessToken, refreshToken);

      // Respond with the user's data
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      // Respond with invalid credentials message
      res.status(400).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    // Log and respond with the error
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Logout controller
export const logout = async (req, res) => {
  try {
    // Get the refresh token from cookies
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      // Verify the refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      // Delete the refresh token from Redis
      await redis.del(`refresh_token:${decoded.userId}`);
    }

    // Clear access and refresh token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    // Respond with logout success message
    res.json({ message: "logout successful" });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "server error", error: error.message });
  }
};

// Refresh token controller
export const refreshToken = async (req, res) => {
  try {
    // Get the refresh token from cookies
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "no refresh token provided" });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    // Retrieve the stored refresh token from Redis
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

    // Check if the stored token matches the provided token
    if (storedToken !== refreshToken) {
      return res.status(401).json({ message: "invalid refresh token" });
    }

    // Generate a new access token
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      }
    );

    // Set the new access token as a cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    // Respond with refresh token success message
    res.json({ message: "refresh token successful" });
  } catch (error) {
    // Log and respond with the error
    console.log("Error in refresh token controller", error.message);
    res.status(500).json({ message: "server error", error: error.message });
  }
};

// Get profile controller
export const getProfile = async (req, res) => {
  try {
    // Respond with the user's data from the request object
    res.json(req.user);
  } catch (error) {
    // Respond with a server error
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
