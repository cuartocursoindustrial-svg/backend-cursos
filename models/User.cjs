// models/User.cjs - VERSIÓN COMPLETA CON TOKENS DE ACCESO
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    unique: true,
    required: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  cursosComprados: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Curso' 
  }],
  cursosCompletados: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Curso' 
  }],
  fechaRegistro: {
    type: Date,
    default: Date.now
  },
  ultimoAcceso: {
    type: Date,
    default: Date.now
  },
  avatar: {
    type: String,
    default: function() {
      return this.nombre ? this.nombre.charAt(0).toUpperCase() : "U";
    }
  },
  
  // VERIFICACIÓN DE EMAIL
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  verificationSentAt: Date,
  
  // TOKENS DE ACCESO TEMPORAL A CURSOS
  accessTokens: [{
    cursoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curso',
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    },
    lastAccessed: Date,
    accessCount: {
      type: Number,
      default: 0
    },
    ipAddress: String,
    userAgent: String
  }],
  
  // SEGUIMIENTO DE ACCESOS
  accessLogs: [{
    cursoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curso'
    },
    accessDate: {
      type: Date,
      default: Date.now
    },
    tokenUsed: String,
    ipAddress: String,
    userAgent: String,
    duration: Number // en segundos
  }],
  
  // CONFIGURACIÓN DEL USUARIO
  settings: {
    sessionTimeout: {
      type: Number,
      default: 24 // horas
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto']
    }
  }
}, {
  timestamps: true
});

// ============================================
// ÍNDICES PARA MEJOR RENDIMIENTO
// ============================================
userSchema.index({ email: 1 });
userSchema.index({ "accessTokens.token": 1 });
userSchema.index({ "accessTokens.expiresAt": 1 });
userSchema.index({ "cursosComprados": 1 });
userSchema.index({ "verificationToken": 1 }, { sparse: true });

// ============================================
// MÉTODOS DE INSTANCIA
// ============================================

/**
 * Generar token de acceso temporal para un curso
 * @param {ObjectId} cursoId - ID del curso
 * @param {Object} metadata - Información adicional (ip, userAgent)
 * @returns {String} Token de acceso
 */
userSchema.methods.generateCourseAccessToken = function(cursoId, metadata = {}) {
  const payload = {
    userId: this._id,
    cursoId: cursoId,
    type: 'course_access',
    generationTime: Date.now(),
    uniqueId: crypto.randomBytes(16).toString('hex')
  };

  // Generar token JWT
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || 'fallback_secret_para_desarrollo',
    { expiresIn: '1h' }
  );

  // Calcular fecha de expiración
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Crear objeto del token
  const tokenData = {
    cursoId: cursoId,
    token: token,
    createdAt: new Date(),
    expiresAt: expiresAt,
    used: false,
    accessCount: 0,
    ipAddress: metadata.ipAddress || null,
    userAgent: metadata.userAgent || null
  };

  // Limpiar tokens expirados antes de agregar uno nuevo
  this.cleanExpiredTokens();

  // Agregar token a la lista
  this.accessTokens.push(tokenData);

  return token;
};

/**
 * Verificar si un token es válido para un curso
 * @param {String} token - Token a verificar
 * @param {ObjectId} cursoId - ID del curso
 * @returns {Object|null} Datos del token o null si no es válido
 */
userSchema.methods.verifyCourseAccessToken = function(token, cursoId) {
  // Primero verificar en tokens almacenados
  const storedToken = this.accessTokens.find(t => 
    t.token === token && 
    t.cursoId.toString() === cursoId.toString()
  );

  if (!storedToken) {
    return null; // Token no encontrado
  }

  // Verificar si está expirado
  if (new Date() > storedToken.expiresAt) {
    return null; // Token expirado
  }

  // Verificar si ya fue usado (puedes quitar esto si quieres múltiples accesos)
  if (storedToken.used) {
    return null; // Token ya usado
  }

  // Verificar con JWT
  try {
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'fallback_secret_para_desarrollo'
    );

    // Verificar que coincidan los IDs
    if (decoded.userId !== this._id.toString() || 
        decoded.cursoId !== cursoId.toString()) {
      return null;
    }

    // Actualizar contador y último acceso
    storedToken.accessCount += 1;
    storedToken.lastAccessed = new Date();
    
    // Marcar como usado después de X accesos (ej: 3 accesos)
    if (storedToken.accessCount >= 3) {
      storedToken.used = true;
    }

    return {
      valid: true,
      token: storedToken,
      decoded: decoded,
      remainingAccess: 3 - storedToken.accessCount
    };

  } catch (error) {
    console.error("Error verifying token:", error.message);
    return null;
  }
};

/**
 * Limpiar tokens expirados
 */
userSchema.methods.cleanExpiredTokens = function() {
  const now = new Date();
  
  // Filtrar tokens no expirados
  this.accessTokens = this.accessTokens.filter(token => 
    token.expiresAt > now
  );
};

/**
 * Invalidar todos los tokens de un curso
 * @param {ObjectId} cursoId - ID del curso
 */
userSchema.methods.invalidateCourseTokens = function(cursoId) {
  this.accessTokens = this.accessTokens.filter(token => 
    token.cursoId.toString() !== cursoId.toString()
  );
};

/**
 * Invalidar un token específico
 * @param {String} token - Token a invalidar
 */
userSchema.methods.invalidateToken = function(token) {
  this.accessTokens = this.accessTokens.filter(t => t.token !== token);
};

/**
 * Verificar si el usuario tiene acceso a un curso
 * @param {ObjectId} cursoId - ID del curso
 * @returns {Boolean}
 */
userSchema.methods.hasCourseAccess = function(cursoId) {
  return this.cursosComprados.some(compradoId => 
    compradoId.toString() === cursoId.toString()
  );
};

/**
 * Agregar curso comprado
 * @param {ObjectId} cursoId - ID del curso
 */
userSchema.methods.addPurchasedCourse = function(cursoId) {
  if (!this.hasCourseAccess(cursoId)) {
    this.cursosComprados.push(cursoId);
  }
};

/**
 * Marcar curso como completado
 * @param {ObjectId} cursoId - ID del curso
 */
userSchema.methods.markCourseCompleted = function(cursoId) {
  if (this.hasCourseAccess(cursoId) && 
      !this.cursosCompletados.includes(cursoId)) {
    this.cursosCompletados.push(cursoId);
  }
};

/**
 * Registrar acceso a un curso
 * @param {ObjectId} cursoId - ID del curso
 * @param {String} token - Token usado
 * @param {Object} metadata - Información adicional
 */
userSchema.methods.logCourseAccess = function(cursoId, token, metadata = {}) {
  this.accessLogs.push({
    cursoId: cursoId,
    accessDate: new Date(),
    tokenUsed: token,
    ipAddress: metadata.ipAddress || null,
    userAgent: metadata.userAgent || null,
    duration: metadata.duration || 0
  });

  // Limitar el tamaño del log (últimos 100 accesos)
  if (this.accessLogs.length > 100) {
    this.accessLogs = this.accessLogs.slice(-100);
  }

  this.ultimoAcceso = new Date();
};

/**
 * Obtener estadísticas de acceso del usuario
 * @returns {Object} Estadísticas
 */
userSchema.methods.getAccessStats = function() {
  return {
    totalCourses: this.cursosComprados.length,
    completedCourses: this.cursosCompletados.length,
    lastAccess: this.ultimoAcceso,
    totalAccessLogs: this.accessLogs.length,
    activeTokens: this.accessTokens.filter(t => !t.used && new Date() < t.expiresAt).length
  };
};

// ============================================
// MIDDLEWARE (HOOKS)
// ============================================

// Limpiar tokens expirados antes de guardar
userSchema.pre('save', function(next) {
  if (this.accessTokens && this.accessTokens.length > 0) {
    this.cleanExpiredTokens();
  }
  next();
});

// Limpiar tokens expirados antes de consultas find
userSchema.pre('find', function() {
  this.cleanExpiredTokens = function() {
    const now = new Date();
    this.accessTokens = this.accessTokens.filter(token => 
      token.expiresAt > now
    );
  };
});

// ============================================
// MÉTODOS ESTÁTICOS
// ============================================

/**
 * Buscar usuario por token de acceso
 * @param {String} token - Token de acceso
 * @returns {Promise<User>} Usuario encontrado
 */
userSchema.statics.findByAccessToken = async function(token) {
  return this.findOne({ "accessTokens.token": token });
};

/**
 * Buscar usuario por token de verificación
 * @param {String} token - Token de verificación
 * @returns {Promise<User>} Usuario encontrado
 */
userSchema.statics.findByVerificationToken = async function(token) {
  return this.findOne({ 
    verificationToken: token,
    verificationTokenExpires: { $gt: Date.now() }
  });
};

/**
 * Verificar token de acceso a curso (método estático)
 * @param {String} token - Token a verificar
 * @param {ObjectId} cursoId - ID del curso
 * @returns {Promise<Object>} Resultado de la verificación
 */
userSchema.statics.verifyTokenAccess = async function(token, cursoId) {
  try {
    // Primero verificar el token JWT
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'fallback_secret_para_desarrollo'
    );

    // Buscar usuario
    const user = await this.findById(decoded.userId);
    if (!user) {
      return { valid: false, reason: 'Usuario no encontrado' };
    }

    // Verificar acceso al curso
    if (!user.hasCourseAccess(cursoId)) {
      return { valid: false, reason: 'Usuario no tiene acceso al curso' };
    }

    // Verificar token en la lista del usuario
    const verification = user.verifyCourseAccessToken(token, cursoId);
    if (!verification) {
      return { valid: false, reason: 'Token inválido o expirado' };
    }

    return {
      valid: true,
      user: user,
      token: verification.token,
      remainingAccess: verification.remainingAccess
    };

  } catch (error) {
    console.error("Error en verifyTokenAccess:", error.message);
    return { 
      valid: false, 
      reason: error.message.includes('expired') ? 'Token expirado' : 'Token inválido' 
    };
  }
};

module.exports = mongoose.model("User", userSchema);
