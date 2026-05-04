import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ─── ICONOS PARA CATEGORÍAS (genéricos) ──────────────────────────────────────
export const ICONOS_CATEGORIA = [
  { id: "comida",    emoji: "🍽️", label: "Comida" },
  { id: "bebidas",   emoji: "🥤", label: "Bebidas" },
  { id: "dulces",    emoji: "🍬", label: "Dulces" },
  { id: "snacks",    emoji: "🍿", label: "Snacks" },
  { id: "postres",   emoji: "🍰", label: "Postres" },
  { id: "otros",     emoji: "📦", label: "Otros" },
];

// ─── ICONOS PARA PRODUCTOS (específicos) ─────────────────────────────────────
export const ICONOS_PRODUCTO = [
  // Comidas
  { id: "hamburguesa", emoji: "🍔", label: "Hamburguesa" },
  { id: "pizza",       emoji: "🍕", label: "Pizza" },
  { id: "hotdog",      emoji: "🌭", label: "Hot Dog" },
  { id: "sandwich",    emoji: "🥪", label: "Sandwich" },
  { id: "papas",       emoji: "🍟", label: "Papas fritas" },
  { id: "pollo",       emoji: "🍗", label: "Pollo" },
  { id: "arroz",       emoji: "🍚", label: "Arroz / Plato" },
  { id: "sopa",        emoji: "🍲", label: "Sopa" },
  { id: "ensalada",    emoji: "🥗", label: "Ensalada" },
  { id: "siumai",      emoji: "🥟", label: "Siu Mai / Dim Sum" },
  { id: "nachos",      emoji: "🫔", label: "Nachos" },
  { id: "wrap",        emoji: "🌯", label: "Wrap / Burrito" },
  { id: "pudín",       emoji: "🍮", label: "Pudín / Flan" },
  // Bebidas
  { id: "soda",        emoji: "🥤", label: "Soda / Refresco" },
  { id: "agua",        emoji: "💧", label: "Agua" },
  { id: "cafe",        emoji: "☕", label: "Café" },
  { id: "jugo",        emoji: "🍹", label: "Jugo / Fresco" },
  { id: "te",          emoji: "🍵", label: "Té" },
  { id: "leche",       emoji: "🥛", label: "Leche" },
  // Dulces y postres
  { id: "helado",      emoji: "🍦", label: "Helado" },
  { id: "pastel",      emoji: "🎂", label: "Pastel / Torta" },
  { id: "galleta",     emoji: "🍪", label: "Galleta" },
  { id: "donut",       emoji: "🍩", label: "Dona" },
  { id: "paleta",      emoji: "🍭", label: "Paleta" },
  { id: "chocolate",   emoji: "🍫", label: "Chocolate" },
  { id: "dulce",       emoji: "🍬", label: "Dulce / Caramelo" },
  // Snacks
  { id: "papitas",     emoji: "🥔", label: "Papitas" },
  { id: "palomitas",   emoji: "🍿", label: "Palomitas" },
  { id: "nueces",      emoji: "🥜", label: "Nueces / Maní" },
  // Otros
  { id: "producto",    emoji: "🏷️", label: "Producto general" },
  { id: "ticket",      emoji: "🎟️", label: "Ticket / Entrada" },
  { id: "regalo",      emoji: "🎁", label: "Souvenir / Regalo" },
];

// Todos los iconos combinados para búsqueda
export const TODOS_ICONOS = [...ICONOS_CATEGORIA, ...ICONOS_PRODUCTO];

export function getEmoji(iconoId) {
  const found = TODOS_ICONOS.find(i => i.id === iconoId);
  return found ? found.emoji : "📦";
}

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
export function escucharCategorias(callback) {
  return onSnapshot(
    query(collection(db, "categorias"), orderBy("orden", "asc")),
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function crearCategoria(nombre, iconoId) {
  const snap = await getDocs(collection(db, "categorias"));
  const orden = snap.size + 1;
  return addDoc(collection(db, "categorias"), {
    nombre, iconoId, orden, creadoEn: serverTimestamp()
  });
}

export async function editarCategoria(id, nombre, iconoId) {
  return updateDoc(doc(db, "categorias", id), { nombre, iconoId });
}

export async function eliminarCategoria(id) {
  const q    = query(collection(db, "productos"),
    where("categoriaId", "==", id),
    where("activo", "==", true));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error("La categoría tiene productos activos. Desactívalos primero.");
  return deleteDoc(doc(db, "categorias", id));
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────
export function escucharProductosPorCategoria(categoriaId, callback) {
  return onSnapshot(
    query(collection(db, "productos"),
      where("categoriaId", "==", categoriaId),
      orderBy("nombre", "asc")),
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function crearProducto(datos) {
  return addDoc(collection(db, "productos"), {
    ...datos,
    stock:    0,
    activo:   true,
    creadoEn: serverTimestamp(),
  });
}

export async function editarProducto(id, datos) {
  const { nombre, iconoId, precioVenta, alertaMinima } = datos;
  return updateDoc(doc(db, "productos", id), {
    nombre, iconoId, precioVenta, alertaMinima
  });
}

export async function desactivarProducto(id) {
  return updateDoc(doc(db, "productos", id), { activo: false });
}

export async function reactivarProducto(id) {
  return updateDoc(doc(db, "productos", id), { activo: true });
}

// ─── ESTADO DEL STOCK ────────────────────────────────────────────────────────
export function estadoStock(stock, alertaMinima) {
  if (stock <= 0)            return "agotado";
  if (stock <= alertaMinima) return "alerta";
  return "ok";
}
