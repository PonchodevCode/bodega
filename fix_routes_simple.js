const fs = require('fs');

// Leer el archivo
let content = fs.readFileSync('server.js', 'utf8');

// Lista de reemplazos manuales
const replacements = [
    // Corregir rutas GET
    { 
        from: "auth.authenticate(), app.get /api/herramientas/:id', auth.authenticate(), (req, res) => {",
        to: "app.get('/api/herramientas/:id', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/categorias', (req, res) => {",
        to: "app.get('/api/categorias', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/prestamos', (req, res) => {",
        to: "app.get('/api/prestamos', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/prestamos/activos', (req, res) => {",
        to: "app.get('/api/prestamos/activos', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/devoluciones', (req, res) => {",
        to: "app.get('/api/devoluciones', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/solicitantes', (req, res) => {",
        to: "app.get('/api/solicitantes', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/resumen', (req, res) => {",
        to: "app.get('/api/resumen', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/estadisticas', (req, res) => {",
        to: "app.get('/api/estadisticas', auth.authenticate(), (req, res) => {"
    },
    
    // Corregir rutas POST
    {
        from: "auth.authenticate(), app.post /api/herramientas', auth.authenticate(), auth.authorize(['admin', 'supervisor']), (req, res) => {",
        to: "app.post('/api/herramientas', auth.authenticate(), auth.authorize(['admin', 'supervisor']), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.post /api/prestamos', (req, res) => {",
        to: "app.post('/api/prestamos', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.post /api/devoluciones', (req, res) => {",
        to: "app.post('/api/devoluciones', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.post /api/solicitantes', (req, res) => {",
        to: "app.post('/api/solicitantes', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.post /api/registro', (req, res) => {",
        to: "app.post('/api/registro', auth.authenticate(), (req, res) => {"
    },
    
    // Corregir rutas PUT
    {
        from: "auth.authenticate(), app.put /api/herramientas/:id', (req, res) => {",
        to: "app.put('/api/herramientas/:id', auth.authenticate(), (req, res) => {"
    },
    
    // Rutas de auth (sin protección circular)
    {
        from: "auth.authenticate(), app.post /api/auth/login', async (req, res) => {",
        to: "app.post('/api/auth/login', async (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/auth/verify', auth.authenticate(), (req, res) => {",
        to: "app.get('/api/auth/verify', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.post /api/auth/logout', auth.authenticate(), async (req, res) => {",
        to: "app.post('/api/auth/logout', auth.authenticate(), async (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.get /api/auth/me', auth.authenticate(), (req, res) => {",
        to: "app.get('/api/auth/me', auth.authenticate(), (req, res) => {"
    },
    {
        from: "auth.authenticate(), app.post /api/auth/change-password', auth.authenticate(), async (req, res) => {",
        to: "app.post('/api/auth/change-password', auth.authenticate(), async (req, res) => {"
    }
];

// Aplicar reemplazos
replacements.forEach(replacement => {
    content = content.replace(replacement.from, replacement.to);
});

// Escribir archivo corregido
fs.writeFileSync('server.js', content);

console.log(`Aplicados ${replacements.length} reemplazos`);

// Verificar que no queden rutas malformadas
const badPatterns = content.match(/auth\.authenticate\(\), app\./g);
if (badPatterns) {
    console.log(`ATENCIÓN: Quedan ${badPatterns.length} rutas malformadas`);
} else {
    console.log('✅ Todas las rutas están corregidas');
}

// Contar rutas protegidas
const protectedRoutes = content.match(/auth\.authenticate\(\)/g) || [];
console.log(`Total de rutas protegidas: ${protectedRoutes.length}`);