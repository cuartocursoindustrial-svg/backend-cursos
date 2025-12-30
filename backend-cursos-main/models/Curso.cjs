const mongoose = require('mongoose');

const cursoSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  titulo: { type: String, required: true },
  categoria: { type: String, required: true },
  precio: { type: Number, required: true },
  descripcion: { type: String, required: true },
  contenido: {
    videos: { type: Number, default: 0 },
    presentaciones: { type: Number, default: 0 },
    ejercicios: { type: Number, default: 0 }
  },
  temas: [{ type: String }],
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Curso', cursoSchema);
