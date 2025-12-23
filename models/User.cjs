// models/User.cjs - VERSIÓN MEJORADA
const mongoose = require("mongoose");

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
      type: mongoose.Schema.Types.ObjectId,  // ✅ CORRECTO
      ref: 'Curso' 
  }]
  cursosCompletados: {
    type: [Number], // IDs de cursos marcados como completados
    default: []
  },
  fechaRegistro: {
    type: Date,
    default: Date.now
  },
  ultimoAcceso: {
    type: Date,
    default: Date.now
  },
  avatarInicial: {
    type: String,
    default: "U"
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt automáticamente
});

module.exports = mongoose.model("User", userSchema);
