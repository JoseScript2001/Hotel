// Importar Firebase
import {
  auth,
  db,
  doc,
  getDoc
} from '../js/firebase-config.js';

// Importar funciones de autenticación
import { currentUser } from '../js/auth.js';

// Elementos del DOM
const confirmationId = document.getElementById('confirmation-id');
const roomName = document.getElementById('room-name');
const checkInDate = document.getElementById('check-in-date');
const checkOutDate = document.getElementById('check-out-date');
const duration = document.getElementById('duration');
const guests = document.getElementById('guests');
const guestName = document.getElementById('guest-name');
const guestEmail = document.getElementById('guest-email');
const guestPhone = document.getElementById('guest-phone');
const extrasList = document.getElementById('extras-list');
const specialRequests = document.getElementById('special-requests');
const roomPrice = document.getElementById('room-price');
const extrasPrice = document.getElementById('extras-price');
const totalPrice = document.getElementById('total-price');
const printButton = document.getElementById('print-confirmation');
const resendEmailBtn = document.getElementById('resend-email');

// Función para obtener parámetros de la URL
function obtenerParametrosURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    id: urlParams.get('id')
  };
}

// Función para cargar los detalles de la reservación
async function cargarDetallesReservacion() {
  try {
    const params = obtenerParametrosURL();
    const reservacionId = params.id;
    
    if (!reservacionId) {
      mostrarError('No se encontró el ID de la reservación en la URL');
      return;
    }
    
    // Mostrar el ID en la página
    if (confirmationId) {
      confirmationId.textContent = reservacionId;
    }
    
    // Obtener datos de la reservación desde Firestore
    const reservaDoc = await getDoc(doc(db, "reservaciones", reservacionId));
    
    if (!reservaDoc.exists()) {
      mostrarError('La reservación no existe o ha sido eliminada');
      return;
    }
    
    const reserva = reservaDoc.data();
    
    // Verificar si el usuario actual es el dueño de la reservación o un administrador
    if (auth.currentUser) {
      if (auth.currentUser.uid !== reserva.usuarioId) {
        // Verificar si es admin (en una implementación real sería más complejo)
        console.log("Advertencia: El usuario actual no es el propietario de esta reservación");
      }
    }
    
    // Actualizar la información en la página
    actualizarInformacionReservacion(reserva);
    
  } catch (error) {
    console.error("Error al cargar los detalles de la reservación:", error);
    mostrarError('Error al cargar los detalles de la reservación');
  }
}

// Función para mostrar mensaje de error
function mostrarError(mensaje) {
  // Crear un elemento de alerta
  const alertElement = document.createElement('div');
  alertElement.className = 'alert alert-danger text-center my-4';
  alertElement.textContent = mensaje;
  
  // Insertar antes del primer elemento en el contenido principal
  const mainContent = document.querySelector('main .container');
  if (mainContent && mainContent.firstChild) {
    mainContent.insertBefore(alertElement, mainContent.firstChild);
  }
  
  // Ocultar la tarjeta de confirmación
  const confirmationCard = document.querySelector('.confirmation-card');
  if (confirmationCard) {
    confirmationCard.style.display = 'none';
  }
}

// Función para actualizar la información de la reservación en la página
function actualizarInformacionReservacion(reserva) {
  // Información principal
  if (roomName) roomName.textContent = reserva.habitacionNombre || 'No especificado';
  
  // Formatear fechas
  const fechaEntrada = reserva.fechaEntrada.toDate ? reserva.fechaEntrada.toDate() : new Date(reserva.fechaEntrada);
  const fechaSalida = reserva.fechaSalida.toDate ? reserva.fechaSalida.toDate() : new Date(reserva.fechaSalida);
  
  if (checkInDate) checkInDate.textContent = fechaEntrada.toLocaleDateString();
  if (checkOutDate) checkOutDate.textContent = fechaSalida.toLocaleDateString();
  if (duration) duration.textContent = `${reserva.noches} noche${reserva.noches !== 1 ? 's' : ''}`;
  if (guests) guests.textContent = `${reserva.adultos} adulto${reserva.adultos !== 1 ? 's' : ''}, ${reserva.ninos} niño${reserva.ninos !== 1 ? 's' : ''}`;
  
  // Información del huésped
  if (guestName) guestName.textContent = reserva.huesped?.nombre || 'No especificado';
  if (guestEmail) guestEmail.textContent = reserva.huesped?.email || reserva.usuarioEmail || 'No especificado';
  if (guestPhone) guestPhone.textContent = reserva.huesped?.telefono || 'No especificado';
  
  // Extras
  if (extrasList) {
    if (reserva.extras && reserva.extras.length > 0) {
      extrasList.innerHTML = '';
      reserva.extras.forEach(extra => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${extra.nombre}</span>
          <span>$${extra.total.toFixed(2)}</span>
        `;
        extrasList.appendChild(li);
      });
    } else {
      const extrasSection = document.getElementById('extras-section');
      if (extrasSection) {
        extrasSection.innerHTML = '<p>No se seleccionaron servicios adicionales.</p>';
      }
    }
  }
  
  // Solicitudes especiales
  if (specialRequests) {
    if (reserva.solicitudesEspeciales && reserva.solicitudesEspeciales.trim() !== '') {
      specialRequests.textContent = reserva.solicitudesEspeciales;
    } else {
      const specialRequestsSection = document.getElementById('special-requests-section');
      if (specialRequestsSection) {
        specialRequestsSection.style.display = 'none';
      }
    }
  }
  
  // Precios
  if (roomPrice) roomPrice.textContent = `$${reserva.precioBase?.toFixed(2) || '0.00'}`;
  
  if (extrasPrice) {
    const precioExtras = reserva.precioExtras || 0;
    extrasPrice.textContent = `$${precioExtras.toFixed(2)}`;
    
    // Ocultar sección de extras si no hay
    if (precioExtras === 0) {
      const extrasPriceContainer = document.getElementById('extras-price-container');
      if (extrasPriceContainer) {
        extrasPriceContainer.style.display = 'none';
      }
    }
  }
  
  if (totalPrice) totalPrice.textContent = `$${reserva.precioTotal?.toFixed(2) || '0.00'}`;
}

// Función para imprimir la confirmación
function imprimirConfirmacion() {
  window.print();
}

// Función para reenviar correo de confirmación
async function reenviarCorreoConfirmacion(reservaId) {
  try {
    const reservaDoc = await getDoc(doc(db, "reservaciones", reservaId));
    
    if (!reservaDoc.exists()) {
      mostrarError('La reservación no existe o ha sido eliminada');
      return;
    }
    
    const reserva = reservaDoc.data();
    
// Preparar datos para EmailJS
const templateParams = {
  hotel_logo: "https://i.imgur.com/SZHqAIH.png", // Reemplaza con URL real del logo
  order_id: reservaId,
  guest_name: reserva.huesped?.nombre || "Estimado cliente",
  room_image: "https://i.imgur.com/JLn0KKk.jpg", // Imagen predeterminada
  name: reserva.habitacionNombre,
  units: reserva.noches,
  check_in: new Date(reserva.fechaEntrada.toDate ? reserva.fechaEntrada.toDate() : reserva.fechaEntrada).toLocaleDateString(),
  check_out: new Date(reserva.fechaSalida.toDate ? reserva.fechaSalida.toDate() : reserva.fechaSalida).toLocaleDateString(),
  guests: `${reserva.adultos} adultos, ${reserva.ninos} niños`,
  price: (reserva.precioBase / reserva.noches).toFixed(2),
  room_total: reserva.precioBase.toFixed(2),
  cost: {
    shipping: reserva.precioExtras.toFixed(2),
    tax: "0.00", // Si no tienes impuestos calculados
    total: reserva.precioTotal.toFixed(2)
  },
  to_email: reserva.huesped?.email || reserva.usuarioEmail // Añadimos la dirección de correo del destinatario
};

    // Enviar email usando EmailJS
    emailjs.send('service_qqjjqzb', 'template_oljupv9', templateParams, 'YWLyHKBym8x8Nb9fS')
      .then(function(response) {
        console.log('Correo reenviado!', response.status, response.text);
        alert('Se ha reenviado el correo de confirmación exitosamente.');
      }, function(error) {
        console.error('Error al reenviar correo:', error);
        alert('Ocurrió un error al reenviar el correo de confirmación.');
      });
  } catch (error) {
    console.error("Error al reenviar correo de confirmación:", error);
    alert('Ocurrió un error al reenviar el correo de confirmación.');
  }
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  // Cargar detalles de la reservación
  cargarDetallesReservacion();
  
  // Evento para imprimir
  if (printButton) {
    printButton.addEventListener('click', imprimirConfirmacion);
  }
  
  // Evento para reenviar correo
  if (resendEmailBtn) {
    resendEmailBtn.addEventListener('click', () => {
      const params = obtenerParametrosURL();
      if (params.id) {
        reenviarCorreoConfirmacion(params.id);
      }
    });
  }
});