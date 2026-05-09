import { guardRoute, requirePermiso, getUsuarioActual } from "./auth.js";
import { escucharCategorias, getEmoji, estadoStock } from "./catalogo.js";
import { db, auth } from "./firebase-config.js";
import { formatearMoneda, ajustarStock } from "./operaciones.js";
import {
  collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

guardRoute();
requirePermiso("ajustar_inventario");
const estado = {
  categorias: [],
  productos: [],
  termino: "",
  productoSeleccionado: "",
};

const $ = (id) => document.getElementById(id);
const lista = $("lista-ajustes");
const alerta = $("alerta-ajustes");
const buscador = $("buscador-ajustes");
const formulario = $("form-ajuste");
const boton = $("btn-ajustar-stock");

function mostrarAlerta(tipo, mensaje) {
  alerta.textContent = mensaje;
  alerta.className = `alerta alerta-${tipo} show`;
  alerta.style.display = "block";
}

function ocultarAlerta() {
  alerta.className = "alerta alerta-error";
  alerta.style.display = "none";
  alerta.textContent = "";
}

function renderProductos() {
  const termino = estado.termino.toLowerCase().trim();
  lista.innerHTML = "";

  const productosFiltrados = estado.productos.filter((prod) => !termino || prod.nombre.toLowerCase().includes(termino));

  if (productosFiltrados.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🔍</div>
        <p>No hay productos disponibles para ajustar.</p>
      </div>`;
    return;
  }

  estado.categorias.forEach((categoria) => {
    const productosCategoria = productosFiltrados.filter((prod) => prod.categoriaId === categoria.id);
    if (productosCategoria.length === 0) return;

    const seccion = document.createElement("div");
    seccion.className = "seccion-cat";

    const titulo = document.createElement("div");
    titulo.className = "seccion-cat-titulo";
    titulo.innerHTML = `<span style="font-size:20px;">${getEmoji(categoria.iconoId)}</span>${categoria.nombre}`;
    seccion.appendChild(titulo);

    const grid = document.createElement("div");
    grid.className = "ajuste-grid";

    productosCategoria.forEach((prod) => {
      const estadoStockProd = estadoStock(prod.stock ?? 0, prod.alertaMinima ?? 0);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `ajuste-card ${estadoSeleccionado(prod.id) ? "seleccionado" : ""}`;
      card.innerHTML = `
        <div class="ajuste-icono">${getEmoji(prod.iconoId)}</div>
        <div class="ajuste-info">
          <div class="ajuste-nombre">${prod.nombre}</div>
          <div class="ajuste-meta">Stock ${prod.stock ?? 0} · ${estadoStockProd}</div>
        </div>`;
      card.addEventListener("click", () => {
        estado.productoSeleccionado = prod.id;
        renderProductos();
        $("producto-seleccionado").textContent = `${prod.nombre} · stock ${prod.stock ?? 0}`;
      });
      grid.appendChild(card);
    });

    seccion.appendChild(grid);
    lista.appendChild(seccion);
  });
}

function estadoSeleccionado(id) {
  return estado.productoSeleccionado === id;
}

async function guardarAjuste(event) {
  const btn = document.getElementById("btn-ajustar-stock");

  event.preventDefault();
  ocultarAlerta();

  // Evitar múltiples clics
  if (btn.disabled) return;

  if (!estado.productoSeleccionado) {
    mostrarAlerta("aviso", "Selecciona un producto.");
    return;
  }

  // Bloquear el botón y cambiar texto
  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = "⏳ Ajustando...";

  try {
    const usuarioActual = auth.currentUser;
    if (!usuarioActual) {
      mostrarAlerta("error", "No se pudo identificar al usuario. Intenta iniciar sesión de nuevo.");
      return;
    }

    await ajustarStock({
      usuarioId: usuarioActual.uid,
      productoId: estado.productoSeleccionado,
      cantidad: $("cantidad-ajuste").value,
      tipo: $("tipo-ajuste").value,
      motivo: $("motivo-ajuste").value.trim(),
    });

    mostrarAlerta("success", "Ajuste registrado correctamente.");
    $("cantidad-ajuste").value = "";
    $("motivo-ajuste").value = "";
  } catch (error) {
    mostrarAlerta("error", error.message || "No se pudo registrar el ajuste.");
  } finally {
    // Reactivar el botón en caso de error o al terminar
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

escucharCategorias((cats) => {
  estado.categorias = cats;
  renderProductos();
});

onSnapshot(
  query(collection(db, "productos"), where("activo", "==", true)),
  (snap) => {
    estado.productos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!estado.productoSeleccionado && estado.productos.length > 0) {
      estado.productoSeleccionado = estado.productos[0].id;
      $("producto-seleccionado").textContent = `${estado.productos[0].nombre} · stock ${estado.productos[0].stock ?? 0}`;
    }
    renderProductos();
  }
);

buscador.addEventListener("input", (event) => {
  estado.termino = event.target.value;
  renderProductos();
});

formulario.addEventListener("submit", guardarAjuste);
