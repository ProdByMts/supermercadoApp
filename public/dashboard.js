// 1. Verificar que el usuario esté logueado
const token = localStorage.getItem('token');
const rolId = parseInt(localStorage.getItem('rol_id'));

if (!token) {
    // Si no hay token, lo echamos al login
    window.location.href = 'index.html';
}

// 2. Mostrar herramientas según el Rol
if (rolId === 1 || rolId === 2) {
    document.getElementById('seccionAgregar').classList.remove('oculto');
}
if (rolId === 1) {
    document.getElementById('seccionAuditoria').classList.remove('oculto');
    document.getElementById('seccionUsuarios').classList.remove('oculto'); // ¡Nueva línea!
    cargarHistorial();
}

if (rolId === 1) {
    document.getElementById('seccionAuditoria').classList.remove('oculto');
    cargarHistorial(); // Llamamos a la función que vamos a crear ahora
}

// 3. Función para cargar los productos desde el Backend
async function cargarProductos() {
    try {
        const response = await fetch('/productos', {
            headers: { 'Authorization': token }
        });
        const productos = await response.json();
        
        const contenedor = document.getElementById('contenedorProductos');
        contenedor.innerHTML = ''; // Limpiar contenedor

        productos.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card-producto';
            card.innerHTML = `
                <h4>${p.nombre}</h4>
                <p>${p.descripcion || 'Sin descripción'}</p>
                <p><strong>Precio:</strong> $${p.precio}</p>
                <p><strong>Stock:</strong> ${p.stock} u.</p>
                <button class="btn-accion" onclick="comprarProducto(${p.id})">Comprar 1 un.</button>
            `;
            contenedor.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

// 4. Función para comprar un producto directamente desde la web
window.comprarProducto = async (productoId) => {
    try {
        const response = await fetch('/productos/comprar', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ producto_id: productoId, cantidad: 1 })
        });

        const data = await response.json();
        alert(data.mensaje || data.error);
        cargarProductos(); // Recargar la lista para ver el nuevo stock
    } catch (error) {
        alert('Error al procesar la compra.');
    }
};

// 5. Manejar el envío del formulario de nuevo producto
document.getElementById('formProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('prodNombre').value;
    const descripcion = document.getElementById('prodDesc').value;
    const precio = document.getElementById('prodPrecio').value;
    const stock = document.getElementById('prodStock').value;

    const response = await fetch('/productos', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({ nombre, descripcion, precio, stock })
    });

    if (response.ok) {
        alert('Producto agregado con éxito');
        document.getElementById('formProducto').reset();
        cargarProductos(); // Recargar catálogo
    } else {
        alert('Error al agregar producto');
    }
});

// 6. Botón Cerrar Sesión
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// 7. Función para cargar el Historial de Auditoría
async function cargarHistorial() {
    try {
        const response = await fetch('/auditoria', {
            headers: { 'Authorization': token }
        });
        
        if (!response.ok) return; // Si no es admin, simplemente ignora esto

        const registros = await response.json();
        const tabla = document.getElementById('tablaAuditoria');
        tabla.innerHTML = ''; 

        registros.forEach(reg => {
            const fila = document.createElement('tr');
            // Formatear la fecha para que se vea bonita
            const fecha = new Date(reg.fecha_hora).toLocaleString();
            
            fila.innerHTML = `
                <td>${fecha}</td>
                <td>${reg.usuario || 'Desconocido'}</td>
                <td><strong>${reg.accion}</strong></td>
                <td>${reg.producto || 'N/A'}</td>
                <td>${reg.cantidad || '-'}</td>
                <td>${reg.ip_origen}</td>
            `;
            tabla.appendChild(fila);
        });
    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

// 8. Manejar el envío del formulario para registrar nuevos usuarios
document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('userNombre').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const rol_id = parseInt(document.getElementById('userRol').value);

    try {
        const response = await fetch('/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol_id })
        });

        const data = await response.json();

        if (response.ok) {
            alert('¡Usuario registrado exitosamente desde el panel!');
            document.getElementById('formUsuario').reset();
        } else {
            alert(data.error || 'Error al registrar al usuario.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor.');
    }
});

// Ejecutar al cargar la página
cargarProductos();
