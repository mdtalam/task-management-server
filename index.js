const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow frontend connections
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lszuq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// **MongoDB Collections**
let userCollection;
let taskCollection;

// **Connect to MongoDB**
async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB");

    const db = client.db("taskDb");
    userCollection = db.collection("userInfo");
    taskCollection = db.collection("tasks");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
}
connectDB();

// **Socket.IO Connection Handling**
io.on("connection", (socket) => {
  console.log("🔵 A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected:", socket.id);
  });
});

// ---------------------- 🔹 API Routes 🔹 ----------------------

// **1️⃣ Save User Info (If Not Exists)**
app.post("/users/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const user = req.body;

  try {
    const isExist = await userCollection.findOne(query);
    if (isExist) {
      return res.send(isExist);
    }
    const result = await userCollection.insertOne({
      ...user,
      timestamp: Date.now(),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to save user!" });
  }
});

// **2️⃣ Fetch All Tasks**
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await taskCollection.find().toArray();
    res.send(tasks);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch tasks!" });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { title, description, category } = req.body;

  if (!title || title.length > 50) {
    return res
      .status(400)
      .json({ error: "Title must be under 50 characters." });
  }
  if (description && description.length > 200) {
    return res
      .status(400)
      .json({ error: "Description must be under 200 characters." });
  }

  const newTask = {
    title,
    description: description || "",
    category: category || "To-Do",
    timestamp: new Date(),
  };

  try {
    const result = await taskCollection.insertOne(newTask);

    if (result.insertedId) {
      io.emit("task-updated"); // Notify all clients
      return res
        .status(201)
        .json({ message: "Task added successfully", task: newTask });
    } else {
      return res.status(500).json({ error: "Failed to insert task!" });
    }
  } catch (error) {
    console.error("Database Insert Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// **Start Server**
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
