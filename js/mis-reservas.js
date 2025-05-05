// Importar Firebase
import {
  auth,
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onAuthStateChanged
} from '../js/firebase-config.js';

// Variables para la paginación y filtros
let reservaciones = [];
let filtrosActuales = {
  estado: 'all',
  fechaDesde: null,
  fechaHasta: null
};
let userAuthenticated = false;

// Elementos del DOM
const reservasContainer = document.getElementById('reservaciones-container');
const reservasCount = document.getElementById('reservas-count');
const filterForm = document.getElementById('filter-form');
const exportBtn = document.getElementById('export-reservations');

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

// Función para verificar autenticación
function verificarAutenticacion() {
  // Mostrar mensaje de carga mientras se verifica
  if (reservasContainer) {
    reservasContainer.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Verificando autenticación...</span>
        </div>
        <p class="mt-3">Verificando tu sesión...</p>
      </div>
    `;
  }
  
  // Utilizar onAuthStateChanged para verificar de forma asíncrona
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Usuario autenticado
      console.log("Usuario autenticado:", user.email);
      userAuthenticated = true;
      // Cargar las reservaciones
      cargarReservaciones();
    } else {
      // No hay usuario autenticado
      console.log("No hay usuario autenticado, redirigiendo al login");
      userAuthenticated = false;
      
      // Mostrar mensaje antes de redirigir
      if (reservasContainer) {
        reservasContainer.innerHTML = `
          <div class="alert alert-warning text-center" role="alert">
            <h4>Autenticación requerida</h4>
            <p>Debes iniciar sesión para ver tus reservaciones.</p>
            <p>Serás redirigido a la página de inicio de sesión en unos segundos...</p>
          </div>
        `;
      }
      
      // Redirigir después de un breve retraso
      setTimeout(() => {
        window.location.href = '../login.html';
      }, 3000);
    }
  });
}

// Función para cargar las reservaciones del usuario
async function cargarReservaciones() {
  try {
    // Verificar nuevamente la autenticación por seguridad
    if (!auth.currentUser) {
      console.error("Error: No hay usuario autenticado al intentar cargar reservaciones");
      return;
    }
    
    // Mostrar loader
    if (reservasContainer) {
      reservasContainer.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="mt-3">Cargando tus reservaciones...</p>
        </div>
      `;
    }
    
    console.log("Consultando reservaciones para el usuario:", auth.currentUser.uid);
    
    // Construir query para las reservaciones del usuario actual
    const reservasRef = collection(db, "reservaciones");
    let q = query(
      reservasRef,
      where("usuarioId", "==", auth.currentUser.uid)
    );
    
    try {
      // Intentar obtener las reservaciones
      const querySnapshot = await getDocs(q);
      console.log("Reservaciones encontradas:", querySnapshot.size);
      
      // Procesar resultados
      reservaciones = [];
      querySnapshot.forEach((doc) => {
        const reserva = {
          id: doc.id,
          ...doc.data()
        };
        
        // Convertir fechas de Firestore a objetos Date si es necesario
        if (reserva.fechaEntrada && typeof reserva.fechaEntrada.toDate === 'function') {
          reserva.fechaEntrada = reserva.fechaEntrada.toDate();
        }
        
        if (reserva.fechaSalida && typeof reserva.fechaSalida.toDate === 'function') {
          reserva.fechaSalida = reserva.fechaSalida.toDate();
        }
        
        if (reserva.fechaCreacion && typeof reserva.fechaCreacion.toDate === 'function') {
          reserva.fechaCreacion = reserva.fechaCreacion.toDate();
        }
        
        reservaciones.push(reserva);
      });
      
      // Aplicar filtros si existen
      aplicarFiltros();
    } catch (queryError) {
      console.error("Error al consultar reservaciones:", queryError);
      if (reservasContainer) {
        reservasContainer.innerHTML = `
          <div class="alert alert-danger text-center" role="alert">
            <h4>Error al cargar reservaciones</h4>
            <p>No se pudieron obtener tus reservaciones. Por favor, inténtalo de nuevo.</p>
            <p><small>Error: ${queryError.message}</small></p>
            <button class="btn btn-danger mt-3" onclick="window.location.reload()">
              <ion-icon name="refresh-outline"></ion-icon> Reintentar
            </button>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error("Error general al cargar reservaciones:", error);
    
    if (reservasContainer) {
      reservasContainer.innerHTML = `
        <div class="alert alert-danger text-center" role="alert">
          <h4>Error al cargar tus reservaciones</h4>
          <p>Ocurrió un error inesperado. Por favor, inténtalo de nuevo más tarde.</p>
          <p><small>Error: ${error.message}</small></p>
          <button class="btn btn-danger mt-3" onclick="window.location.reload()">
            <ion-icon name="refresh-outline"></ion-icon> Reintentar
          </button>
        </div>
      `;
    }
    
    mostrarToast("Error", "No se pudieron cargar tus reservaciones", "error");
  }
}

// Función para aplicar filtros a las reservaciones
function aplicarFiltros() {
  try {
    // Obtener valores de los filtros
    const estado = document.getElementById('filter-status').value;
    const fechaDesde = document.getElementById('filter-date-from').value;
    const fechaHasta = document.getElementById('filter-date-to').value;
    
    // Actualizar filtros actuales
    filtrosActuales = {
      estado,
      fechaDesde: fechaDesde ? new Date(fechaDesde) : null,
      fechaHasta: fechaHasta ? new Date(fechaHasta) : null
    };
    
    // Filtrar reservaciones
    let reservacionesFiltradas = [...reservaciones];
    
    // Filtrar por estado
    if (estado !== 'all') {
      reservacionesFiltradas = reservacionesFiltradas.filter(r => r.estado === estado);
    }
    
    // Filtrar por fecha desde
    if (filtrosActuales.fechaDesde) {
      filtrosActuales.fechaDesde.setHours(0, 0, 0, 0);
      reservacionesFiltradas = reservacionesFiltradas.filter(r => {
        const fechaEntrada = new Date(r.fechaEntrada);
        fechaEntrada.setHours(0, 0, 0, 0);
        return fechaEntrada >= filtrosActuales.fechaDesde;
      });
    }
    
    // Filtrar por fecha hasta
    if (filtrosActuales.fechaHasta) {
      filtrosActuales.fechaHasta.setHours(23, 59, 59, 999);
      reservacionesFiltradas = reservacionesFiltradas.filter(r => {
        const fechaSalida = new Date(r.fechaSalida);
        fechaSalida.setHours(0, 0, 0, 0);
        return fechaSalida <= filtrosActuales.fechaHasta;
      });
    }
    
    // Actualizar contador de reservaciones
    if (reservasCount) {
      reservasCount.textContent = `${reservacionesFiltradas.length} reservación(es) encontrada(s)`;
    }
    
    // Mostrar reservaciones en la interfaz
    mostrarReservaciones(reservacionesFiltradas);
    
  } catch (error) {
    console.error("Error al aplicar filtros:", error);
    mostrarToast("Error", "No se pudieron aplicar los filtros", "error");
  }
}

// Función para mostrar las reservaciones en la interfaz
function mostrarReservaciones(reservacionesList) {
  if (!reservasContainer) return;
  
  // Si no hay reservaciones, mostrar mensaje
  if (reservacionesList.length === 0) {
    reservasContainer.innerHTML = `
      <div class="no-reservations">
        <ion-icon name="calendar-outline"></ion-icon>
        <h4>No tienes reservaciones</h4>
        <p>Aún no has realizado ninguna reservación. ¡Reserva tu primera estancia ahora!</p>
        <a href="booking.html" class="btn btn-primary">
          <ion-icon name="add-outline"></ion-icon> Nueva Reservación
        </a>
      </div>
    `;
    return;
  }
  
  // Generar tarjetas de reservaciones
  let html = '';
  
  reservacionesList.forEach(reserva => {
    // Formatear fechas
    const fechaEntrada = new Date(reserva.fechaEntrada).toLocaleDateString();
    const fechaSalida = new Date(reserva.fechaSalida).toLocaleDateString();
    
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
    
    html += `
      <div class="reserva-card">
        <div class="reserva-header">
          <h5>${reserva.habitacionNombre}</h5>
          <span class="status-badge ${estadoClase}">${reserva.estado}</span>
        </div>
        <div class="reserva-body">
          <div class="reserva-dates">
            <div class="date-block">
              <span class="date-label">Llegada</span>
              <span class="date-value">${fechaEntrada}</span>
            </div>
            <div class="date-arrow">
              <ion-icon name="arrow-forward-outline"></ion-icon>
            </div>
            <div class="date-block">
              <span class="date-label">Salida</span>
              <span class="date-value">${fechaSalida}</span>
            </div>
          </div>
          <div class="reserva-info">
            <p><strong>Huéspedes:</strong> ${reserva.adultos} adulto(s), ${reserva.ninos} niño(s)</p>
            <p><strong>Noches:</strong> ${reserva.noches}</p>
            ${reserva.extras && reserva.extras.length > 0 ? 
              `<p><strong>Extras:</strong> ${reserva.extras.map(e => e.nombre).join(', ')}</p>` : ''}
          </div>
          <div class="reserva-price">
            Total: <span class="price-value">$${reserva.precioTotal.toFixed(2)}</span>
          </div>
        </div>
        <div class="reserva-footer">
          <button class="btn btn-sm btn-primary view-reservation" data-id="${reserva.id}">
            <ion-icon name="eye-outline"></ion-icon> Ver Detalles
          </button>
          ${reserva.estado === 'confirmada' ? 
            `<button class="btn btn-sm btn-danger cancel-reservation" data-id="${reserva.id}">
              <ion-icon name="close-outline"></ion-icon> Cancelar
            </button>` : ''}
        </div>
      </div>
    `;
  });
  
  reservasContainer.innerHTML = html;
  
  // Añadir eventos a los botones
  document.querySelectorAll('.view-reservation').forEach(button => {
    button.addEventListener('click', () => {
      const reservaId = button.getAttribute('data-id');
      verDetallesReservacion(reservaId);
    });
  });
  
  document.querySelectorAll('.cancel-reservation').forEach(button => {
    button.addEventListener('click', () => {
      const reservaId = button.getAttribute('data-id');
      confirmarCancelacionReservacion(reservaId);
    });
  });
}

// Función para ver detalles de una reservación
async function verDetallesReservacion(reservaId) {
  // Buscar la reservación en la lista
  const reserva = reservaciones.find(r => r.id === reservaId);
  
  if (!reserva) {
    mostrarToast("Error", "No se encontró la reservación", "error");
    return;
  }
  
  // Crear modal para mostrar detalles
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
  
  try {
    // Formatear fechas
    const fechaEntrada = new Date(reserva.fechaEntrada).toLocaleDateString();
    const fechaSalida = new Date(reserva.fechaSalida).toLocaleDateString();
    const fechaCreacion = reserva.fechaCreacion ? new Date(reserva.fechaCreacion).toLocaleString() : 'No disponible';
    
    // Formatear extras
    let extrasHTML = '';
    if (reserva.extras && reserva.extras.length > 0) {
      extrasHTML = '<ul class="list-group mb-3">';
      reserva.extras.forEach(extra => {
        extrasHTML += `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            ${extra.nombre}
            <span class="badge bg-primary rounded-pill">$${extra.total?.toFixed(2) || '0.00'}</span>
          </li>
        `;
      });
      extrasHTML += '</ul>';
    } else {
      extrasHTML = '<p>No se seleccionaron servicios adicionales.</p>';
    }
    
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
    
    // Mostrar detalles en el modal
    modalContent.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <div class="reservation-detail-section">
            <h5>Información de la Reserva</h5>
            <p><strong>ID:</strong> ${reserva.id}</p>
            <p><strong>Estado:</strong> <span class="status-badge ${estadoClase}">${reserva.estado}</span></p>
            <p><strong>Fecha de creación:</strong> ${fechaCreacion}</p>
            <p><strong>Habitación:</strong> ${reserva.habitacionNombre}</p>
          </div>
          
          <div class="reservation-detail-section">
            <h5>Fechas y Huéspedes</h5>
            <p><strong>Check-in:</strong> ${fechaEntrada}</p>
            <p><strong>Check-out:</strong> ${fechaSalida}</p>
            <p><strong>Número de noches:</strong> ${reserva.noches}</p>
            <p><strong>Huéspedes:</strong> ${reserva.adultos} adultos, ${reserva.ninos} niños</p>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="reservation-detail-section">
            <h5>Datos de Contacto</h5>
            <p><strong>Nombre:</strong> ${reserva.huesped?.nombre || 'No especificado'}</p>
            <p><strong>Email:</strong> ${reserva.huesped?.email || reserva.usuarioEmail}</p>
            <p><strong>Teléfono:</strong> ${reserva.huesped?.telefono || 'No especificado'}</p>
            <p><strong>Documento:</strong> ${reserva.huesped?.documento || 'No especificado'}</p>
          </div>
          
          <div class="reservation-detail-section">
            <h5>Resumen de Precios</h5>
            <div class="price-summary">
              <div class="price-row">
                <span>Precio base (${reserva.noches} noches):</span>
                <span>$${reserva.precioBase?.toFixed(2) || '0.00'}</span>
              </div>
              <div class="price-row">
                <span>Extras:</span>
                <span>$${reserva.precioExtras?.toFixed(2) || '0.00'}</span>
              </div>
              <div class="price-divider"></div>
              <div class="price-row total">
                <span>Total:</span>
                <span>$${reserva.precioTotal?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row mt-3">
        <div class="col-md-6">
          <div class="reservation-detail-section">
            <h5>Servicios Adicionales</h5>
            ${extrasHTML}
          </div>
        </div>
        
        <div class="col-md-6">
          ${reserva.solicitudesEspeciales ? `
            <div class="reservation-detail-section">
              <h5>Solicitudes Especiales</h5>
              <p>${reserva.solicitudesEspeciales}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Mostrar u ocultar botón de cancelar según el estado
    const btnCancelar = document.getElementById('cancel-reservation');
    
    if (btnCancelar) {
      if (reserva.estado === 'confirmada') {
        btnCancelar.classList.remove('d-none');
        // Añadir evento
        btnCancelar.onclick = () => cancelarReservacion(reserva.id);
      } else {
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

// Función para confirmar cancelación de una reservación
function confirmarCancelacionReservacion(reservaId) {
  if (confirm("¿Estás seguro de que deseas cancelar esta reservación? Esta acción no se puede deshacer.")) {
    cancelarReservacion(reservaId);
  }
}

// Función para cancelar una reservación
async function cancelarReservacion(reservaId) {
  try {
    // Actualizar el estado de la reservación en Firestore
    await updateDoc(doc(db, "reservaciones", reservaId), {
      estado: "cancelada",
      fechaCancelacion: serverTimestamp()
    });
    
    // Actualizar el estado en la lista local
    const index = reservaciones.findIndex(r => r.id === reservaId);
    if (index !== -1) {
      reservaciones[index].estado = "cancelada";
    }
    
    // Cerrar el modal si está abierto
    const modal = bootstrap.Modal.getInstance(document.getElementById('reservationDetailModal'));
    if (modal) modal.hide();
    
    // Mostrar notificación
    mostrarToast("Reservación cancelada", "Tu reservación ha sido cancelada exitosamente");
    
    // Volver a aplicar filtros para actualizar la interfaz
    aplicarFiltros();
  } catch (error) {
    console.error("Error al cancelar la reservación:", error);
    mostrarToast("Error", "No se pudo cancelar la reservación", "error");
  }
}

// Función para exportar reservaciones a CSV
function exportarReservacionesCSV() {
  try {
    // Obtener reservaciones filtradas
    let reservacionesExportar = [...reservaciones];
    
    // Aplicar filtros actuales
    if (filtrosActuales.estado !== 'all') {
      reservacionesExportar = reservacionesExportar.filter(r => r.estado === filtrosActuales.estado);
    }
    
    if (filtrosActuales.fechaDesde) {
      reservacionesExportar = reservacionesExportar.filter(r => new Date(r.fechaEntrada) >= filtrosActuales.fechaDesde);
    }
    
    if (filtrosActuales.fechaHasta) {
      reservacionesExportar = reservacionesExportar.filter(r => new Date(r.fechaSalida) <= filtrosActuales.fechaHasta);
    }
    
    // Verificar si hay reservaciones para exportar
    if (reservacionesExportar.length === 0) {
      mostrarToast("Información", "No hay reservaciones para exportar");
      return;
    }
    
    // Preparar datos para CSV
    let csvContent = "ID,Habitación,Fechas,Huéspedes,Extras,Total,Estado\n";
    
    reservacionesExportar.forEach(reserva => {
      // Formatear fechas
      const fechaEntrada = new Date(reserva.fechaEntrada).toLocaleDateString();
      const fechaSalida = new Date(reserva.fechaSalida).toLocaleDateString();
      
      // Escapar comas y comillas en los valores
      const id = `"${reserva.id}"`;
      const habitacion = `"${reserva.habitacionNombre.replace(/"/g, '""')}"`;
      const fechas = `"${fechaEntrada} - ${fechaSalida}"`;
      const huespedes = `"${reserva.adultos} adultos, ${reserva.ninos} niños"`;
      
      // Extras
      let extras = '""';
      if (reserva.extras && reserva.extras.length > 0) {
        extras = `"${reserva.extras.map(e => e.nombre).join(', ').replace(/"/g, '""')}"`;
      }
      
      const total = `"$${reserva.precioTotal?.toFixed(2) || '0.00'}"`;
      const estado = `"${reserva.estado}"`;
      
      csvContent += `${id},${habitacion},${fechas},${huespedes},${extras},${total},${estado}\n`;
    });
    
    // Crear el blob y el link para descarga
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `mis_reservaciones_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarToast("Éxito", "Reservaciones exportadas exitosamente");
  } catch (error) {
    console.error("Error al exportar reservaciones:", error);
    mostrarToast("Error", "No se pudieron exportar las reservaciones", "error");
  }
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM cargado, verificando autenticación...");
  
  // Verificar autenticación antes de cargar datos
  verificarAutenticacion();
  
  // Añadir evento al formulario de filtros
  if (filterForm) {
    filterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      aplicarFiltros();
    });
  }
  
  // Añadir evento al botón de exportar
  if (exportBtn) {
    exportBtn.addEventListener('click', exportarReservacionesCSV);
  }
});