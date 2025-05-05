// Importar métodos y objetos de Firebase
import {
  auth,
  db,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from '../js/firebase-config.js';

// Importar funciones de autenticación
import { currentUser } from '../js/auth.js';

// Servicios adicionales
const serviciosAdicionales = {
  breakfast: {
    id: 'breakfast',
    nombre: 'Desayuno buffet',
    precio: 20,
    porDia: true
  },
  parking: {
    id: 'parking',
    nombre: 'Estacionamiento',
    precio: 15,
    porDia: true
  },
  airportShuttle: {
    id: 'airport-shuttle',
    nombre: 'Traslado aeropuerto',
    precio: 50,
    porDia: false
  },
  spaAccess: {
    id: 'spa-access',
    nombre: 'Acceso al spa',
    precio: 35,
    porDia: true
  }
};

// Elementos del DOM
const roomTitle = document.getElementById('room-title');
const roomImage = document.getElementById('room-image');
const roomAmenities = document.getElementById('room-amenities');
const roomDescription = document.getElementById('room-description');
const pricePerNight = document.getElementById('price-per-night');
const nightsCount = document.getElementById('nights-count');
const totalPrice = document.getElementById('total-price');
const checkInDate = document.getElementById('check-in-date');
const checkOutDate = document.getElementById('check-out-date');
const numAdults = document.getElementById('num-adults');
const numChildren = document.getElementById('num-children');
const extrasContainer = document.getElementById('extras-container');
const reservationForm = document.getElementById('reservation-form');
const confirmBtn = document.getElementById('confirm-reservation');

// Variables para calcular el precio
let selectedRoom = null;
let selectedRoomPrice = 0;
let selectedExtras = [];
let numberOfNights = 0;

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

// Función para obtener parámetros de la URL
function obtenerParametrosURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    room: urlParams.get('room')
  };
}

// Función para cargar los detalles de la habitación
async function cargarDetallesHabitacion() {
  try {
    const params = obtenerParametrosURL();
    const roomId = params.room;
    
    if (!roomId) {
      mostrarToast('Error', 'No se ha especificado una habitación', 'error');
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 2000);
      return;
    }
    
    console.log("Cargando habitación con ID:", roomId);
    
    // Obtener datos de la habitación desde Firebase
    const habitacionDoc = await getDoc(doc(db, "habitaciones", roomId));
    
    if (!habitacionDoc.exists()) {
      console.error("La habitación no existe en Firestore");
      mostrarToast('Error', 'La habitación especificada no existe', 'error');
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 2000);
      return;
    }
    
    // Obtener los datos de la habitación
    selectedRoom = {
      id: roomId,
      ...habitacionDoc.data()
    };
    
    console.log("Datos de la habitación cargados:", selectedRoom);
    
    selectedRoomPrice = selectedRoom.precio;
    
    // Actualizar UI con los detalles de la habitación
    if (roomTitle) roomTitle.textContent = selectedRoom.nombre;
    if (roomImage) roomImage.innerHTML = `<img src="${selectedRoom.imagen || '/assets/images/habitacion1.jpg'}" alt="${selectedRoom.nombre}" class="img-fluid rounded">`;
    if (roomDescription) roomDescription.textContent = selectedRoom.descripcion;
    if (pricePerNight) pricePerNight.textContent = `$${selectedRoom.precio.toFixed(2)}`;
    
    // Cargar amenidades
    if (roomAmenities) {
      roomAmenities.innerHTML = '';
      if (selectedRoom.amenidades && selectedRoom.amenidades.length > 0) {
        selectedRoom.amenidades.forEach(amenidad => {
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
          
          roomAmenities.innerHTML += `
            <span class="badge bg-secondary"><ion-icon name="${iconName}"></ion-icon> ${amenidad}</span>
          `;
        });
      }
    }
    
    // Establecer fechas mínimas para check-in y check-out
    if (checkInDate) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const formattedToday = today.toISOString().split('T')[0];
      const formattedTomorrow = tomorrow.toISOString().split('T')[0];
      
      checkInDate.min = formattedToday;
      checkInDate.value = formattedToday;
      
      checkOutDate.min = formattedTomorrow;
      checkOutDate.value = formattedTomorrow;
      
      // Calcular noches iniciales
      calcularNumeroNoches();
    }
  } catch (error) {
    console.error("Error al cargar detalles de la habitación:", error);
    mostrarToast('Error', 'Ha ocurrido un error al cargar los detalles de la habitación', 'error');
    
    // Mostrar error en la interfaz para una mejor experiencia de usuario
    if (roomTitle) roomTitle.textContent = "Error al cargar la habitación";
    if (roomDescription) roomDescription.textContent = "No se pudo cargar la información. Por favor, intente más tarde.";
    if (roomImage) roomImage.innerHTML = '<div class="alert alert-danger">No se pudo cargar la imagen</div>';
  }
}

// Variables para la galería
let currentGalleryImages = [];
let currentImageIndex = 0;

// Función para abrir la galería de la habitación
async function abrirGaleriaHabitacion() {
  try {
    if (!selectedRoom) return;
    
    // Actualizar título del modal
    const modalTitle = document.getElementById('galleryModalLabel');
    if (modalTitle) {
      modalTitle.textContent = `Galería: ${selectedRoom.nombre}`;
    }
    
    // Cargar imágenes de la galería
    let imagenes = [];
    
    // Si la habitación tiene una galería de imágenes, usarla
    if (selectedRoom.galeria && selectedRoom.galeria.length > 0) {
      imagenes = [...selectedRoom.galeria];
    } else {
      // Si no hay galería, usar la imagen principal y algunas imágenes predeterminadas
      imagenes.push(selectedRoom.imagen || '/assets/images/habitacion1.jpg');
      
      // Añadir algunas imágenes predeterminadas (esto se puede personalizar)
      const defaultImages = [
        '/assets/images/habitacion1.jpg',
        '/assets/images/habitacion2.jpg',
        '/assets/images/habitacion3.jpg'
      ];
      
      // Añadir solo imágenes predeterminadas que no coincidan con la principal
      defaultImages.forEach(img => {
        if (img !== selectedRoom.imagen) {
          imagenes.push(img);
        }
      });
    }
    
    // Guardar imágenes actuales
    currentGalleryImages = imagenes;
    currentImageIndex = 0;
    
    // Actualizar imagen principal
    actualizarImagenPrincipal();
    
    // Generar miniaturas
    generarMiniaturas();
    
    // Mostrar el modal
    const galleryModal = new bootstrap.Modal(document.getElementById('galleryModal'));
    galleryModal.show();
  } catch (error) {
    console.error("Error al abrir la galería:", error);
  }
}

// Función para actualizar la imagen principal
function actualizarImagenPrincipal() {
  const mainImage = document.getElementById('main-gallery-image');
  const imageCaption = document.getElementById('image-caption');
  
  if (mainImage && imageCaption) {
    mainImage.src = currentGalleryImages[currentImageIndex];
    imageCaption.textContent = `Imagen ${currentImageIndex + 1} de ${currentGalleryImages.length}`;
  }
  
  // Actualizar miniatura activa
  document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
    if (index === currentImageIndex) {
      thumb.classList.add('active');
    } else {
      thumb.classList.remove('active');
    }
  });
}

// Función para generar miniaturas
function generarMiniaturas() {
  const thumbnailsContainer = document.getElementById('thumbnails-container');
  
  if (thumbnailsContainer) {
    thumbnailsContainer.innerHTML = '';
    
    currentGalleryImages.forEach((img, index) => {
      const thumbnail = document.createElement('div');
      thumbnail.className = `thumbnail ${index === currentImageIndex ? 'active' : ''}`;
      thumbnail.innerHTML = `<img src="${img}" alt="Miniatura ${index + 1}">`;
      
      thumbnail.addEventListener('click', () => {
        currentImageIndex = index;
        actualizarImagenPrincipal();
      });
      
      thumbnailsContainer.appendChild(thumbnail);
    });
  }
}

// Función para navegar a la imagen anterior
function imagenAnterior() {
  if (currentImageIndex > 0) {
    currentImageIndex--;
  } else {
    currentImageIndex = currentGalleryImages.length - 1;
  }
  actualizarImagenPrincipal();
}

// Función para navegar a la imagen siguiente
function imagenSiguiente() {
  if (currentImageIndex < currentGalleryImages.length - 1) {
    currentImageIndex++;
  } else {
    currentImageIndex = 0;
  }
  actualizarImagenPrincipal();
}

// Función para calcular el número de noches
function calcularNumeroNoches() {
  if (checkInDate && checkOutDate) {
    const checkin = new Date(checkInDate.value);
    const checkout = new Date(checkOutDate.value);
    
    // Calcular diferencia en días
    const diffTime = checkout.getTime() - checkin.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Actualizar número de noches
    numberOfNights = diffDays > 0 ? diffDays : 0;
    
    // Verificar si las fechas son válidas
    if (diffDays <= 0) {
      mostrarToast('Error', 'La fecha de salida debe ser posterior a la fecha de llegada', 'error');
      // Establecer fecha de salida para el día siguiente
      const nextDay = new Date(checkin);
      nextDay.setDate(nextDay.getDate() + 1);
      checkOutDate.value = nextDay.toISOString().split('T')[0];
      numberOfNights = 1;
    }
    
    // Actualizar UI
    if (nightsCount) nightsCount.textContent = numberOfNights;
    
    // Actualizar precio total
    calcularPrecioTotal();
  }
}

// Función para calcular el precio total
function calcularPrecioTotal() {
  if (!selectedRoom) return;
  
  // Precio base por noches
  let precioBase = selectedRoom.precio * numberOfNights;
  
  // Precio de extras
  let precioExtras = 0;
  selectedExtras = [];
  
  // Recorrer los checkboxes de extras
  const extrasCheckboxes = document.querySelectorAll('.extra-option');
  extrasCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      const extraId = checkbox.id;
      let extraInfo;
      
      switch (extraId) {
        case 'breakfast':
          extraInfo = serviciosAdicionales.breakfast;
          precioExtras += extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio;
          selectedExtras.push({ ...extraInfo, total: extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio });
          break;
        case 'parking':
          extraInfo = serviciosAdicionales.parking;
          precioExtras += extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio;
          selectedExtras.push({ ...extraInfo, total: extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio });
          break;
        case 'airport-shuttle':
          extraInfo = serviciosAdicionales.airportShuttle;
          precioExtras += extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio;
          selectedExtras.push({ ...extraInfo, total: extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio });
          break;
        case 'spa-access':
          extraInfo = serviciosAdicionales.spaAccess;
          precioExtras += extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio;
          selectedExtras.push({ ...extraInfo, total: extraInfo.porDia ? extraInfo.precio * numberOfNights : extraInfo.precio });
          break;
      }
    }
  });
  
  // Calcular precio total
  const precioTotal = precioBase + precioExtras;
  
  // Actualizar UI
  if (totalPrice) totalPrice.textContent = `$${precioTotal.toFixed(2)}`;
  
  // Actualizar contenedor de extras
  actualizarExtrasContainer();
}

// Función para actualizar el contenedor de extras
function actualizarExtrasContainer() {
  if (extrasContainer) {
    // Limpiar contenedor
    extrasContainer.innerHTML = '';
    
    // Si hay extras seleccionados, mostrarlos
    if (selectedExtras.length > 0) {
      selectedExtras.forEach(extra => {
        extrasContainer.innerHTML += `
          <div class="d-flex justify-content-between mb-2">
            <span>${extra.nombre}:</span>
            <span>$${extra.total.toFixed(2)}</span>
          </div>
        `;
      });
    }
  }
}

// Función para verificar disponibilidad de la habitación
async function verificarDisponibilidad(habitacionId, fechaEntrada, fechaSalida) {
  try {
    console.log("Verificando disponibilidad para:", habitacionId);
    console.log("Fecha entrada:", fechaEntrada);
    console.log("Fecha salida:", fechaSalida);
    
    // Convertir fechas a objetos Date para comparación
    const entrada = new Date(fechaEntrada);
    const salida = new Date(fechaSalida);
    
    // Ajustar a medianoche para comparación exacta
    entrada.setHours(0, 0, 0, 0);
    salida.setHours(0, 0, 0, 0);
    
    console.log("Fecha entrada (procesada):", entrada);
    console.log("Fecha salida (procesada):", salida);
    
    // Consultar reservaciones existentes para esa habitación
    const reservasRef = collection(db, "reservaciones");
    
    // Si la colección no existe, Firebase va a retornar un resultado vacío
    // En ese caso, permitimos la reserva (no hay conflictos)
    const q = query(reservasRef, where("habitacionId", "==", habitacionId));
    
    try {
      const querySnapshot = await getDocs(q);
      
      console.log("Número de reservas encontradas:", querySnapshot.size);
      
      // Si no hay reservas previas, la habitación está disponible
      if (querySnapshot.empty) {
        console.log("No hay reservas previas, habitación disponible");
        return true;
      }
      
      // Verificar conflictos de fechas
      for (const docSnap of querySnapshot.docs) {
        const reserva = docSnap.data();
        
        // Verificar que la reserva no esté cancelada
        if (reserva.estado === 'cancelada') {
          console.log("Reserva cancelada, ignorando:", docSnap.id);
          continue;
        }
        
        // Convertir fechas a objetos Date (manejo de varios formatos posibles)
        let reservaEntrada, reservaSalida;
        
        try {
          // Manejar diferentes formatos de fecha
          if (reserva.fechaEntrada && typeof reserva.fechaEntrada.toDate === 'function') {
            reservaEntrada = reserva.fechaEntrada.toDate();
          } else if (reserva.fechaEntrada instanceof Date) {
            reservaEntrada = reserva.fechaEntrada;
          } else {
            reservaEntrada = new Date(reserva.fechaEntrada);
          }
          
          if (reserva.fechaSalida && typeof reserva.fechaSalida.toDate === 'function') {
            reservaSalida = reserva.fechaSalida.toDate();
          } else if (reserva.fechaSalida instanceof Date) {
            reservaSalida = reserva.fechaSalida;
          } else {
            reservaSalida = new Date(reserva.fechaSalida);
          }
          
          // Verificar si las fechas son válidas
          if (isNaN(reservaEntrada.getTime()) || isNaN(reservaSalida.getTime())) {
            console.error("Fechas inválidas en la reserva:", docSnap.id);
            continue;
          }
          
          // Ajustar a medianoche para comparación exacta
          reservaEntrada.setHours(0, 0, 0, 0);
          reservaSalida.setHours(0, 0, 0, 0);
          
          console.log("Reserva existente ID:", docSnap.id);
          console.log("Reserva entrada:", reservaEntrada);
          console.log("Reserva salida:", reservaSalida);
          
          // Verificar conflictos
          // Conflicto si:
          // 1. La entrada solicitada está entre la entrada y salida de una reserva existente
          // 2. La salida solicitada está entre la entrada y salida de una reserva existente
          // 3. La entrada y salida solicitadas abarcan completamente una reserva existente
          const conflicto1 = entrada >= reservaEntrada && entrada < reservaSalida;
          const conflicto2 = salida > reservaEntrada && salida <= reservaSalida;
          const conflicto3 = entrada <= reservaEntrada && salida >= reservaSalida;
          
          console.log("¿Conflicto tipo 1?", conflicto1);
          console.log("¿Conflicto tipo 2?", conflicto2);
          console.log("¿Conflicto tipo 3?", conflicto3);
          
          if (conflicto1 || conflicto2 || conflicto3) {
            console.log("Conflicto detectado, habitación no disponible");
            return false; // Hay conflicto, no está disponible
          }
        } catch (conversionError) {
          console.error("Error al convertir fechas:", conversionError);
          // Si hay error en la conversión, asumimos que no hay conflicto y continuamos
          continue;
        }
      }
      
      console.log("No se detectaron conflictos, habitación disponible");
      return true; // No hay conflictos, está disponible
    } catch (queryError) {
      console.error("Error al consultar reservaciones:", queryError);
      // Si hay error en la consulta pero no es crítico, permitimos la reserva
      return true;
    }
  } catch (error) {
    console.error("Error al verificar disponibilidad:", error);
    // Para errores generales, mostramos el error pero permitimos la reserva
    // Esta es una decisión de negocio: permitir la reserva y resolver conflictos manualmente
    // en lugar de rechazar potencialmente reservas válidas
    return true;
  }
}

// Función para crear una nueva reservación
async function crearReservacion(datosReservacion) {
  try {
    // Verificar si la colección existe, y si no, crearla implícitamente
    let reservacionesCollection = collection(db, "reservaciones");
    
    // Guardar la reservación en Firestore
    const reservaRef = await addDoc(reservacionesCollection, {
      ...datosReservacion,
      fechaCreacion: serverTimestamp(),
      estado: 'confirmada' // Estados posibles: confirmada, cancelada, completada
    });
    
    return {
      exito: true,
      id: reservaRef.id,
      mensaje: "Reservación creada exitosamente"
    };
  } catch (error) {
    console.error("Error al crear la reservación:", error);
    return {
      exito: false,
      mensaje: "Error al procesar la reservación: " + error.message
    };
  }
}

// Manejador de eventos para el formulario de reservación
async function manejarReservacion(event) {
  event.preventDefault();
  
  // Verificar si el usuario está autenticado
  if (!auth.currentUser) {
    mostrarToast('Autenticación requerida', 'Debes iniciar sesión para realizar una reservación', 'error');
    
    // Guardar datos de la reservación en sessionStorage para recuperarlos después de login
    const reservacionTemp = {
      habitacionId: selectedRoom.id,
      fechaEntrada: checkInDate.value,
      fechaSalida: checkOutDate.value,
      adultos: numAdults.value,
      ninos: numChildren.value,
      extras: selectedExtras.map(extra => extra.id)
    };
    
    sessionStorage.setItem('reservacionTemp', JSON.stringify(reservacionTemp));
    
    // Redirigir a la página de login
    setTimeout(() => {
      window.location.href = '../login.html';
    }, 2000);
    
    return;
  }
  
  // Deshabilitar botón de confirmación para evitar doble envío
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
  }
  
  try {
    // Verificar disponibilidad
    const disponible = await verificarDisponibilidad(
      selectedRoom.id,
      checkInDate.value,
      checkOutDate.value
    );
    
    if (!disponible) {
      mostrarToast('Habitación no disponible', 'Lo sentimos, la habitación no está disponible para las fechas seleccionadas. Por favor, elige otras fechas.', 'error');
      
      // Restaurar botón
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirmar Reservación';
      }
      return;
    }
    
    // Obtener datos del formulario
    const guestName = document.getElementById('guest-name').value;
    const guestEmail = document.getElementById('guest-email').value;
    const guestPhone = document.getElementById('guest-phone').value;
    const guestId = document.getElementById('guest-id').value;
    const specialRequests = document.getElementById('special-requests').value;
    
    // Calcular el precio total nuevamente para asegurar exactitud
    calcularPrecioTotal();
    
    // Crear objeto con datos de la reservación
    const datosReservacion = {
      habitacionId: selectedRoom.id,
      habitacionNombre: selectedRoom.nombre,
      usuarioId: auth.currentUser.uid,
      usuarioEmail: auth.currentUser.email,
      huesped: {
        nombre: guestName,
        email: guestEmail,
        telefono: guestPhone,
        documento: guestId
      },
      fechaEntrada: new Date(checkInDate.value),
      fechaSalida: new Date(checkOutDate.value),
      noches: numberOfNights,
      adultos: parseInt(numAdults.value),
      ninos: parseInt(numChildren.value),
      solicitudesEspeciales: specialRequests,
      extras: selectedExtras.map(extra => ({
        id: extra.id,
        nombre: extra.nombre,
        precio: extra.precio,
        total: extra.total
      })),
      precioBase: selectedRoom.precio * numberOfNights,
      precioExtras: selectedExtras.reduce((total, extra) => total + extra.total, 0),
      precioTotal: parseFloat((selectedRoom.precio * numberOfNights + selectedExtras.reduce((total, extra) => total + extra.total, 0)).toFixed(2))
    };
    
    // Crear la reservación
    const resultado = await crearReservacion(datosReservacion);
    
    // Restaurar botón
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Confirmar Reservación';
    }
    
    if (resultado.exito) {
      // Preparar datos para EmailJS
      const templateParams = {
        hotel_logo: "https://i.imgur.com/SZHqAIH.png", // Reemplaza con URL real del logo
        order_id: resultado.id,
        guest_name: datosReservacion.huesped.nombre,
        room_image: selectedRoom.imagen || "https://i.imgur.com/JLn0KKk.jpg", // Imagen predeterminada si no hay
        name: datosReservacion.habitacionNombre,
        units: datosReservacion.noches,
        check_in: datosReservacion.fechaEntrada.toLocaleDateString(),
        check_out: datosReservacion.fechaSalida.toLocaleDateString(),
        guests: `${datosReservacion.adultos} adultos, ${datosReservacion.ninos} niños`,
        price: selectedRoom.precio.toFixed(2),
        room_total: datosReservacion.precioBase.toFixed(2),
        cost: {
          shipping: datosReservacion.precioExtras.toFixed(2),
          tax: "0.00", // Si no tienes impuestos calculados
          total: datosReservacion.precioTotal.toFixed(2)
        },
        to_email: datosReservacion.huesped.email || datosReservacion.usuarioEmail // Añadimos la dirección de correo del destinatario
      };

      // Enviar email usando EmailJS
      emailjs.send('service_qqjjqzb', 'template_oljupv9', templateParams, 'YWLyHKBym8x8Nb9fS')
        .then(function(response) {
          console.log('Correo enviado!', response.status, response.text);
        }, function(error) {
          console.error('Error al enviar correo:', error);
        });

      mostrarToast('Reservación Confirmada', '¡Tu reservación ha sido confirmada exitosamente! Se ha enviado un correo con los detalles.', 'success');
      
      // Redirigir a la página de confirmación después de 2 segundos
      setTimeout(() => {
        window.location.href = `confirmacion.html?id=${resultado.id}`;
      }, 2000);
    } else {
      mostrarToast('Error', resultado.mensaje, 'error');
    }
  } catch (error) {
    console.error("Error general en la reservación:", error);
    mostrarToast('Error', 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.', 'error');
    
    // Restaurar botón
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Confirmar Reservación';
    }
  }
}

// Inicializar eventos cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  // Cargar detalles de la habitación seleccionada
  cargarDetallesHabitacion();
  
  // Eventos para las fechas de check-in y check-out
  if (checkInDate) {
    checkInDate.addEventListener('change', () => {
      // Actualizar fecha mínima de check-out
      if (checkOutDate) {
        const newMinCheckout = new Date(checkInDate.value);
        newMinCheckout.setDate(newMinCheckout.getDate() + 1);
        checkOutDate.min = newMinCheckout.toISOString().split('T')[0];
        
        // Si la fecha de check-out es menor a la nueva fecha mínima, actualizarla
        if (new Date(checkOutDate.value) <= new Date(checkInDate.value)) {
          checkOutDate.value = newMinCheckout.toISOString().split('T')[0];
        }
      }
      
      calcularNumeroNoches();
    });
  }
  
  if (checkOutDate) {
    checkOutDate.addEventListener('change', calcularNumeroNoches);
  }
  
  // Eventos para los extras
  const extrasCheckboxes = document.querySelectorAll('.extra-option');
  extrasCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', calcularPrecioTotal);
  });
  
  // Evento para el formulario de reservación
  if (reservationForm) {
    reservationForm.addEventListener('submit', manejarReservacion);
  }

  // Añadir evento al botón de ver galería
const viewGalleryBtn = document.getElementById('view-gallery-btn');
if (viewGalleryBtn) {
  viewGalleryBtn.addEventListener('click', abrirGaleriaHabitacion);
}

// Añadir eventos a los botones de navegación de la galería
const prevBtn = document.querySelector('.gallery-nav.prev-btn');
const nextBtn = document.querySelector('.gallery-nav.next-btn');

if (prevBtn) {
  prevBtn.addEventListener('click', imagenAnterior);
}

if (nextBtn) {
  nextBtn.addEventListener('click', imagenSiguiente);
}

// Añadir soporte para navegación con teclado cuando el modal está abierto
document.addEventListener('keydown', (e) => {
  const galleryModal = document.getElementById('galleryModal');
  if (galleryModal && galleryModal.classList.contains('show')) {
    if (e.key === 'ArrowLeft') {
      imagenAnterior();
    } else if (e.key === 'ArrowRight') {
      imagenSiguiente();
    }
  }
});

});

// Exportar funciones que podrían necesitarse en otros archivos
export {
  verificarDisponibilidad,
  crearReservacion
};