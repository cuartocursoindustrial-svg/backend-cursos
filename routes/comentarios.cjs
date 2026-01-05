// routes/comentarios.cjs - VERSIÓN CORREGIDA
const express = require("express");
const router = express.Router();

// CORRECCIÓN: Importar authMiddleware correctamente
const authModule = require("./auth.cjs");
const authMiddleware = authModule.authMiddleware;

// Modelo de comentarios
const Comentario = require("../models/Comentario.cjs");
const User = require("../models/User.cjs"); // Añadir esta línea

// =============================================
// OBTENER COMENTARIOS DE UN VIDEO
// =============================================
router.get("/video/:videoId", authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;
        
        console.log('📝 Obteniendo comentarios para video:', videoId, 'Usuario:', req.user?.userId);
        
        const comentarios = await Comentario.find({ videoId })
            .sort({ createdAt: -1 })
            .lean();
        
        // Formatear respuesta para el frontend
        const comentariosFormateados = comentarios.map(comentario => ({
            _id: comentario._id,
            id: comentario._id.toString(), // Para compatibilidad
            videoId: comentario.videoId,
            contenido: comentario.contenido,
            texto: comentario.contenido, // Alias para compatibilidad
            usuario: {
                id: comentario.usuario.id,
                nombre: comentario.usuario.nombre,
                email: comentario.usuario.email
            },
            fecha: comentario.createdAt,
            createdAt: comentario.createdAt,
            respuestas: comentario.respuestas || []
        }));
        
        res.json({ 
            success: true, 
            comentarios: comentariosFormateados 
        });
    } catch (error) {
        console.error('❌ Error obteniendo comentarios:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener comentarios' 
        });
    }
});

// =============================================
// CREAR NUEVO COMENTARIO
// =============================================
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { videoId, contenido, cursoId } = req.body;
        const userId = req.user.userId;
        
        console.log('💬 Creando comentario:', {
            videoId,
            contenido: contenido?.substring(0, 50) + '...',
            cursoId,
            userId
        });
        
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
        
        // Buscar usuario para obtener datos
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }
        
        // Verificar que el usuario tenga acceso al curso
        const cursoAccesible = user.cursosComprados && 
                              user.cursosComprados.some(curso => 
                                  curso.toString() === (cursoId || '2')
                              );
        
        if (!cursoAccesible) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes acceso a este curso' 
            });
        }
        
        // Crear comentario
        const nuevoComentario = new Comentario({
            videoId,
            cursoId: cursoId || '2', // Por defecto álgebra
            contenido,
            usuario: {
                id: user._id,
                nombre: user.nombre,
                email: user.email
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
                email: user.email
            },
            fecha: nuevoComentario.createdAt,
            createdAt: nuevoComentario.createdAt,
            respuestas: []
        };
        
        res.status(201).json({ 
            success: true, 
            comentario: comentarioResponse 
        });
    } catch (error) {
        console.error('❌ Error creando comentario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al crear comentario' 
        });
    }
});

// =============================================
// AGREGAR RESPUESTA A COMENTARIO
// =============================================
router.post("/:comentarioId/respuestas", authMiddleware, async (req, res) => {
    try {
        const { contenido } = req.body;
        const { comentarioId } = req.params;
        const userId = req.user.userId;
        
        console.log('💬 Agregando respuesta:', {
            comentarioId,
            contenido: contenido?.substring(0, 50) + '...',
            userId
        });
        
        if (!contenido) {
            return res.status(400).json({ 
                success: false, 
                message: 'El contenido es requerido' 
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
                email: user.email
            }
        };
        
        comentario.respuestas.push(nuevaRespuesta);
        await comentario.save();
        
        console.log('✅ Respuesta agregada a comentario:', comentarioId);
        
        res.status(201).json({ 
            success: true, 
            respuesta: nuevaRespuesta 
        });
    } catch (error) {
        console.error('❌ Error agregando respuesta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al agregar respuesta' 
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
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permiso para eliminar este comentario' 
            });
        }
        
        await comentario.deleteOne();
        
        console.log('✅ Comentario eliminado:', comentarioId);
        
        res.json({ 
            success: true, 
            message: 'Comentario eliminado exitosamente' 
        });
    } catch (error) {
        console.error('❌ Error eliminando comentario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al eliminar comentario' 
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
            message: 'Respuesta eliminada exitosamente' 
        });
    } catch (error) {
        console.error('❌ Error eliminando respuesta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al eliminar respuesta' 
        });
    }
});

module.exports = router;
