
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

require("dotenv").config();
require("dns").setServers(["8.8.8.8"]);

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Make Socket.IO available to API routes
app.use("/api/chats", (req, res, next) => {
  req.io = io;
  next();
});

// API routes — io is defined before these routes are loaded
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/chats", require("./routes/chats"));

const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return next(new Error("Invalid token"));
    }

    socket.userId = String(decoded.userId);
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;

  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
  io.emit("online-users", Array.from(onlineUsers.keys()));

  console.log("User connected:", userId);

  // Join a conversation room only if the other user exists
  socket.on("join-chat", async (otherUserId) => {
    try {
      if (
        typeof otherUserId !== "string" ||
        !mongoose.isValidObjectId(otherUserId) ||
        otherUserId === userId
      ) {
        return;
      }

      const User = require("./models/User");
      const otherUser = await User.findById(otherUserId).select("_id");

      if (!otherUser) return;

      const chatKey = [userId, otherUserId].sort().join(":");
      socket.join(chatKey);
    } catch (error) {
      console.error("Join chat error:", error.message);
    }
  });

  // Messages are broadcast by the authenticated chats API
  // after they have been saved in the database.
  // Do not accept client-supplied message objects here.

  socket.on("disconnect", () => {
    const count = onlineUsers.get(userId) || 0;

    if (count <= 1) {
      onlineUsers.delete(userId);
    } else {
      onlineUsers.set(userId, count - 1);
    }

    io.emit("online-users", Array.from(onlineUsers.keys()));
    console.log("User disconnected:", userId);
  });
});

app.get("/", (req, res) => {
  res.send("VibeChat server is running!");
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");

    server.listen(PORT, () => {
      console.log(`VibeChat server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

startServer();
