// models/Comentario.cjs - VERSIÓN CORREGIDA
const mongoose = require('mongoose');

const respuestaSchema = new mongoose.Schema({
    contenido: {
        type: String,
        required: [true, 'El contenido es requerido'],
        maxlength: [500, 'La respuesta no puede exceder 500 caracteres']
    },
    usuario: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        nombre: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    }
}, {
    timestamps: true
});

const comentarioSchema = new mongoose.Schema({
    videoId: {
        type: String,
        required: [true, 'El ID del video es requerido'],
        index: true
    },
    cursoId: {
        type: String,
        default: '2', // ID del curso de Álgebra
        index: true
    },
    contenido: {
        type: String,
        required: [true, 'El contenido es requerido'],
        maxlength: [1000, 'El comentario no puede exceder 1000 caracteres']
    },
    usuario: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        nombre: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    },
    respuestas: [respuestaSchema]
}, {
    timestamps: true
});

// Índices para mejor rendimiento
comentarioSchema.index({ videoId: 1, createdAt: -1 });
comentarioSchema.index({ cursoId: 1 });
comentarioSchema.index({ 'usuario.id': 1 });

module.exports = mongoose.model('Comentario', comentarioSchema);
