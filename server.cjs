// server.cjs - VERSIÓN ACTUALIZADA CON CORS SEGURO PARA BLOGGER
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Importar rutas
const authRoutes = require("./routes/auth.cjs");
const cursoRoutes = require("./routes/cursos.cjs"); // Nueva ruta de cursos

const app = express();
app.use(cors());  // ← ESTA LÍNEA ES CLAVE

// 🔐 CONFIGURACIÓN SEGURA DE CORS PARA BLOGGER
const corsOptions = {
  origin: function (origin, callback) {
    // Lista de dominios permitidos
    const allowedOrigins = [
      'https://academiaohara.blogspot.com',
      'https://www.academiaohara.blogspot.com',
      'https://academiaohara.blogspot.es',
      'https://academiaohara.blogspot.com.ar',
      'https://academiaohara.blogspot.mx',
      'http://localhost:5500',      // Desarrollo local
      'http://127.0.0.1:5500',
      'http://localhost:3000',      // Para pruebas del frontend
      'https://*.blogspot.com'      // Cualquier subdominio de Blogger
    ];
    
    // Permitir peticiones sin origen (Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // En desarrollo, permitir cualquier origen
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Verificar si el origen está permitido
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*.', '.*\.');
        return new RegExp(pattern).test(origin);
      }
      return origin === allowed;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS bloqueado para origen:', origin);
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// MIDDLEWARES
app.use(cors(corsOptions)); // 🔐 Usar configuración CORS segura
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HEADERS DE SEGURIDAD ADICIONALES
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CONECTAR A MONGODB - VERSIÓN CORREGIDA
// ✅ REMOVÍ LAS OPCIONES OBSOLETAS useNewUrlParser y useUnifiedTopology
mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection;

db.on('error', (error) => {
  console.error('❌ Error de conexión a MongoDB:', error);
});

db.once('open', () => {
  console.log('✅ Conectado a MongoDB Atlas');
  console.log('📊 Base de datos:', db.name);
});

// RUTA DE PRUEBA
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API Academia Ohara - Backend Funcionando",
    version: "2.0.0",
    endpoints: {
      auth: "/api/auth",
      cursos: "/api/cursos",
      perfil: "/api/auth/perfil"
    },
    status: "online",
    timestamp: new Date().toISOString()
  });
});

// RUTAS DE LA API
app.use("/api/auth", authRoutes);
app.use("/api/cursos", cursoRoutes); // Nueva ruta para cursos

// MANEJO DE ERRORES 404
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.path,
    method: req.method
  });
});

// MANEJO DE ERRORES GLOBALES
app.use((err, req, res, next) => {
  console.error('🔥 Error del servidor:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
  
  res.status(500).json({
    error: "Error interno del servidor",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS configurado para dominios de Blogger`);
});