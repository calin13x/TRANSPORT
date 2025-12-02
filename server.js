// server.js (VERSIONE PRO)
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

// ----------------------
// Utility: token verify
// ----------------------
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

// ----------------------
// Connessione Mongo
// ----------------------
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

// ----------------------
// Helper: detect schema date field
// ----------------------
function findDateField(model) {
  // try common name 'data'
  if (model.schema.path("data")) return "data";
  // otherwise search any path that contains 'data' or 'date'
  const p = Object.keys(model.schema.paths).find(k => /data|date/i.test(k));
  return p || null;
}

// Helper: basic targa validation (very permissive)
function isValidTarga(t) {
  if (!t && t !== "") return false;
  // Italian license plate pattern approx: letters+numbers (very permissive)
  return /^[A-Z0-9\s\-]{1,20}$/i.test(String(t).trim());
}

// ----------------------
// TRASPORTI ROUTES
// ----------------------

// GET list with pagination & optional filters (simple)
app.get("/api/trasporti", verifyToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
    const skip = (page - 1) * limit;
    const sort = req.query.sort || "-createdAt";

    // Allow optional text search 'q' across a few fields
    const q = req.query.q ? String(req.query.q).trim() : null;

    const filters = {};

    // Simple filters by known query params
    if (req.query.cliente) filters.cliente = { $regex: req.query.cliente, $options: "i" };
    if (req.query.targa) filters.targa = { $regex: req.query.targa, $options: "i" };
    if (req.query.autista) {
      // try both autista_carico and autista_scarico fields
      filters.$or = [
        { autista_carico: { $regex: req.query.autista, $options: "i" } },
        { autista_scarico: { $regex: req.query.autista, $options: "i" } }
      ];
    }
    if (req.query.regione) filters.regione_carico = { $regex: req.query.regione, $options: "i" };

    // Date range (uses best-guess date field)
    const dateField = findDateField(Trasporto);
    if (dateField) {
      const from = req.query.data_from ? new Date(req.query.data_from) : null;
      const to = req.query.data_to ? new Date(req.query.data_to) : null;
      if (from || to) {
        filters[dateField] = {};
        if (from && !isNaN(from)) filters[dateField].$gte = from;
        if (to && !isNaN(to)) {
          // include entire day for 'to' param
          to.setHours(23, 59, 59, 999);
          filters[dateField].$lte = to;
        }
      }
    }

    // Global text search
    if (q) {
      filters.$or = filters.$or || [];
      const textFields = ["cliente", "modello", "modello", "targa", "carico", "scarico", "note", "indirizzo_ritiro"];
      for (const f of textFields) {
        if (Trasporto.schema.path(f)) {
          filters.$or.push({ [f]: { $regex: q, $options: "i" } });
        }
      }
    }

    const total = await Trasporto.countDocuments(filters);
    const list = await Trasporto.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      data: list
    });
  } catch (err) {
    console.error("GET /api/trasporti error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// SEARCH endpoint with more specific filters (alias to previous but kept separate)
app.get("/api/trasporti/search", verifyToken, async (req, res) => {
  // reuse the /api/trasporti logic by forwarding query params
  return app._router.handle(req, res, () => {}, "GET", "/api/trasporti");
});

// POST create new trasporto with light validation
app.post("/api/trasporti", verifyToken, async (req, res) => {
  try {
    const body = req.body || {};

    // Basic validations:
    if (body.targa && !isValidTarga(body.targa)) {
      return res.status(400).json({ error: "Targa non valida" });
    }

    // Normalize/parse date fields if present
    const dateField = findDateField(Trasporto);
    if (dateField && body[dateField]) {
      const d = new Date(body[dateField]);
      if (isNaN(d)) return res.status(400).json({ error: "Data non valida" });
      body[dateField] = d;
    }

    const doc = new Trasporto(body);
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /api/trasporti error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT replace entire doc (keep but warn: PUT overwrites)
app.put("/api/trasporti/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};

    if (body.targa && !isValidTarga(body.targa)) {
      return res.status(400).json({ error: "Targa non valida" });
    }

    const dateField = findDateField(Trasporto);
    if (dateField && body[dateField]) {
      const d = new Date(body[dateField]);
      if (isNaN(d)) return res.status(400).json({ error: "Data non valida" });
      body[dateField] = d;
    }

    const updated = await Trasporto.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: "Non trovato" });
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/trasporti/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH partial update
app.patch("/api/trasporti/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};

    if (body.targa && !isValidTarga(body.targa)) {
      return res.status(400).json({ error: "Targa non valida" });
    }

    const dateField = findDateField(Trasporto);
    if (dateField && body[dateField]) {
      const d = new Date(body[dateField]);
      if (isNaN(d)) return res.status(400).json({ error: "Data non valida" });
      body[dateField] = d;
    }

    const updated = await Trasporto.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: "Non trovato" });
    res.json(updated);
  } catch (err) {
    console.error("PATCH /api/trasporti/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE trasporto
app.delete("/api/trasporti/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await Trasporto.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ error: "Non trovato" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/trasporti/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// quick test
app.get("/api/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
