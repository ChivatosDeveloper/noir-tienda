// ========== CONFIGURACIÓN ==========
const API_URL = 'http://localhost:3000/api';

// ========== DATOS DE PRODUCTOS ==========
const productos = [
    // MUJER
    { id: 1, nombre: 'Blazer Oversized', precio: 89.99, categoria: 'mujer', imagen: '🧥', color: 'Negro', descripcion: 'Clásico y versátil' },
    { id: 2, nombre: 'Vestido Midi Satén', precio: 79.99, categoria: 'mujer', imagen: '👗', color: 'Blanco', descripcion: 'Elegante y sofisticado' },
    { id: 3, nombre: 'Falda Plisada Premium', precio: 45.99, categoria: 'mujer', imagen: '👔', color: 'Negro', descripcion: 'Efecto volumen' },
    { id: 4, nombre: 'Top Crop Ribbed', precio: 29.99, categoria: 'mujer', imagen: '👚', color: 'Blanco', descripcion: 'Casual y cómodo', descuento: 40, precioOriginal: 49.98 },
    
    // HOMBRE
    { id: 5, nombre: 'Camisa Lino Premium', precio: 49.99, categoria: 'hombre', imagen: '👔', color: 'Blanco', descripcion: 'Transpirable y fresca' },
    { id: 6, nombre: 'Pantalón Wide Leg', precio: 59.99, categoria: 'hombre', imagen: '👖', color: 'Gris', descripcion: 'Comodidad y estilo', descuento: 30, precioOriginal: 85.99 },
    { id: 7, nombre: 'Camiseta Básica', precio: 24.99, categoria: 'hombre', imagen: '👕', color: 'Negro', descripcion: 'Imprescindible' },
    { id: 8, nombre: 'Shorts Casuales', precio: 39.99, categoria: 'hombre', imagen: '🩳', color: 'Beige', descripcion: 'Perfecto para verano' },
    
    // ACCESORIOS
    { id: 9, nombre: 'Bolso Elegante', precio: 129.99, categoria: 'accesorios', imagen: '👜', color: 'Negro', descripcion: 'Práctico y elegante' },
    { id: 10, nombre: 'Cinturón de Cuero', precio: 44.99, categoria: 'accesorios', imagen: '🪢', color: 'Marrón', descripcion: 'Complemento perfecto' },
    { id: 11, nombre: 'Gafas de Sol', precio: 69.99, categoria: 'accesorios', imagen: '😎', color: 'Negro', descripcion: 'Protección UV' },
    { id: 12, nombre: 'Bufanda Larga', precio: 34.99, categoria: 'accesorios', imagen: '🧣', color: 'Gris', descripcion: 'Calidez y estilo' },
    
    // PREMIUM
    { id: 13, nombre: 'Jersey Cashmere', precio: 119.99, categoria: 'premium', imagen: '🧶', color: 'Gris', descripcion: 'Lujo y comodidad' },
    { id: 14, nombre: 'Trench Coat', precio: 139.99, categoria: 'premium', imagen: '🧥', color: 'Negro', descripcion: 'Diseño atemporal' },
    { id: 15, nombre: 'Vestido de Noche', precio: 199.99, categoria: 'premium', imagen: '👗', color: 'Rojo', descripcion: 'Espectacular' },
    
    // OFERTA
    { id: 16, nombre: 'Jeans Classic', precio: 35.99, categoria: 'oferta', imagen: '👖', color: 'Azul', descripcion: 'Básico indispensable', descuento: 50, precioOriginal: 71.98 },
    { id: 17, nombre: 'Chaqueta Denim', precio: 45.99, categoria: 'oferta', imagen: '🧥', color: 'Azul', descripcion: 'Icónica', descuento: 35, precioOriginal: 70.75 },
];

// ========== ESTADO GLOBAL ==========
let selectedCategory = 'todo';
let selectedProduct = null;
let apartados = JSON.parse(localStorage.getItem('apartados')) || [];
let currentSort = 'newest';
let currentSize = '';

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    setupEventListeners();
    updateApartadosBadge();
});

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Categorías
    document.querySelectorAll('.category-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-card').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            selectedCategory = e.currentTarget.dataset.category;
            renderProducts();
        });
    });

    // Filtros
    document.getElementById('sortFilter').addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderProducts();
    });

    document.getElementById('sizeFilter').addEventListener('change', (e) => {
        currentSize = e.target.value;
        renderProducts();
    });

    // Botón de apartados
    document.getElementById('apartadosBtn').addEventListener('click', openApartadosModal);

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeApartadoModal();
            closeApartadosModal();
        }
    });
}

// ========== RENDERIZAR PRODUCTOS ==========
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    
    // Filtrar por categoría
    let productosFiltrados = selectedCategory === 'todo' 
        ? productos 
        : productos.filter(p => p.categoria === selectedCategory);

    // Ordenar
    productosFiltrados = sortProducts(productosFiltrados, currentSort);

    grid.innerHTML = productosFiltrados.map((producto, index) => `
        <div class="product-card" style="animation-delay: ${index * 0.05}s">
            ${producto.descuento ? `
                <div class="product-badge">-${producto.descuento}%</div>
            ` : ''}
            
            <div class="product-image">
                <span>${producto.imagen}</span>
            </div>
            
            <div class="product-info">
                <span class="product-category category-${producto.categoria}">
                    ${getCategoryName(producto.categoria)}
                </span>
                
                <h3 class="product-name">${producto.nombre}</h3>
                <p class="product-description">${producto.descripcion}</p>
                <p style="color: var(--text-light); font-size: 0.85rem; margin-bottom: 0.75rem;">📏 ${producto.color}</p>
                
                <div class="product-price-container">
                    ${producto.precioOriginal ? `
                        <span class="product-price-original">€${producto.precioOriginal.toFixed(2)}</span>
                    ` : ''}
                    <span class="product-price">€${producto.precio.toFixed(2)}</span>
                </div>
                
                <button class="btn-apartar" onclick="openApartadoModal(${producto.id})">
                    Apartar
                </button>
            </div>
        </div>
    `).join('');
}

// ========== FUNCIONES DE ORDENAMIENTO ==========
function sortProducts(prods, sortType) {
    const sorted = [...prods];
    
    switch(sortType) {
        case 'price-low':
            sorted.sort((a, b) => a.precio - b.precio);
            break;
        case 'price-high':
            sorted.sort((a, b) => b.precio - a.precio);
            break;
        case 'popular':
            sorted.sort(() => Math.random() - 0.5);
            break;
        case 'newest':
        default:
            sorted.sort((a, b) => b.id - a.id);
    }
    
    return sorted;
}

// ========== MODAL DE APARTADO ==========
function openApartadoModal(productId) {
    selectedProduct = productos.find(p => p.id === productId);
    
    if (!selectedProduct) return;

    const summary = document.getElementById('productSummary');
    summary.innerHTML = `
        <div class="product-summary-item">
            <strong>Prenda:</strong>
            <span>${selectedProduct.nombre}</span>
        </div>
        <div class="product-summary-item">
            <strong>Color:</strong>
            <span>${selectedProduct.color}</span>
        </div>
        <div class="product-summary-item">
            <strong>Precio:</strong>
            <span>€${selectedProduct.precio.toFixed(2)}</span>
        </div>
    `;

    document.getElementById('apartadoModal').classList.add('active');
}

function closeApartadoModal() {
    document.getElementById('apartadoModal').classList.remove('active');
    limpiarFormulario();
}

function confirmarApartado() {
    const nombre = document.getElementById('customerName').value.trim();
    const telefono = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const tamaño = document.getElementById('selectedSize').value;
    const color = document.getElementById('selectedColor').value.trim();

    if (!nombre || !telefono || !email || !tamaño) {
        mostrarNotificacion('Por favor completa todos los campos', 'error');
        return;
    }

    // Validar email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarNotificacion('Email inválido', 'error');
        return;
    }

    // Deshabilitar botón mientras se procesa
    const btnApartado = document.querySelector('.btn-apartado');
    btnApartado.disabled = true;
    btnApartado.textContent = 'Procesando...';

    // Enviar al backend
    const datosApartado = {
        producto: {
            id: selectedProduct.id,
            nombre: selectedProduct.nombre,
            precio: selectedProduct.precio,
            imagen: selectedProduct.imagen,
            color: color || selectedProduct.color
        },
        cliente: {
            nombre,
            telefono,
            email
        }
    };

    fetch(`${API_URL}/apartados`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosApartado)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Guardar localmente también
            const apartado = {
                id: Date.now(),
                productId: selectedProduct.id,
                nombre: selectedProduct.nombre,
                precio: selectedProduct.precio,
                imagen: selectedProduct.imagen,
                tamaño,
                color: color || selectedProduct.color,
                cliente: nombre,
                telefono,
                email,
                fechaApartado: new Date(),
                tiempoExpiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
                codigoRecogida: data.apartado.codigoRecogida
            };

            apartados.push(apartado);
            localStorage.setItem('apartados', JSON.stringify(apartados));
            updateApartadosBadge();

            mostrarNotificacion(`¡Prenda apartada! 📧 Email enviado a ${email}`, 'success');
            closeApartadoModal();
        } else {
            mostrarNotificacion(data.error || 'Error al apartar la prenda', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        mostrarNotificacion('Error al conectar con el servidor', 'error');
    })
    .finally(() => {
        btnApartado.disabled = false;
        btnApartado.textContent = 'Confirmar Apartado';
    });
}

function limpiarFormulario() {
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerEmail').value = '';
    document.getElementById('selectedSize').value = '';
    document.getElementById('selectedColor').value = '';
}

// ========== MODAL DE MIS APARTADOS ==========
function openApartadosModal() {
    const container = document.getElementById('apartadosContainer');
    
    if (apartados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛍️</div>
                <p>Aún no tienes prendas apartadas</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">¡Comienza a explorar nuestras colecciones!</p>
            </div>
        `;
    } else {
        container.innerHTML = apartados.map(apartado => {
            const tiempoRestante = calcularTiempoRestante(apartado.tiempoExpiracion);
            const espirado = new Date() > new Date(apartado.tiempoExpiracion);
            
            return `
                <div class="apartado-item" style="${espirado ? 'opacity: 0.5; border-color: var(--danger);' : ''}">
                    <div class="apartado-info">
                        <div class="apartado-producto">
                            <span style="font-size: 1.5rem; margin-right: 0.5rem;">${apartado.imagen}</span>
                            ${apartado.nombre}
                        </div>
                        <div class="apartado-detalles">
                            Tamaño: <strong>${apartado.tamaño}</strong> | Color: <strong>${apartado.color}</strong> | Precio: <strong>€${apartado.precio.toFixed(2)}</strong>
                        </div>
                        <div class="apartado-cliente">
                            📧 ${apartado.email} | 📞 ${apartado.telefono}
                        </div>
                        ${espirado ? '<div style="color: var(--danger); font-weight: bold; margin-top: 0.5rem;">⚠️ EXPIRADO</div>' : ''}
                    </div>
                    <div class="apartado-tiempo" style="${espirado ? 'background: var(--danger);' : ''}">
                        ${tiempoRestante}
                    </div>
                    <button class="btn-eliminar" onclick="eliminarApartado(${apartado.id})">
                        Eliminar
                    </button>
                </div>
            `;
        }).join('');
    }

    document.getElementById('apartadosModal').classList.add('active');
}

function closeApartadosModal() {
    document.getElementById('apartadosModal').classList.remove('active');
}

function eliminarApartado(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este apartado?')) {
        apartados = apartados.filter(a => a.id !== id);
        localStorage.setItem('apartados', JSON.stringify(apartados));
        updateApartadosBadge();
        openApartadosModal(); // Actualizar modal
        mostrarNotificacion('Apartado eliminado', 'success');
    }
}

function calcularTiempoRestante(fechaExpiracion) {
    const ahora = new Date();
    const fecha = new Date(fechaExpiracion);
    const diferencia = fecha - ahora;

    if (diferencia <= 0) {
        return 'EXPIRADO';
    }

    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));

    if (horas > 0) {
        return `${horas}h ${minutos}m`;
    } else {
        return `${minutos}m`;
    }
}

// ========== FUNCIONES AUXILIARES ==========
function getCategoryName(categoria) {
    const nombres = {
        'todo': 'Todo',
        'mujer': 'Mujer',
        'hombre': 'Hombre',
        'accesorios': 'Accesorios',
        'premium': 'Premium',
        'oferta': 'Oferta'
    };
    return nombres[categoria] || categoria;
}

function updateApartadosBadge() {
    const badge = document.getElementById('apartadosBadge');
    const apartadosActivos = apartados.filter(a => new Date() < new Date(a.tiempoExpiracion)).length;
    badge.textContent = apartadosActivos;
    badge.style.display = apartadosActivos > 0 ? 'flex' : 'none';
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    // Crear notificación temporal
    const notifDiv = document.createElement('div');
    notifDiv.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${tipo === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-weight: 500;
        z-index: 3000;
        animation: slideInRight 0.3s ease-out;
    `;
    notifDiv.textContent = mensaje;
    document.body.appendChild(notifDiv);

    setTimeout(() => {
        notifDiv.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notifDiv.remove(), 300);
    }, 3000);
}

// Agregar animaciones CSS para notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);