// models/User.cjs - VERSIÓN ACTUALIZADA CON VERIFICACIÓN
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
  avatar: {
    type: String,
    default: function() {
      return this.nombre ? this.nombre.charAt(0).toUpperCase() : "U";
    }
  },
  // NUEVOS CAMPOS PARA VERIFICACIÓN
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  verificationSentAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
