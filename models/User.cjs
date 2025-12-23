// models/User.cjs - VERSIÓN CORREGIDA
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
  avatarInicial: {
    type: String,
    default: "U"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
