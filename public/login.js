// Sistema de Login - Frontend JavaScript

class LoginSystem {
    constructor() {
        this.sessionTimer = null;
        this.timeRemaining = 15 * 60; // 15 minutos en segundos
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    setupEventListeners() {
        // Formulario de login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Toggle password visibility
        document.getElementById('togglePassword').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // Enter key on form fields
        ['username', 'password'].forEach(fieldId => {
            document.getElementById(fieldId).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.login();
                }
            });
        });
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const passwordIcon = document.getElementById('passwordIcon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            passwordIcon.className = 'fas fa-eye';
        }
    }

    checkExistingSession() {
        const token = localStorage.getItem('authToken');
        if (token) {
            // Verificar si el token es válido
            this.verifyToken(token);
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Token válido, redirigir al sistema
                this.redirectToMain();
            } else {
                // Token inválido o expirado
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Error verificando token:', error);
            localStorage.removeItem('authToken');
        }
    }

    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Validaciones básicas
        if (!username || !password) {
            this.showError('Por favor, completa todos los campos');
            return;
        }

        // Mostrar loading
        this.setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Login exitoso
                this.showSuccess('¡Inicio de sesión exitoso! Redirigiendo...');
                
                // Guardar token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                
                // Iniciar temporizador de sesión
                this.startSessionTimer();
                
                // Redirigir después de un breve tiempo
                setTimeout(() => {
                    this.redirectToMain();
                }, 1500);
                
            } else {
                // Error en login
                this.showError(data.error || 'Error al iniciar sesión');
            }
            
        } catch (error) {
            console.error('Error en login:', error);
            this.showError('Error de conexión. Inténtalo nuevamente.');
        } finally {
            this.setLoading(false);
        }
    }

    redirectToMain() {
        window.location.href = '/';
    }

    startSessionTimer() {
        // Mostrar timer
        document.getElementById('session-timer').style.display = 'block';
        this.timeRemaining = 15 * 60; // Reiniciar a 15 minutos
        
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
        }
        
        this.sessionTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.sessionExpired();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timerElement = document.getElementById('time-remaining');
        if (timerElement) {
            timerElement.textContent = display;
        }
        
        // Cambiar color cuando quedan menos de 5 minutos
        const sessionTimerElement = document.getElementById('session-timer');
        if (this.timeRemaining <= 300) { // 5 minutos
            sessionTimerElement.style.background = '#f8d7da';
            sessionTimerElement.style.borderColor = '#f5c6cb';
            sessionTimerElement.style.color = '#721c24';
        }
    }

    sessionExpired() {
        clearInterval(this.sessionTimer);
        localStorage.removeItem('authToken');
        localStorage.removeItem('usuario');
        
        this.showError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        document.getElementById('session-timer').style.display = 'none';
    }

    setLoading(loading) {
        const spinner = document.querySelector('.loading-spinner');
        const button = document.querySelector('.btn-login');
        
        if (loading) {
            spinner.style.display = 'inline';
            button.disabled = true;
        } else {
            spinner.style.display = 'none';
            button.disabled = false;
        }
    }

    showError(message) {
        const alertElement = document.getElementById('login-alert');
        const messageElement = document.getElementById('error-message');
        
        messageElement.textContent = message;
        alertElement.style.display = 'block';
        
        // Ocultar después de 5 segundos
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        const alertElement = document.getElementById('success-alert');
        const messageElement = document.getElementById('success-message');
        
        messageElement.textContent = message;
        alertElement.style.display = 'block';
        
        // Ocultar después de 3 segundos
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 3000);
    }
}

// Inicializar el sistema de login cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new LoginSystem();
});

// Manejar cierre de pestaña o navegador
window.addEventListener('beforeunload', (e) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        // Intentar cerrar sesión en el servidor (best effort)
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }).catch(() => {
            // Ignorar errores en beforeunload
        });
    }
});