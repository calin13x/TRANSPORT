import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Utente non trovato" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Password errata" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Errore server" });
  }
});

// CREATE USER (solo MASTER)
router.post("/create", auth, async (req, res) => {
  try {
    if (req.user.role !== "MASTER")
      return res.status(403).json({ message: "Non autorizzato" });

    const { username, password, role } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "Utente già esistente" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed, role });
    await user.save();

    res.json({ message: "Utente creato con successo" });
  } catch (err) {
    res.status(500).json({ message: "Errore server" });
  }
});

// GET MY INFO
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

export default router;
