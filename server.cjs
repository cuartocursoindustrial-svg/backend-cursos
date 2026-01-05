// server.cjs - VERSIÓN FINAL CORREGIDA
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Importar rutas CORRECTAMENTE
const authRoutes = require("./routes/auth.cjs"); // Cambio 1: importar todo el objeto
const cursoRoutes = require("./routes/cursos.cjs");
const comentariosRoutes = require('./routes/comentarios.cjs');

const app = express();

// 🔐 CONFIGURACIÓN SEGURA DE CORS PARA BLOGGER
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
      
      // Permitir sin origen (Postman, curl, server-to-server)
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 horas
};

// MIDDLEWARES - ORDEN CORRECTO
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CONEXIÓN MONGODB MEJORADA
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const db = mongoose.connection;

db.on('error', (error) => {
  console.error('❌ Error de conexión a MongoDB:', error);
  if (error.name === 'MongoNetworkError') {
    console.error('🔄 Reintentando conexión en 5 segundos...');
    setTimeout(() => {
      mongoose.connect(process.env.MONGODB_URI);
    }, 5000);
  }
});

db.on('connected', () => {
  console.log('✅ Conectado a MongoDB Atlas');
  console.log('📊 Base de datos:', db.name);
  console.log('📈 Host:', db.host);
});

db.on('disconnected', () => {
  console.log('⚠️ Desconectado de MongoDB');
});

db.once('open', () => {
  console.log('🚀 Conexión MongoDB establecida');
});

// 🔍 MIDDLEWARE PARA DEBUG (opcional)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
    });
    console.log('Body:', req.body ? JSON.stringify(req.body).substring(0, 200) + '...' : 'empty');
    next();
  });
}

// RUTA DE PRUEBA MEJORADA
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API Academia Ohara - Backend Funcionando",
    version: "2.1.0",
    status: "online",
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        registro: "POST /api/auth/registro",
        login: "POST /api/auth/login",
        verifyEmail: "GET /api/auth/verify-email",
        resendVerification: "POST /api/auth/resend-verification",
        checkVerification: "GET /api/auth/check-verification",
        perfil: "GET /api/auth/perfil",
        agregarCurso: "POST /api/auth/agregar-curso",
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
      },
      comentarios: {
        porVideo: "GET /api/comentarios/video/:videoId",
        crear: "POST /api/comentarios",
        agregarRespuesta: "POST /api/comentarios/:comentarioId/respuestas",
        eliminar: "DELETE /api/comentarios/:comentarioId",
        eliminarRespuesta: "DELETE /api/comentarios/respuestas/:respuestaId",
        estadisticas: "GET /api/comentarios/estadisticas/:videoId"
      }
    },
    cors: {
      allowed: process.env.NODE_ENV === 'production' ? 'Blogger domains only' : 'All origins (dev)',
      current_origin: req.headers.origin || 'No origin header'
    }
  });
});

// RUTAS - CORRECCIÓN IMPORTANTE
// Cambio 2: Usar authRoutes.router (porque exportamos un objeto)
app.use("/api/auth", authRoutes.router); // ← ¡IMPORTANTE!
app.use("/api/cursos", cursoRoutes);
app.use('/api/comentarios', comentariosRoutes);

// RUTA HEALTH CHECK MEJORADA
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const isHealthy = dbStatus === 1;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: statusMap[dbStatus] || 'unknown',
      readyState: dbStatus,
      name: db.name,
      host: db.host
    },
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// RUTA PARA PRUEBAS DE AUTENTICACIÓN (solo desarrollo)
if (process.env.NODE_ENV !== 'production') {
  // Importar el middleware desde authRoutes
  const { authMiddleware } = require("./routes/auth.cjs");
  
  app.get("/api/test-auth", authMiddleware, (req, res) => {
    res.json({
      success: true,
      message: "✅ Middleware de autenticación funciona correctamente",
      user: req.user,
      timestamp: new Date().toISOString()
    });
  });
  
  // Ruta para probar CORS
  app.get("/api/test-cors", (req, res) => {
    res.json({
      success: true,
      message: "CORS configurado correctamente",
      origin: req.headers.origin,
      headers: req.headers
    });
  });
}

// MANEJADOR 404 MEJORADO
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      "/",
      "/health",
      "/api/auth/*",
      "/api/cursos/*",
      "/api/comentarios/*"
    ]
  });
});

// MANEJADOR GLOBAL DE ERRORES MEJORADO
app.use((err, req, res, next) => {
  console.error('🔥 Error Global:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    headers: req.headers
  });
  
  // Errores de CORS
  if (err.message === 'Origen no permitido') {
    return res.status(403).json({ 
      error: "CORS Error", 
      message: "Este origen no está permitido",
      your_origin: req.headers.origin,
      allowed_origins: process.env.NODE_ENV === 'production' 
        ? ['https://academiaohara.blogspot.com', 'https://*.blogspot.com']
        : ['All origins (dev mode)'],
      tip: "Asegúrate de que tu dominio esté en la lista de allowedOrigins en server.cjs"
    });
  }
  
  // Errores JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: "Token inválido",
      code: "INVALID_TOKEN"
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: "Token expirado",
      code: "TOKEN_EXPIRED"
    });
  }
  
  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));
    
    return res.status(400).json({
      error: "Error de validación",
      code: "VALIDATION_ERROR",
      details: errors
    });
  }
  
  // Error de duplicado en MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      error: "Registro duplicado",
      code: "DUPLICATE_KEY",
      field: field,
      value: err.keyValue[field],
      message: `El ${field} '${err.keyValue[field]}' ya está registrado`
    });
  }
  
  // Error genérico
  const statusCode = err.statusCode || 500;
  const response = {
    error: "Error interno del servidor",
    code: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
    requestId: req.id || Math.random().toString(36).substring(7)
  };
  
  // Solo incluir detalles en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    response.message = err.message;
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
});

// MANEJAR EXCEPCIONES NO CAPTURADAS
process.on('uncaughtException', (error) => {
  console.error('💥 Excepción no capturada:', error);
  // En producción, podrías reiniciar el proceso aquí
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Promesa rechazada no manejada:', reason);
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`
  🚀 Servidor Academia Ohara
  📍 Escuchando en: http://localhost:${PORT}
  🌍 Entorno: ${process.env.NODE_ENV || 'development'}
  🔒 CORS: ${process.env.NODE_ENV === 'production' ? 'Solo dominios permitidos' : 'Todos los orígenes'}
  🗄️  Base de datos: ${mongoose.connection.readyState === 1 ? '✅ Conectado' : '❌ Desconectado'}
  ⏰ Iniciado: ${new Date().toISOString()}
  `);
});

// MANEJAR CIERRE GRACIOSO
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    mongoose.connection.close(false, () => {
      console.log('✅ Conexión MongoDB cerrada');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT (Ctrl+C), cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    mongoose.connection.close(false, () => {
      console.log('✅ Conexión MongoDB cerrada');
      process.exit(0);
    });
  });
});

module.exports = app; // Para testing
