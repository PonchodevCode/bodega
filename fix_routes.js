const fs = require('fs');

// Leer el archivo actual
let content = fs.readFileSync('server.js', 'utf8');

// Función para corregir rutas malformadas
function fixRoutes(text) {
    // Patrón para encontrar rutas malformadas
    const badRoutePattern = /auth\.authenticate\(\), app\.(get|post|put) (\/api\/[^']+)', (.*?auth\.authenticate\(\))?, \((req, res\) => \{/g;
    
    // Reemplazar con formato correcto
    return text.replace(badRoutePattern, (match, method, route, extraAuth) => {
        // Determinar si necesita authorize
        if (extraAuth && extraAuth.includes('authorize')) {
            return `app.${method}('${route}', auth.authenticate(), ${extraAuth}, (req, res) => {`;
        }
        return `app.${method}('${route}', auth.authenticate(), (req, res) => {`;
    });
}

// Aplicar correcciones
content = fixRoutes(content);

// Corrección adicional para casos específicos
const specificFixes = [
    // Rutas sin comillas iniciales
    { 
        search: /auth\.authenticate\(\), app\.(get|post|put) (\/api\/[^']+)', \((req, res\) => \{/g,
        replace: 'app.$1(\'$2\', auth.authenticate(), (req, res) => {'
    },
    // Rutas con authorize específico
    {
        search: /app\.(get|post|put)('(\/api\/herramientas)', auth\.authenticate\(\), auth\.authorize\(\['admin', 'supervisor'\]\), \((req, res\) => \{/g,
        replace: 'app.post(\'/api/herramientas\', auth.authenticate(), auth.authorize([\'admin\', \'supervisor\']), (req, res) => {'
    }
];

specificFixes.forEach(fix => {
    content = content.replace(fix.search, fix.replace);
});

// Escribir archivo corregido
fs.writeFileSync('server.js', content);

console.log('Rutas corregidas exitosamente');

// Verificar cuántas rutas tienen auth correctamente
const authRoutes = content.match(/app\.(get|post|put)\('\/api\//g) || [];
console.log(`Total de rutas API: ${authRoutes.length}`);

const protectedRoutes = content.match(/auth\.authenticate\(\)/g) || [];
console.log(`Rutas protegidas: ${protectedRoutes.length}`);