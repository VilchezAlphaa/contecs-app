
import { auth, db } from "./firebase-config.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { tienePermiso } from "./permisos.js";

const provider = new GoogleAuthProvider();
const PUBLIC_PAGES = ["index.html", ""];

// Escucha cambios en el documento del usuario en Firestore en tiempo real
// Si el rol cambia, actualiza sessionStorage y recarga la página automáticamente
export function escucharCambiosDeRol(uid) {
  const ref = doc(db, "usuarios", uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data       = snap.data();
    const rolActual  = sessionStorage.getItem("rol");
    const rolNuevo   = data.rol || "sin_rol";

    if (rolActual !== rolNuevo) {
      // El admin cambió el rol — actualizar y recargar sin que el usuario haga nada
      sessionStorage.setItem("rol",    rolNuevo);
      sessionStorage.setItem("nombre", data.nombre || sessionStorage.getItem("nombre"));
      window.location.reload();
    }
  });
}

export function guardRoute() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  onAuthStateChanged(auth, async (user) => {
    if (!user && !PUBLIC_PAGES.includes(page)) {
      window.location.href = "index.html";
    } else if (user && PUBLIC_PAGES.includes(page)) {
      await cargarUsuario(user);
      window.location.href = "dashboard.html";
    } else if (user && !PUBLIC_PAGES.includes(page)) {
      // Ya autenticado en página protegida — escuchar cambios de rol
      escucharCambiosDeRol(user.uid);
    }
  });
}

async function cargarUsuario(user) {
  const ref  = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Usuario ya existe — cargar sus datos
    const data = snap.data();
    sessionStorage.setItem("uid",    user.uid);
    sessionStorage.setItem("nombre", data.nombre || user.displayName || user.email);
    sessionStorage.setItem("rol",    data.rol || "sin_rol");
    sessionStorage.setItem("email",  user.email);
  } else {
    // Primera vez que entra — crear documento automáticamente con sin_rol
    const nuevoUsuario = {
      nombre:    user.displayName || user.email,
      email:     user.email,
      foto:      user.photoURL || "",
      rol:       "sin_rol",
      creadoEn:  serverTimestamp(),
    };
    await setDoc(ref, nuevoUsuario);
    sessionStorage.setItem("uid",    user.uid);
    sessionStorage.setItem("nombre", nuevoUsuario.nombre);
    sessionStorage.setItem("rol",    "sin_rol");
    sessionStorage.setItem("email",  user.email);
  }
}

export async function loginConGoogle() {
  const result = await signInWithPopup(auth, provider);
  await cargarUsuario(result.user);
  return result.user;
}

export async function cerrarSesion() {
  sessionStorage.clear();
  await signOut(auth);
  window.location.href = "index.html";
}

export function getUsuarioActual() {
  return {
    uid:    sessionStorage.getItem("uid"),
    nombre: sessionStorage.getItem("nombre"),
    rol:    sessionStorage.getItem("rol"),
    email:  sessionStorage.getItem("email"),
  };
}

export function usuarioTienePermiso(permiso) {
  const rol = sessionStorage.getItem("rol");
  return tienePermiso(rol, permiso);
}

export function requirePermiso(permiso) {
  if (!usuarioTienePermiso(permiso)) {
    window.location.href = "dashboard.html";
  }
}