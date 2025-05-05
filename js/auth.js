// Importar métodos y objetos de Firebase desde el archivo de configuración
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  facebookProvider,
  githubProvider,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from './firebase-config.js';

// Estado del usuario
let currentUser = null;

// Elementos del DOM
const userSection = document.getElementById('user-section');
const loginLink = document.getElementById('login-link');

// Verificar si estamos en la página de login
const isLoginPage = window.location.pathname.includes('login.html');

// Si estamos en la página de login, inicializar los elementos del formulario
if (isLoginPage) {
  // Obtener elementos del DOM
  const emailInput = document.getElementById('mail');
  const passInput = document.getElementById('pass');
  const loginBtn = document.getElementById('iniciar');
  const registerBtn = document.getElementById('registrarse');
  const welcomeContainer = document.getElementById('ir');

  // Función para crear los botones de redes sociales
  function crearBotonesSociales() {
    // Verificar si el contenedor ya existe para evitar duplicados
    const existingContainer = document.querySelector('.social-login');
    if (existingContainer) return;

    const socialLoginContainer = document.createElement('div');
    socialLoginContainer.className = 'social-login';
    socialLoginContainer.innerHTML = `
      <p>O inicia sesión con:</p>
      <div class="social-buttons">
        <button id="facebook-login" class="social-btn facebook-btn">
          <img src="https://cdn.icon-icons.com/icons2/836/PNG/512/Facebook_icon-icons.com_66805.png" alt="Facebook" width="20">
          Facebook
        </button>
        <button id="github-login" class="social-btn github-btn">
          <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" width="20">
          GitHub
        </button>
      </div>
    `;

    // Insertar después de los botones de login/register
    const buttonContainer = document.querySelector('.button-container');
    if (buttonContainer) {
      buttonContainer.after(socialLoginContainer);
      
      // Añadir event listeners después de crear los botones
      document.getElementById('facebook-login')?.addEventListener('click', iniciarSesionConFacebook);
      document.getElementById('github-login')?.addEventListener('click', iniciarSesionConGitHub);
    }
  }

  // Crear los botones de redes sociales al cargar la página
  document.addEventListener('DOMContentLoaded', crearBotonesSociales);

  // Función para validar el email
  function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // Función para validar la contraseña (mínimo 6 caracteres)
  function validarPassword(password) {
    return password.length >= 6;
  }

  // Función para mostrar toast de notificación
  function mostrarToast(titulo, mensaje, tipo = 'success') {
    const toastElement = document.getElementById('authToast');
    const toastHeader = document.getElementById('toast-header');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    
    if (toastElement && toastHeader && toastTitle && toastMessage) {
      // Configurar el estilo según el tipo
      toastHeader.className = 'toast-header ' + tipo;
      
      // Establecer título y mensaje
      toastTitle.textContent = titulo;
      toastMessage.textContent = mensaje;
      
      // Mostrar el toast usando Bootstrap
      const toast = new bootstrap.Toast(toastElement);
      toast.show();
    } else {
      // Fallback si los elementos no existen
      alert(`${titulo}: ${mensaje}`);
    }
  }

  // Función para guardar datos del usuario en Firestore
  async function guardarUsuarioEnFirestore(user, metodo = 'email') {
    try {
      // Primero verificamos si el usuario ya existe en la colección "usuarios"
      const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
      const userDocs = await getDocs(userQuery);
      
      if (userDocs.empty) {
        // Si no existe, guardar información del usuario
        await addDoc(collection(db, "usuarios"), {
          uid: user.uid,
          email: user.email || '',
          fechaRegistro: serverTimestamp(),
          metodoAutenticacion: metodo,
          nombreCompleto: user.displayName || '',
          photoURL: user.photoURL || '',
          rol: 'cliente' // Por defecto, todos los usuarios son clientes
        });
        console.log("Usuario guardado en Firestore");
      } else {
        console.log("Usuario ya existe en Firestore");
      }
    } catch (error) {
      console.error("Error al guardar el usuario en Firestore:", error);
    }
  }

  // Función para manejar el inicio de sesión exitoso
  function manejarInicioSesionExitoso(user, metodo) {
    console.log("Usuario autenticado:", user);
    const nombreMostrado = user.displayName || user.email || "Usuario";
    mostrarToast("Inicio de sesión exitoso", `¡Bienvenido, ${nombreMostrado}!`);

    // Guardar información del usuario en Firestore
    guardarUsuarioEnFirestore(user, metodo);

    // Generar botón para ir a la página principal
    welcomeContainer.innerHTML = '<a href="index.html" id="btn-principal">Ir al Inicio</a>';
  }

  // Evento para iniciar sesión con correo y contraseña
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const email = emailInput.value.trim();
      const password = passInput.value;

      // Validar campos antes de intentar autenticar
      if (!email || !password) {
        mostrarToast("Error", "Por favor, completa todos los campos", "error");
        return;
      }

      if (!validarEmail(email)) {
        mostrarToast("Error", "Por favor, ingresa un correo electrónico válido", "error");
        return;
      }

      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          // Usuario autenticado correctamente
          manejarInicioSesionExitoso(userCredential.user, 'email');
        })
        .catch((error) => {
          // Manejar errores
          console.error("Error durante el inicio de sesión:", error);
          let errorMessage = "Error al iniciar sesión. Verifica tus credenciales.";
          
          // Personalizar mensaje según el error
          if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuario no encontrado. Verifica tu correo o regístrate.";
          } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Contraseña incorrecta. Inténtalo de nuevo.";
          }
          
          mostrarToast("Error de autenticación", errorMessage, "error");
        });
    });
  }

  // Evento para registrar un nuevo usuario
  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      const email = emailInput.value.trim();
      const password = passInput.value;

      // Validar campos antes de intentar registrar
      if (!email || !password) {
        mostrarToast("Error", "Por favor, completa todos los campos", "error");
        return;
      }

      if (!validarEmail(email)) {
        mostrarToast("Error", "Por favor, ingresa un correo electrónico válido", "error");
        return;
      }

      if (!validarPassword(password)) {
        mostrarToast("Error", "La contraseña debe tener al menos 6 caracteres", "error");
        return;
      }

      createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          // Usuario registrado correctamente
          mostrarToast("Registro exitoso", `Usuario registrado: ${userCredential.user.email}`);
          manejarInicioSesionExitoso(userCredential.user, 'email');
        })
        .catch((error) => {
          // Manejar errores
          console.error("Error durante el registro:", error);
          let errorMessage = "Error al registrar el usuario. Inténtalo de nuevo.";
          
          // Personalizar mensaje según el error
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Este correo ya está registrado. Intenta iniciar sesión.";
          } else if (error.code === 'auth/weak-password') {
            errorMessage = "La contraseña es demasiado débil. Usa al menos 6 caracteres.";
          }
          
          mostrarToast("Error de registro", errorMessage, "error");
        });
    });
  }

  // Función para iniciar sesión con Facebook
  function iniciarSesionConFacebook() {
    console.log("Iniciando proceso de login con Facebook...");
    
    signInWithPopup(auth, facebookProvider)
      .then((result) => {
        // Inicio de sesión exitoso
        const user = result.user;
        console.log("Login con Facebook exitoso:", user);
        
        manejarInicioSesionExitoso(user, 'facebook');
      })
      .catch((error) => {
        // Mostrar información detallada del error en la consola
        console.error("Error completo durante el inicio de sesión con Facebook:", error);
        
        // El código de error, mensaje de error y el email utilizado (si está disponible)
        const errorCode = error.code;
        const errorMessage = error.message;
        const email = error.customData ? error.customData.email : null;
        
        console.log("Código de error:", errorCode);
        console.log("Mensaje de error:", errorMessage);
        if (email) console.log("Email relacionado con el error:", email);
        
        let mensajeAlerta = "Error al iniciar sesión con Facebook: " + errorMessage;
        
        if (errorCode === 'auth/account-exists-with-different-credential') {
          mensajeAlerta = `Ya existe una cuenta con el correo ${email}. Intenta iniciar sesión con otro método.`;
        } else if (errorCode === 'auth/popup-closed-by-user') {
          mensajeAlerta = "Has cerrado la ventana de inicio de sesión.";
        } else if (errorCode === 'auth/popup-blocked') {
          mensajeAlerta = "El navegador ha bloqueado la ventana emergente. Por favor, permite ventanas emergentes para este sitio.";
        } else if (errorCode === 'auth/cancelled-popup-request') {
          mensajeAlerta = "La solicitud de ventana emergente fue cancelada.";
        }
        
        mostrarToast("Error de autenticación", mensajeAlerta, "error");
      });
  }

  // Función para iniciar sesión con GitHub
  function iniciarSesionConGitHub() {
    console.log("Iniciando proceso de login con GitHub...");
    
    signInWithPopup(auth, githubProvider)
      .then((result) => {
        // Inicio de sesión exitoso
        const user = result.user;
        console.log("Login con GitHub exitoso:", user);
        
        manejarInicioSesionExitoso(user, 'github');
      })
      .catch((error) => {
        // Mostrar información detallada del error en la consola
        console.error("Error completo durante el inicio de sesión con GitHub:", error);
        
        // El código de error, mensaje de error y el email utilizado (si está disponible)
        const errorCode = error.code;
        const errorMessage = error.message;
        const email = error.customData ? error.customData.email : null;
        
        console.log("Código de error:", errorCode);
        console.log("Mensaje de error:", errorMessage);
        if (email) console.log("Email relacionado con el error:", email);
        
        let mensajeAlerta = "Error al iniciar sesión con GitHub: " + errorMessage;
        
        if (errorCode === 'auth/account-exists-with-different-credential') {
          mensajeAlerta = `Ya existe una cuenta con el correo ${email}. Intenta iniciar sesión con otro método.`;
        } else if (errorCode === 'auth/popup-closed-by-user') {
          mensajeAlerta = "Has cerrado la ventana de inicio de sesión.";
        } else if (errorCode === 'auth/popup-blocked') {
          mensajeAlerta = "El navegador ha bloqueado la ventana emergente. Por favor, permite ventanas emergentes para este sitio.";
        } else if (errorCode === 'auth/cancelled-popup-request') {
          mensajeAlerta = "La solicitud de ventana emergente fue cancelada.";
        }
        
        mostrarToast("Error de autenticación", mensajeAlerta, "error");
      });
  }
}

// Obtener información del rol del usuario
async function obtenerRolUsuario(uid) {
  try {
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", uid));
    const userDocs = await getDocs(userQuery);
    
    if (!userDocs.empty) {
      const userData = userDocs.docs[0].data();
      return userData.rol || 'cliente';
    }
    
    return 'cliente'; // Por defecto, si no hay información
  } catch (error) {
    console.error("Error al obtener el rol del usuario:", error);
    return 'cliente';
  }
}

// Función para mostrar el menú de usuario según su estado de autenticación
async function actualizarUISegunAutenticacion(user) {
  if (user) {
    // Usuario autenticado
    currentUser = user;
    const displayName = user.displayName || user.email.split('@')[0];
    const photoURL = user.photoURL || 'https://via.placeholder.com/30';
    const rol = await obtenerRolUsuario(user.uid);
    
    // Actualizar la UI según si estamos en la página de login o no
    if (!isLoginPage && userSection) {
      let adminLink = '';
      if (rol === 'admin') {
        adminLink = `<a class="dropdown-item" href="pages/admin-panel.html">
                      <ion-icon name="settings-outline"></ion-icon> Panel de Administración
                    </a>`;
      }
      
      userSection.innerHTML = `
        <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <img src="${photoURL}" alt="Usuario" class="rounded-circle" width="30" height="30">
          ${displayName}
        </a>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
          <li><a class="dropdown-item" href="pages/perfil.html">
            <ion-icon name="person-outline"></ion-icon> Mi Perfil
          </a></li>
          <li><a class="dropdown-item" href="pages/mis-reservas.html">
            <ion-icon name="calendar-outline"></ion-icon> Mis Reservas
          </a></li>
          ${adminLink}
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="#" id="logout-btn">
            <ion-icon name="log-out-outline"></ion-icon> Cerrar Sesión
          </a></li>
        </ul>
      `;
      
      // Añadir evento para cerrar sesión
      document.getElementById('logout-btn')?.addEventListener('click', cerrarSesion);
    }
  } else {
    // Usuario no autenticado
    currentUser = null;
    
    // Actualizar la UI según si estamos en la página de login o no
    if (!isLoginPage && userSection) {
      userSection.innerHTML = `
        <a href="login.html" class="nav-link" id="login-link">
          <ion-icon name="person-outline"></ion-icon> Iniciar Sesión
        </a>
      `;
    }
  }
}

// Función para cerrar sesión
function cerrarSesion() {
  signOut(auth).then(() => {
    console.log("Sesión cerrada exitosamente");
    // Redirigir a la página principal
    window.location.href = 'index.html';
  }).catch((error) => {
    console.error("Error al cerrar sesión:", error);
  });
}

// Escuchar cambios en el estado de autenticación
onAuthStateChanged(auth, (user) => {
  actualizarUISegunAutenticacion(user);
});

// Exportar funciones y variables que necesitamos
export {
  currentUser,
  actualizarUISegunAutenticacion,
  cerrarSesion,
  obtenerRolUsuario
};