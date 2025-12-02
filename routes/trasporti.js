import express from "express";
import Trasporto from "../models/Trasporto.js";

const router = express.Router();

// Get all trasporti
router.get("/", async (req, res) => {
  try {
    const trasporti = await Trasporto.find().sort({ createdAt: -1 });
    console.log("Fetching trasporti, first item checked state:", trasporti[0]?.checked);
    res.json(trasporti);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new trasporto
router.post("/", async (req, res) => {
  try {
    const newTrasporto = await Trasporto.create(req.body);
    res.status(201).json(newTrasporto);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update trasporto
router.put("/:id", async (req, res) => {
  try {
    console.log("Updating trasporto", req.params.id, "with data:", req.body);
    const updated = await Trasporto.findByIdAndUpdate(req.params.id, req.body, { new: true });
    console.log("Updated result:", updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete trasporto
router.delete("/:id", async (req, res) => {
  try {
    await Trasporto.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
