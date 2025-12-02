import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import Trasporto from "./models/Trasporto.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// mongo
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err));

// ---------- AUTH ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing credentials" });

  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "4h" });
    return res.json({ token, user: { username } });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const token = header.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// ---------- TRASPORTI (protette) ----------
app.get("/api/trasporti", verifyToken, async (req, res) => {
  const list = await Trasporto.find().sort({ createdAt: -1 });
  res.json(list);
});

app.get("/api/trasporti/recent", verifyToken, async (req, res) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recent = await Trasporto.find({ createdAt: { $gte: oneWeekAgo } }).sort({ createdAt: -1 });
  res.json(recent);
});

app.post("/api/trasporti", verifyToken, async (req, res) => {
  const doc = new Trasporto(req.body);
  const saved = await doc.save();
  res.json(saved);
});

app.put("/api/trasporti/:id", verifyToken, async (req, res) => {
  const updated = await Trasporto.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// DELETE a trasporto by ID
app.delete("/api/trasporti/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Trasporto.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Trasporto not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting trasporto:", err);
    res.status(500).json({ error: "Failed to delete trasporto" });
  }
});


// quick test
app.get("/api/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
