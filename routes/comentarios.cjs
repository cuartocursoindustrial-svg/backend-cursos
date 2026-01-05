// routes/comentarios.cjs - VERSIÓN MEJORADA
const express = require("express");
const router = express.Router();

// Importar middleware correctamente (así está bien)
const { authMiddleware, requireVerifiedEmail } = require("./auth.cjs");

// Modelos
const Comentario = require("../models/Comentario.cjs");
const User = require("../models/User.cjs");

// =============================================
// MIDDLEWARE ESPECÍFICO PARA COMENTARIOS
// =============================================
function verificarAccesoCurso(req, res, next) {
    // Este middleware verificará que el usuario tenga acceso al curso
    // Se aplicará a rutas que crean/leen comentarios
    next(); // Por ahora siempre pasa, pero puedes implementar lógica aquí
}

// =============================================
// OBTENER COMENTARIOS DE UN VIDEO
// =============================================
router.get("/video/:videoId", authMiddleware, verificarAccesoCurso, async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.user.userId;
        
        console.log('📝 Obteniendo comentarios para video:', videoId, 'Usuario:', userId);
        
        // Obtener comentarios con paginación básica
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const comentarios = await Comentario.find({ videoId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        // Obtener contador total
        const totalComentarios = await Comentario.countDocuments({ videoId });
        
        // Formatear respuesta
        const comentariosFormateados = comentarios.map(comentario => ({
            _id: comentario._id,
            id: comentario._id.toString(),
            videoId: comentario.videoId,
            contenido: comentario.contenido,
            texto: comentario.contenido,
            usuario: {
                id: comentario.usuario.id,
                nombre: comentario.usuario.nombre,
                email: comentario.usuario.email,
                avatar: comentario.usuario.avatar || comentario.usuario.nombre?.charAt(0).toUpperCase()
            },
            fecha: comentario.createdAt,
            createdAt: comentario.createdAt,
            respuestas: comentario.respuestas || [],
            puedeEliminar: comentario.usuario.id.toString() === userId.toString()
        }));
        
        res.json({ 
            success: true, 
            comentarios: comentariosFormateados,
            paginacion: {
                paginaActual: page,
                totalPaginas: Math.ceil(totalComentarios / limit),
                totalComentarios,
                limite: limit
            }
        });
    } catch (error) {
        console.error('❌ Error obteniendo comentarios:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener comentarios',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =============================================
// CREAR NUEVO COMENTARIO (requiere email verificado)
// =============================================
router.post("/", authMiddleware, requireVerifiedEmail, async (req, res) => {
    try {
        const { videoId, contenido, cursoId } = req.body;
        const userId = req.user.userId;
        
        console.log('💬 Creando comentario:', {
            videoId,
            contenido: contenido?.substring(0, 50) + '...',
            cursoId,
            userId
        });
        
        // Validaciones
        if (!videoId || !contenido) {
            return res.status(400).json({ 
                success: false, 
                message: 'Video ID y contenido son requeridos' 
            });
        }
        
        if (contenido.length < 2) {
            return res.status(400).json({ 
                success: false, 
                message: 'El comentario debe tener al menos 2 caracteres' 
            });
        }
        
        if (contenido.length > 1000) {
            return res.status(400).json({ 
                success: false, 
                message: 'El comentario no puede exceder 1000 caracteres' 
            });
        }
        
        // Buscar usuario
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }
        
        // Verificar acceso al curso (opcional, puedes ajustar esta lógica)
        const cursoAccesible = user.cursosComprados && 
                              user.cursosComprados.some(curso => 
                                  curso.toString() === (cursoId || '2')
                              );
        
        if (!cursoAccesible && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes acceso a este curso' 
            });
        }
        
        // Crear comentario
        const nuevoComentario = new Comentario({
            videoId,
            cursoId: cursoId || '2',
            contenido,
            usuario: {
                id: user._id,
                nombre: user.nombre,
                email: user.email,
                avatar: user.avatar || user.nombre.charAt(0).toUpperCase()
            }
        });
        
        await nuevoComentario.save();
        
        console.log('✅ Comentario creado:', nuevoComentario._id);
        
        // Formatear respuesta
        const comentarioResponse = {
            _id: nuevoComentario._id,
            id: nuevoComentario._id.toString(),
            videoId: nuevoComentario.videoId,
            contenido: nuevoComentario.contenido,
            texto: nuevoComentario.contenido,
            usuario: {
                id: user._id,
                nombre: user.nombre,
                email: user.email,
                avatar: user.avatar || user.nombre.charAt(0).toUpperCase()
            },
            fecha: nuevoComentario.createdAt,
            createdAt: nuevoComentario.createdAt,
            respuestas: [],
            puedeEliminar: true // El usuario puede eliminar su propio comentario
        };
        
        res.status(201).json({ 
            success: true, 
            comentario: comentarioResponse,
            message: 'Comentario publicado exitosamente'
        });
    } catch (error) {
        console.error('❌ Error creando comentario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al crear comentario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =============================================
// AGREGAR RESPUESTA A COMENTARIO (requiere email verificado)
// =============================================
router.post("/:comentarioId/respuestas", authMiddleware, requireVerifiedEmail, async (req, res) => {
    try {
        const { contenido } = req.body;
        const { comentarioId } = req.params;
        const userId = req.user.userId;
        
        console.log('💬 Agregando respuesta:', {
            comentarioId,
            contenido: contenido?.substring(0, 50) + '...',
            userId
        });
        
        // Validaciones
        if (!contenido) {
            return res.status(400).json({ 
                success: false, 
                message: 'El contenido es requerido' 
            });
        }
        
        if (contenido.length < 2) {
            return res.status(400).json({ 
                success: false, 
                message: 'La respuesta debe tener al menos 2 caracteres' 
            });
        }
        
        if (contenido.length > 500) {
            return res.status(400).json({ 
                success: false, 
                message: 'La respuesta no puede exceder 500 caracteres' 
            });
        }
        
        // Buscar usuario
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }
        
        // Buscar comentario
        const comentario = await Comentario.findById(comentarioId);
        if (!comentario) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comentario no encontrado' 
            });
        }
        
        // Crear respuesta
        const nuevaRespuesta = {
            contenido,
            usuario: {
                id: user._id,
                nombre: user.nombre,
                email: user.email,
                avatar: user.avatar || user.nombre.charAt(0).toUpperCase()
            }
        };
        
        comentario.respuestas.push(nuevaRespuesta);
        await comentario.save();
        
        // Obtener la respuesta recién creada con su ID
        const respuestaCreada = comentario.respuestas[comentario.respuestas.length - 1];
        
        console.log('✅ Respuesta agregada a comentario:', comentarioId);
        
        res.status(201).json({ 
            success: true, 
            respuesta: {
                ...respuestaCreada.toObject(),
                puedeEliminar: true // El usuario puede eliminar su propia respuesta
            },
            message: 'Respuesta publicada exitosamente'
        });
    } catch (error) {
        console.error('❌ Error agregando respuesta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al agregar respuesta',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =============================================
// ELIMINAR COMENTARIO
// =============================================
router.delete("/:comentarioId", authMiddleware, async (req, res) => {
    try {
        const { comentarioId } = req.params;
        const userId = req.user.userId;
        
        console.log('🗑️ Eliminando comentario:', comentarioId, 'Usuario:', userId);
        
        const comentario = await Comentario.findById(comentarioId);
        if (!comentario) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comentario no encontrado' 
            });
        }
        
        // Verificar que el usuario sea el dueño del comentario
        if (comentario.usuario.id.toString() !== userId.toString()) {
            // Opcional: Podrías permitir que administradores también eliminen
            // if (!req.user.esAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permiso para eliminar este comentario' 
            });
        }
        
        await comentario.deleteOne();
        
        console.log('✅ Comentario eliminado:', comentarioId);
        
        res.json({ 
            success: true, 
            message: 'Comentario eliminado exitosamente',
            comentarioId
        });
    } catch (error) {
        console.error('❌ Error eliminando comentario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al eliminar comentario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =============================================
// ELIMINAR RESPUESTA
// =============================================
router.delete("/respuestas/:respuestaId", authMiddleware, async (req, res) => {
    try {
        const { respuestaId } = req.params;
        const userId = req.user.userId;
        
        console.log('🗑️ Eliminando respuesta:', respuestaId, 'Usuario:', userId);
        
        // Buscar comentario que contiene la respuesta
        const comentario = await Comentario.findOne({
            'respuestas._id': respuestaId
        });
        
        if (!comentario) {
            return res.status(404).json({ 
                success: false, 
                message: 'Respuesta no encontrada' 
            });
        }
        
        // Encontrar la respuesta específica
        const respuesta = comentario.respuestas.id(respuestaId);
        if (!respuesta) {
            return res.status(404).json({ 
                success: false, 
                message: 'Respuesta no encontrada' 
            });
        }
        
        // Verificar que el usuario sea el dueño de la respuesta
        if (respuesta.usuario.id.toString() !== userId.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permiso para eliminar esta respuesta' 
            });
        }
        
        // Eliminar la respuesta
        respuesta.deleteOne();
        await comentario.save();
        
        console.log('✅ Respuesta eliminada:', respuestaId);
        
        res.json({ 
            success: true, 
            message: 'Respuesta eliminada exitosamente',
            respuestaId,
            comentarioId: comentario._id
        });
    } catch (error) {
        console.error('❌ Error eliminando respuesta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al eliminar respuesta',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =============================================
// ESTADÍSTICAS DE COMENTARIOS (opcional)
// =============================================
router.get("/estadisticas/:videoId", authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;
        
        const totalComentarios = await Comentario.countDocuments({ videoId });
        
        // Contar respuestas (sumar respuestas de todos los comentarios)
        const comentarios = await Comentario.find({ videoId }).select('respuestas');
        const totalRespuestas = comentarios.reduce((total, comentario) => {
            return total + (comentario.respuestas?.length || 0);
        }, 0);
        
        res.json({
            success: true,
            videoId,
            estadisticas: {
                totalComentarios,
                totalRespuestas,
                totalInteracciones: totalComentarios + totalRespuestas
            }
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas'
        });
    }
});

module.exports = router;
