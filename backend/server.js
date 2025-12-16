require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());

/* -------------------- MongoDB -------------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

/* -------------------- Schema -------------------- */
const SecretSchema = new mongoose.Schema({
  text: String,
  password: String,
  expiresAt: Date,
});

const Secret = mongoose.model("Secret", SecretSchema);

/* -------------------- API Routes -------------------- */

// Create secret
app.post("/create", async (req, res) => {
  try {
    const { text, password, expiresAt } = req.body;

    const secret = await Secret.create({
      text,
      password,
      expiresAt,
    });

    res.json({ id: secret._id });
  } catch (err) {
    res.status(500).json({ error: "Failed to create secret" });
  }
});

// Read secret
app.post("/read/:id", async (req, res) => {
  try {
    const { password } = req.body;
    const secret = await Secret.findById(req.params.id);

    if (!secret) {
      return res.status(404).json({ error: "Secret not found" });
    }

    if (secret.expiresAt && new Date() > secret.expiresAt) {
      await Secret.deleteOne({ _id: secret._id });
      return res.status(410).json({ error: "Secret expired" });
    }

    if (secret.password !== password) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const text = secret.text;
    await Secret.deleteOne({ _id: secret._id });

    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: "Failed to read secret" });
  }
});

/* -------------------- Frontend -------------------- */

// Serve frontend files
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// ✅ FIXED CATCH-ALL (NO '*')
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* -------------------- Start Server -------------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
