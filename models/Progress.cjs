const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  cursoId: {
    type: String,
    required: true
  },
  leccionesVistas: {
    type: [String],
    default: []
  },
  ultimaLeccion: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Progress", progressSchema);
