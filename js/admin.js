// Importar Firebase
import {
  auth,
  db,
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  createUserWithEmailAndPassword
} from '../js/firebase-config.js';

// Importar funciones de autenticación
import { 
  currentUser, 
  obtenerRolUsuario
} from '../js/auth.js';

// Variables globales
let userRole = 'cliente';
let charts = {};
let paginationState = {
  reservations: {
    page: 1,
    size: 10,
    total: 0
  },
  users: {
    page: 1,
    size: 10,
    total: 0
  }
};

// Variables para la galería
let currentGalleryImages = [];
let mainGalleryImage = '';

// Asegurarnos de que la autenticación esté lista
document.addEventListener('DOMContentLoaded', async () => {
  // Esperar a que Firebase Auth esté listo
  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
  
  // Ahora verificar acceso
  const tieneAcceso = await verificarAccesoAdmin();
  if (!tieneAcceso) return;
  
  // El resto de tu código de inicialización...
  cargarEstadisticasDashboard();
  // ...
});

// Elimina la llamada a verificarAccesoAdmin que estás haciendo actualmente

async function verificarAccesoAdmin() {
  // Esperar un momento para asegurar que auth esté inicializado completamente
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("Verificando acceso admin...");
  console.log("Usuario actual:", auth.currentUser);
  
  if (!auth.currentUser) {
    console.log("No hay usuario autenticado, redirigiendo al login");
    window.location.href = '../login.html';
    return false;
  }
  
  // Verificar si el usuario es administrador
  const rol = await obtenerRolUsuario(auth.currentUser.uid);
  console.log("Rol obtenido:", rol);
  userRole = rol;
  
  if (rol !== 'admin' && rol !== 'recepcion') {
    console.log("Usuario sin permisos de administrador, redirigiendo");
    alert('No tienes permisos para acceder al panel de administración');
    window.location.href = '../index.html';
    return false;
  }
  
  console.log("Acceso confirmado con rol:", rol);
  return true;
}

// Función para mostrar toast de notificación
function mostrarToast(titulo, mensaje, tipo = 'success') {
  const toastElement = document.getElementById('notificationToast');
  const toastHeader = document.querySelector('#notificationToast .toast-header');
  const toastTitle = document.getElementById('toast-title');
  const toastMessage = document.getElementById('toast-message');
  
  if (toastElement && toastHeader && toastTitle && toastMessage) {
    // Configurar el estilo según el tipo
    toastHeader.className = `toast-header bg-${tipo === 'success' ? 'success' : 'danger'} text-white`;
    
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

// ---------- DASHBOARD ---------- //

// Función para cargar estadísticas del dashboard
async function cargarEstadisticasDashboard() {
  try {
    // 1. Obtener reservaciones activas
    const hoy = new Date();
    const reservasRef = collection(db, "reservaciones");
    const reservasActivas = query(
      reservasRef,
      where("estado", "==", "confirmada"),
      where("fechaEntrada", "<=", hoy),
      where("fechaSalida", ">=", hoy)
    );
    const reservasActivasSnapshot = await getDocs(reservasActivas);
    const numReservasActivas = reservasActivasSnapshot.size;
    
    // Actualizar en el DOM
    document.getElementById('active-reservations').textContent = numReservasActivas;
    
    // 2. Obtener habitaciones disponibles
    const habitacionesRef = collection(db, "habitaciones");
    const habitacionesDisponibles = query(
      habitacionesRef,
      where("estado", "==", "disponible")
    );
    const habitacionesDisponiblesSnapshot = await getDocs(habitacionesDisponibles);
    const numHabitacionesDisponibles = habitacionesDisponiblesSnapshot.size;
    
    // Actualizar en el DOM
    document.getElementById('available-rooms').textContent = numHabitacionesDisponibles;
    
    // 3. Obtener usuarios registrados
    const usuariosRef = collection(db, "usuarios");
    const usuariosSnapshot = await getDocs(usuariosRef);
    const numUsuarios = usuariosSnapshot.size;
    
    // Actualizar en el DOM
    document.getElementById('registered-users').textContent = numUsuarios;
    
    // 4. Calcular ingresos mensuales
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const reservasMes = query(
      reservasRef,
      where("fechaCreacion", ">=", primerDiaMes)
    );
    const reservasMesSnapshot = await getDocs(reservasMes);
    
    let ingresosMes = 0;
    reservasMesSnapshot.forEach(doc => {
      const reserva = doc.data();
      if (reserva.estado !== 'cancelada') {
        ingresosMes += reserva.precioTotal || 0;
      }
    });
    
    // Actualizar en el DOM
    document.getElementById('monthly-income').textContent = `$${ingresosMes.toFixed(2)}`;
    
    // 5. Cargar próximas llegadas
    await cargarProximasLlegadas();
    
    // 6. Cargar gráficos
    cargarGraficos();
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
    mostrarToast("Error", "No se pudieron cargar las estadísticas del dashboard", "error");
  }
}

// Función para cargar próximas llegadas
async function cargarProximasLlegadas() {
  try {
    const llegadasContainer = document.getElementById('upcoming-arrivals');
    
    // Limpiar contenedor
    if (!llegadasContainer) return;
    llegadasContainer.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></td></tr>';
    
    // Obtener fecha actual
    const hoy = new Date();
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);
    
    // Obtener próximas 10 llegadas desde mañana
    const reservasRef = collection(db, "reservaciones");
    const proximasLlegadas = query(
      reservasRef,
      where("fechaEntrada", ">=", mañana),
      where("estado", "==", "confirmada"),
      orderBy("fechaEntrada"),
      limit(5)
    );
    
    const llegadasSnapshot = await getDocs(proximasLlegadas);
    
    // Verificar si hay resultados
    if (llegadasSnapshot.empty) {
      llegadasContainer.innerHTML = '<tr><td colspan="6" class="text-center">No hay llegadas próximas programadas.</td></tr>';
      return;
    }
    
    // Generar filas de la tabla
    let filasHTML = '';
    
    llegadasSnapshot.forEach((doc) => {
      const reserva = doc.data();
      const id = doc.id;
      
      // Formatear fechas
      const fechaEntrada = reserva.fechaEntrada.toDate ? reserva.fechaEntrada.toDate() : new Date(reserva.fechaEntrada);
      const fechaSalida = reserva.fechaSalida.toDate ? reserva.fechaSalida.toDate() : new Date(reserva.fechaSalida);
      
      const fechaEntradaFormateada = fechaEntrada.toLocaleDateString();
      const fechaSalidaFormateada = fechaSalida.toLocaleDateString();
      
      filasHTML += `
        <tr>
          <td>${reserva.huesped?.nombre || reserva.usuarioEmail}</td>
          <td>${reserva.habitacionNombre}</td>
          <td>${fechaEntradaFormateada}</td>
          <td>${fechaSalidaFormateada}</td>
          <td><span class="status-badge status-confirmed">Confirmada</span></td>
          <td>
            <button class="btn btn-sm btn-info view-reservation" data-id="${id}">
              <ion-icon name="eye-outline"></ion-icon>
            </button>
          </td>
        </tr>
      `;
    });
    
    llegadasContainer.innerHTML = filasHTML;
    
    // Añadir eventos a los botones de ver
    document.querySelectorAll('.view-reservation').forEach(button => {
      button.addEventListener('click', () => {
        const reservaId = button.getAttribute('data-id');
        mostrarDetallesReservacion(reservaId);
      });
    });
  } catch (error) {
    console.error("Error al cargar próximas llegadas:", error);
    const llegadasContainer = document.getElementById('upcoming-arrivals');
    if (llegadasContainer) {
      llegadasContainer.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar los datos</td></tr>';
    }
  }
}

// Función para cargar gráficos
function cargarGraficos() {
  // Gráfico de ocupación por tipo de habitación
  const roomOccupancyCtx = document.getElementById('roomOccupancyChart')?.getContext('2d');
  if (roomOccupancyCtx) {
    if (charts.roomOccupancy) charts.roomOccupancy.destroy();
    
    charts.roomOccupancy = new Chart(roomOccupancyCtx, {
      type: 'doughnut',
      data: {
        labels: ['Individual', 'Doble', 'Suite', 'Familiar'],
        datasets: [{
          data: [25, 40, 15, 20],
          backgroundColor: [
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: false,
            text: 'Ocupación por Tipo de Habitación'
          }
        }
      }
    });
  }
  
  // Gráfico de reservaciones por mes
  const reservationsCtx = document.getElementById('reservationsChart')?.getContext('2d');
  if (reservationsCtx) {
    if (charts.reservations) charts.reservations.destroy();
    
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesActual = new Date().getMonth();
    const ultimos6Meses = [];
    
    for (let i = 5; i >= 0; i--) {
      const mesIndex = (mesActual - i + 12) % 12;
      ultimos6Meses.push(meses[mesIndex]);
    }
    
    charts.reservations = new Chart(reservationsCtx, {
      type: 'bar',
      data: {
        labels: ultimos6Meses,
        datasets: [{
          label: 'Reservaciones',
          data: [65, 59, 80, 81, 56, 90],
          backgroundColor: 'rgba(128, 0, 128, 0.7)',
          borderColor: 'rgba(128, 0, 128, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false,
            text: 'Reservaciones por Mes'
          }
        }
      }
    });
  }
}

// ---------- RESERVACIONES ---------- //

// Función para cargar lista de reservaciones
async function cargarReservaciones(filtros = {}) {
  try {
    const reservationsTable = document.getElementById('reservations-table');
    const tableInfo = document.getElementById('reservation-table-info');
    
    // Mostrar loader
    if (reservationsTable) {
      reservationsTable.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></td></tr>';
    }
    
    // Construir query según filtros
    const reservasRef = collection(db, "reservaciones");
    let q = query(reservasRef, orderBy("fechaCreacion", "desc"));
    
    // Aplicar filtros adicionales si existen
    if (filtros.estado && filtros.estado !== 'all') {
      q = query(q, where("estado", "==", filtros.estado));
    }
    
    if (filtros.fechaDesde) {
      const fechaDesde = new Date(filtros.fechaDesde);
      q = query(q, where("fechaEntrada", ">=", fechaDesde));
    }
    
    if (filtros.fechaHasta) {
      const fechaHasta = new Date(filtros.fechaHasta);
      q = query(q, where("fechaSalida", "<=", fechaHasta));
    }
    
    // Aplicar paginación (esto es simplificado, en Firebase es más complejo implementar paginación perfecta)
    // Para una implementación real, consideraría usar startAfter y límites
    
    // Obtener reservaciones
    const reservacionesSnapshot = await getDocs(q);
    
    // Actualizar total para la paginación
    paginationState.reservations.total = reservacionesSnapshot.size;
    
    // Actualizar información de la tabla
    if (tableInfo) {
      tableInfo.textContent = `Mostrando ${Math.min(paginationState.reservations.total, paginationState.reservations.size)} de ${paginationState.reservations.total} reservaciones`;
    }
    
    // Verificar si hay resultados
    if (reservacionesSnapshot.empty) {
      if (reservationsTable) {
        reservationsTable.innerHTML = '<tr><td colspan="7" class="text-center">No hay reservaciones que coincidan con los filtros.</td></tr>';
      }
      return;
    }
    
    // Generar filas de la tabla con todos los resultados
    // (para una implementación real, aplicaría slice para paginación)
    let filasHTML = '';
    
    reservacionesSnapshot.forEach((doc) => {
      const reserva = doc.data();
      const id = doc.id;
      
      // Formatear fechas
      const fechaEntrada = reserva.fechaEntrada.toDate ? reserva.fechaEntrada.toDate() : new Date(reserva.fechaEntrada);
      const fechaSalida = reserva.fechaSalida.toDate ? reserva.fechaSalida.toDate() : new Date(reserva.fechaSalida);
      
      const fechaEntradaFormateada = fechaEntrada.toLocaleDateString();
      const fechaSalidaFormateada = fechaSalida.toLocaleDateString();
      
      // Determinar clase CSS según estado
      let estadoClase = '';
      switch (reserva.estado) {
        case 'confirmada':
          estadoClase = 'status-confirmed';
          break;
        case 'completada':
          estadoClase = 'status-completed';
          break;
        case 'cancelada':
          estadoClase = 'status-cancelled';
          break;
      }
      
      filasHTML += `
        <tr>
          <td>${id.substring(0, 8)}...</td>
          <td>${reserva.huesped?.nombre || reserva.usuarioEmail}</td>
          <td>${reserva.habitacionNombre}</td>
          <td>${fechaEntradaFormateada} - ${fechaSalidaFormateada}</td>
          <td>$${reserva.precioTotal?.toFixed(2) || '0.00'}</td>
          <td><span class="status-badge ${estadoClase}">${reserva.estado}</span></td>
          <td>
            <button class="btn btn-sm btn-info me-1 view-reservation" data-id="${id}">
              <ion-icon name="eye-outline"></ion-icon>
            </button>
            <button class="btn btn-sm btn-danger delete-reservation" data-id="${id}">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </td>
        </tr>
      `;
    });
    
    if (reservationsTable) {
      reservationsTable.innerHTML = filasHTML;
      
      // Añadir eventos a los botones
      document.querySelectorAll('.view-reservation').forEach(button => {
        button.addEventListener('click', () => {
          const reservaId = button.getAttribute('data-id');
          mostrarDetallesReservacion(reservaId);
        });
      });
      
      document.querySelectorAll('.delete-reservation').forEach(button => {
        button.addEventListener('click', () => {
          const reservaId = button.getAttribute('data-id');
          confirmarEliminarReservacion(reservaId);
        });
      });
    }
    
    // Actualizar botones de paginación
    actualizarBotonesPaginacion('reservations');
  } catch (error) {
    console.error("Error al cargar reservaciones:", error);
    if (reservationsTable) {
      reservationsTable.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar los datos</td></tr>';
    }
    mostrarToast("Error", "No se pudieron cargar las reservaciones", "error");
  }
}

// Función para mostrar detalles de una reservación
async function mostrarDetallesReservacion(reservaId) {
  try {
    // Obtener el modal
    const modal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalContent = document.getElementById('reservation-detail-content');
    
    // Mostrar spinner mientras carga
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="text-center">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </div>
      `;
    }
    
    // Mostrar el modal
    modal.show();
    
    // Obtener datos de la reservación
    const reservaDoc = await getDoc(doc(db, "reservaciones", reservaId));
    
    if (!reservaDoc.exists()) {
      modalContent.innerHTML = '<div class="alert alert-danger">La reservación no existe o ha sido eliminada.</div>';
      return;
    }
    
    const reserva = reservaDoc.data();
    
    // Formatear fechas
    const fechaEntrada = reserva.fechaEntrada.toDate ? reserva.fechaEntrada.toDate() : new Date(reserva.fechaEntrada);
    const fechaSalida = reserva.fechaSalida.toDate ? reserva.fechaSalida.toDate() : new Date(reserva.fechaSalida);
    
    const fechaEntradaFormateada = fechaEntrada.toLocaleDateString();
    const fechaSalidaFormateada = fechaSalida.toLocaleDateString();
    
    // Formatear extras
    let extrasHTML = '';
    if (reserva.extras && reserva.extras.length > 0) {
      extrasHTML = '<ul class="list-group mb-3">';
      reserva.extras.forEach(extra => {
        extrasHTML += `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            ${extra.nombre}
            <span class="badge bg-primary rounded-pill">$${extra.total.toFixed(2)}</span>
          </li>
        `;
      });
      extrasHTML += '</ul>';
    } else {
      extrasHTML = '<p>No se seleccionaron servicios adicionales.</p>';
    }
    
    // Mostrar detalles en el modal
    modalContent.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <h5>Información de la Reserva</h5>
          <p><strong>ID:</strong> ${reservaId}</p>
          <p><strong>Estado:</strong> <span class="status-badge ${reserva.estado === 'confirmada' ? 'status-confirmed' : reserva.estado === 'completada' ? 'status-completed' : 'status-cancelled'}">${reserva.estado}</span></p>
          <p><strong>Habitación:</strong> ${reserva.habitacionNombre}</p>
          <p><strong>Check-in:</strong> ${fechaEntradaFormateada}</p>
          <p><strong>Check-out:</strong> ${fechaSalidaFormateada}</p>
          <p><strong>Número de noches:</strong> ${reserva.noches}</p>
          <p><strong>Huéspedes:</strong> ${reserva.adultos} adultos, ${reserva.ninos} niños</p>
        </div>
        <div class="col-md-6">
          <h5>Información del Huésped</h5>
          <p><strong>Nombre:</strong> ${reserva.huesped?.nombre || 'No especificado'}</p>
          <p><strong>Email:</strong> ${reserva.huesped?.email || reserva.usuarioEmail}</p>
          <p><strong>Teléfono:</strong> ${reserva.huesped?.telefono || 'No especificado'}</p>
          <p><strong>Documento:</strong> ${reserva.huesped?.documento || 'No especificado'}</p>
        </div>
      </div>
      <hr>
      <div class="row">
        <div class="col-md-6">
          <h5>Servicios Adicionales</h5>
          ${extrasHTML}
        </div>
        <div class="col-md-6">
          <h5>Resumen de Precios</h5>
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between mb-2">
                <span>Precio base (${reserva.noches} noches):</span>
                <span>$${reserva.precioBase?.toFixed(2) || '0.00'}</span>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <span>Extras:</span>
                <span>$${reserva.precioExtras?.toFixed(2) || '0.00'}</span>
              </div>
              <hr>
              <div class="d-flex justify-content-between fw-bold">
                <span>Total:</span>
                <span>$${reserva.precioTotal?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${reserva.solicitudesEspeciales ? `
      <div class="row mt-3">
        <div class="col-12">
          <h5>Solicitudes Especiales</h5>
          <p>${reserva.solicitudesEspeciales}</p>
        </div>
      </div>
      ` : ''}
    `;
    
    // Mostrar u ocultar botones de acciones según el estado
    const btnCompletar = document.getElementById('complete-reservation');
    const btnCancelar = document.getElementById('cancel-reservation');
    
    if (btnCompletar && btnCancelar) {
      if (reserva.estado === 'confirmada') {
        btnCompletar.classList.remove('d-none');
        btnCancelar.classList.remove('d-none');
        
        // Añadir eventos
        btnCompletar.onclick = () => cambiarEstadoReservacion(reservaId, 'completada');
        btnCancelar.onclick = () => cambiarEstadoReservacion(reservaId, 'cancelada');
      } else {
        btnCompletar.classList.add('d-none');
        btnCancelar.classList.add('d-none');
      }
    }
  } catch (error) {
    console.error("Error al mostrar detalles de la reservación:", error);
    if (modalContent) {
      modalContent.innerHTML = '<div class="alert alert-danger">Error al cargar los detalles de la reservación.</div>';
    }
  }
}

// Función para cambiar el estado de una reservación
async function cambiarEstadoReservacion(reservaId, nuevoEstado) {
  try {
    // Actualizar estado en Firestore
    await updateDoc(doc(db, "reservaciones", reservaId), {
      estado: nuevoEstado
    });
    
    // Cerrar el modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('reservationDetailModal'));
    if (modal) modal.hide();
    
    // Mostrar notificación
    mostrarToast("Éxito", `Reservación ${nuevoEstado === 'completada' ? 'completada' : 'cancelada'} exitosamente`);
    
    // Recargar datos
    cargarReservaciones();
    cargarEstadisticasDashboard();
  } catch (error) {
    console.error("Error al cambiar estado de la reservación:", error);
    mostrarToast("Error", "No se pudo cambiar el estado de la reservación", "error");
  }
}

// Función para confirmar eliminación de reservación
function confirmarEliminarReservacion(reservaId) {
  if (confirm("¿Estás seguro de que deseas eliminar esta reservación? Esta acción no se puede deshacer.")) {
    eliminarReservacion(reservaId);
  }
}

// Función para eliminar una reservación
async function eliminarReservacion(reservaId) {
  try {
    // Eliminar de Firestore
    await deleteDoc(doc(db, "reservaciones", reservaId));
    
    // Mostrar notificación
    mostrarToast("Éxito", "Reservación eliminada exitosamente");
    
    // Recargar datos
    cargarReservaciones();
    cargarEstadisticasDashboard();
  } catch (error) {
    console.error("Error al eliminar la reservación:", error);
    mostrarToast("Error", "No se pudo eliminar la reservación", "error");
  }
}

// ---------- HABITACIONES ---------- //

// Función para cargar lista de habitaciones
async function cargarHabitaciones() {
  try {
    const roomsContainer = document.getElementById('rooms-container');
    
    // Mostrar loader
    if (roomsContainer) {
      roomsContainer.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    }
    
    // Obtener habitaciones de Firestore
    const habitacionesRef = collection(db, "habitaciones");
    const habitacionesSnapshot = await getDocs(habitacionesRef);
    
    // Verificar si hay resultados
    if (habitacionesSnapshot.empty) {
      if (roomsContainer) {
        roomsContainer.innerHTML = '<div class="col-12 text-center"><p>No hay habitaciones registradas. Agrega una nueva habitación.</p></div>';
      }
      return;
    }
    
    // Generar tarjetas de habitaciones
    let tarjetasHTML = '';
    
    habitacionesSnapshot.forEach((doc) => {
      const habitacion = doc.data();
      const id = doc.id;
      
      // Determinar clase CSS según estado
      let estadoClase = '';
      switch (habitacion.estado) {
        case 'disponible':
          estadoClase = 'status-available';
          break;
        case 'mantenimiento':
          estadoClase = 'status-maintenance';
          break;
        case 'ocupada':
          estadoClase = 'status-occupied';
          break;
      }
      
      // Generar HTML para amenidades
      let amenidadesHTML = '';
      if (habitacion.amenidades && habitacion.amenidades.length > 0) {
        habitacion.amenidades.forEach(amenidad => {
          let iconName;
          switch (amenidad) {
            case 'WiFi':
              iconName = 'wifi-outline';
              break;
            case 'TV':
              iconName = 'tv-outline';
              break;
            case 'A/C':
              iconName = 'snow-outline';
              break;
            case 'Desayuno':
              iconName = 'restaurant-outline';
              break;
            case 'Jacuzzi':
              iconName = 'water-outline';
              break;
            case 'Champagne':
              iconName = 'wine-outline';
              break;
            default:
              iconName = 'checkmark-circle-outline';
          }
          
          amenidadesHTML += `<span class="badge bg-secondary"><ion-icon name="${iconName}"></ion-icon> ${amenidad}</span> `;
        });
      }
      
    // Añadir contador de imágenes de la galería
      let galeriaInfo = '';
      if (habitacion.galeria && habitacion.galeria.length > 0) {
        galeriaInfo = `<div class="room-gallery-info"><ion-icon name="images-outline"></ion-icon> ${habitacion.galeria.length} imagen(es)</div>`;
      }
      
      tarjetasHTML += `
        <div class="col-lg-4 col-md-6">
          <div class="card room-card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">${habitacion.nombre}</h5>
              <span class="room-status ${estadoClase}">${habitacion.estado}</span>
            </div>
            <div class="card-body">
              <div class="room-image">
                <img src="${habitacion.imagen || '/assets/images/habitacion1.jpg'}" alt="${habitacion.nombre}" class="img-fluid">
                ${galeriaInfo}
              </div>
              <div class="room-info">
                <p>${habitacion.descripcion}</p>
                <div class="room-price mb-2">${habitacion.precio.toFixed(2)} / noche</div>
                <p><strong>Tipo:</strong> ${habitacion.tipo}</p>
                <p><strong>Capacidad:</strong> ${habitacion.capacidad} personas</p>
                <div class="room-amenities">
                  ${amenidadesHTML}
                </div>
              </div>
              <div class="d-flex justify-content-between">
                <button class="btn btn-primary edit-room" data-id="${id}">
                  <ion-icon name="create-outline"></ion-icon> Editar
                </button>
                <button class="btn btn-danger delete-room" data-id="${id}">
                  <ion-icon name="trash-outline"></ion-icon> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    if (roomsContainer) {
      roomsContainer.innerHTML = tarjetasHTML;
      
      // Añadir eventos a los botones
      document.querySelectorAll('.edit-room').forEach(button => {
        button.addEventListener('click', () => {
          const habitacionId = button.getAttribute('data-id');
          editarHabitacion(habitacionId);
        });
      });
      
      document.querySelectorAll('.delete-room').forEach(button => {
        button.addEventListener('click', () => {
          const habitacionId = button.getAttribute('data-id');
          confirmarEliminarHabitacion(habitacionId);
        });
      });
    }
  } catch (error) {
    console.error("Error al cargar habitaciones:", error);
    if (roomsContainer) {
      roomsContainer.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar los datos</div>';
    }
    mostrarToast("Error", "No se pudieron cargar las habitaciones", "error");
  }
}

// Función para guardar una habitación (nueva o editar existente)
async function guardarHabitacion(habitacionData, habitacionId = null) {
  try {
    // Añadir la galería y la imagen principal
    habitacionData.galeria = currentGalleryImages;
    
    // Si hay una imagen principal seleccionada, usarla
    if (mainGalleryImage && currentGalleryImages.includes(mainGalleryImage)) {
      habitacionData.imagen = mainGalleryImage;
    } else if (currentGalleryImages.length > 0) {
      // Si no hay imagen principal pero hay imágenes en la galería, usar la primera
      habitacionData.imagen = currentGalleryImages[0];
    }
    
    if (habitacionId) {
      // Actualizar habitación existente
      await updateDoc(doc(db, "habitaciones", habitacionId), habitacionData);
      mostrarToast("Éxito", "Habitación actualizada exitosamente");
    } else {
      // Crear nueva habitación
      await addDoc(collection(db, "habitaciones"), {
        ...habitacionData,
        fechaCreacion: serverTimestamp()
      });
      mostrarToast("Éxito", "Habitación creada exitosamente");
    }
    
    // Cerrar el modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('roomModal'));
    if (modal) modal.hide();
    
    // Recargar datos
    cargarHabitaciones();
    cargarEstadisticasDashboard();
  } catch (error) {
    console.error("Error al guardar la habitación:", error);
    mostrarToast("Error", "No se pudo guardar la habitación", "error");
  }
}

// Función para editar una habitación existente
async function editarHabitacion(habitacionId) {
  try {
    // Obtener datos de la habitación
    const habitacionDoc = await getDoc(doc(db, "habitaciones", habitacionId));
    
    if (!habitacionDoc.exists()) {
      mostrarToast("Error", "La habitación no existe o ha sido eliminada", "error");
      return;
    }
    
    const habitacion = habitacionDoc.data();
    
    // Abrir el modal para editar
    const modal = new bootstrap.Modal(document.getElementById('roomModal'));
    
    // Actualizar título del modal
    document.getElementById('roomModalLabel').textContent = 'Editar Habitación';
    
    // Rellenar formulario con datos existentes
    document.getElementById('room-id').value = habitacion.id || '';
    document.getElementById('room-name').value = habitacion.nombre || '';
    document.getElementById('room-description').value = habitacion.descripcion || '';
    document.getElementById('room-type').value = habitacion.tipo || 'individual';
    document.getElementById('room-price').value = habitacion.precio || 0;
    document.getElementById('room-capacity').value = habitacion.capacidad || 1;
    document.getElementById('room-image').value = habitacion.imagen || '';
    document.getElementById('room-status').value = habitacion.estado || 'disponible';
    
    // Cargar galería de imágenes
    currentGalleryImages = habitacion.galeria || [];
    mainGalleryImage = habitacion.imagen || '';
    actualizarGaleriaImagenes();
    
    // Marcar amenidades
    const amenidades = habitacion.amenidades || [];
    document.getElementById('amenity-wifi').checked = amenidades.includes('WiFi');
    document.getElementById('amenity-tv').checked = amenidades.includes('TV');
    document.getElementById('amenity-ac').checked = amenidades.includes('A/C');
    document.getElementById('amenity-breakfast').checked = amenidades.includes('Desayuno');
    document.getElementById('amenity-jacuzzi').checked = amenidades.includes('Jacuzzi');
    document.getElementById('amenity-champagne').checked = amenidades.includes('Champagne');
    
    // Actualizar botón de guardar para que sepa que está editando
    const saveButton = document.getElementById('save-room');
    if (saveButton) {
      saveButton.setAttribute('data-edit-id', habitacionId);
    }
    
    // Mostrar el modal
    modal.show();
  } catch (error) {
    console.error("Error al editar la habitación:", error);
    mostrarToast("Error", "No se pudo cargar la información de la habitación", "error");
  }
}

// Función para confirmar eliminación de habitación
function confirmarEliminarHabitacion(habitacionId) {
  if (confirm("¿Estás seguro de que deseas eliminar esta habitación? Esta acción no se puede deshacer.")) {
    eliminarHabitacion(habitacionId);
  }
}

// Función para eliminar una habitación
async function eliminarHabitacion(habitacionId) {
  try {
    // Primero verificar si la habitación tiene reservaciones activas
    const reservasRef = collection(db, "reservaciones");
    const reservasQuery = query(
      reservasRef,
      where("habitacionId", "==", habitacionId),
      where("estado", "==", "confirmada")
    );
    const reservasSnapshot = await getDocs(reservasQuery);
    
    if (!reservasSnapshot.empty) {
      mostrarToast("Error", "No se puede eliminar la habitación porque tiene reservaciones activas", "error");
      return;
    }
    
    // Eliminar de Firestore
    await deleteDoc(doc(db, "habitaciones", habitacionId));
    
    // Mostrar notificación
    mostrarToast("Éxito", "Habitación eliminada exitosamente");
    
    // Recargar datos
    cargarHabitaciones();
    cargarEstadisticasDashboard();
  } catch (error) {
    console.error("Error al eliminar la habitación:", error);
    mostrarToast("Error", "No se pudo eliminar la habitación", "error");
  }
}

// Función para actualizar la visualización de las imágenes de la galería
function actualizarGaleriaImagenes() {
  const galeriaContainer = document.getElementById('gallery-images-container');
  
  if (galeriaContainer) {
    // Limpiar contenedor
    galeriaContainer.innerHTML = '';
    
    if (currentGalleryImages.length === 0) {
      galeriaContainer.innerHTML = '<div class="empty-gallery-message">No hay imágenes en la galería. Añade URLs de imágenes para mostrarlas aquí.</div>';
      return;
    }
    
    // Crear elementos para cada imagen
    currentGalleryImages.forEach((imageUrl, index) => {
      const imageItem = document.createElement('div');
      imageItem.className = 'gallery-image-item';
      
      // Indicador si es la imagen principal
      const isMainImage = imageUrl === mainGalleryImage;
      
      imageItem.innerHTML = `
        <img src="${imageUrl}" alt="Imagen ${index + 1}">
        <button type="button" class="gallery-image-remove" data-index="${index}">
          <ion-icon name="close-outline"></ion-icon>
        </button>
        <button type="button" class="set-as-main" data-url="${imageUrl}" ${isMainImage ? 'style="display:none;"' : ''}>
          <ion-icon name="star-outline"></ion-icon>
        </button>
        ${isMainImage ? '<div class="main-image-flag">Principal</div>' : ''}
      `;
      
      galeriaContainer.appendChild(imageItem);
    });
    
    // Añadir eventos a los botones de eliminar
    document.querySelectorAll('.gallery-image-remove').forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.getAttribute('data-index'));
        eliminarImagenGaleria(index);
      });
    });
    
    // Añadir eventos a los botones de establecer como principal
    document.querySelectorAll('.set-as-main').forEach(button => {
      button.addEventListener('click', () => {
        const url = button.getAttribute('data-url');
        establecerImagenPrincipal(url);
      });
    });
  }
}

// Función para añadir una imagen a la galería
function añadirImagenGaleria(url) {
  // Validar que la URL no esté vacía
  if (!url || url.trim() === '') {
    mostrarToast("Error", "La URL de la imagen no puede estar vacía", "error");
    return;
  }
  
  // Validar que la URL tenga un formato válido
 // Validar que la URL tenga un formato válido (versión más permisiva)
if (!url.match(/^(http|https):\/\/[^\s]+/) && !url.match(/^\/[^\s]+/)) {
  mostrarToast("Error", "La URL de la imagen no es válida. Debe comenzar con http://, https:// o /", "error");
  return;
}
  
  // Validar que la URL no esté ya en la galería
  if (currentGalleryImages.includes(url)) {
    mostrarToast("Error", "Esta imagen ya está en la galería", "error");
    return;
  }
  
  // Añadir la URL a la lista
  currentGalleryImages.push(url);
  
  // Si es la primera imagen, establecerla como principal
  if (currentGalleryImages.length === 1 && !mainGalleryImage) {
    mainGalleryImage = url;
  }
  
  // Actualizar la visualización
  actualizarGaleriaImagenes();
  
  // Limpiar el campo de URL
  document.getElementById('gallery-image-url').value = '';
  
  mostrarToast("Éxito", "Imagen añadida a la galería");
}

// Función para eliminar una imagen de la galería
function eliminarImagenGaleria(index) {
  // Validar que el índice sea válido
  if (index < 0 || index >= currentGalleryImages.length) {
    return;
  }
  
  // Verificar si la imagen a eliminar es la principal
  const imageUrl = currentGalleryImages[index];
  if (imageUrl === mainGalleryImage) {
    // Si se elimina la imagen principal, establecer otra como principal
    if (currentGalleryImages.length > 1) {
      // Encontrar la siguiente imagen disponible
      const nextIndex = index === currentGalleryImages.length - 1 ? 0 : index + 1;
      mainGalleryImage = currentGalleryImages[nextIndex];
    } else {
      // Si no hay más imágenes, limpiar la imagen principal
      mainGalleryImage = '';
    }
  }
  
  // Eliminar la imagen de la lista
  currentGalleryImages.splice(index, 1);
  
  // Actualizar la visualización
  actualizarGaleriaImagenes();
  
  mostrarToast("Éxito", "Imagen eliminada de la galería");
}

// Función para establecer una imagen como principal
function establecerImagenPrincipal(url) {
  // Validar que la URL esté en la galería
  if (!currentGalleryImages.includes(url)) {
    return;
  }
  
  // Establecer como imagen principal
  mainGalleryImage = url;
  
  // Actualizar la visualización
  actualizarGaleriaImagenes();
  
  // Actualizar el campo de imagen principal
  document.getElementById('room-image').value = url;
  
  mostrarToast("Éxito", "Imagen establecida como principal");
}

// ---------- USUARIOS ---------- //

// Función para cargar lista de usuarios
async function cargarUsuarios() {
  try {
    const usersTable = document.getElementById('users-table');
    const tableInfo = document.getElementById('users-table-info');
    
    // Mostrar loader
    if (usersTable) {
      usersTable.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></td></tr>';
    }
    
    // Construir query
    const usuariosRef = collection(db, "usuarios");
    let q = query(usuariosRef, orderBy("fechaRegistro", "desc"));
    
    // Obtener usuarios
    const usuariosSnapshot = await getDocs(q);
    
    // Actualizar total para la paginación
    paginationState.users.total = usuariosSnapshot.size;
    
    // Actualizar información de la tabla
    if (tableInfo) {
      tableInfo.textContent = `Mostrando ${Math.min(paginationState.users.total, paginationState.users.size)} de ${paginationState.users.total} usuarios`;
    }
    
    // Verificar si hay resultados
    if (usuariosSnapshot.empty) {
      if (usersTable) {
        usersTable.innerHTML = '<tr><td colspan="6" class="text-center">No hay usuarios registrados.</td></tr>';
      }
      return;
    }
    
    // Generar filas de la tabla
    let filasHTML = '';
    
    usuariosSnapshot.forEach((doc) => {
      const usuario = doc.data();
      const id = doc.id;
      
      // Formatear fecha
      const fechaRegistro = usuario.fechaRegistro?.toDate ? usuario.fechaRegistro.toDate() : new Date(usuario.fechaRegistro);
      const fechaRegistroFormateada = fechaRegistro instanceof Date && !isNaN(fechaRegistro) ? fechaRegistro.toLocaleDateString() : 'N/A';
      
      filasHTML += `
        <tr>
          <td>${usuario.nombreCompleto || 'Sin nombre'}</td>
          <td>${usuario.email || ''}</td>
          <td>${fechaRegistroFormateada}</td>
          <td><span class="badge ${usuario.rol === 'admin' ? 'bg-danger' : usuario.rol === 'recepcion' ? 'bg-warning' : 'bg-info'}">${usuario.rol || 'cliente'}</span></td>
          <td><span class="badge bg-success">Activo</span></td>
          <td>
            <button class="btn btn-sm btn-primary me-1 edit-user" data-id="${id}">
              <ion-icon name="create-outline"></ion-icon>
            </button>
            <button class="btn btn-sm btn-danger delete-user" data-id="${id}">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </td>
        </tr>
      `;
    });
    
    if (usersTable) {
      usersTable.innerHTML = filasHTML;
      
      // Añadir eventos a los botones
      document.querySelectorAll('.edit-user').forEach(button => {
        button.addEventListener('click', () => {
          const usuarioId = button.getAttribute('data-id');
          editarUsuario(usuarioId);
        });
      });
      
      document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', () => {
          const usuarioId = button.getAttribute('data-id');
          confirmarEliminarUsuario(usuarioId);
        });
      });
    }
    
    // Actualizar botones de paginación
    actualizarBotonesPaginacion('users');
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    if (usersTable) {
      usersTable.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar los datos</td></tr>';
    }
    mostrarToast("Error", "No se pudieron cargar los usuarios", "error");
  }
}

// Función para crear un nuevo usuario
async function crearUsuario(userData) {
  try {
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    
    // Guardar información adicional en Firestore
    await addDoc(collection(db, "usuarios"), {
      uid: userCredential.user.uid,
      email: userData.email,
      nombreCompleto: userData.nombre,
      rol: userData.rol || 'cliente',
      fechaRegistro: serverTimestamp(),
      metodoAutenticacion: 'email'
    });
    
    // Mostrar notificación
    mostrarToast("Éxito", "Usuario creado exitosamente");
    
    // Cerrar el modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
    if (modal) modal.hide();
    
    // Recargar datos
    cargarUsuarios();
  } catch (error) {
    console.error("Error al crear usuario:", error);
    let mensajeError = "No se pudo crear el usuario";
    
    if (error.code === 'auth/email-already-in-use') {
      mensajeError = "El correo electrónico ya está en uso";
    } else if (error.code === 'auth/invalid-email') {
      mensajeError = "El correo electrónico no es válido";
    } else if (error.code === 'auth/weak-password') {
      mensajeError = "La contraseña es demasiado débil";
    }
    
    mostrarToast("Error", mensajeError, "error");
  }
}

// Función para editar un usuario existente
async function editarUsuario(usuarioId) {
  try {
    // Obtener datos del usuario
    const usuarioDoc = await getDoc(doc(db, "usuarios", usuarioId));
    
    if (!usuarioDoc.exists()) {
      mostrarToast("Error", "El usuario no existe o ha sido eliminado", "error");
      return;
    }
    
    const usuario = usuarioDoc.data();
    
    // Abrir el modal para editar
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    
    // Actualizar título del modal
    document.getElementById('userModalLabel').textContent = 'Editar Usuario';
    
    // Rellenar formulario con datos existentes
    document.getElementById('user-name').value = usuario.nombreCompleto || '';
    document.getElementById('user-email').value = usuario.email || '';
    document.getElementById('user-password').value = ''; // No se puede obtener la contraseña existente
    document.getElementById('user-password').disabled = true; // Deshabilitar campo de contraseña para edición
    document.getElementById('user-password').placeholder = 'No se puede cambiar la contraseña aquí';
    document.getElementById('user-role').value = usuario.rol || 'cliente';
    
    // Actualizar botón de guardar para que sepa que está editando
    const saveButton = document.getElementById('save-user');
    if (saveButton) {
      saveButton.setAttribute('data-edit-id', usuarioId);
    }
    
    // Mostrar el modal
    modal.show();
  } catch (error) {
    console.error("Error al editar el usuario:", error);
    mostrarToast("Error", "No se pudo cargar la información del usuario", "error");
  }
}

// Función para actualizar un usuario existente
async function actualizarUsuario(usuarioId, userData) {
  try {
    // Actualizar información en Firestore
    await updateDoc(doc(db, "usuarios", usuarioId), {
      nombreCompleto: userData.nombre,
      rol: userData.rol
      // No se actualiza el email aquí porque requiere autenticación especial
    });
    
    // Mostrar notificación
    mostrarToast("Éxito", "Usuario actualizado exitosamente");
    
    // Cerrar el modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
    if (modal) modal.hide();
    
    // Recargar datos
    cargarUsuarios();
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    mostrarToast("Error", "No se pudo actualizar el usuario", "error");
  }
}

// Función para confirmar eliminación de usuario
function confirmarEliminarUsuario(usuarioId) {
  if (confirm("¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.")) {
    eliminarUsuario(usuarioId);
  }
}

// Función para eliminar un usuario
async function eliminarUsuario(usuarioId) {
  try {
    // Obtener el UID del usuario para borrar de Auth
    const usuarioDoc = await getDoc(doc(db, "usuarios", usuarioId));
    
    if (!usuarioDoc.exists()) {
      mostrarToast("Error", "El usuario no existe o ha sido eliminado", "error");
      return;
    }
    
    const usuario = usuarioDoc.data();
    
    // Verificar si el usuario tiene reservaciones activas
    const reservasRef = collection(db, "reservaciones");
    const reservasQuery = query(
      reservasRef,
      where("usuarioId", "==", usuario.uid),
      where("estado", "==", "confirmada")
    );
    const reservasSnapshot = await getDocs(reservasQuery);
    
    if (!reservasSnapshot.empty) {
      mostrarToast("Error", "No se puede eliminar el usuario porque tiene reservaciones activas", "error");
      return;
    }
    
    // Eliminar de Firestore
    await deleteDoc(doc(db, "usuarios", usuarioId));
    
    // No eliminamos el usuario de Firebase Auth porque podría ser complicado
    // y requiere token fresco. En una implementación real, se podría marcar como
    // desactivado en lugar de eliminar por completo.
    
    // Mostrar notificación
    mostrarToast("Éxito", "Usuario eliminado exitosamente");
    
    // Recargar datos
    cargarUsuarios();
    cargarEstadisticasDashboard();
  } catch (error) {
    console.error("Error al eliminar el usuario:", error);
    mostrarToast("Error", "No se pudo eliminar el usuario", "error");
  }
}

// Función para exportar usuarios a CSV
function exportarUsuariosCSV() {
  try {
    const usuariosRef = collection(db, "usuarios");
    getDocs(usuariosRef).then((snapshot) => {
      if (snapshot.empty) {
        mostrarToast("Información", "No hay usuarios para exportar");
        return;
      }
      
      // Preparar datos para CSV
      let csvContent = "Nombre,Email,Rol,Fecha de Registro\n";
      
      snapshot.forEach((doc) => {
        const usuario = doc.data();
        const fechaRegistro = usuario.fechaRegistro?.toDate ? usuario.fechaRegistro.toDate() : new Date(usuario.fechaRegistro);
        const fechaRegistroFormateada = fechaRegistro instanceof Date && !isNaN(fechaRegistro) ? fechaRegistro.toLocaleDateString() : 'N/A';
        
        // Escapar comas y comillas en los valores
        const nombre = `"${(usuario.nombreCompleto || 'Sin nombre').replace(/"/g, '""')}"`;
        const email = `"${(usuario.email || '').replace(/"/g, '""')}"`;
        const rol = `"${(usuario.rol || 'cliente').replace(/"/g, '""')}"`;
        
        csvContent += `${nombre},${email},${rol},"${fechaRegistroFormateada}"\n`;
      });
      
      // Crear el blob y el link para descarga
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      link.setAttribute("href", url);
      link.setAttribute("download", `usuarios_galaxy_hotel_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      mostrarToast("Éxito", "Usuarios exportados exitosamente");
    }).catch((error) => {
      console.error("Error al exportar usuarios:", error);
      mostrarToast("Error", "No se pudieron exportar los usuarios", "error");
    });
  } catch (error) {
    console.error("Error al exportar usuarios:", error);
    mostrarToast("Error", "No se pudieron exportar los usuarios", "error");
  }
}

// Función para actualizar los botones de paginación
function actualizarBotonesPaginacion(tipo) {
  const prevBtn = document.getElementById(tipo === 'users' ? 'users-prev-page' : 'prev-page');
  const nextBtn = document.getElementById(tipo === 'users' ? 'users-next-page' : 'next-page');
  const pageInfo = document.getElementById(tipo === 'users' ? 'users-current-page' : 'current-page');
  
  if (prevBtn && nextBtn && pageInfo) {
    const state = paginationState[tipo];
    
    // Actualizar texto de la página actual
    pageInfo.textContent = `Página ${state.page}`;
    
    // Habilitar/deshabilitar botones según la página actual
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page * state.size >= state.total;
  }
}

// ---------- INICIALIZACIÓN Y EVENTOS ---------- //

// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar acceso de administrador
  const tieneAcceso = await verificarAccesoAdmin();
  if (!tieneAcceso) return;
  
  // Cargar datos iniciales
  cargarEstadisticasDashboard();
  
  // Event listeners para eventos de pestañas
  document.getElementById('reservations-tab')?.addEventListener('click', () => {
    cargarReservaciones();
  });
  
  document.getElementById('rooms-tab')?.addEventListener('click', () => {
    cargarHabitaciones();
  });
  
  document.getElementById('users-tab')?.addEventListener('click', () => {
    cargarUsuarios();
  });
  
  // Botón para refrescar llegadas
  document.getElementById('refresh-arrivals')?.addEventListener('click', () => {
    cargarProximasLlegadas();
  });
  
  // Botones de filtro para reservaciones
  document.getElementById('apply-filters')?.addEventListener('click', () => {
    const estado = document.getElementById('filter-status').value;
    const fechaDesde = document.getElementById('filter-date-from').value;
    const fechaHasta = document.getElementById('filter-date-to').value;
    
    cargarReservaciones({
      estado,
      fechaDesde,
      fechaHasta
    });
  });
  
  // Eventos para paginación
  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (paginationState.reservations.page > 1) {
      paginationState.reservations.page--;
      cargarReservaciones();
    }
  });
  
  document.getElementById('next-page')?.addEventListener('click', () => {
    if (paginationState.reservations.page * paginationState.reservations.size < paginationState.reservations.total) {
      paginationState.reservations.page++;
      cargarReservaciones();
    }
  });
  
  document.getElementById('users-prev-page')?.addEventListener('click', () => {
    if (paginationState.users.page > 1) {
      paginationState.users.page--;
      cargarUsuarios();
    }
  });
  
  document.getElementById('users-next-page')?.addEventListener('click', () => {
    if (paginationState.users.page * paginationState.users.size < paginationState.users.total) {
      paginationState.users.page++;
      cargarUsuarios();
    }
  });
  
  // Evento para nueva reservación
  document.getElementById('new-reservation-btn')?.addEventListener('click', () => {
    window.location.href = 'booking.html';
  });
  
  // Evento para guardar habitación
  document.getElementById('save-room')?.addEventListener('click', () => {
    // Obtener datos del formulario
    const id = document.getElementById('room-id').value;
    const nombre = document.getElementById('room-name').value;
    const descripcion = document.getElementById('room-description').value;
    const tipo = document.getElementById('room-type').value;
    const precio = parseFloat(document.getElementById('room-price').value);
    const capacidad = parseInt(document.getElementById('room-capacity').value);
    const imagen = document.getElementById('room-image').value;
    const estado = document.getElementById('room-status').value;
    
    // Obtener amenidades seleccionadas
    const amenidades = [];
    if (document.getElementById('amenity-wifi').checked) amenidades.push('WiFi');
    if (document.getElementById('amenity-tv').checked) amenidades.push('TV');
    if (document.getElementById('amenity-ac').checked) amenidades.push('A/C');
    if (document.getElementById('amenity-breakfast').checked) amenidades.push('Desayuno');
    if (document.getElementById('amenity-jacuzzi').checked) amenidades.push('Jacuzzi');
    if (document.getElementById('amenity-champagne').checked) amenidades.push('Champagne');
    
    // Validar datos
    if (!nombre || !descripcion || isNaN(precio) || isNaN(capacidad)) {
      mostrarToast("Error", "Por favor, completa todos los campos obligatorios", "error");
      return;
    }
    
    // Preparar datos para guardar
    const habitacionData = {
      id,
      nombre,
      descripcion,
      tipo,
      precio,
      capacidad,
      imagen,
      estado,
      amenidades
    };
    
    // Verificar si es edición o nueva
    const editId = document.getElementById('save-room').getAttribute('data-edit-id');
    
    // Guardar habitación
    guardarHabitacion(habitacionData, editId);
  });
  
  // Evento para guardar usuario
  document.getElementById('save-user')?.addEventListener('click', () => {
    // Obtener datos del formulario
    const nombre = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const rol = document.getElementById('user-role').value;
    
    // Validar datos
    if (!nombre || !email) {
      mostrarToast("Error", "Por favor, completa todos los campos obligatorios", "error");
      return;
    }
    
    // Verificar si es edición o nuevo
    const editId = document.getElementById('save-user').getAttribute('data-edit-id');
    
    if (editId) {
      // Actualizar usuario existente
      actualizarUsuario(editId, { nombre, rol });
    } else {
      // Validar contraseña para usuario nuevo
      if (!password || password.length < 6) {
        mostrarToast("Error", "La contraseña debe tener al menos 6 caracteres", "error");
        return;
      }
      
      // Crear nuevo usuario
      crearUsuario({ nombre, email, password, rol });
    }
  });
  
  // Evento para exportar usuarios
  document.getElementById('export-users')?.addEventListener('click', exportarUsuariosCSV);
  
  // Resetear formulario de habitación cuando se abre el modal para nueva habitación
  document.getElementById('new-room-btn')?.addEventListener('click', () => {
    document.getElementById('roomModalLabel').textContent = 'Nueva Habitación';
    document.getElementById('room-form').reset();
    document.getElementById('save-room').removeAttribute('data-edit-id');
    document.getElementById('room-id').disabled = false;
    
    // Resetear galería de imágenes
    currentGalleryImages = [];
    mainGalleryImage = '';
    actualizarGaleriaImagenes();
  });
  
  // Resetear formulario de usuario cuando se abre el modal para nuevo usuario
  document.getElementById('new-user-btn')?.addEventListener('click', () => {
    document.getElementById('userModalLabel').textContent = 'Nuevo Usuario';
    document.getElementById('user-form').reset();
    document.getElementById('save-user').removeAttribute('data-edit-id');
    document.getElementById('user-password').disabled = false;
    document.getElementById('user-password').placeholder = 'Mínimo 6 caracteres';
  });
  
  // Evento para añadir imagen a la galería
  document.getElementById('add-gallery-image')?.addEventListener('click', () => {
    const url = document.getElementById('gallery-image-url').value;
    añadirImagenGaleria(url);
  });

  // Evento para añadir imagen con Enter
  document.getElementById('gallery-image-url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const url = document.getElementById('gallery-image-url').value;
      añadirImagenGaleria(url);
    }
  });
});