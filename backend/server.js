const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const CryptoJS = require("crypto-js");
const path = require("path");
require("dotenv").config();

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());

/* =======================
   DATABASE
======================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

/* =======================
   SCHEMA
======================= */
const SecretSchema = new mongoose.Schema({
  content: String,
  password: String,
  expiresAt: Date,
});

const Secret = mongoose.model("Secret", SecretSchema);

/* =======================
   API ROUTES
======================= */

// Create secret
app.post("/create", async (req, res) => {
  try {
    const { text, password, expiryDate } = req.body;

    if (!text || !password || !expiryDate) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Encrypt secret
    const encrypted = CryptoJS.AES.encrypt(
      text,
      password
    ).toString();

    // Expire at END of selected day
    const expiresAt = new Date(expiryDate);
    expiresAt.setHours(23, 59, 59, 999);

    const secret = await Secret.create({
      content: encrypted,
      password,
      expiresAt,
    });

    res.json({ id: secret._id });
  } catch (err) {
    res.status(500).json({ error: "Failed to create secret" });
  }
});

// Get secret
app.post("/get/:id", async (req, res) => {
  try {
    const { password } = req.body;
    const secret = await Secret.findById(req.params.id);

    if (!secret) {
      return res.status(404).json({ error: "Secret not found" });
    }

    if (new Date() > secret.expiresAt) {
      await Secret.findByIdAndDelete(req.params.id);
      return res.status(410).json({ error: "Secret expired" });
    }

    if (password !== secret.password) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const bytes = CryptoJS.AES.decrypt(secret.content, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    res.json({ text: decrypted });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch secret" });
  }
});

/* =======================
   SERVE FRONTEND
======================= */

// Serve frontend folder
app.use(express.static(path.join(__dirname, "../frontend")));

// Always return frontend for unknown routes
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/index.html")
  );
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
