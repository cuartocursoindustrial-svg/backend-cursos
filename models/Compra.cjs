const mongoose = require('mongoose');

const compraSchema = new mongoose.Schema({
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  cursoId: { 
    type: Number, 
    required: true 
  },
  fechaCompra: { 
    type: Date, 
    default: Date.now 
  },
  estado: { 
    type: String, 
    enum: ['completada', 'pendiente', 'cancelada'],
    default: 'completada'
  },
  precioPagado: { 
    type: Number, 
    required: true 
  }
});

// Índice para búsquedas rápidas
compraSchema.index({ usuarioId: 1, cursoId: 1 }, { unique: true });

module.exports = mongoose.model('Compra', compraSchema);