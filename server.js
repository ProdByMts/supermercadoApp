const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json()); // Permite recibir datos en formato JSON desde la web
app.use(express.static('public')); // Permite que el servidor muestre los archivos de la carpeta "public"

// Conexión a la base de datos MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error fatal conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado exitosamente a la base de datos MySQL db_supermercado.');
});

// Ruta web de prueba
app.get('/', (req, res) => {
    res.send('¡El servidor del supermercado está funcionando correctamente!');
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;

// --- RUTAS DE USUARIOS ---

// 1. Registrar un nuevo usuario
app.post('/registro', async (req, res) => {
    // Recibimos los datos que nos envía el cliente
    const { nombre, email, password, rol_id } = req.body;

    try {
        // Encriptamos la contraseña (le damos 10 vueltas de seguridad)
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        // Preparamos la consulta SQL
        const query = 'INSERT INTO usuarios (nombre, email, password, rol_id) VALUES (?, ?, ?, ?)';
        
        // Ejecutamos la consulta
        db.query(query, [nombre, email, passwordEncriptada, rol_id], (err, result) => {
            if (err) {
                console.error('Error al guardar el usuario:', err);
                return res.status(500).json({ error: 'Error al registrar el usuario en la base de datos.' });
            }
            res.status(201).json({ mensaje: '¡Usuario registrado exitosamente!' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- MIDDLEWARES DE SEGURIDAD ---

// 1. Guardia que verifica si el usuario tiene un Token válido
const verificarToken = (req, res, next) => {
    // Leemos el token que viene en la cabecera de la petición
    const token = req.headers['authorization'];
    
    if (!token) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere un token.' });
    }

    // Verificamos si el token es real y no ha expirado
    jwt.verify(token, process.env.JWT_SECRET, (err, usuarioDecodificado) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }
        // Si es válido, guardamos los datos del usuario en la petición y lo dejamos pasar
        req.usuario = usuarioDecodificado;
        next(); 
    });
};

// 2. Guardia que verifica si el usuario es Admin(1) o Reponedor(2)
const soloEmpleados = (req, res, next) => {
    if (req.usuario.rol_id === 1 || req.usuario.rol_id === 2) {
        next(); // Tiene el rol correcto, pasa
    } else {
        res.status(403).json({ error: 'Acceso denegado. Solo para administradores o reponedores.' });
    }
};

// 2. Iniciar Sesión (Login)
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Buscar al usuario por su email
    const query = 'SELECT * FROM usuarios WHERE email = ?';
    
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error en el servidor.' });
        }

        // Si no encuentra ningún usuario con ese email
        if (results.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }

        const usuario = results[0];

        // Comparar la contraseña ingresada con la que está encriptada en la BD
        const passwordCorrecta = await bcrypt.compare(password, usuario.password);
        
        if (!passwordCorrecta) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }

        // Si todo está bien, creamos el Token (JWT)
        // Guardamos dentro del token el ID del usuario y su ROL
        const token = jwt.sign(
            { id: usuario.id, rol_id: usuario.rol_id },
            process.env.JWT_SECRET,
            { expiresIn: '2h' } // El token expira en 2 horas
        );

        // Devolvemos el token y los datos básicos al cliente
        res.json({
            mensaje: '¡Login exitoso!',
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                rol_id: usuario.rol_id
            }
        });
    });
});

// --- RUTAS DE PRODUCTOS ---

// 1. Ver catálogo de productos (Cualquier usuario con Token puede entrar)
app.get('/productos', verificarToken, (req, res) => {
    db.query('SELECT * FROM productos', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener los productos.' });
        }
        res.json(results);
    });
});

// 2. Ingresar un nuevo producto (Solo Admin o Reponedor)
app.post('/productos', verificarToken, soloEmpleados, (req, res) => {
    const { nombre, descripcion, precio, stock } = req.body;
    
    const query = 'INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)';
    
    db.query(query, [nombre, descripcion, precio, stock], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al guardar el producto.' });
        }
        res.status(201).json({ 
            mensaje: 'Producto ingresado al inventario con éxito.', 
            producto_id: result.insertId 
        });
    });
});

// 3. Comprar un producto (Cualquier usuario logueado)
app.post('/productos/comprar', verificarToken, (req, res) => {
    const { producto_id, cantidad } = req.body;
    
    // Aquí capturamos los datos para la auditoría:
    const usuario_id = req.usuario.id; // El "Quién" (viene guardado en el Token)
    const ip_origen = req.ip || req.headers['x-forwarded-for']; // El "Dónde" (IP del cliente)

    // Primero: Verificar si el producto existe y tiene stock suficiente
    db.query('SELECT stock FROM productos WHERE id = ?', [producto_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error en el servidor.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'El producto no existe.' });
        }

        const stockActual = results[0].stock;

        if (stockActual < cantidad) {
            return res.status(400).json({ error: 'Stock insuficiente para realizar la compra.' });
        }

        // Segundo: Restar el stock del producto
        const queryRestarStock = 'UPDATE productos SET stock = stock - ? WHERE id = ?';
        db.query(queryRestarStock, [cantidad, producto_id], (err, updateResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al procesar el stock.' });
            }

            // Tercero: Guardar el rastro en la tabla auditoria_log
            // (MySQL se encarga del "Cuándo" automáticamente gracias al DEFAULT CURRENT_TIMESTAMP)
            const queryLog = 'INSERT INTO auditoria_log (usuario_id, accion, producto_id, cantidad, ip_origen) VALUES (?, ?, ?, ?, ?)';
            
            db.query(queryLog, [usuario_id, 'COMPRA', producto_id, cantidad, ip_origen], (err, logResult) => {
                if (err) {
                    console.error('Error crítico al guardar la auditoría:', err);
                    // No bloqueamos al usuario si la compra fue exitosa, pero lo dejamos en los logs del servidor
                }
                
                res.json({ 
                    mensaje: '¡Compra procesada con éxito y registrada en el historial!' 
                });
            });
        });
    });
});

// 4. Cambiar rol de un usuario (Acceso exclusivo para el Administrador)
app.put('/usuarios/:id/rol', verificarToken, (req, res) => {
    // Verificamos si el usuario que hace la petición es Admin (rol_id = 1)
    if (req.usuario.rol_id !== 1) {
        return res.status(403).json({ error: 'Acceso denegado. Solo el administrador puede asignar roles.' });
    }

    const idUsuarioAfectado = req.params.id;
    const { nuevo_rol_id } = req.body;

    const query = 'UPDATE usuarios SET rol_id = ? WHERE id = ?';
    
    db.query(query, [nuevo_rol_id, idUsuarioAfectado], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al actualizar el rol en la base de datos.' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({ mensaje: '¡El rol del usuario ha sido actualizado correctamente!' });
    });
});

// 5. Ver el historial de auditoría (Solo para Administradores)
app.get('/auditoria', verificarToken, (req, res) => {
    // Verificamos que sea Admin (rol_id = 1)
    if (req.usuario.rol_id !== 1) {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden ver el historial.' });
    }

    // Unimos las tablas para mostrar los nombres en lugar de solo los IDs
    const query = `
        SELECT a.id, u.nombre AS usuario, a.accion, p.nombre AS producto, a.cantidad, a.fecha_hora, a.ip_origen
        FROM auditoria_log a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        LEFT JOIN productos p ON a.producto_id = p.id
        ORDER BY a.fecha_hora DESC
        LIMIT 20
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al cargar el historial.' });
        }
        res.json(results);
    });
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
