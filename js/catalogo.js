import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ─── ICONOS PREDEFINIDOS POR CATEGORÍA ───────────────────────────────────────
export const ICONOS = {
  bebidas: [
    { id: "lata",      emoji: "🥤", label: "Lata / Refresco" },
    { id: "botella",   emoji: "🍶", label: "Botella" },
    { id: "agua",      emoji: "💧", label: "Agua" },
    { id: "cafe",      emoji: "☕", label: "Café" },
    { id: "jugo",      emoji: "🍹", label: "Jugo" },
    { id: "cerveza",   emoji: "🍺", label: "Cerveza" },
    { id: "vino",      emoji: "🍷", label: "Vino" },
    { id: "leche",     emoji: "🥛", label: "Leche" },
    { id: "te",        emoji: "🍵", label: "Té" },
    { id: "coctel",    emoji: "🍸", label: "Cóctel" },
  ],
  comida: [
    { id: "hamburguesa", emoji: "🍔", label: "Hamburguesa" },
    { id: "pizza",       emoji: "🍕", label: "Pizza" },
    { id: "sandwich",    emoji: "🥪", label: "Sandwich" },
    { id: "hotdog",      emoji: "🌭", label: "Hot Dog" },
    { id: "taco",        emoji: "🌮", label: "Taco" },
    { id: "arroz",       emoji: "🍚", label: "Arroz / Plato" },
    { id: "ensalada",    emoji: "🥗", label: "Ensalada" },
    { id: "sopa",        emoji: "🍲", label: "Sopa" },
    { id: "pollo",       emoji: "🍗", label: "Pollo" },
    { id: "papas",       emoji: "🍟", label: "Papas fritas" },
  ],
  dulces: [
    { id: "dulce",     emoji: "🍬", label: "Dulce / Caramelo" },
    { id: "chocolate", emoji: "🍫", label: "Chocolate" },
    { id: "helado",    emoji: "🍦", label: "Helado" },
    { id: "pastel",    emoji: "🎂", label: "Pastel / Torta" },
    { id: "galleta",   emoji: "🍪", label: "Galleta" },
    { id: "donut",     emoji: "🍩", label: "Dona" },
    { id: "paleta",    emoji: "🍭", label: "Paleta" },
    { id: "chicle",    emoji: "🫧", label: "Chicle" },
  ],
  snacks: [
    { id: "papitas",   emoji: "🥔", label: "Papitas / Snack" },
    { id: "palomitas", emoji: "🍿", label: "Palomitas" },
    { id: "nachos",    emoji: "🧀", label: "Nachos" },
    { id: "nueces",    emoji: "🥜", label: "Nueces / Maní" },
    { id: "pretzel",   emoji: "🥨", label: "Pretzel" },
  ],
  otros: [
    { id: "caja",      emoji: "📦", label: "Caja / Paquete" },
    { id: "bolsa",     emoji: "🛍️", label: "Bolsa" },
    { id: "ticket",    emoji: "🎟️", label: "Ticket / Entrada" },
    { id: "regalo",    emoji: "🎁", label: "Regalo / Souvenir" },
    { id: "producto",  emoji: "🏷️", label: "Producto general" },
    { id: "utensilio", emoji: "🍴", label: "Utensilio" },
  ],
};

// Todos los iconos en un array plano para búsqueda rápida
export const TODOS_ICONOS = Object.values(ICONOS).flat();

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
  // Verificar que no tenga productos activos
  const q = query(collection(db, "productos"),
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
    stock: 0,
    activo: true,
    creadoEn: serverTimestamp(),
  });
}

export async function editarProducto(id, datos) {
  // Solo se pueden editar: nombre, icono, precioVenta, alertaMinima
  // NUNCA el stock desde aquí
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
// Devuelve: "ok" | "alerta" | "agotado"
export function estadoStock(stock, alertaMinima) {
  if (stock <= 0)             return "agotado";
  if (stock <= alertaMinima)  return "alerta";
  return "ok";
}
