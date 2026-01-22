const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Ruta a la base de datos
const dbPath = './database/herramientas.db';

// Eliminar base de datos existente si existe
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Base de datos existente eliminada');
}

// Crear nueva base de datos
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al crear la base de datos:', err.message);
        process.exit(1);
    }
    console.log('Base de datos creada exitosamente');
});

// Leer y ejecutar el schema
const schemaPath = path.join(__dirname, '../database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('Error al ejecutar el schema:', err.message);
        process.exit(1);
    }
    console.log('Schema ejecutado exitosamente');
});

// Leer y ejecutar los datos iniciales
const seedPath = path.join(__dirname, '../database/seed.sql');
const seed = fs.readFileSync(seedPath, 'utf8');

db.exec(seed, (err) => {
    if (err) {
        console.error('Error al insertar datos iniciales:', err.message);
        process.exit(1);
    }
    console.log('Datos iniciales insertados exitosamente');
});

// Verificar datos insertados
const queries = [
    'SELECT COUNT(*) as count FROM herramientas',
    'SELECT COUNT(*) as count FROM categorias',
    'SELECT COUNT(*) as count FROM solicitantes',
    'SELECT COUNT(*) as count FROM prestamos',
    'SELECT COUNT(*) as count FROM devoluciones'
];

let completed = 0;
queries.forEach(query => {
    db.get(query, [], (err, row) => {
        if (err) {
            console.error('Error al verificar datos:', err.message);
        } else {
            console.log(`Registros encontrados: ${row.count}`);
        }
        
        completed++;
        if (completed === queries.length) {
            console.log('\nBase de datos inicializada correctamente');
            console.log('Puedes iniciar el servidor con: npm run dev');
            db.close();
        }
    });
});