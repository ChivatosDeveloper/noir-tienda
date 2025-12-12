 
 // CONFIGURACIÓN SUPABASE
        const SUPABASE_URL = 'https://hfqulonhcgwrbgnjsvnv.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_U5y-nlPKsZHAQHmZ3yEYjg_kZwcVVF5';
        const { createClient } = window.supabase;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // VARIABLES GLOBALES
        let currentUser = null;
        let allApartados = [];
        let filteredApartados = [];
        let currentTab = 'pendientes';
        let selectedApartadoForModal = null;
        let html5QrCode = null;
let qrScannerActive = false;

        // INICIALIZACIÓN
        document.addEventListener('DOMContentLoaded', () => {
            checkAuthStatus();
        });

        // AUTENTICACIÓN
        function checkAuthStatus() {
            const storedUser = localStorage.getItem('adminUser');
            
            if (storedUser) {
                currentUser = JSON.parse(storedUser);
                showAdminPanel();
                loadApartados();
                setupRealtimeListener();
            } else {
                showLoginModal();
            }
        }

        async function handleLogin(e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    mostrarNotificacion('❌ Error al iniciar sesión', 'error');
                    return;
                }

                currentUser = {
                    id: data.user.id,
                    email: data.user.email,
                    token: data.session.access_token
                };

                localStorage.setItem('adminUser', JSON.stringify(currentUser));
                document.querySelector('.login-form').reset();

                showAdminPanel();
                loadApartados();
                setupRealtimeListener();
                mostrarNotificacion('✅ ¡Bienvenido!', 'success');

            } catch (error) {
                console.error('Error:', error);
                mostrarNotificacion('❌ Error de conexión', 'error');
            }
        }

        function logout() {
            if (confirm('¿Deseas cerrar sesión?')) {
                currentUser = null;
                localStorage.removeItem('adminUser');
                allApartados = [];
                filteredApartados = [];
                showLoginModal();
                mostrarNotificacion('👋 Sesión cerrada', 'success');
            }
        }

        function showLoginModal() {
            document.getElementById('loginModal').style.display = 'flex';
            document.getElementById('adminContent').style.display = 'none';
        }

        function showAdminPanel() {
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
        }

        // CARGAR APARTADOS
        async function loadApartados() {
            try {
                const { data, error } = await supabase
                    .from('apartados')
                    .select('*')
                    .order('fecha_apartado', { ascending: false });

                if (error) {
                    console.error('Error al cargar apartados:', error);
                    mostrarNotificacion('❌ Error al cargar datos', 'error');
                    return;
                }

                allApartados = data || [];
                filterAndDisplayApartados();
                updateStatistics();

            } catch (error) {
                console.error('Error:', error);
            }
        }

        // ========== ESCÁNER QR ==========
function abrirEscanerQR() {
    document.getElementById('modalEscanerQR').classList.add('active');
    iniciarEscanerQR();
}

function cerrarEscanerQR() {
    detenerEscanerQR();
    document.getElementById('modalEscanerQR').classList.remove('active');
    document.getElementById('qr-result').style.display = 'none';
}

function iniciarEscanerQR() {
    if (qrScannerActive) return;
    
    html5QrCode = new Html5Qrcode("qr-reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, // Cámara trasera
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanFailure
    ).then(() => {
        qrScannerActive = true;
        console.log("Escáner QR iniciado");
    }).catch(err => {
        console.error("Error al iniciar escáner:", err);
        mostrarNotificacion('❌ Error al acceder a la cámara', 'error');
    });
}

function detenerEscanerQR() {
    if (html5QrCode && qrScannerActive) {
        html5QrCode.stop().then(() => {
            qrScannerActive = false;
            console.log("Escáner QR detenido");
        }).catch(err => {
            console.error("Error al detener escáner:", err);
        });
    }
}

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código detectado: ${decodedText}`);
    
    // Mostrar resultado
    document.getElementById('codigoDetectado').textContent = decodedText;
    document.getElementById('qr-result').style.display = 'block';
    
    // Buscar el apartado
    buscarApartadoPorCodigo(decodedText);
    
    // Detener escáner después de 2 segundos
    setTimeout(() => {
        detenerEscanerQR();
        cerrarEscanerQR();
    }, 2000);
}

function onScanFailure(error) {
    // Ignorar errores de escaneo (son normales mientras busca el QR)
}

async function buscarApartadoPorCodigo(codigo) {
    try {
        // Buscar en los apartados cargados
        const apartado = allApartados.find(a => 
            a.codigo_recogida.toUpperCase() === codigo.toUpperCase()
        );
        
        if (!apartado) {
            mostrarNotificacion('❌ Apartado no encontrado', 'error');
            return;
        }
        
        if (apartado.estado !== 'activo') {
            mostrarNotificacion(`⚠️ Este apartado está ${apartado.estado}`, 'error');
            return;
        }
        
        // Abrir modal de recogida automáticamente
        mostrarNotificacion('✅ Apartado encontrado', 'success');
        
        // Pequeño delay para que vea la notificación
        setTimeout(() => {
            openModalRecogida(apartado.id);
            // Pre-llenar el código
            document.getElementById('codigoVerificacion').value = codigo;
        }, 500);
        
    } catch (error) {
        console.error('Error al buscar apartado:', error);
        mostrarNotificacion('❌ Error al buscar apartado', 'error');
    }
}

        // LISTENER TIEMPO REAL
        function setupRealtimeListener() {
            supabase
                .channel('apartados-changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'apartados'
                }, (payload) => {
                    console.log('Cambio detectado:', payload);
                    loadApartados();
                })
                .subscribe();
        }

        // FILTRAR Y MOSTRAR
        function filterAndDisplayApartados() {
            let filtered = allApartados.filter(a => {
                switch (currentTab) {
                    case 'pendientes':
                        return a.estado === 'activo';
                    case 'recogidos':
                        return a.estado === 'recogido';
                    default:
                        return true;
                }
            });

            const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
            if (searchTerm) {
                filtered = filtered.filter(a =>
                    a.codigo_recogida.toLowerCase().includes(searchTerm) ||
                    a.cliente_nombre.toLowerCase().includes(searchTerm) ||
                    a.cliente_email.toLowerCase().includes(searchTerm)
                );
            }

            filteredApartados = filtered;
            displayApartadosInTab();
        }

        function displayApartadosInTab() {
            const tabName = currentTab;
            const containerId = `apartados${tabName.charAt(0).toUpperCase() + tabName.slice(1)}List`;
            const emptyId = `empty${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;

            const container = document.getElementById(containerId);
            const emptyState = document.getElementById(emptyId);

            if (!container) return;

            if (filteredApartados.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'flex';
                return;
            }

            emptyState.style.display = 'none';

            container.innerHTML = filteredApartados.map(apartado => {
                const horasRestantes = calcularHorasRestantes(apartado.fecha_expiracion);
                const esUrgente = horasRestantes < 2 && horasRestantes > 0;

                return `
                    <div class="apartado-card">
                        <div class="apartado-header">
                            <div class="codigo-recogida">${apartado.codigo_recogida}</div>
                            <span class="apartado-estado estado-${apartado.estado}">
                                ${apartado.estado === 'activo' ? '⏳ PENDIENTE' : '✅ RECOGIDO'}
                            </span>
                        </div>

                        <div class="apartado-info">
                            <div class="info-item">
                                <span class="info-label">👤 Cliente</span>
                                <span class="info-value">${apartado.cliente_nombre}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">📧 Email</span>
                                <span class="info-value" style="font-size: 0.85rem;">${apartado.cliente_email}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">📱 Teléfono</span>
                                <span class="info-value">${apartado.cliente_telefono}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">📏 Tamaño</span>
                                <span class="info-value">${apartado.producto_tamaño || '-'}</span>
                            </div>
                        </div>

                        <div class="producto-info">
                            <p><strong>👕 Producto:</strong> ${apartado.producto_nombre}</p>
                            <p><strong>🎨 Color:</strong> ${apartado.producto_color}</p>
                            <p><strong>💰 Precio:</strong> €${parseFloat(apartado.producto_precio).toFixed(2)}</p>
                        </div>

                        ${horasRestantes > 0 && apartado.estado === 'activo' ? `
                            <div class="tiempo-restante ${esUrgente ? 'warning' : ''}">
                                <i class="fas fa-hourglass-end"></i>
                                <span>${Math.floor(horasRestantes)}h ${Math.floor((horasRestantes % 1) * 60)}m restantes</span>
                            </div>
                        ` : ''}

                        ${apartado.estado === 'recogido' && apartado.fecha_recogida ? `
                            <div class="tiempo-restante" style="background: #d1fae5; border-left-color: #10b981;">
                                <i class="fas fa-check-circle"></i>
                                <span>Recogido: ${new Date(apartado.fecha_recogida).toLocaleString('es-ES')}</span>
                            </div>
                        ` : ''}

                        <div class="apartado-actions">
                            ${apartado.estado === 'activo' ? `
                                <button class="btn btn-success" onclick="openModalRecogida('${apartado.id}')">
                                    <i class="fas fa-check-double"></i>
                                    Marcar Recogido
                                </button>
                                <button class="btn btn-danger" onclick="cancelarApartado('${apartado.id}')">
                                    <i class="fas fa-times"></i>
                                    Cancelar
                                </button>
                            ` : ''}
                            <button class="btn btn-info" onclick="copiarCodigo('${apartado.codigo_recogida}')">
                                <i class="fas fa-copy"></i>
                                Copiar Código
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // MODAL RECOGIDA
        function openModalRecogida(apartadoId) {
            const apartado = allApartados.find(a => a.id === apartadoId);
            if (!apartado) return;

            selectedApartadoForModal = apartado;

            const detalle = document.getElementById('apartadoDetalleRecogida');
            detalle.innerHTML = `
                <div class="detalle-row">
                    <span class="detalle-label">Código:</span>
                    <span class="detalle-value">${apartado.codigo_recogida}</span>
                </div>
                <div class="detalle-row">
                    <span class="detalle-label">Cliente:</span>
                    <span class="detalle-value">${apartado.cliente_nombre}</span>
                </div>
                <div class="detalle-row">
                    <span class="detalle-label">Producto:</span>
                    <span class="detalle-value">${apartado.producto_nombre}</span>
                </div>
                <div class="detalle-row">
                    <span class="detalle-label">Precio:</span>
                    <span class="detalle-value">€${parseFloat(apartado.producto_precio).toFixed(2)}</span>
                </div>
            `;

            document.getElementById('modalRecogida').classList.add('active');
        }

        function closeModalRecogida() {
            document.getElementById('modalRecogida').classList.remove('active');
            document.getElementById('codigoVerificacion').value = '';
            selectedApartadoForModal = null;
        }

        async function confirmarRecogida() {
            if (!selectedApartadoForModal) return;

            const codigoIngresado = document.getElementById('codigoVerificacion').value.toUpperCase();

            if (!codigoIngresado) {
                mostrarNotificacion('⚠️ Ingresa el código de recogida', 'error');
                return;
            }

            if (codigoIngresado !== selectedApartadoForModal.codigo_recogida) {
                mostrarNotificacion('❌ Código incorrecto', 'error');
                return;
            }

            try {
                const { error } = await supabase
                    .from('apartados')
                    .update({
                        estado: 'recogido',
                        fecha_recogida: new Date().toISOString()
                    })
                    .eq('id', selectedApartadoForModal.id);

                if (error) {
                    if (error.message.includes('auditoria_apartados')) {
                        mostrarNotificacion('✅ Recogida registrada', 'success');
                        closeModalRecogida();
                        loadApartados();
                        return;
                    }
                    throw error;
                }

                mostrarNotificacion('✅ Recogida registrada correctamente', 'success');
                closeModalRecogida();
                loadApartados();

            } catch (error) {
                console.error('Error:', error);
                mostrarNotificacion('❌ Error al registrar recogida', 'error');
            }
        }

        async function cancelarApartado(apartadoId) {
            if (!confirm('¿Deseas cancelar este apartado?')) return;

            try {
                const { error } = await supabase
                    .from('apartados')
                    .update({ estado: 'cancelado' })
                    .eq('id', apartadoId);

                if (error) throw error;

                mostrarNotificacion('✅ Apartado cancelado', 'success');
                loadApartados();

            } catch (error) {
                console.error('Error:', error);
                mostrarNotificacion('❌ Error al cancelar', 'error');
            }
        }

        // CAMBIO DE PESTAÑAS
        function switchTab(tabName) {
            currentTab = tabName;

            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.closest('.tab-btn').classList.add('active');

            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');

            filterAndDisplayApartados();
        }

        // BÚSQUEDA
        function filtrarApartados() {
            filterAndDisplayApartados();
        }

        function limpiarBusqueda() {
            document.getElementById('searchInput').value = '';
            filterAndDisplayApartados();
        }

        // ESTADÍSTICAS
        function updateStatistics() {
            const pendientes = allApartados.filter(a => a.estado === 'activo').length;
            const recogidos = allApartados.filter(a => a.estado === 'recogido').length;
            const expirados = allApartados.filter(a => a.estado === 'expirado').length;

            document.getElementById('badgePendientes').textContent = pendientes;
            document.getElementById('badgeRecogidos').textContent = recogidos;

            document.getElementById('statPendientes').textContent = pendientes;
            document.getElementById('statRecogidos').textContent = recogidos;
            document.getElementById('statExpirados').textContent = expirados;

            const recogidosHoy = allApartados.filter(a => {
                if (!a.fecha_recogida) return false;
                const fecha = new Date(a.fecha_recogida);
                return a.estado === 'recogido' && fecha.toDateString() === new Date().toDateString();
            });

            const ingresosTotal = recogidosHoy.reduce((sum, a) => sum + parseFloat(a.producto_precio), 0);

            document.getElementById('ingresosTotal').textContent = `€${ingresosTotal.toFixed(2)}`;
            document.getElementById('ingresosItems').textContent = `${recogidosHoy.length} apartados recogidos hoy`;
        }

        // FUNCIONES AUXILIARES
        function calcularHorasRestantes(fechaExpiracion) {
            const ahora = new Date();
            const fecha = new Date(fechaExpiracion);
            const diferencia = fecha - ahora;

            if (diferencia <= 0) return 0;

            return diferencia / (1000 * 60 * 60);
        }

        function copiarCodigo(codigo) {
            navigator.clipboard.writeText(codigo).then(() => {
                mostrarNotificacion(`📋 Código ${codigo} copiado`, 'success');
            }).catch(() => {
                mostrarNotificacion('❌ Error al copiar', 'error');
            });
        }

        // NOTIFICACIONES
        function mostrarNotificacion(mensaje, tipo = 'success') {
            const notif = document.getElementById('notification');
            const notifText = document.getElementById('notificationText');

            notifText.textContent = mensaje;

            if (tipo === 'error') {
                notif.style.background = '#c41e3a';
            } else {
                notif.style.background = '#10b981';
            }

            notif.classList.add('show');

            setTimeout(() => {
                notif.classList.remove('show');
            }, 3000);
        }