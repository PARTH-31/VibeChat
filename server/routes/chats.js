
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");
const User = require("../models/User");

const router = express.Router();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Please log in first.",
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId || !mongoose.isValidObjectId(decoded.userId)) {
      return res.status(401).json({
        message: "Invalid token.",
      });
    }

    req.userId = String(decoded.userId);
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

function getChatQuery(userId, otherUserId) {
  return {
    participants: {
      $all: [userId, otherUserId],
      $size: 2,
    },
  };
}

// Load conversation history
router.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (otherUserId === req.userId) {
      return res.status(400).json({
        message: "You cannot chat with yourself.",
      });
    }

    const chat = await Chat.findOne(
      getChatQuery(req.userId, otherUserId)
    ).populate("messages.sender", "name email");

    return res.json(chat || { messages: [] });
  } catch (error) {
    console.error("Fetch chat error:", error.message);

    return res.status(500).json({
      message: "Unable to load chat.",
    });
  }
});

// Save a message, then broadcast the server-loaded message
router.post("/:userId", authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim()
        : "";

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (otherUserId === req.userId) {
      return res.status(400).json({
        message: "You cannot message yourself.",
      });
    }

    if (!text) {
      return res.status(400).json({
        message: "Message cannot be empty.",
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        message: "Message is too long.",
      });
    }

    const recipient = await User.findById(otherUserId).select("_id");

    if (!recipient) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    let chat = await Chat.findOne(
      getChatQuery(req.userId, otherUserId)
    );

    if (!chat) {
      chat = new Chat({
        participants: [req.userId, otherUserId],
        messages: [],
      });
    }

    chat.messages.push({
      sender: req.userId,
      text,
    });

    await chat.save();

    const savedChat = await Chat.findById(chat._id).populate(
      "messages.sender",
      "name email"
    );

    const savedMessage =
      savedChat.messages[savedChat.messages.length - 1];

    // Broadcast only the message retrieved from MongoDB.
    // Both users must have joined this conversation room.
    if (req.io) {
      const chatKey = [req.userId, String(otherUserId)]
        .sort()
        .join(":");

      req.io.to(chatKey).emit("new-message", savedMessage);
    }

    return res.status(201).json(savedChat);
  } catch (error) {
    console.error("Send message error:", error.message);

    return res.status(500).json({
      message: "Unable to send message.",
    });
  }
});

module.exports = router;
