// Sistema de Control de Herramientas - Frontend JavaScript

class HerramientasApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.usuario = null;
        this.sessionTimer = null;
        this.timeRemaining = 15 * 60; // 15 minutos
        this.editingHerramientaId = null;
        this.init();
    }

    removeHiddenInlineStyles(rootEl) {
        try {
            if (!rootEl) return;

            // Remove inline properties on the root
            if (rootEl.getAttribute && rootEl.getAttribute('style')) {
                rootEl.style.removeProperty('display');
                rootEl.style.removeProperty('visibility');
                rootEl.style.removeProperty('opacity');
            }

            // Remove on children that explicitly contain hiding rules in the inline style
            const all = rootEl.querySelectorAll('*');
            all.forEach(child => {
                const s = child.getAttribute && child.getAttribute('style');
                if (!s) return;
                const low = s.replace(/\s/g,'').toLowerCase();
                if (low.includes('display:none') || low.includes('visibility:hidden') || low.includes('opacity:0')) {
                    try {
                        child.style.removeProperty('display');
                        child.style.removeProperty('visibility');
                        child.style.removeProperty('opacity');
                    } catch (err) {
                        // ignore
                    }
                }
            });
        } catch (err) {
            console.error('removeHiddenInlineStyles error:', err);
        }
    }

    async init() {
        // Verificar autenticación primero
        if (!this.checkAuth()) {
            // Redirigir a login
            window.location.href = '/login.html';
            return;
        }

        // Si hay autenticación, inicializar
        this.setupEventListeners();
        this.setupResponsiveHandlers();
        // Asegurar que la UI principal sea visible incluso si el HTML tiene una estructura diferente
        // (mostrar contenedor antes de cargar datos para que el usuario vea progreso)
        this.ensureUIVisible();
        // Aplicar estilos de depuración temporal para identificar elementos ocultos
        this.applyDebugStyles();
        await this.loadInitialData();
        this.showPage('dashboard');
        this.setDefaultDates();
        this.startSessionTimer();
    }

    ensureUIVisible() {
        try {
            // 1) Ocultar overlays conocidos
            const authCheck = document.getElementById('auth-check');
            if (authCheck) authCheck.style.setProperty('display', 'none', 'important');

            const loadingSpinner = document.getElementById('loading-spinner');
            if (loadingSpinner) loadingSpinner.style.setProperty('display', 'none', 'important');

            // 2) Mostrar el contenedor principal que exista en la página
            const mainSystem = document.getElementById('main-system');
            const appContainer = document.querySelector('.app-container');
            if (mainSystem) {
                mainSystem.style.setProperty('display', 'flex', 'important');
            } else if (appContainer) {
                appContainer.style.setProperty('display', 'flex', 'important');
                // Asegurar que los hijos principales estén visibles
                const sidebar = appContainer.querySelector('.sidebar');
                const mainArea = appContainer.querySelector('.main-area');
                if (sidebar) sidebar.style.removeProperty('display');
                if (mainArea) {
                    mainArea.style.setProperty('display', 'flex', 'important');
                }
            }

            // 3) Forzar visibilidad del área de contenido
            const contentArea = document.querySelector('.content-area') || mainSystem;
            if (contentArea) {
                contentArea.style.setProperty('visibility', 'visible', 'important');
                contentArea.style.setProperty('opacity', '1', 'important');
            }
        } catch (err) {
            console.error('ensureUIVisible error:', err);
        }
    }

    // Estilos de depuración temporales para visualizar elementos ocultos
    applyDebugStyles() {
        try {
            const styleId = 'debug-ui-styles';
            if (document.getElementById(styleId)) return;

            const css = `
                /* destacar áreas principales */
                .content-area, .main-area, .page-content { outline: 2px dashed rgba(0,0,0,0.08) !important; background-color: rgba(243,244,246,0.9) !important; }
                
                /* asegurar que modals/overlays no cubran la UI durante depuración */
                #auth-check, #loading-spinner, .spinner-overlay { display: none !important; pointer-events: none !important; }
            `;

            const style = document.createElement('style');
            style.id = styleId;
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
            console.log('Debug styles applied');
        } catch (err) {
            console.error('applyDebugStyles error:', err);
        }
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        const usuarioData = localStorage.getItem('usuario');
        
        if (!token || !usuarioData) {
            // No redirigir aquí, dejar que el init maneje la redirección
            return false;
        }

        try {
            this.usuario = JSON.parse(usuarioData);
            this.updateUserInfo();
            this.setupAxiosInterceptors();
            return true;
        } catch (error) {
            console.error('Error parsing usuario data:', error);
            // Limpiar datos inválidos
            localStorage.removeItem('authToken');
            localStorage.removeItem('usuario');
            return false;
        }
    }

    updateUserInfo() {
        // Actualizar información del usuario en la UI
        const elements = {
            'usuario-nombre': this.usuario.nombre_completo,
            'user-dropdown-text': this.usuario.nombre_completo,
            'user-info-header': `${this.usuario.nombre_completo} - ${this.usuario.departamento}`
        };

        Object.entries(elements).forEach(([id, text]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = text;
            }
        });
    }

    setupAxiosInterceptors() {
        // Para fetch API, añadiremos headers en cada llamada
    }

    async apiCall(endpoint, method = 'GET', data = null) {
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            this.handleSessionExpired();
            throw new Error('No hay token de autenticación');
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(endpoint, options);

            if (response.status === 401) {
                this.handleSessionExpired();
                throw new Error('Sesión expirada');
            }

            // Leer cuerpo como texto primero (por si el servidor responde HTML en errores)
            const raw = await response.text();

            if (!response.ok) {
                // Intentar parsear JSON desde el texto, si es posible
                try {
                    const parsed = JSON.parse(raw);
                    throw new Error(parsed.error || parsed.message || `Error ${response.status}`);
                } catch (parseErr) {
                    // No era JSON — devolver el texto crudo en el mensaje de error (recortar)
                    const snippet = raw ? raw.slice(0, 300) : response.statusText;
                    throw new Error(`Error ${response.status}: ${snippet}`);
                }
            }

            // En caso de éxito, intentar parsear JSON; si no es JSON, devolver texto
            try {
                return raw ? JSON.parse(raw) : {};
            } catch (parseOkErr) {
                return raw;
            }
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Error de conexión con el servidor');
            }
            throw error;
        }
    }

    handleSessionExpired() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('usuario');
        this.showAlert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'warning');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.showPage(page);
            });
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.getElementById('logout-dropdown-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Change password
        document.getElementById('change-password-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showChangePasswordModal();
        });

        // Profile
        document.getElementById('profile-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showProfileModal();
        });

        // Forms
        document.getElementById('guardar-herramienta')?.addEventListener('click', () => this.saveHerramienta());
        document.getElementById('guardar-prestamo')?.addEventListener('click', () => this.savePrestamo());
        document.getElementById('guardar-devolucion')?.addEventListener('click', () => this.saveDevolucion());
        document.getElementById('guardar-registro')?.addEventListener('click', () => this.saveRegistro());
        // Abrir modal de registro
        document.getElementById('open-registro-modal')?.addEventListener('click', (e) => {
            e.preventDefault();
            const modalEl = document.getElementById('registroModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        });

        // Abrir modal de creación de solicitante desde Registro
        document.getElementById('open-solicitante-modal')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openCreateSolicitanteModal();
        });
        // Abrir modal de backups
        document.getElementById('backup-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openBackupModal();
        });

        // Search
        document.getElementById('buscar-herramienta')?.addEventListener('input', (e) => {
            this.buscarHerramienta(e.target.value);
        });

        // Modal changes
        document.getElementById('prestamo-herramienta')?.addEventListener('change', (e) => {
            this.actualizarCantidadMaxima();
        });
        // Export report button (in Reportes page)
        document.getElementById('export-report-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.exportReport();
        });
    }

    setupResponsiveHandlers() {
        // Mobile menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('show');
                }
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 992) {
                sidebar.classList.remove('show');
            }
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadCategorias(),
                this.loadHerramientas(),
                this.loadSolicitantes(),
                this.loadPrestamosActivos(),
                this.loadEstadisticas()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    showPage(pageName) {
        console.log('showPage called for:', pageName);

        // Seleccionar todas las páginas objetivo: elementos cuyo id termina en "-page"
        // (evita seleccionar wrappers que también usan la clase `.page-content`)
        const pages = Array.from(document.querySelectorAll('[id$="-page"]'));

        // Si no hay páginas, salir
        if (pages.length === 0) {
            console.warn('No se encontraron elementos .page-content en el DOM');
            return;
        }

        // Determinar la página objetivo
        const targetId = `${pageName}-page`;
        const targetPage = document.getElementById(targetId);
        console.log('targetPage for', pageName, 'found:', !!targetPage);

        // Ocultar todas las páginas explícitamente y resetear estilos relacionados
        pages.forEach(page => {
            if (page.id === targetId) return;
            page.classList.add('d-none');
            try {
                page.style.setProperty('display', 'none', 'important');
                page.style.setProperty('visibility', 'hidden', 'important');
                page.style.setProperty('opacity', '0', 'important');
            } catch (err) {
                // ignore
            }
        });

        // Mostrar la página objetivo de forma robusta
        if (targetPage) {
            // Eliminar estilos inline de ocultamiento que podrían provenir del HTML o de ejecuciones previas
            this.removeHiddenInlineStyles(targetPage);

            targetPage.classList.remove('d-none');
            try {
                targetPage.style.setProperty('display', 'block', 'important');
                targetPage.style.setProperty('visibility', 'visible', 'important');
                targetPage.style.setProperty('opacity', '1', 'important');
                // quitar clase de animación si existiera para evitar estados inconsistentes
                targetPage.classList.remove('fade-in');
            } catch (err) {
                console.warn('No se pudo forzar visibilidad del targetPage:', err);
            }
        } else {
            // Si no existe la página objetivo, mostrar la primera página disponible
            const first = pages[0];
            first.classList.remove('d-none');
            first.style.removeProperty('display');
            first.style.setProperty('visibility', 'visible', 'important');
            first.style.setProperty('opacity', '1', 'important');
        }

        // Actualizar navegación: marcar enlace activo
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');

        this.currentPage = pageName;

        // Cargar datos específicos de la página (no bloquear la UI)
        this.loadPageData(pageName);
    }

    async loadPageData(pageName) {
        switch (pageName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'inventario':
                await this.loadInventarioData();
                break;
            case 'prestamos':
                await this.loadPrestamosData();
                break;
            case 'devoluciones':
                await this.loadDevolucionesData();
                break;
            case 'reportes':
                await this.loadReportesData();
                break;
            case 'registro':
                await this.loadRegistroData();
                break;
        }
    }

    async loadRegistroData() {
        try {
            // Solo los admins deben ver/consultar la lista de usuarios
            if (!this.usuario || this.usuario.rol !== 'admin') {
                // Eliminar contenedor si existe
                const existing = document.getElementById('usuarios-admin-container');
                if (existing) existing.remove();
                return;
            }

            const usuarios = await this.apiCall('/api/usuarios');
            this.renderUsuariosTable(usuarios);
            // Cargar solicitantes también para administración (admins y supervisors)
            await this.loadSolicitantesAdmin();
            // Cargar categorías para administración
            await this.loadCategoriasAdmin();
        } catch (error) {
            console.error('Error loading usuarios:', error);
        }
    }

    async loadSolicitantesAdmin() {
        try {
            const solicitantes = await this.apiCall('/api/solicitantes');
            this.renderSolicitantesTable(solicitantes);
        } catch (error) {
            console.error('Error loading solicitantes:', error);
        }
    }

    renderSolicitantesTable(items) {
        const tbody = document.querySelector('#solicitantes-table tbody');
        if (!tbody) return;

        tbody.innerHTML = items.map(s => `
            <tr>
                <td>${s.id}</td>
                <td>${s.nombre}</td>
                <td>${s.departamento}</td>
                <td>${s.telefono || ''}</td>
                <td>${s.email || ''}</td>
                <td>
                    ${ (this.usuario && (this.usuario.rol === 'admin' || this.usuario.rol === 'supervisor')) ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteSolicitante(${s.id})" title="Eliminar solicitante" data-bs-toggle="tooltip" data-bs-placement="top">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : `<span class="text-muted small">No autorizado</span>`}
                </td>
            </tr>
        `).join('');
        this.initTooltips();
    }

    async deleteSolicitante(id) {
        if (!confirm('¿Eliminar solicitante? Esta acción no se puede deshacer.')) return;
        try {
            await this.apiCall(`/api/solicitantes/${id}`, 'DELETE');
            this.showAlert('Solicitante eliminado', 'success');
            await this.loadSolicitantesAdmin();
            await this.loadPrestamosData();
        } catch (error) {
            console.error('Error eliminando solicitante:', error);
            this.showAlert('Error al eliminar solicitante: ' + error.message, 'error');
        }
    }

    async loadCategoriasAdmin() {
        try {
            const categorias = await this.apiCall('/api/categorias');
            this.renderCategoriasTable(categorias);
        } catch (err) {
            console.error('Error cargando categorias:', err);
        }
    }

    renderCategoriasTable(items) {
        const tbody = document.querySelector('#categorias-table tbody');
        if (!tbody) return;
        tbody.innerHTML = items.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>
                    ${ (this.usuario && (this.usuario.rol === 'admin' || this.usuario.rol === 'supervisor')) ? `
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="app.openEditCategoriaModal(${c.id}, '${encodeURIComponent(c.nombre)}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteCategoria(${c.id})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : `<span class="small text-muted">No autorizado</span>` }
                </td>
            </tr>
        `).join('');
    }

    openEditCategoriaModal(id, encodedName) {
        const nombre = decodeURIComponent(encodedName);
        const modalHtml = `
            <div class="modal fade" id="editCategoriaModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Editar Categoría</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Nombre</label>
                                <input class="form-control" id="edit-categoria-nombre" value="${nombre}">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn btn-primary" id="save-edit-categoria">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('editCategoriaModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
        document.getElementById('save-edit-categoria').addEventListener('click', async () => {
            const newName = document.getElementById('edit-categoria-nombre').value.trim();
            if (!newName) { alert('Nombre requerido'); return; }
            try {
                await this.apiCall(`/api/categorias/${id}`, 'PUT', { nombre: newName });
                this.showAlert('Categoría actualizada', 'success');
                modal.hide();
                modalEl.remove();
                await this.loadCategoriasAdmin();
            } catch (err) {
                console.error('Error actualizando categoría:', err);
                this.showAlert('Error al actualizar categoría: ' + err.message, 'error');
            }
        }, { once: true });
        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });
    }

    async deleteCategoria(id) {
        if (!confirm('¿Eliminar categoría? Solo se puede eliminar si no tiene herramientas asociadas.')) return;
        try {
            await this.apiCall(`/api/categorias/${id}`, 'DELETE');
            this.showAlert('Categoría eliminada', 'success');
            await this.loadCategoriasAdmin();
            await this.loadInventarioData();
        } catch (err) {
            console.error('Error eliminando categoría:', err);
            this.showAlert('Error al eliminar categoría: ' + err.message, 'error');
        }
    }

    renderUsuariosTable(usuarios) {
        // Crear o encontrar contenedor debajo del formulario de registro
        let container = document.getElementById('usuarios-admin-container');
        if (!container) {
            const registroForm = document.getElementById('registro-page') || document.getElementById('registro-page') || document.querySelector('#registro-page');
            // Insert after registro form card
            const page = document.getElementById('registro-page') || document.querySelector('#registro-page');
            container = document.createElement('div');
            container.id = 'usuarios-admin-container';
            container.className = 'card mt-4';
            container.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">Administración de Usuarios</h5>
                    <div class="table-responsive">
                        <table class="table table-hover" id="usuarios-table">
                            <thead class="table-light">
                                <tr>
                                    <th>ID</th>
                                    <th>Usuario</th>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Departamento</th>
                                    <th>Rol</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            `;
            page.appendChild(container);
        }

        const tbody = container.querySelector('#usuarios-table tbody');
        if (!tbody) return;
        tbody.innerHTML = usuarios.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.nombre_usuario}</td>
                <td>${u.nombre_completo}</td>
                <td>${u.email || ''}</td>
                <td>${u.departamento || ''}</td>
                <td>${u.rol || ''}</td>
                <td>
                    ${this.usuario && this.usuario.rol === 'admin' ? `
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="app.editUsuario(${u.id})" title="Editar usuario" data-bs-toggle="tooltip" data-bs-placement="top">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteUsuario(${u.id})" title="Eliminar usuario" data-bs-toggle="tooltip" data-bs-placement="top">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : `
                        <span class="text-muted small">No autorizado</span>
                    `}
                </td>
            </tr>
        `).join('');
        this.initTooltips();
    }

    async deleteUsuario(usuarioId) {
        if (!confirm('¿Eliminar usuario? Esta acción no se puede deshacer.')) return;
        try {
            await this.apiCall(`/api/usuarios/${usuarioId}`, 'DELETE');
            this.showAlert('Usuario eliminado', 'success');
            await this.loadRegistroData();
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            this.showAlert('Error al eliminar usuario: ' + error.message, 'error');
        }
    }

    async editUsuario(usuarioId) {
        try {
            const usuario = await this.apiCall(`/api/usuarios/${usuarioId}`);
            // Crear modal de edición
            const modalHtml = `
                <div class="modal fade" id="editUsuarioModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Editar Usuario</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="editUsuarioForm">
                                    <div class="mb-3">
                                        <label class="form-label">Nombre completo</label>
                                        <input type="text" class="form-control" id="edit-nombre-completo" value="${usuario.nombre_completo || ''}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Email</label>
                                        <input type="email" class="form-control" id="edit-email" value="${usuario.email || ''}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Departamento</label>
                                        <input type="text" class="form-control" id="edit-departamento" value="${usuario.departamento || ''}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Rol</label>
                                        <select class="form-select" id="edit-rol">
                                            <option value="usuario" ${usuario.rol === 'usuario' ? 'selected' : ''}>usuario</option>
                                            <option value="supervisor" ${usuario.rol === 'supervisor' ? 'selected' : ''}>supervisor</option>
                                            <option value="admin" ${usuario.rol === 'admin' ? 'selected' : ''}>admin</option>
                                        </select>
                                    </div>
                                    <div class="mb-3 form-check">
                                        <input class="form-check-input" type="checkbox" id="edit-activo" ${usuario.activo ? 'checked' : ''}>
                                        <label class="form-check-label" for="edit-activo">Activo</label>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-primary" id="save-edit-usuario">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalEl = document.getElementById('editUsuarioModal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            document.getElementById('save-edit-usuario').addEventListener('click', async () => {
                const nombre_completo = document.getElementById('edit-nombre-completo').value.trim();
                const email = document.getElementById('edit-email').value.trim();
                const departamento = document.getElementById('edit-departamento').value.trim();
                const rol = document.getElementById('edit-rol').value;
                const activo = document.getElementById('edit-activo').checked ? 1 : 0;

                try {
                    await this.apiCall(`/api/usuarios/${usuarioId}`, 'PUT', { nombre_completo, email, departamento, rol, activo });
                    this.showAlert('Usuario actualizado', 'success');
                    modal.hide();
                    modalEl.remove();
                    await this.loadRegistroData();
                } catch (error) {
                    console.error('Error actualizando usuario:', error);
                    this.showAlert('Error al actualizar usuario: ' + error.message, 'error');
                }
            }, { once: true });

            modalEl.addEventListener('hidden.bs.modal', () => {
                modalEl.remove();
            }, { once: true });
        } catch (error) {
            console.error('Error cargando usuario:', error);
            this.showAlert('Error al cargar usuario: ' + error.message, 'error');
        }
    }

    async loadDashboardData() {
        try {
            const [prestamosActivos, stats] = await Promise.all([
                this.apiCall('/api/prestamos/activos'),
                this.apiCall('/api/estadisticas')
            ]);

            this.updateDashboardStats(stats);
            this.renderPrestamosRecientes(prestamosActivos.slice(0, 5));
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('total-herramientas').textContent = stats.total_herramientas || 0;
        document.getElementById('herramientas-disponibles').textContent = 
            (stats.herramientas_activas || 0) - (stats.herramientas_prestadas || 0);
        document.getElementById('herramientas-prestadas').textContent = stats.herramientas_prestadas || 0;
        document.getElementById('prestamos-activos').textContent = stats.prestamos_activos || 0;
    }

    renderPrestamosRecientes(prestamos) {
        console.log('renderPrestamosRecientes called, count=', Array.isArray(prestamos) ? prestamos.length : 0);
        const tbody = document.querySelector('#prestamos-recientes-table tbody');
        console.log('tbody found:', !!tbody);
        if (!tbody) return;

        tbody.innerHTML = prestamos.map(prestamo => `
            <tr>
                <td><span class="badge bg-primary">${prestamo.codigo_prestamo}</span></td>
                <td>${prestamo.herramienta_nombre}</td>
                <td>${prestamo.solicitante_nombre}</td>
                <td>${prestamo.departamento}</td>
                <td>${this.formatDate(prestamo.fecha_salida)}</td>
                <td><span class="badge bg-warning">Activo</span></td>
            </tr>
        `).join('');
        this.initTooltips();
    }

    async loadInventarioData() {
        try {
            const herramientas = await this.apiCall('/api/herramientas');
            this.renderInventarioTable(herramientas);
        } catch (error) {
            console.error('Error loading inventario:', error);
        }
    }

    renderInventarioTable(herramientas) {
        const tbody = document.querySelector('#inventario-table tbody');
        if (!tbody) return;

        tbody.innerHTML = herramientas.map(herramienta => {
            const disponibilidad = herramienta.stock_total > 0 ? 
                (herramienta.en_bodega / herramienta.stock_total * 100).toFixed(1) : 0;
            const disponibilidadClass = disponibilidad >= 70 ? 'success' : 
                                      disponibilidad >= 40 ? 'warning' : 'danger';

            return `
                <tr>
                    <td><strong>${herramienta.codigo}</strong></td>
                    <td>${herramienta.nombre}</td>
                    <td>${herramienta.categoria_nombre}</td>
                    <td>${herramienta.stock_total}</td>
                    <td><span class="text-success">${herramienta.en_bodega}</span></td>
                    <td><span class="text-warning">${herramienta.prestadas}</span></td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar bg-${disponibilidadClass}" 
                                 style="width: ${disponibilidad}%">
                                ${disponibilidad}%
                            </div>
                        </div>
                    </td>
                    <td><span class="badge bg-success">${herramienta.estado}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="app.editHerramienta(${herramienta.id})" title="Editar" data-bs-toggle="tooltip" data-bs-placement="top">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${
                            (this.usuario && (this.usuario.rol === 'admin' || this.usuario.rol === 'supervisor')) ? 
                            `<button class="btn btn-sm btn-outline-danger ms-1" onclick="app.deleteHerramienta(${herramienta.id})" title="Eliminar" data-bs-toggle="tooltip" data-bs-placement="top">
                                <i class="fas fa-trash-alt"></i>
                            </button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-success ms-1" onclick="app.prestarHerramienta(${herramienta.id})" title="Prestar" data-bs-toggle="tooltip" data-bs-placement="top">
                            <i class="fas fa-hand-holding"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadPrestamosData() {
        try {
            const [prestamos, herramientas, solicitantes] = await Promise.all([
                this.apiCall('/api/prestamos'),
                this.apiCall('/api/herramientas'),
                this.apiCall('/api/solicitantes')
            ]);

            this.renderPrestamosTable(prestamos);
            this.updatePrestamoModal(herramientas, solicitantes);
        } catch (error) {
            console.error('Error loading prestamos:', error);
        }
    }

    updatePrestamoModal(herramientas = [], solicitantes = []) {
        try {
            // Llenar select de herramientas (solo las disponibles en bodega)
            const herramientasDisponibles = herramientas.filter(h => (h.en_bodega || 0) > 0);
            this.updateSelectOptions('prestamo-herramienta', herramientasDisponibles, 'id', 'nombre', 'codigo');

            // Llenar select de solicitantes
            this.updateSelectOptions('prestamo-solicitante', solicitantes, 'id', 'nombre');
        } catch (error) {
            console.error('Error actualizando modal de préstamo:', error);
        }
    }

    initTooltips() {
        try {
            if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) {
                return;
            }

            // Dispose previous instances stored on this app to avoid duplicates
            this._tooltipInstances = this._tooltipInstances || [];
            if (this._tooltipInstances.length > 0) {
                this._tooltipInstances.forEach(inst => {
                    try { inst.dispose(); } catch (e) { /* ignore */ }
                });
                this._tooltipInstances = [];
            }

            // Inicializar todos los tooltips de Bootstrap en la página
            const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.forEach(el => {
                try {
                    const instance = new bootstrap.Tooltip(el);
                    this._tooltipInstances.push(instance);
                } catch (e) {
                    // ignore initialization errors
                }
            });
        } catch (err) {
            console.error('initTooltips error:', err);
        }
    }

    renderPrestamosTable(prestamos) {
        const tbody = document.querySelector('#prestamos-table tbody');
        if (!tbody) return;

        tbody.innerHTML = prestamos.map(prestamo => `
            <tr>
                <td><span class="badge bg-primary">${prestamo.codigo_prestamo}</span></td>
                <td>${prestamo.herramienta_codigo} - ${prestamo.herramienta_nombre}</td>
                <td>${prestamo.solicitante_nombre}</td>
                <td>${prestamo.departamento}</td>
                <td>
                    <span class="badge bg-info">${prestamo.cantidad}</span>
                    ${prestamo.estado === 'Activo' ? `<small class="text-muted">(pendientes)</small>` : ''}
                </td>
                <td>${this.formatDate(prestamo.fecha_salida)}</td>
                <td>${prestamo.fecha_retorno ? this.formatDate(prestamo.fecha_retorno) : '-'}</td>
                <td>
                    <span class="badge bg-${prestamo.estado === 'Activo' ? 'warning' : 'success'}">
                        ${prestamo.estado}
                    </span>
                </td>
                <td>
                    ${prestamo.estado === 'Activo' ? `
                        <button class="btn btn-sm btn-outline-success" onclick="app.devolverHerramienta(${prestamo.id})" title="Devolver" data-bs-toggle="tooltip" data-bs-placement="top">
                            <i class="fas fa-undo"></i> Devolver
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
        // Inicializar tooltips para los botones renderizados
        this.initTooltips();
    }

    async loadDevolucionesData() {
        try {
            const devoluciones = await this.apiCall('/api/devoluciones');
            console.log('Devoluciones cargadas:', devoluciones);
            this.renderDevolucionesTable(devoluciones);
        } catch (error) {
            console.error('Error loading devoluciones:', error);
            this.showAlert('Error al cargar devoluciones: ' + error.message, 'error');
        }
    }

    renderDevolucionesTable(devoluciones) {
        const tbody = document.querySelector('#devoluciones-table tbody');
        if (!tbody) {
            console.error('Tabla de devoluciones no encontrada');
            return;
        }

        if (!devoluciones || devoluciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay devoluciones registradas</td></tr>';
            return;
        }

        tbody.innerHTML = devoluciones.map(devolucion => `
            <tr>
                <td><span class="badge bg-success">${devolucion.codigo_devolucion || 'N/A'}</span></td>
                <td><span class="badge bg-primary">${devolucion.codigo_prestamo || 'N/A'}</span></td>
                <td>${devolucion.nombre_herramienta || 'N/A'}</td>
                <td>${devolucion.solicitante || 'N/A'}</td>
                <td>${devolucion.cantidad || 0}</td>
                <td>${this.formatDate(devolucion.fecha_prestamo)}</td>
                <td>${this.formatDate(devolucion.fecha_devolucion)}</td>
                <td>${devolucion.dias_uso || 0} días</td>
                <td><span class="badge bg-info">${devolucion.estado_herramienta || 'Buena'}</span></td>
            </tr>
        `).join('');
    }

    async loadReportesData() {
        try {
            const resumen = await this.apiCall('/api/resumen');
            this.renderResumenTable(resumen);
        } catch (error) {
            console.error('Error loading reportes:', error);
        }
    }

    renderResumenTable(resumen) {
        const tbody = document.querySelector('#resumen-table tbody');
        if (!tbody) return;

        tbody.innerHTML = resumen.map(item => {
            const disponibilidadClass = item.porcentaje_disponible >= 70 ? 'success' : 
                                      item.porcentaje_disponible >= 40 ? 'warning' : 'danger';

            return `
                <tr>
                    <td><strong>${item.codigo}</strong></td>
                    <td>${item.nombre}</td>
                    <td>${item.categoria}</td>
                    <td>${item.stock_total}</td>
                    <td><span class="text-success">${item.en_bodega}</span></td>
                    <td><span class="text-warning">${item.prestadas}</span></td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar bg-${disponibilidadClass}" 
                                 style="width: ${item.porcentaje_disponible}%">
                                ${item.porcentaje_disponible}%
                            </div>
                        </div>
                    </td>
                    <td><span class="badge bg-success">${item.estado}</span></td>
                </tr>
            `;
        }).join('');
    }

    async loadCategorias() {
        try {
            const categorias = await this.apiCall('/api/categorias');
            this.updateSelectOptions('categoria', categorias, 'id', 'nombre');
            this.updateSelectOptions('prestamo-categoria', categorias, 'id', 'nombre');
        } catch (error) {
            console.error('Error loading categorias:', error);
        }
    }

    async loadHerramientas() {
        try {
            const herramientas = await this.apiCall('/api/herramientas');
            const herramientasDisponibles = herramientas.filter(h => h.en_bodega > 0);
            this.updateSelectOptions('prestamo-herramienta', herramientasDisponibles, 'id', 'nombre', 'codigo');
        } catch (error) {
            console.error('Error loading herramientas:', error);
        }
    }

    async loadSolicitantes() {
        try {
            const solicitantes = await this.apiCall('/api/solicitantes');
            this.updateSelectOptions('prestamo-solicitante', solicitantes, 'id', 'nombre');
        } catch (error) {
            console.error('Error loading solicitantes:', error);
        }
    }

    async loadPrestamosActivos() {
        try {
            const prestamos = await this.apiCall('/api/prestamos/activos');
            //console.log('Préstamos activos cargados:', prestamos);
            
            if (!prestamos || prestamos.length === 0) {
                console.log('No hay préstamos activos para devolver');
                return;
            }
            
            // Update custom display for prestamos in devolucion modal
            prestamos.forEach(prestamo => {
                prestamo.descripcion_custom = `${prestamo.codigo_prestamo} - ${prestamo.herramienta_nombre} (${prestamo.solicitante_nombre}) - Cantidad: ${prestamo.cantidad}`;
            });
            
            this.updateSelectOptionsConDatos('devolucion-prestamo', prestamos, 'id', 'descripcion_custom', 'cantidad');
        } catch (error) {
            console.error('Error loading prestamos activos:', error);
        }
    }

    async loadEstadisticas() {
        try {
            return await this.apiCall('/api/estadisticas');
        } catch (error) {
            console.error('Error loading estadisticas:', error);
            return {};
        }
    }

    updateSelectOptions(selectId, items, valueField, textField, extraField = null) {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Seleccione...</option>';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            
            if (extraField) {
                option.textContent = `${item[extraField]} - ${item[textField]}`;
            } else {
                option.textContent = item[textField];
            }
            
            select.appendChild(option);
        });
    }

    openCreateSolicitanteModal() {
        const modalHtml = `
            <div class="modal fade" id="createSolicitanteModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Nuevo Solicitante</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="createSolicitanteForm">
                                <div class="mb-3">
                                    <label for="new-solicitante-nombre" class="form-label">Nombre completo</label>
                                    <input type="text" class="form-control" id="new-solicitante-nombre" required>
                                </div>
                                <div class="mb-3">
                                    <label for="new-solicitante-departamento" class="form-label">Departamento</label>
                                    <input type="text" class="form-control" id="new-solicitante-departamento" required>
                                </div>
                                <div class="mb-3">
                                    <label for="new-solicitante-telefono" class="form-label">Teléfono</label>
                                    <input type="text" class="form-control" id="new-solicitante-telefono">
                                </div>
                                <div class="mb-3">
                                    <label for="new-solicitante-email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="new-solicitante-email">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="guardar-solicitante-btn">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insertar modal y mostrarlo
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('createSolicitanteModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Guardar evento
        document.getElementById('guardar-solicitante-btn').addEventListener('click', async () => {
            const nombre = document.getElementById('new-solicitante-nombre').value.trim();
            const departamento = document.getElementById('new-solicitante-departamento').value.trim();
            const telefono = document.getElementById('new-solicitante-telefono').value.trim();
            const email = document.getElementById('new-solicitante-email').value.trim();

            if (!nombre || !departamento) {
                alert('Nombre y departamento son requeridos');
                return;
            }

            try {
                const data = { nombre, departamento, telefono, email };
                const response = await this.apiCall('/api/solicitantes', 'POST', data);
                // Añadir opción al select y seleccionarla
                const select = document.getElementById('prestamo-solicitante');
                if (select) {
                    const option = document.createElement('option');
                    option.value = response.id;
                    option.textContent = response.message ? `${nombre}` : nombre;
                    select.appendChild(option);
                    select.value = response.id;
                }

                this.showAlert('Solicitante creado', 'success');
                modal.hide();
                modalEl.remove();
                await this.loadSolicitantes();
            } catch (error) {
                console.error('Error creando solicitante:', error);
                this.showAlert('Error al crear solicitante: ' + error.message, 'error');
            }
        }, { once: true });

        // Limpiar modal al cerrarse
        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
        }, { once: true });
    }

    async openBackupModal() {
        try {
            const modalHtml = `
                <div class="modal fade" id="backupModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Backups de la base de datos</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="d-flex mb-3">
                                    <button class="btn btn-primary me-2" id="create-backup-btn"><i class="fas fa-database me-2"></i>Crear backup</button>
                                    <div id="backup-status" class="align-self-center"></div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-hover" id="backups-list-table">
                                        <thead class="table-light">
                                            <tr><th>Archivo</th><th>Tamaño</th><th>Modificado</th><th>Acciones</th></tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalEl = document.getElementById('backupModal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            const tbody = modalEl.querySelector('#backups-list-table tbody');

            const loadList = async () => {
                try {
                    const list = await this.apiCall('/backups');
                    tbody.innerHTML = list.map(b => `
                        <tr>
                            <td>${b.file}</td>
                            <td>${(b.size/1024).toFixed(1)} KB</td>
                            <td>${new Date(b.mtime).toLocaleString()}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-success me-1" data-file="${b.file}" data-action="restore">Restaurar</button>
                                <a class="btn btn-sm btn-outline-secondary" href="/backups/${b.file}" download>Descargar</a>
                            </td>
                        </tr>
                    `).join('');
                    this.initTooltips();
                } catch (err) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-danger">Error cargando backups</td></tr>';
                    console.error('Error listando backups:', err);
                }
            };

            modalEl.querySelector('#create-backup-btn').addEventListener('click', async () => {
                try {
                    modalEl.querySelector('#backup-status').textContent = 'Creando...';
                    await this.apiCall('/backup', 'POST');
                    modalEl.querySelector('#backup-status').textContent = 'Backup creado';
                    await loadList();
                    setTimeout(() => modalEl.querySelector('#backup-status').textContent = '', 2000);
                } catch (err) {
                    modalEl.querySelector('#backup-status').textContent = 'Error';
                    console.error('Error creando backup:', err);
                }
            });

            modalEl.addEventListener('click', async (e) => {
                const btn = e.target.closest('button[data-action="restore"]');
                if (!btn) return;
                const filename = btn.getAttribute('data-file');
                if (!confirm(`Restaurar backup ${filename}? Esto reemplazará la base de datos actual.`)) return;
                try {
                    await this.apiCall('/restore', 'POST', { filename });
                    this.showAlert('Backup restaurado. El servidor reiniciará la conexión.', 'success');
                    await loadList();
                } catch (err) {
                    console.error('Error restaurando backup:', err);
                    this.showAlert('Error al restaurar backup: ' + err.message, 'error');
                }
            });

            await loadList();

            modalEl.addEventListener('hidden.bs.modal', () => {
                modalEl.remove();
            }, { once: true });
        } catch (err) {
            console.error('openBackupModal error:', err);
            this.showAlert('Error abriendo modal backups: ' + err.message, 'error');
        }
    }

    // Crear categoría desde modal
    async openCreateCategoriaModal() {
        const modalHtml = `
            <div class="modal fade" id="createCategoriaModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Nueva Categoría</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="createCategoriaForm">
                                <div class="mb-3">
                                    <label for="new-categoria-nombre" class="form-label">Nombre</label>
                                    <input type="text" class="form-control" id="new-categoria-nombre" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="guardar-categoria-btn">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('createCategoriaModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        document.getElementById('guardar-categoria-btn').addEventListener('click', async () => {
            const nombre = document.getElementById('new-categoria-nombre').value.trim();
            if (!nombre) {
                alert('Nombre requerido');
                return;
            }
            try {
                const resp = await this.apiCall('/api/categorias', 'POST', { nombre });
                // recargar categorias y seleccionar la creada
                await this.loadCategorias();
                const select = document.getElementById('categoria');
                if (select && resp.id) {
                    select.value = resp.id;
                }
                this.showAlert('Categoría creada', 'success');
                modal.hide();
                modalEl.remove();
            } catch (err) {
                console.error('Error creando categoría:', err);
                this.showAlert('Error al crear categoría: ' + err.message, 'error');
            }
        }, { once: true });

        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
        }, { once: true });
    }

    async exportReport() {
        try {
            const token = localStorage.getItem('authToken');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/export/report.xlsx', { method: 'GET', headers });
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `Error ${response.status}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'report.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.showAlert('Descarga iniciada: report.xlsx', 'success');
        } catch (err) {
            console.error('exportReport error:', err);
            this.showAlert('Error al exportar: ' + err.message, 'error');
        }
    }

    updateSelectOptionsConDatos(selectId, items, valueField, textField, dataField) {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Seleccione...</option>';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            
            // Agregar data attributes adicionales
            option.dataset.cantidad = item[dataField] || 1;
            
            select.appendChild(option);
        });
    }

    actualizarCantidadMaxima() {
        const herramientaSelect = document.getElementById('prestamo-herramienta');
        const cantidadInput = document.getElementById('prestamo-cantidad');
        
        if (herramientaSelect.value) {
            const selectedOption = herramientaSelect.options[herramientaSelect.selectedIndex];
            const disponible = parseInt(selectedOption.dataset.disponible) || 1;
            cantidadInput.max = disponible;
            cantidadInput.placeholder = `Máximo: ${disponible}`;
        }
    }

    actualizarCantidadMaximaDevolucion() {
        const prestamoSelect = document.getElementById('devolucion-prestamo');
        const cantidadInput = document.getElementById('devolucion-cantidad');
        const maxSpan = document.getElementById('devolucion-max');
        
        if (prestamoSelect.value) {
            // Obtener la información del préstamo seleccionado
            const selectedOption = prestamoSelect.options[prestamoSelect.selectedIndex];
            const cantidadMaxima = parseInt(selectedOption.dataset.cantidad) || 1;
            
            cantidadInput.max = cantidadMaxima;
            cantidadInput.value = Math.min(1, cantidadMaxima);
            maxSpan.textContent = cantidadMaxima;
            cantidadInput.placeholder = `Máximo: ${cantidadMaxima}`;
        } else {
            maxSpan.textContent = '-';
            cantidadInput.placeholder = 'Seleccione un préstamo';
        }
    }

    async saveHerramienta() {
        const form = document.getElementById('herramientaForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            codigo: document.getElementById('codigo').value,
            nombre: document.getElementById('nombre').value,
            categoria_id: document.getElementById('categoria').value,
            stock_total: parseInt(document.getElementById('stock').value),
            estado: document.getElementById('estado').value
        };

        try {
            if (this.editingHerramientaId) {
                // Actualizar herramienta existente
                await this.apiCall(`/api/herramientas/${this.editingHerramientaId}`, 'PUT', data);
                this.showAlert('Herramienta actualizada exitosamente', 'success');
                this.editingHerramientaId = null;
            } else {
                // Crear nueva herramienta
                await this.apiCall('/api/herramientas', 'POST', data);
                this.showAlert('Herramienta creada exitosamente', 'success');
            }
            // Cerrar modal y refrescar datos
            const modalEl = document.getElementById('herramientaModal');
            bootstrap.Modal.getInstance(modalEl)?.hide();
            form.reset();
            await this.loadInventarioData();
            await this.loadDashboardData();
        } catch (error) {
            this.showAlert('Error al guardar herramienta: ' + error.message, 'error');
        }
    }

    async savePrestamo() {
        const form = document.getElementById('prestamoForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            herramienta_id: parseInt(document.getElementById('prestamo-herramienta').value),
            solicitante_id: parseInt(document.getElementById('prestamo-solicitante').value),
            cantidad: parseInt(document.getElementById('prestamo-cantidad').value),
            fecha_salida: document.getElementById('prestamo-fecha-salida').value,
            fecha_retorno: document.getElementById('prestamo-fecha-retorno').value,
            observaciones: document.getElementById('prestamo-observaciones').value
        };

        try {
            await this.apiCall('/api/prestamos', 'POST', data);
            this.showAlert('Préstamo registrado exitosamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('prestamoModal')).hide();
            form.reset();
            await this.loadPrestamosData();
            await this.loadDashboardData();
        } catch (error) {
            this.showAlert('Error al registrar préstamo: ' + error.message, 'error');
        }
    }

    async saveDevolucion() {
        const form = document.getElementById('devolucionForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            prestamo_id: parseInt(document.getElementById('devolucion-prestamo').value),
            cantidad: parseInt(document.getElementById('devolucion-cantidad').value),
            fecha_devolucion: document.getElementById('devolucion-fecha').value,
            estado_herramienta: document.getElementById('devolucion-estado').value,
            observaciones: document.getElementById('devolucion-observaciones').value
        };

        try {
            await this.apiCall('/api/devoluciones', 'POST', data);
            this.showAlert('Devolución registrada exitosamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('devolucionModal')).hide();
            form.reset();
            await this.loadDevolucionesData();
            await this.loadPrestamosData();
            await this.loadDashboardData();
        } catch (error) {
            this.showAlert('Error al registrar devolución: ' + error.message, 'error');
        }
    }

    prestarHerramienta(herramientaId) {
        // Abrir modal de préstamo con la herramienta preseleccionada
        document.getElementById('prestamo-herramienta').value = herramientaId;
        this.actualizarCantidadMaxima();
        new bootstrap.Modal(document.getElementById('prestamoModal')).show();
    }

    devolverHerramienta(prestamoId) {
        // Abrir modal de devolución con el préstamo preseleccionado
        document.getElementById('devolucion-prestamo').value = prestamoId;
        new bootstrap.Modal(document.getElementById('devolucionModal')).show();
    }

    async saveRegistro() {
        const form = document.getElementById('registroForm');
        
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-password-confirm').value;
        
        if (password !== confirmPassword) {
            this.showAlert('Las contraseñas no coinciden', 'error');
            return;
        }
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            nombre: document.getElementById('reg-nombre').value,
            departamento: document.getElementById('reg-departamento').value,
            telefono: document.getElementById('reg-telefono').value,
            email: document.getElementById('reg-email').value,
            usuario: document.getElementById('reg-usuario').value,
            password: password
        };

        try {
            const response = await this.apiCall('/api/registro', 'POST', data);
            this.showAlert('Usuario registrado exitosamente', 'success');
            form.reset();
            
            // Opcional: Redirigir a otra página después del registro
            setTimeout(() => {
                this.showPage('dashboard');
            }, 2000);
            
        } catch (error) {
            this.showAlert('Error al registrar usuario: ' + error.message, 'error');
        }
    }

    async logout() {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                await this.apiCall('/api/auth/logout', 'POST');
            }
        } catch (error) {
            console.error('Error en logout:', error);
        } finally {
            localStorage.removeItem('authToken');
            localStorage.removeItem('usuario');
            window.location.href = '/login.html';
        }
    }

    startSessionTimer() {
        this.timeRemaining = 15 * 60; // Reiniciar a 15 minutos
        
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
        }
        
        this.updateSessionTimerDisplay();
        
        this.sessionTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateSessionTimerDisplay();
            
            if (this.timeRemaining <= 300) { // 5 minutos
                document.getElementById('session-timer').classList.add('warning');
            }
            
            if (this.timeRemaining <= 60) { // 1 minuto
                this.showAlert('Tu sesión expirará en 1 minuto. Guarda tu trabajo.', 'warning');
            }
            
            if (this.timeRemaining <= 0) {
                this.sessionExpired();
            }
        }, 1000);
    }

    updateSessionTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timeElement = document.getElementById('time-remaining');
        if (timeElement) {
            timeElement.textContent = display;
        }
    }

    sessionExpired() {
        clearInterval(this.sessionTimer);
        this.showAlert('Tu sesión ha expirado. Redirigiendo al login...', 'warning');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }

    showChangePasswordModal() {
        // Mostrar modal para cambiar contraseña
        const modalHtml = `
            <div class="modal fade" id="changePasswordModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Cambiar Contraseña</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="changePasswordForm">
                                <div class="mb-3">
                                    <label for="current-password" class="form-label">Contraseña Actual</label>
                                    <input type="password" class="form-control" id="current-password" required>
                                </div>
                                <div class="mb-3">
                                    <label for="new-password" class="form-label">Nueva Contraseña</label>
                                    <input type="password" class="form-control" id="new-password" required minlength="6">
                                </div>
                                <div class="mb-3">
                                    <label for="confirm-password" class="form-label">Confirmar Nueva Contraseña</label>
                                    <input type="password" class="form-control" id="confirm-password" required minlength="6">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="save-password">Cambiar Contraseña</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
        
        // Configurar eventos
        document.getElementById('save-password').addEventListener('click', () => this.changePassword());
        
        // Limpiar modal cuando se cierra
        document.getElementById('changePasswordModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('changePasswordModal').remove();
        });
    }

    async changePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            this.showAlert('Las contraseñas nuevas no coinciden', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showAlert('La nueva contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        try {
            await this.apiCall('/api/auth/change-password', 'POST', {
                currentPassword,
                newPassword
            });
            
            this.showAlert('Contraseña cambiada exitosamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
            
        } catch (error) {
            this.showAlert('Error al cambiar contraseña: ' + error.message, 'error');
        }
    }

    showProfileModal() {
        const modalHtml = `
            <div class="modal fade" id="profileModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Mi Perfil</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <div class="mb-3">
                                    <i class="fas fa-user-circle" style="font-size: 4rem; color: #667eea;"></i>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-6">
                                    <strong>Nombre:</strong><br>
                                    <span>${this.usuario.nombre_completo}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Usuario:</strong><br>
                                    <span>${this.usuario.nombre_usuario}</span>
                                </div>
                            </div>
                            <hr>
                            <div class="row">
                                <div class="col-6">
                                    <strong>Departamento:</strong><br>
                                    <span>${this.usuario.departamento}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Rol:</strong><br>
                                    <span class="badge bg-primary">${this.usuario.rol}</span>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('profileModal'));
        modal.show();
        
        document.getElementById('profileModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('profileModal').remove();
        });
    }

    editHerramienta(herramientaId) {
        (async () => {
            try {
                console.log('Editar herramienta:', herramientaId);
                const herramienta = await this.apiCall(`/api/herramientas/${herramientaId}`);

                // Guardar id en estado para que saveHerramienta haga PUT
                this.editingHerramientaId = herramientaId;

                // Rellenar formulario
                document.getElementById('codigo').value = herramienta.codigo || '';
                document.getElementById('nombre').value = herramienta.nombre || '';
                document.getElementById('categoria').value = herramienta.categoria_id || '';
                document.getElementById('stock').value = herramienta.stock_total || 0;
                document.getElementById('estado').value = herramienta.estado || 'Activo';

                // Cambiar título del modal y abrirlo
                const modalEl = document.getElementById('herramientaModal');
                const titleEl = modalEl.querySelector('.modal-title');
                if (titleEl) titleEl.textContent = 'Editar Herramienta';

                // Mostrar modal
                new bootstrap.Modal(modalEl).show();

                // Cuando se cierre el modal, resetear editingHerramientaId y título
                modalEl.addEventListener('hidden.bs.modal', () => {
                    this.editingHerramientaId = null;
                    titleEl && (titleEl.textContent = 'Nueva Herramienta');
                    document.getElementById('herramientaForm').reset();
                }, { once: true });

            } catch (error) {
                console.error('Error abriendo modal de edición:', error);
                this.showAlert('Error al cargar datos de la herramienta: ' + error.message, 'error');
            }
        })();
    }

    async deleteHerramienta(herramientaId) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta herramienta? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await this.apiCall(`/api/herramientas/${herramientaId}`, 'DELETE');
            this.showAlert('Herramienta eliminada exitosamente', 'success');
            await this.loadInventarioData();
            await this.loadDashboardData();
        } catch (error) {
            console.error('Error eliminando herramienta:', error);
            this.showAlert('Error al eliminar herramienta: ' + error.message, 'error');
        }
    }

    buscarHerramienta(termino) {
        const rows = document.querySelectorAll('#inventario-table tbody tr');
        termino = termino.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(termino) ? '' : 'none';
        });
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const fechaSalida = document.getElementById('prestamo-fecha-salida');
        const fechaDevolucion = document.getElementById('devolucion-fecha');
        
        if (fechaSalida) fechaSalida.value = today;
        if (fechaDevolucion) fechaDevolucion.value = today;
    }

    // Implementación duplicada de apiCall eliminada: la aplicación usa la versión
    // definida al inicio de `public/app.js`, que añade el header Authorization.

    showAlert(message, type = 'info') {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alert);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new HerramientasApp();
});