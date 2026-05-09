import { auth, db, storage } from "./firebase-config.js";
import {
  collection, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

function aNumero(valor, fallback = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function nombreProducto(item, producto) {
  return item.nombre || producto?.nombre || "Producto";
}

function precioItem(item, producto, campoAlterno = "precioVenta") {
  const directo = aNumero(item.precioUnitario, NaN);
  if (Number.isFinite(directo)) return directo;

  const alterno = aNumero(item[campoAlterno], NaN);
  if (Number.isFinite(alterno)) return alterno;

  return aNumero(producto?.[campoAlterno], 0);
}

function subtotalItem(item, producto, campoAlterno = "precioCompra") {
  const directo = aNumero(item.subtotal, NaN);
  if (Number.isFinite(directo)) {
    if (directo <= 0) {
      throw new Error("El subtotal debe ser mayor que cero.");
    }
    return directo;
  }

  const unitario = precioItem(item, producto, campoAlterno);
  const cantidad = cantidadItem(item);
  return unitario * cantidad;
}

function cantidadItem(item) {
  const cantidad = Math.trunc(aNumero(item.cantidad, 0));
  if (cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor que cero.");
  }
  return cantidad;
}

function fondoRef() {
  return doc(db, "fondos", "principal");
}

async function asegurarFondo(tx) {
  const ref = fondoRef();
  const snap = await tx.get(ref);
  if (!snap.exists()) {
    tx.set(ref, {
      balance: 0,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    });
    return 0;
  }
  return aNumero(snap.data().balance, 0);
}

function crearMovimientoInventarioRef() {
  return doc(collection(db, "movimientos_inventario"));
}

function crearMovimientoFondoRef() {
  return doc(collection(db, "fondos_entrada"));
}

function resumenItemPrincipal(items) {
  if (!Array.isArray(items) || items.length === 0) return "Movimiento";
  if (items.length === 1) return items[0].nombre || "Movimiento";
  return `${items[0].nombre || "Movimiento"} +${items.length - 1} más`;
}

function validarFacturaArchivo(factura) {
  if (!factura) {
    throw new Error("Selecciona una factura.");
  }

  const tiposPermitidos = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
  const tipoArchivo = factura.type || "";

  if (!tiposPermitidos.includes(tipoArchivo)) {
    throw new Error("La factura debe ser un PDF o una imagen válida.");
  }

  const limiteBytes = 10 * 1024 * 1024;
  if (factura.size > limiteBytes) {
    throw new Error("La factura no puede superar 10 MB.");
  }
}

function limpiarNombreArchivo(nombre) {
  return String(nombre || "factura")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function esperarAuthListo() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Firebase Auth todavía no está listo para subir la factura."));
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      cleanup();
      if (user) {
        resolve(user);
      } else {
        reject(new Error("Debes iniciar sesión de nuevo para subir la factura."));
      }
    }, (error) => {
      cleanup();
      reject(error);
    });

    function cleanup() {
      window.clearTimeout(timeoutId);
      unsubscribe();
    }
  });
}

export async function subirFacturaAStorage({ compraId, factura, usuarioId }) {
  if (!compraId) throw new Error("No se pudo preparar la carga de la factura.");
  if (!usuarioId) throw new Error("No se pudo identificar al usuario.");

  validarFacturaArchivo(factura);
  await esperarAuthListo();

  const nombreSeguro = limpiarNombreArchivo(factura.name);
  const metadata = {
    contentType: factura.type || "application/octet-stream",
  };

  const ruta = `compras/${compraId}/facturas/${Date.now()}_${nombreSeguro}`;
  const archivoRef = storageRef(storage, ruta);

  try {
    const resultado = await uploadBytes(archivoRef, factura, metadata);
    const url = await getDownloadURL(resultado.ref);

    return {
      url,
      name: factura.name,
      size: factura.size,
      contentType: factura.type || "application/octet-stream",
      uploadedAt: serverTimestamp(),
      uploadedBy: usuarioId,
    };
  } catch (error) {
    if (error?.code === "storage/unauthorized") {
      throw new Error("Firebase Storage rechazó la subida. Revisa las reglas para permitir escritura autenticada en compras/{compraId}/facturas/**.");
    }

    throw error;
  }
}

async function leerProductosTx(tx, items) {
  const lecturas = [];
  for (const item of items) {
    const productoRef = doc(db, "productos", item.productoId);
    const productoSnap = await tx.get(productoRef);
    lecturas.push({ ref: productoRef, snap: productoSnap, item });
  }
  return lecturas;
}

export function formatearMoneda(valor) {
  return aNumero(valor, 0).toLocaleString("es-PA", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export async function registrarVenta({ usuarioId, usuarioNombre = "", items, metodoPago = "efectivo", nota = "" }) {
  if (!usuarioId) throw new Error("No se pudo identificar al usuario.");
  if (!Array.isArray(items) || items.length === 0) throw new Error("Agrega al menos un producto.");

  const ventaRef = doc(collection(db, "ventas"));
  const fondoMovimientoRef = crearMovimientoFondoRef();
  const movimientoRefs = items.map(() => crearMovimientoInventarioRef());

  return runTransaction(db, async (tx) => {
    const fondoSnap = await tx.get(fondoRef());
    const lecturas = await leerProductosTx(tx, items);

    const lineas = [];
    let total = 0;

    for (let i = 0; i < lecturas.length; i += 1) {
      const { ref: productoRef, snap: productoSnap, item } = lecturas[i];

      if (!productoSnap.exists()) {
        throw new Error(`El producto ${nombreProducto(item)} ya no existe.`);
      }

      const producto = productoSnap.data();
      if (producto.activo === false) {
        throw new Error(`El producto ${nombreProducto(item, producto)} está inactivo.`);
      }

      const cantidad = cantidadItem(item);
      const stockActual = aNumero(producto.stock, 0);
      if (stockActual < cantidad) {
        throw new Error(`Stock insuficiente para ${nombreProducto(item, producto)}.`);
      }

      const unitario = precioItem(item, producto, "precioVenta");
      const subtotal = unitario * cantidad;
      const nuevoStock = stockActual - cantidad;

      tx.update(productoRef, {
        stock: nuevoStock,
        actualizadoEn: serverTimestamp(),
      });

      tx.set(movimientoRefs[i], {
        tipo: "salida",
        origen: "venta",
        productoId: item.productoId,
        nombre: nombreProducto(item, producto),
        cantidad,
        antes: stockActual,
        despues: nuevoStock,
        motivo: item.motivo || "Venta registrada",
        referenciaId: ventaRef.id,
        usuarioId,
        creadoEn: serverTimestamp(),
      });

      lineas.push({
        productoId: item.productoId,
        nombre: nombreProducto(item, producto),
        cantidad,
        precioUnitario: unitario,
        subtotal,
      });

      total += subtotal;
    }

    const balanceActual = fondoSnap.exists() ? aNumero(fondoSnap.data().balance, 0) : 0;
    const nuevoBalance = balanceActual + total;

    tx.set(fondoRef(), {
      balance: nuevoBalance,
      actualizadoEn: serverTimestamp(),
    }, { merge: true });

    tx.set(fondoMovimientoRef, {
      tipo: "ingreso",
      origen: "venta",
      monto: total,
      descripcion: nota || resumenItemPrincipal(lineas),
      titulo: resumenItemPrincipal(lineas),
      referenciaId: ventaRef.id,
      usuarioId,
      usuarioNombre,
      creadoEn: serverTimestamp(),
    });

    tx.set(ventaRef, {
      usuarioId,
      usuarioNombre,
      items: lineas,
      total,
      metodoPago,
      nota,
      creadoEn: serverTimestamp(),
    });

    return { id: ventaRef.id, total, balance: nuevoBalance, items: lineas };
  });
}

export async function registrarCompra({ usuarioId, usuarioNombre = "", proveedor = "", items, metodoPago = "efectivo", nota = "", factura = null }) {
  if (!usuarioId) throw new Error("No se pudo identificar al usuario.");
  if (!Array.isArray(items) || items.length === 0) throw new Error("Agrega al menos un producto.");
  if (!String(proveedor).trim()) throw new Error("El proveedor es obligatorio.");
  if (!String(metodoPago).trim()) throw new Error("El método de pago es obligatorio.");
  if (!factura) throw new Error("Selecciona una factura.");

  const compraRef = doc(collection(db, "compras"));
  const fondoMovimientoRef = crearMovimientoFondoRef();
  const movimientoRefs = items.map(() => crearMovimientoInventarioRef());

  const facturaMetadata = await subirFacturaAStorage({
    compraId: compraRef.id,
    factura,
    usuarioId,
  });

  return runTransaction(db, async (tx) => {
    const fondoSnap = await tx.get(fondoRef());
    const lecturas = await leerProductosTx(tx, items);

    const lineas = [];
    let total = 0;

    for (let i = 0; i < lecturas.length; i += 1) {
      const { ref: productoRef, snap: productoSnap, item } = lecturas[i];

      if (!productoSnap.exists()) {
        throw new Error(`El producto ${nombreProducto(item)} ya no existe.`);
      }

      const producto = productoSnap.data();
      const cantidad = cantidadItem(item);
      const stockActual = aNumero(producto.stock, 0);
      const subtotal = subtotalItem(item, producto, "precioCompra");
      const unitario = subtotal / cantidad;
      const nuevoStock = stockActual + cantidad;

      tx.update(productoRef, {
        stock: nuevoStock,
        precioCompra: unitario,
        ultimoCosto: unitario,
        actualizadoEn: serverTimestamp(),
      });

      tx.set(movimientoRefs[i], {
        tipo: "entrada",
        origen: "compra",
        productoId: item.productoId,
        nombre: nombreProducto(item, producto),
        cantidad,
        antes: stockActual,
        despues: nuevoStock,
        motivo: item.motivo || "Compra registrada",
        referenciaId: compraRef.id,
        usuarioId,
        creadoEn: serverTimestamp(),
      });

      lineas.push({
        productoId: item.productoId,
        nombre: nombreProducto(item, producto),
        cantidad,
        precioUnitario: unitario,
        subtotal,
      });

      total += subtotal;
    }

    const balanceActual = fondoSnap.exists() ? aNumero(fondoSnap.data().balance, 0) : 0;
    const nuevoBalance = balanceActual - total;

    tx.set(fondoRef(), {
      balance: nuevoBalance,
      actualizadoEn: serverTimestamp(),
    }, { merge: true });

    tx.set(fondoMovimientoRef, {
      tipo: "salida",
      origen: "compra",
      monto: total,
      descripcion: nota || resumenItemPrincipal(lineas),
      titulo: resumenItemPrincipal(lineas),
      referenciaId: compraRef.id,
      usuarioId,
      usuarioNombre,
      creadoEn: serverTimestamp(),
    });

    tx.set(compraRef, {
      usuarioId,
      usuarioNombre,
      proveedor,
      items: lineas,
      total,
      metodoPago,
      nota,
      factura: facturaMetadata,
      creadoEn: serverTimestamp(),
    });

    return { id: compraRef.id, total, balance: nuevoBalance, items: lineas };
  });
}

export async function ajustarStock({ usuarioId, productoId, cantidad, tipo, motivo = "" }) {
  if (!usuarioId) throw new Error("No se pudo identificar al usuario.");
  if (!productoId) throw new Error("Selecciona un producto.");

  const cantidadNormalizada = cantidadItem({ cantidad });
  const delta = tipo === "salida" ? -cantidadNormalizada : cantidadNormalizada;
  const movimientoRef = crearMovimientoInventarioRef();
  const productoRef = doc(db, "productos", productoId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(productoRef);
    if (!snap.exists()) throw new Error("El producto seleccionado ya no existe.");

    const producto = snap.data();
    const stockActual = aNumero(producto.stock, 0);
    const nuevoStock = stockActual + delta;

    if (nuevoStock < 0) {
      throw new Error("El ajuste dejaría stock negativo.");
    }

    tx.update(productoRef, {
      stock: nuevoStock,
      actualizadoEn: serverTimestamp(),
    });

    tx.set(movimientoRef, {
      tipo: delta >= 0 ? "entrada" : "salida",
      origen: "ajuste",
      productoId,
      nombre: producto.nombre || "Producto",
      cantidad: cantidadNormalizada,
      antes: stockActual,
      despues: nuevoStock,
      motivo: motivo || "Ajuste manual",
      referenciaId: movimientoRef.id,
      usuarioId,
      creadoEn: serverTimestamp(),
    });

    return { id: movimientoRef.id, stock: nuevoStock };
  });
}

export async function registrarMovimientoFondo({ usuarioId, usuarioNombre = "", tipo, monto, descripcion = "", referenciaId = null, titulo = "Movimiento" }) {
  if (!usuarioId) throw new Error("No se pudo identificar al usuario.");
  const montoNormalizado = aNumero(monto, 0);
  if (montoNormalizado <= 0) throw new Error("El monto debe ser mayor que cero.");

  const fondoMovimientoRef = crearMovimientoFondoRef();

  return runTransaction(db, async (tx) => {
    const balanceActual = await asegurarFondo(tx);
    const delta = tipo === "salida" ? -montoNormalizado : montoNormalizado;
    const nuevoBalance = balanceActual + delta;

    if (nuevoBalance < 0) {
      throw new Error("El fondo no puede quedar negativo.");
    }

    tx.set(fondoRef(), {
      balance: nuevoBalance,
      actualizadoEn: serverTimestamp(),
    }, { merge: true });

    tx.set(fondoMovimientoRef, {
      tipo: delta >= 0 ? "ingreso" : "salida",
      origen: "manual",
      monto: montoNormalizado,
      descripcion,
      titulo,
      referenciaId,
      usuarioId,
      usuarioNombre,
      creadoEn: serverTimestamp(),
    });

    return { id: fondoMovimientoRef.id, balance: nuevoBalance };
  });
}
