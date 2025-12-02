/**
 * importexcel.js
 *
 * 1. Legge usato.xlsx
 * 2. Genera automaticamente Trasporto.js in base agli header
 * 3. Importa tutti i dati in MongoDB
 *
 * COMMAND:
 *   node importexcel.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

dotenv.config();

const EXCEL_FILE = path.join(process.cwd(), "usato.xlsx");
const MODEL_FILE = path.join(process.cwd(), "models", "Trasporto.js");

// ----------------------
// COLONNE DA IMPORTARE
// ----------------------
const ALLOWED_HEADERS = [
  "#",
  "CLIENTE",
  "DATA",
  "MODELLO",
  "TARGA",
  "REGIONE CARICO",
  "CARICO",
  "SCARICO",
  "NOTE",
  "PAGAMENTO",
  "AUTISTA CARICO",
  "AUTISTA SCARICO",
  "INDIRIZZO RITIRO",
  "n° FATTURA",
  "DEPOSITO"
];

// ----------------------
// SAFE NORMALIZATION
// ----------------------
function normalizeHeader(name) {
  if (!name) return "field";
  let s = String(name).trim();

  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^a-zA-Z0-9 ]/g, "");
  s = s.replace(/\s+/g, "_");
  s = s.toLowerCase();

  if (!/^[a-z]/.test(s)) s = "f_" + s;

  return s;
}

// ----------------------
// TYPE DETECTION
// ----------------------
function detectType(header, values) {
  // Forza queste colonne a String
  const forceString = ["AUTISTA CARICO", "AUTISTA SCARICO"];
  if (forceString.includes(header)) return "String";

  let nums = 0, dates = 0, total = 0;
  for (const v of values) {
    if (v === "" || v === null || v === undefined) continue;
    total++;

    const str = String(v).trim();
    if (!isNaN(Number(str))) nums++;
    if (!isNaN(Date.parse(str))) dates++;
  }

  if (total === 0) return "String";
  if (dates / total > 0.6) return "Date";
  if (nums / total > 0.6) return "Number";
  return "String";
}

// ----------------------
// MAIN
// ----------------------
async function run() {
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error("❌ usato.xlsx NON trovato:", EXCEL_FILE);
    process.exit(1);
  }

  console.log("📄 Carico Excel:", EXCEL_FILE);

  const wb = XLSX.readFile(EXCEL_FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    console.error("❌ Excel vuoto.");
    process.exit(1);
  }

  // Filtra colonne ammesse
  const headers = Object.keys(rows[0]).filter(h => ALLOWED_HEADERS.includes(h));

  console.log("\n📌 Headers trovati e accettati:");
  console.table(headers);

  // Mappatura headers → campi schema
  const fields = headers.map(h => {
    const field = normalizeHeader(h);
    const sampleValues = rows.map(r => r[h]).slice(0, 200);
    const type = detectType(h, sampleValues);
    return { header: h, field, type };
  });

  // ----------------------
  // CREA MODELLO MONGOOSE
  // ----------------------
  const modelsDir = path.join(process.cwd(), "models");
  if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

  const schemaLines = fields
    .map(f => `  ${f.field}: { type: ${f.type} }, // ${f.header}`)
    .join("\n");

  const modelCode = `
import mongoose from "mongoose";

const TrasportoSchema = new mongoose.Schema({
${schemaLines}
}, { timestamps: true });

export default mongoose.model("Trasporto", TrasportoSchema);
`;

  fs.writeFileSync(MODEL_FILE, modelCode);
  console.log("\n📦 Creato modello:", MODEL_FILE);

  // ----------------------
  // IMPORTA IN MONGO
  // ----------------------
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI non impostato nel file .env");
    process.exit(1);
  }

  console.log("🔌 Connessione a Mongo...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Mongo connesso.");

  const Trasporto = (await import("./models/Trasporto.js")).default;

  const docs = rows.map(r => {
    const obj = {};
    for (const f of fields) {
      let val = r[f.header];

      if (f.type === "Date") {
        const d = Date.parse(String(val));
        obj[f.field] = isNaN(d) ? null : new Date(d);
      } else if (f.type === "Number") {
        obj[f.field] = Number(val) || 0;
      } else {
        obj[f.field] = String(val);
      }
    }
    return obj;
  });

  console.log(`⬆️ Importo ${docs.length} righe...`);

  await Trasporto.deleteMany({});
  await Trasporto.insertMany(docs);

  console.log("✅ Import completato!");

  console.log("\n📋 Mapping finale:");
  console.table(fields);

  await mongoose.disconnect();
  console.log("🔌 Mongo disconnesso.");
}

run().catch(err => {
  console.error("❌ ERRORE:", err);
  process.exit(1);
});
