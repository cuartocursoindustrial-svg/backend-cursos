// server.cjs - VERSIÓN CORREGIDA
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Importar rutas
const authRoutes = require("./routes/auth.cjs");
const cursoRoutes = require("./routes/cursos.cjs");

const app = express();

// 🔐 CONFIGURACIÓN SEGURA DE CORS PARA BLOGGER - VERSIÓN SIMPLIFICADA
const corsOptions = {
  origin: function (origin, callback) {
    // En producción, solo permitir dominios específicos
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://academiaohara.blogspot.com',
        'https://www.academiaohara.blogspot.com',
        'https://academiaohara.blogspot.es',
        'https://academiaohara.blogspot.com.ar',
        'https://academiaohara.blogspot.mx',
        'https://*.blogspot.com',
      'http://localhost:3000',            
      'http://localhost:8080',           
      'http://127.0.0.1:3000',          
      'http://127.0.0.1:8080',          
      ];
      
      // Permitir sin origen (Postman, curl)
      if (!origin) return callback(null, true);
      
      // Verificar origen
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          return origin.includes('.blogspot.com');
        }
        return origin === allowed;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log('❌ CORS bloqueado en producción para:', origin);
        callback(new Error('Origen no permitido'));
      }
    } else {
      // En desarrollo, permitir todo
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// MIDDLEWARES - ORDEN CORRECTO
app.use(cors(corsOptions)); // ✅ SOLO UNA VEZ, con las opciones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CONEXIÓN MONGODB
mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection;
db.on('error', (error) => {
  console.error('❌ Error de conexión a MongoDB:', error);
});
db.once('open', () => {
  console.log('✅ Conectado a MongoDB Atlas');
  console.log('📊 Base de datos:', db.name);
});

// 🔍 MIDDLEWARE PARA DEBUG (opcional)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    origin: req.headers.origin
  });
  next();
});

// RUTA DE PRUEBA MEJORADA
// En server.cjs, actualiza la ruta "/"
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API Academia Ohara - Backend Funcionando",
    version: "2.0.0",
    status: "online",
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: {
        registro: "POST /api/auth/registro",
        login: "POST /api/auth/login",
        perfil: "GET /api/auth/perfil",
        agregarCurso: "POST /api/auth/agregar-curso",  // ← AÑADE ESTA
        completarCurso: "POST /api/auth/completar-curso",
        progreso: {
          guardar: "POST /api/auth/progreso",
          obtener: "GET /api/auth/progreso/:cursoId"
        }
      },
      cursos: {
        todos: "GET /api/cursos",
        crear: "POST /api/cursos",
        detalle: "GET /api/cursos/:id"
      }
    },
    timestamp: new Date().toISOString(),
    cors: {
      allowed: process.env.NODE_ENV === 'production' ? 'Blogger domains only' : 'All origins (dev)'
    }
  });
});

// RUTAS
app.use("/api/auth", authRoutes);
app.use("/api/cursos", cursoRoutes);

// RUTA HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.path,
    method: req.method,
    available_endpoints: ["/", "/health", "/api/auth", "/api/cursos"]
  });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err.message);
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: "Token inválido" });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: "Token expirado" });
  }
  
  if (err.message === 'Origen no permitido') {
    return res.status(403).json({ 
      error: "CORS Error", 
      message: "Este origen no está permitido",
      allowed_origins: [
        'https://academiaohara.blogspot.com',
        'https://*.blogspot.com'
      ]
    });
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
  console.log(`🔒 CORS: ${process.env.NODE_ENV === 'production' ? 'Solo Blogger' : 'Todos los orígenes'}`);
});
