// Importar Firebase
import {
  auth,
  db,
  collection,
  getDocs,
  getDoc,
  doc
} from './firebase-config.js';

// Contenedor de habitaciones
const roomsContainer = document.getElementById('rooms-container');

// Variables para la galería
let currentGalleryImages = [];
let currentImageIndex = 0;
let currentRoomId = null;

// Función para cargar habitaciones desde Firebase
async function cargarHabitaciones() {
  try {
    // Mostrar estado de carga
    if (roomsContainer) {
      roomsContainer.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando habitaciones...</span></div></div>';
    }
    
    // Obtener habitaciones desde Firebase
    const habitacionesRef = collection(db, "habitaciones");
    const habitacionesSnapshot = await getDocs(habitacionesRef);
    
    // Verificar si hay habitaciones
    if (habitacionesSnapshot.empty) {
      if (roomsContainer) {
        roomsContainer.innerHTML = '<div class="col-12 text-center"><p>No hay habitaciones disponibles actualmente.</p></div>';
      }
      return;
    }
    
    // Generar HTML de las habitaciones
    let habitacionesHTML = '';
    
    habitacionesSnapshot.forEach((doc) => {
      const habitacion = doc.data();
      const id = doc.id;
      
      // Mostrar solo habitaciones disponibles para los clientes
      if (habitacion.estado === 'disponible') {
        // Obtener reseñas
        const reviews = obtenerResenas(id);
        const reviewsCount = reviews.length;
        const averageRating = reviewsCount > 0 
          ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviewsCount).toFixed(1) 
          : 0;
        
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
        
        // Verificar si es una oferta especial (con precio rebajado)
        const esOferta = habitacion.precioOriginal && habitacion.precioOriginal > habitacion.precio;
        
        // HTML para el indicador de calificación
        const ratingHTML = averageRating > 0 ? 
          `<div class="room-rating">
            <div class="stars">
              ${generarEstrellas(averageRating)}
            </div>
            <span class="rating-value">${averageRating}</span>
            <span class="reviews-count">(${reviewsCount})</span>
          </div>` : 
          `<div class="room-rating">
            <span class="no-reviews">Sin reseñas</span>
          </div>`;
        
        habitacionesHTML += `
          <div class="col-lg-4 col-md-6">
            <div class="room-card bg-dark text-white text-center p-3 h-100 rounded ${esOferta ? 'special-offer' : ''}">
              ${esOferta ? '<div class="offer-badge">OFERTA ESPECIAL</div>' : ''}
              <div class="mb-3">
                <img src="${habitacion.imagen || '/assets/images/habitacion1.jpg'}" alt="${habitacion.nombre}" class="img-fluid rounded">
                <button class="view-gallery-btn" data-room-id="${id}">
                  <ion-icon name="images-outline"></ion-icon> Ver Galería
                </button>
              </div>
              <h4>${habitacion.nombre}</h4>
              ${ratingHTML}
              <div class="amenities mb-2">
                ${amenidadesHTML}
              </div>
              <p>${habitacion.descripcion}</p>
              <div class="price-section mb-3">
                ${esOferta ? `<span class="original-price">$${habitacion.precioOriginal.toFixed(2)}</span>` : ''}
                <span class="room-price">$${habitacion.precio.toFixed(2)}</span> / noche
              </div>
              <div class="button-group">
                <a href="pages/booking.html?room=${id}" class="btn btn-primary reserve-btn" data-room="${habitacion.nombre}" data-price="${habitacion.precio}">Reservar Ahora</a>
                <button class="btn btn-outline-light review-btn mt-2" data-room-id="${id}" data-room-name="${habitacion.nombre}">
                  <ion-icon name="star-outline"></ion-icon> Ver Reseñas
                </button>
              </div>
            </div>
          </div>
        `;
      }
    });
    
    // Actualizar el contenedor
    if (roomsContainer) {
      roomsContainer.innerHTML = habitacionesHTML;
      
      // Añadir evento para botones de galería
      document.querySelectorAll('.view-gallery-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const roomId = button.getAttribute('data-room-id');
          abrirGaleriaHabitacion(roomId);
        });
      });
      
      // Añadir evento para botones de reseñas
      document.querySelectorAll('.review-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const roomId = button.getAttribute('data-room-id');
          const roomName = button.getAttribute('data-room-name');
          abrirModalResenas(roomId, roomName);
        });
      });
    }
  } catch (error) {
    console.error("Error al cargar habitaciones:", error);
    if (roomsContainer) {
      roomsContainer.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar las habitaciones. Por favor, intenta más tarde.</div>';
    }
  }
}

// Función para abrir la galería de una habitación
async function abrirGaleriaHabitacion(roomId) {
  try {
    currentRoomId = roomId;
    
    // Obtener datos de la habitación
    const habitacionDoc = await getDoc(doc(db, "habitaciones", roomId));
    
    if (!habitacionDoc.exists()) {
      console.error("La habitación no existe");
      return;
    }
    
    const habitacion = habitacionDoc.data();
    
    // Actualizar título del modal
    const modalTitle = document.getElementById('galleryModalLabel');
    if (modalTitle) {
      modalTitle.textContent = `Galería: ${habitacion.nombre}`;
    }
    
    // Actualizar link de reserva
    const reserveBtn = document.getElementById('reserve-from-gallery');
    if (reserveBtn) {
      reserveBtn.href = `pages/booking.html?room=${roomId}`;
    }
    
    // Cargar imágenes de la galería
    let imagenes = [];
    
    // Si la habitación tiene una galería de imágenes, usarla
    if (habitacion.galeria && habitacion.galeria.length > 0) {
      imagenes = [...habitacion.galeria];
    } else {
      // Si no hay galería, usar la imagen principal y algunas imágenes predeterminadas
      imagenes.push(habitacion.imagen || '/assets/images/habitacion1.jpg');
      
      // Añadir algunas imágenes predeterminadas (esto se puede personalizar)
      const defaultImages = [
        '/assets/images/habitacion1.jpg',
        '/assets/images/habitacion2.jpg',
        '/assets/images/habitacion3.jpg'
      ];
      
      // Añadir solo imágenes predeterminadas que no coincidan con la principal
      defaultImages.forEach(img => {
        if (img !== habitacion.imagen) {
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

// Funciones para el sistema de reseñas

// Función para generar HTML de estrellas según la calificación
function generarEstrellas(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  
  let html = '';
  
  // Estrellas llenas
  for (let i = 0; i < fullStars; i++) {
    html += '<ion-icon name="star"></ion-icon>';
  }
  
  // Media estrella
  if (halfStar) {
    html += '<ion-icon name="star-half"></ion-icon>';
  }
  
  // Estrellas vacías
  for (let i = 0; i < emptyStars; i++) {
    html += '<ion-icon name="star-outline"></ion-icon>';
  }
  
  return html;
}

// Función para abrir el modal de reseñas
function abrirModalResenas(roomId, roomName) {
  currentRoomId = roomId;
  
  // Obtener reseñas existentes
  const reviews = obtenerResenas(roomId);
  
  // Calcular calificación promedio
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) 
    : 0;
  
  // Actualizar título del modal
  const modalTitle = document.getElementById('reviewsModalLabel');
  if (modalTitle) {
    modalTitle.textContent = `Reseñas: ${roomName}`;
  }
  
  // Actualizar contenido del modal
  const modalContent = document.getElementById('reviews-container');
  if (modalContent) {
    let reviewsHTML = '';
    
    // Mostrar calificación promedio
    reviewsHTML += `
      <div class="reviews-summary">
        <div class="average-rating">
          <div class="rating-value">${averageRating}</div>
          <div class="stars">
            ${generarEstrellas(averageRating)}
          </div>
          <div class="reviews-count">${reviews.length} reseña${reviews.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
    
    // Mostrar formulario para agregar reseña
    reviewsHTML += `
      <div class="review-form-container">
        <h5>Deja tu reseña</h5>
        <form id="review-form">
          <div class="mb-3">
            <label for="reviewer-name" class="form-label">Tu nombre</label>
            <input type="text" class="form-control" id="reviewer-name" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Calificación</label>
            <div class="rating-selector">
              <div class="stars-input">
                ${[1, 2, 3, 4, 5].map(star => `
                  <span class="star" data-value="${star}">
                    <ion-icon name="star-outline"></ion-icon>
                  </span>
                `).join('')}
              </div>
              <span class="rating-value-display">0</span>
            </div>
          </div>
          <div class="mb-3">
            <label for="review-text" class="form-label">Tu comentario</label>
            <textarea class="form-control" id="review-text" rows="3" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Enviar Reseña</button>
        </form>
      </div>
    `;
    
    // Mostrar reseñas existentes
    if (reviews.length > 0) {
      reviewsHTML += `
        <div class="reviews-list mt-4">
          <h5>Reseñas de otros huéspedes</h5>
          ${reviews.map(review => `
            <div class="review-item">
              <div class="review-header">
                <div class="reviewer-name">${review.name}</div>
                <div class="review-date">${formatearFecha(review.date)}</div>
              </div>
              <div class="review-rating">
                ${generarEstrellas(review.rating)}
                <span class="rating-value">${review.rating}</span>
              </div>
              <div class="review-text">${review.text}</div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      reviewsHTML += `
        <div class="no-reviews-message">
          <p>Aún no hay reseñas para esta habitación. ¡Sé el primero en opinar!</p>
        </div>
      `;
    }
    
    modalContent.innerHTML = reviewsHTML;
    
    // Configurar eventos para el selector de estrellas
    document.querySelectorAll('.star').forEach(star => {
      star.addEventListener('mouseover', () => {
        const value = parseInt(star.getAttribute('data-value'));
        actualizarVistaEstrellas(value);
      });
      
      star.addEventListener('mouseout', () => {
        const currentRating = parseInt(document.querySelector('.rating-value-display').textContent) || 0;
        actualizarVistaEstrellas(currentRating);
      });
      
      star.addEventListener('click', () => {
        const value = parseInt(star.getAttribute('data-value'));
        document.querySelector('.rating-value-display').textContent = value;
        actualizarVistaEstrellas(value, true);
      });
    });
    
    // Configurar evento para el formulario de reseña
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
      reviewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('reviewer-name').value;
        const rating = parseInt(document.querySelector('.rating-value-display').textContent) || 0;
        const text = document.getElementById('review-text').value;
        
        if (!name || rating === 0 || !text) {
          alert('Por favor, completa todos los campos y proporciona una calificación.');
          return;
        }
        
        // Agregar la reseña
        agregarResena(roomId, {
          name,
          rating,
          text,
          date: new Date().toISOString()
        });
        
        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('reviewsModal'));
        if (modal) modal.hide();
        
        // Mostrar notificación
        alert('¡Gracias por tu reseña!');
        
        // Recargar las habitaciones para actualizar las calificaciones
        cargarHabitaciones();
      });
    }
  }
  
  // Mostrar el modal
  const reviewsModal = new bootstrap.Modal(document.getElementById('reviewsModal'));
  reviewsModal.show();
}

// Función para actualizar la vista de estrellas en el selector
function actualizarVistaEstrellas(value, isSet = false) {
  const stars = document.querySelectorAll('.stars-input .star');
  
  stars.forEach((star, index) => {
    const starValue = parseInt(star.getAttribute('data-value'));
    const icon = star.querySelector('ion-icon');
    
    if (starValue <= value) {
      icon.setAttribute('name', 'star');
      icon.classList.add('active');
    } else {
      icon.setAttribute('name', 'star-outline');
      icon.classList.remove('active');
    }
  });
  
  // Si se establece un valor, actualizar el display
  if (isSet) {
    document.querySelector('.rating-value-display').textContent = value;
  }
}

// Función para obtener las reseñas de una habitación
function obtenerResenas(roomId) {
  try {
    const reviewsKey = `hotel_reviews_${roomId}`;
    const reviewsData = localStorage.getItem(reviewsKey);
    
    return reviewsData ? JSON.parse(reviewsData) : [];
  } catch (error) {
    console.error("Error al obtener reseñas:", error);
    return [];
  }
}

// Función para agregar una nueva reseña
function agregarResena(roomId, review) {
  try {
    const reviewsKey = `hotel_reviews_${roomId}`;
    const reviews = obtenerResenas(roomId);
    
    // Añadir la nueva reseña
    reviews.push(review);
    
    // Guardar en localStorage
    localStorage.setItem(reviewsKey, JSON.stringify(reviews));
    
    return true;
  } catch (error) {
    console.error("Error al agregar reseña:", error);
    return false;
  }
}

// Función para formatear fecha
function formatearFecha(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
}

// Inicializar la carga de habitaciones cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  cargarHabitaciones();
  
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