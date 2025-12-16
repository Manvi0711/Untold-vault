const express = require("express");
const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");
const path = require("path");
require("dotenv").config();

const app = express();

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json());

/* ======================
   SERVE FRONTEND
====================== */
const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

app.use(express.static(FRONTEND_PATH));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

/* ======================
   DATABASE CONNECTION
====================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

/* ======================
   SCHEMA
====================== */
const SecretSchema = new mongoose.Schema({
  text: String,
  passwordHash: String,
  expiresAt: Date
});

const Secret = mongoose.model("Secret", SecretSchema);

/* ======================
   CREATE SECRET
====================== */
app.post("/create", async (req, res) => {
  const { text, password, expiresAt } = req.body;

  if (!text || !password) {
    return res.status(400).send("Missing text or password");
  }

  let expiryDate;

  if (expiresAt) {
    // Set expiry to END of selected day
    expiryDate = new Date(expiresAt);
    expiryDate.setHours(23, 59, 59, 999);
  } else {
    // Default = 5 years
    expiryDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5);
  }

  const encryptedText = CryptoJS.AES.encrypt(text, password).toString();
  const passwordHash = CryptoJS.SHA256(password).toString();

  const secret = await Secret.create({
    text: encryptedText,
    passwordHash,
    expiresAt: expiryDate
  });

  res.json({
    id: secret._id,
    expiresAt: expiryDate
  });
});

/* ======================
   READ SECRET
====================== */
app.post("/read/:id", async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  const secret = await Secret.findById(id);

  if (!secret) {
    return res.send("Secret not found or expired");
  }

  // Expiry check
  if (new Date() > secret.expiresAt) {
    return res.send(
      `This secret expired on ${secret.expiresAt.toDateString()}`
    );
  }

  const passwordHash = CryptoJS.SHA256(password).toString();

  if (passwordHash !== secret.passwordHash) {
    return res.send("Wrong password");
  }

  const decryptedText = CryptoJS.AES.decrypt(
    secret.text,
    password
  ).toString(CryptoJS.enc.Utf8);

  res.send(
    `${decryptedText}\n\n(Expires on ${secret.expiresAt.toDateString()})`
  );
});

/* ======================
   START SERVER
====================== */
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
