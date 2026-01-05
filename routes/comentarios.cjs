const express = require('express');
const router = express.Router();
const Comentario = require('../models/Comentario.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');

// Middleware para verificar si el usuario tiene acceso al curso
const verificarAccesoCurso = async (req, res, next) => {
    try {
        const user = req.user;
        const cursoId = req.body.cursoId || req.params.cursoId;
        
        // Verificar que el usuario tenga el curso comprado
        const tieneCurso = user.cursosComprados && 
                          user.cursosComprados.some(curso => 
                              curso.toString() === cursoId.toString()
                          );
        
        if (!tieneCurso) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes acceso a este curso' 
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Obtener comentarios de un video
router.get('/video/:videoId', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;
        
        const comentarios = await Comentario.find({ videoId })
            .sort({ createdAt: -1 })
            .populate('usuario.id', 'nombre email avatar')
            .lean();
        
        res.json({ success: true, comentarios });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Crear nuevo comentario
router.post('/', authMiddleware, verificarAccesoCurso, async (req, res) => {
    try {
        const { videoId, contenido, cursoId } = req.body;
        
        if (!videoId || !contenido) {
            return res.status(400).json({ 
                success: false, 
                message: 'Video ID y contenido son requeridos' 
            });
        }
        
        const nuevoComentario = new Comentario({
            videoId,
            cursoId: cursoId || '2', // Por defecto álgebra
            contenido,
            usuario: {
                id: req.user._id,
                nombre: req.user.nombre,
                email: req.user.email
            }
        });
        
        await nuevoComentario.save();
        
        const comentarioPopulado = await Comentario.findById(nuevoComentario._id)
            .populate('usuario.id', 'nombre email avatar')
            .lean();
        
        res.status(201).json({ success: true, comentario: comentarioPopulado });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Agregar respuesta a comentario
router.post('/:comentarioId/respuestas', authMiddleware, verificarAccesoCurso, async (req, res) => {
    try {
        const { contenido } = req.body;
        const { comentarioId } = req.params;
        
        if (!contenido) {
            return res.status(400).json({ 
                success: false, 
                message: 'El contenido es requerido' 
            });
        }
        
        const comentario = await Comentario.findById(comentarioId);
        if (!comentario) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comentario no encontrado' 
            });
        }
        
        const nuevaRespuesta = {
            contenido,
            usuario: {
                id: req.user._id,
                nombre: req.user.nombre,
                email: req.user.email
            }
        };
        
        comentario.respuestas.push(nuevaRespuesta);
        await comentario.save();
        
        res.status(201).json({ 
            success: true, 
            respuesta: nuevaRespuesta 
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Eliminar comentario
router.delete('/:comentarioId', authMiddleware, async (req, res) => {
    try {
        const { comentarioId } = req.params;
        
        const comentario = await Comentario.findById(comentarioId);
        if (!comentario) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comentario no encontrado' 
            });
        }
        
        // Verificar que el usuario sea el dueño del comentario
        if (comentario.usuario.id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permiso para eliminar este comentario' 
            });
        }
        
        await comentario.deleteOne();
        
        res.json({ 
            success: true, 
            message: 'Comentario eliminado exitosamente' 
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Eliminar respuesta
router.delete('/respuestas/:respuestaId', authMiddleware, async (req, res) => {
    try {
        const { respuestaId } = req.params;
        
        // Buscar el comentario que contiene la respuesta
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
        if (respuesta.usuario.id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permiso para eliminar esta respuesta' 
            });
        }
        
        // Eliminar la respuesta
        respuesta.deleteOne();
        await comentario.save();
        
        res.json({ 
            success: true, 
            message: 'Respuesta eliminada exitosamente' 
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Obtener estadísticas de comentarios
router.get('/estadisticas/:videoId', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;
        
        const totalComentarios = await Comentario.countDocuments({ videoId });
        const comentariosConRespuestas = await Comentario.countDocuments({
            videoId,
            'respuestas.0': { $exists: true }
        });
        
        res.json({
            success: true,
            estadisticas: {
                totalComentarios,
                comentariosConRespuestas,
                porcentajeConRespuestas: totalComentarios > 0 ? 
                    Math.round((comentariosConRespuestas / totalComentarios) * 100) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
