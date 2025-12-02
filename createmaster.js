require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User"); // assicurati che il modello User sia esportato qui

// Connetti a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log("MongoDB connected");

  // Controlla se l'utente master esiste già
  const existing = await User.findOne({ username: process.env.MASTER_USERNAME });
  if (existing) {
    console.log("Utente master già presente nel DB");
    process.exit();
  }

  // Hash della password e creazione dell'utente
  const hashed = await bcrypt.hash(process.env.MASTER_PASSWORD, 10);
  const user = new User({
    username: process.env.MASTER_USERNAME,
    password: hashed,
    role: "master"
  });

  await user.save();
  console.log(`Master user creato: ${process.env.MASTER_USERNAME}`);
  process.exit();
}).catch(err => {
  console.error("Errore connessione MongoDB:", err);
  process.exit(1);
});
