// backend-conexion.cjs - CONEXIÓN FRONTEND-BACKEND PARA BLOGGER
// ================================================================

// 🔧 CONFIGURACIÓN
const API_BASE_URL = "http://localhost:3000/api"; // Cambiar en producción

// 📊 VARIABLES GLOBALES
let usuarioActual = null;
let tokenJWT = null;
let backendDisponible = false;

// 📡 FUNCIÓN PARA PROBAR CONEXIÓN CON BACKEND
async function probarConexionBackend() {
  console.log("🔄 Probando conexión con backend...");
  
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend conectado:', data.message);
      backendDisponible = true;
      return { success: true, data };
    } else {
      console.warn('⚠️ Backend respondió con error:', response.status);
      backendDisponible = false;
      return { success: false, error: `Error ${response.status}` };
    }
  } catch (error) {
    console.error('❌ No se pudo conectar al backend:', error.message);
    backendDisponible = false;
    return { 
      success: false, 
      error: 'Backend no disponible',
      detalles: error.message 
    };
  }
}

// 👤 REGISTRAR USUARIO EN BACKEND
async function registrarUsuarioBackend(nombre, email, password) {
  console.log("📝 Intentando registrar usuario...");
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password: password
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error en registro:', data.error);
      return {
        success: false,
        error: data.error || 'Error desconocido en registro'
      };
    }
    
    console.log('✅ Usuario registrado:', data.usuario.email);
    
    // Guardar token y usuario
    tokenJWT = data.token;
    usuarioActual = data.usuario;
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('academiaOhara_token', tokenJWT);
    localStorage.setItem('academiaOhara_usuario', JSON.stringify(usuarioActual));
    
    return {
      success: true,
      token: data.token,
      usuario: data.usuario,
      mensaje: data.mensaje || 'Registro exitoso'
    };
    
  } catch (error) {
    console.error('❌ Error de conexión en registro:', error);
    return {
      success: false,
      error: 'No se pudo conectar al servidor. Revisa tu conexión.'
    };
  }
}

// 🔐 INICIAR SESIÓN EN BACKEND
async function iniciarSesionBackend(email, password) {
  console.log("🔐 Intentando iniciar sesión...");
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: email.trim().toLowerCase(),
        password: password
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error en login:', data.error);
      return {
        success: false,
        error: data.error || 'Credenciales incorrectas'
      };
    }
    
    console.log('✅ Login exitoso:', data.usuario.email);
    
    // Guardar token y usuario
    tokenJWT = data.token;
    usuarioActual = data.usuario;
    
    // Guardar en localStorage
    localStorage.setItem('academiaOhara_token', tokenJWT);
    localStorage.setItem('academiaOhara_usuario', JSON.stringify(usuarioActual));
    
    return {
      success: true,
      token: data.token,
      usuario: data.usuario,
      mensaje: data.mensaje || 'Login exitoso'
    };
    
  } catch (error) {
    console.error('❌ Error de conexión en login:', error);
    return {
      success: false,
      error: 'No se pudo conectar al servidor'
    };
  }
}

// 📚 OBTENER CURSOS DESDE BACKEND
async function obtenerCursosBackend() {
  console.log("📚 Obteniendo cursos desde backend...");
  
  try {
    const response = await fetch(`${API_BASE_URL}/cursos`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Error obteniendo cursos:', response.status);
      return { success: false, error: `Error ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ ${data.cursos.length} cursos obtenidos`);
      return {
        success: true,
        cursos: data.cursos,
        total: data.total
      };
    } else {
      console.error('❌ Backend reportó error:', data.error);
      return { success: false, error: data.error };
    }
    
  } catch (error) {
    console.error('❌ Error de conexión obteniendo cursos:', error);
    return {
      success: false,
      error: 'No se pudo obtener el catálogo de cursos'
    };
  }
}

// 🛒 COMPRAR CURSO EN BACKEND
async function comprarCursoBackend(cursoId) {
  console.log(`🛒 Intentando comprar curso ${cursoId}...`);
  
  if (!tokenJWT) {
    return {
      success: false,
      error: 'No estás autenticado. Inicia sesión primero.'
    };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/cursos/comprar`, {
      method: 'POST',
      headers: {
        'Authorization': tokenJWT,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cursoId })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error comprando curso:', data.error);
      return {
        success: false,
        error: data.error || 'Error al procesar la compra'
      };
    }
    
    console.log('✅ Curso comprado:', data.message);
    
    return {
      success: true,
      mensaje: data.message,
      curso: data.curso,
      fechaCompra: data.fechaCompra
    };
    
  } catch (error) {
    console.error('❌ Error de conexión comprando curso:', error);
    return {
      success: false,
      error: 'No se pudo conectar al servidor para procesar la compra'
    };
  }
}

// 🎓 OBTENER MIS CURSOS COMPRADOS
async function obtenerMisCursosBackend() {
  console.log("🎓 Obteniendo mis cursos comprados...");
  
  if (!tokenJWT) {
    return {
      success: false,
      error: 'No estás autenticado'
    };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/cursos/usuario/mis-cursos`, {
      method: 'GET',
      headers: {
        'Authorization': tokenJWT,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error obteniendo mis cursos:', data.error);
      return {
        success: false,
        error: data.error || 'Error al obtener tus cursos'
      };
    }
    
    console.log(`✅ ${data.cursos.length} cursos obtenidos para el usuario`);
    
    return {
      success: true,
      cursos: data.cursos,
      total: data.total
    };
    
  } catch (error) {
    console.error('❌ Error de conexión obteniendo mis cursos:', error);
    return {
      success: false,
      error: 'No se pudo obtener tu lista de cursos'
    };
  }
}

// 👤 OBTENER PERFIL DE USUARIO
async function obtenerPerfilBackend() {
  if (!tokenJWT) {
    return { success: false, error: 'No autenticado' };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/perfil`, {
      method: 'GET',
      headers: {
        'Authorization': tokenJWT,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error obteniendo perfil:', data.error);
      return { success: false, error: data.error };
    }
    
    return {
      success: true,
      usuario: data.usuario
    };
    
  } catch (error) {
    console.error('❌ Error de conexión obteniendo perfil:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

// 🔄 SINCRONIZAR ESTADO LOCAL CON BACKEND
async function sincronizarConBackend() {
  console.log("🔄 Sincronizando con backend...");
  
  // 1. Probar conexión
  const conexion = await probarConexionBackend();
  
  if (!conexion.success) {
    console.warn('⚠️ Modo offline activado');
    return { success: false, modo: 'offline' };
  }
  
  // 2. Si hay token guardado, verificar sesión
  const tokenGuardado = localStorage.getItem('academiaOhara_token');
  const usuarioGuardado = localStorage.getItem('academiaOhara_usuario');
  
  if (tokenGuardado && usuarioGuardado) {
    try {
      tokenJWT = tokenGuardado;
      usuarioActual = JSON.parse(usuarioGuardado);
      
      // Verificar si el token sigue válido
      const perfil = await obtenerPerfilBackend();
      
      if (perfil.success) {
        console.log('✅ Sesión restaurada:', usuarioActual.nombre);
        
        // Obtener cursos comprados actualizados
        const misCursos = await obtenerMisCursosBackend();
        
        return {
          success: true,
          modo: 'online',
          usuario: usuarioActual,
          tokenValido: true,
          misCursos: misCursos.success ? misCursos.cursos : []
        };
      } else {
        // Token inválido, limpiar
        console.log('❌ Token inválido, limpiando sesión...');
        localStorage.removeItem('academiaOhara_token');
        localStorage.removeItem('academiaOhara_usuario');
        tokenJWT = null;
        usuarioActual = null;
      }
    } catch (error) {
      console.error('Error restaurando sesión:', error);
    }
  }
  
  return {
    success: true,
    modo: 'online',
    usuario: null,
    tokenValido: false
  };
}

// 🧹 FUNCIÓN PARA CERRAR SESIÓN
function cerrarSesionBackend() {
  console.log("👋 Cerrando sesión...");
  
  // Limpiar variables
  usuarioActual = null;
  tokenJWT = null;
  
  // Limpiar localStorage
  localStorage.removeItem('academiaOhara_token');
  localStorage.removeItem('academiaOhara_usuario');
  
  return { success: true, mensaje: 'Sesión cerrada' };
}

// 📊 FUNCIÓN PARA GUARDAR PROGRESO
async function guardarProgresoBackend(cursoId, leccionId) {
  if (!tokenJWT) {
    return { success: false, error: 'No autenticado' };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/progreso`, {
      method: 'POST',
      headers: {
        'Authorization': tokenJWT,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cursoId, leccionId })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error };
    }
    
    return { 
      success: true, 
      mensaje: data.mensaje,
      progreso: data.progreso
    };
    
  } catch (error) {
    console.error('Error guardando progreso:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

// 🔍 FUNCIÓN PARA OBTENER PROGRESO
async function obtenerProgresoBackend(cursoId) {
  if (!tokenJWT) {
    return { success: false, error: 'No autenticado' };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/progreso/${cursoId}`, {
      method: 'GET',
      headers: {
        'Authorization': tokenJWT,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error };
    }
    
    return { 
      success: true, 
      progreso: data
    };
    
  } catch (error) {
    console.error('Error obteniendo progreso:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

// 🌐 EXPORTAR FUNCIONES PARA USAR EN BLOGGER
// Esto permite que las funciones estén disponibles globalmente
if (typeof window !== 'undefined') {
  window.backendAPI = {
    // Configuración
    API_BASE_URL,
    
    // Estado
    usuarioActual: () => usuarioActual,
    tokenJWT: () => tokenJWT,
    backendDisponible: () => backendDisponible,
    
    // Funciones principales
    probarConexion: probarConexionBackend,
    registrarUsuario: registrarUsuarioBackend,
    iniciarSesion: iniciarSesionBackend,
    cerrarSesion: cerrarSesionBackend,
    sincronizar: sincronizarConBackend,
    
    // Cursos
    obtenerCursos: obtenerCursosBackend,
    comprarCurso: comprarCursoBackend,
    obtenerMisCursos: obtenerMisCursosBackend,
    
    // Perfil
    obtenerPerfil: obtenerPerfilBackend,
    
    // Progreso
    guardarProgreso: guardarProgresoBackend,
    obtenerProgreso: obtenerProgresoBackend,
    
    // Utilidades
    tieneSesion: () => !!tokenJWT && !!usuarioActual,
    getNombreUsuario: () => usuarioActual ? usuarioActual.nombre : 'Invitado',
    getAvatarInicial: () => usuarioActual ? usuarioActual.avatar : 'U'
  };
  
  console.log('✅ Backend API cargada en window.backendAPI');
}

// Para usar en Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_BASE_URL,
    probarConexionBackend,
    registrarUsuarioBackend,
    iniciarSesionBackend,
    obtenerCursosBackend,
    comprarCursoBackend,
    obtenerMisCursosBackend,
    obtenerPerfilBackend,
    sincronizarConBackend,
    cerrarSesionBackend,
    guardarProgresoBackend,
    obtenerProgresoBackend
  };
}