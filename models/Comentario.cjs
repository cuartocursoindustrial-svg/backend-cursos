// models/Comentario.cjs - VERSIÓN MEJORADA
const mongoose = require('mongoose');

const respuestaSchema = new mongoose.Schema({
    contenido: {
        type: String,
        required: [true, 'El contenido es requerido'],
        trim: true,
        minlength: [2, 'La respuesta debe tener al menos 2 caracteres'],
        maxlength: [500, 'La respuesta no puede exceder 500 caracteres']
    },
    usuario: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        nombre: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        avatar: {
            type: String,
            default: function() {
                // Generar avatar basado en la primera letra del nombre
                return this.nombre ? this.nombre.charAt(0).toUpperCase() : 'U';
            }
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

const comentarioSchema = new mongoose.Schema({
    videoId: {
        type: String,
        required: [true, 'El ID del video es requerido'],
        trim: true,
        index: true
    },
    cursoId: {
        type: String,
        default: '2', // ID del curso de Álgebra
        trim: true,
        index: true
    },
    contenido: {
        type: String,
        required: [true, 'El contenido es requerido'],
        trim: true,
        minlength: [2, 'El comentario debe tener al menos 2 caracteres'],
        maxlength: [1000, 'El comentario no puede exceder 1000 caracteres']
    },
    usuario: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        nombre: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        avatar: {
            type: String,
            default: function() {
                return this.nombre ? this.nombre.charAt(0).toUpperCase() : 'U';
            }
        }
    },
    respuestas: [respuestaSchema],
    // Campos para moderación (opcional)
    reportado: {
        type: Boolean,
        default: false
    },
    motivoReporte: {
        type: String,
        trim: true
    },
    visible: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// =============================================
// VIRTUALES (campos calculados)
// =============================================

// Contador de respuestas (virtual)
comentarioSchema.virtual('totalRespuestas').get(function() {
    return this.respuestas ? this.respuestas.length : 0;
});

// Indicador si tiene respuestas (virtual)
comentarioSchema.virtual('tieneRespuestas').get(function() {
    return this.respuestas && this.respuestas.length > 0;
});

// Fecha formateada (virtual)
comentarioSchema.virtual('fechaFormateada').get(function() {
    if (!this.createdAt) return '';
    
    const ahora = new Date();
    const diferencia = ahora - this.createdAt;
    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    
    if (minutos < 1) return 'Ahora mismo';
    if (minutos < 60) return `Hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
    if (dias < 7) return `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
    
    return this.createdAt.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
});

// =============================================
// MÉTODOS DE INSTANCIA
// =============================================

// Método para agregar respuesta
comentarioSchema.methods.agregarRespuesta = function(respuestaData) {
    this.respuestas.push(respuestaData);
    return this.save();
};

// Método para eliminar respuesta por ID
comentarioSchema.methods.eliminarRespuesta = function(respuestaId) {
    const respuestaIndex = this.respuestas.findIndex(
        respuesta => respuesta._id.toString() === respuestaId.toString()
    );
    
    if (respuestaIndex === -1) {
        throw new Error('Respuesta no encontrada');
    }
    
    this.respuestas.splice(respuestaIndex, 1);
    return this.save();
};

// Método para verificar si usuario es dueño
comentarioSchema.methods.esDueno = function(usuarioId) {
    return this.usuario.id.toString() === usuarioId.toString();
};

// =============================================
// MÉTODOS ESTÁTICOS
// =============================================

// Buscar comentarios por video con paginación
comentarioSchema.statics.buscarPorVideo = function(videoId, pagina = 1, limite = 20) {
    const skip = (pagina - 1) * limite;
    
    return this.find({ videoId, visible: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limite)
        .lean();
};

// Contar comentarios por video
comentarioSchema.statics.contarPorVideo = function(videoId) {
    return this.countDocuments({ videoId, visible: true });
};

// Obtener estadísticas
comentarioSchema.statics.obtenerEstadisticas = async function(videoId) {
    const totalComentarios = await this.countDocuments({ videoId, visible: true });
    
    const comentarios = await this.find({ videoId, visible: true })
        .select('respuestas')
        .lean();
    
    const totalRespuestas = comentarios.reduce((total, comentario) => {
        return total + (comentario.respuestas?.length || 0);
    }, 0);
    
    return {
        totalComentarios,
        totalRespuestas,
        totalInteracciones: totalComentarios + totalRespuestas
    };
};

// =============================================
// MIDDLEWARE (hooks)
// =============================================

// Antes de guardar, limpiar contenido
comentarioSchema.pre('save', function(next) {
    if (this.contenido) {
        this.contenido = this.contenido.trim();
    }
    next();
});

// Middleware para respuestas
respuestaSchema.pre('save', function(next) {
    if (this.contenido) {
        this.contenido = this.contenido.trim();
    }
    next();
});

// =============================================
// ÍNDICES PARA MEJOR RENDIMIENTO
// =============================================
comentarioSchema.index({ videoId: 1, createdAt: -1 });
comentarioSchema.index({ cursoId: 1 });
comentarioSchema.index({ 'usuario.id': 1 });
comentarioSchema.index({ visible: 1 });
comentarioSchema.index({ reportado: 1 });

// Índice compuesto para búsquedas comunes
comentarioSchema.index({ videoId: 1, visible: 1, createdAt: -1 });

// =============================================
// EXPORTACIÓN
// =============================================
const Comentario = mongoose.model('Comentario', comentarioSchema);

module.exports = Comentario;
