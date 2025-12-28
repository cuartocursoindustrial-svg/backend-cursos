require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth.cjs");
const cursoRoutes = require("./routes/cursos.cjs");

const app = express();

/* ========================
   CORS CONFIGURACIÓN
======================== */
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV === "production") {
      if (origin.includes(".blogspot.com")) {
        return callback(null, true);
      }
      console.log("❌ CORS bloqueado:", origin);
      return callback(new Error("Origen no permitido"));
    }

    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ========================
   MONGODB
======================== */
mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on("error", err => {
  console.error("❌ MongoDB error:", err);
});

mongoose.connection.once("open", () => {
  console.log("✅ MongoDB conectado");
});

/* ========================
   LOGS (SOLO DEV)
======================== */
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    console.log("Origin:", req.headers.origin);
    next();
  });
}

/* ========================
   RUTAS
======================== */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "Academia Ohara API",
    env: process.env.NODE_ENV || "development"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/cursos", cursoRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime()
  });
});

/* ========================
   ERRORES
======================== */
app.use((err, req, res, next) => {
  if (err.message === "Origen no permitido") {
    return res.status(403).json({ error: "CORS bloqueado" });
  }

  console.error("🔥 Error:", err.message);
  res.status(500).json({ error: "Error interno" });
});

/* ========================
   SERVER
======================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
