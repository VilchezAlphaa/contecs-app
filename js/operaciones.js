import { auth, db, storage } from "./firebase-config.js";
import {
  collection, doc, runTransaction, serverTimestamp, setDoc
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

export async function esperarAuthListo(timeout = 10000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), timeout);
    onAuthStateChanged(auth, () => {
      clearTimeout(timer);
      resolve();
    });
  });
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

function descripcionErrorStorage(error, ruta, bucket) {
  const codigo = error?.code || "desconocido";
  const mensaje = error?.message || String(error || "Error desconocido");
  return `No se pudo subir la factura a ${bucket}/${ruta} (${codigo}). ${mensaje}`;
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
      throw new Error(descripcionErrorStorage(error, ruta, storage.app.options.storageBucket || "storageBucket-desconocido"));
    }

    throw new Error(descripcionErrorStorage(error, ruta, storage.app.options.storageBucket || "storageBucket-desconocido"));
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

  // Primero: guardar compra en Firestore (atomicamente)
  const transactionResult = await runTransaction(db, async (tx) => {
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
      factura: null,
      facturaEstado: "pendiente",
      facturaError: null,
      creadoEn: serverTimestamp(),
    });

    return { id: compraRef.id, total, balance: nuevoBalance, items: lineas };
  });

  // Segundo: intenta subir factura de manera no-bloqueante
  let facturaSubida = false;
  let facturaError = null;

  try {
    const facturaMetadata = await subirFacturaAStorage({
      compraId: transactionResult.id,
      factura,
      usuarioId,
    });

    // Éxito: actualiza el documento con la factura
    await setDoc(doc(db, "compras", transactionResult.id), {
      factura: facturaMetadata,
      facturaEstado: "subida",
      facturaError: null,
      actualizadoEn: serverTimestamp(),
    }, { merge: true });

    facturaSubida = true;
  } catch (error) {
    // Fallo: registra el error pero NO detiene el proceso
    facturaError = error.message || "Error desconocido al subir factura.";
    await setDoc(doc(db, "compras", transactionResult.id), {
      facturaEstado: "error",
      facturaError,
      actualizadoEn: serverTimestamp(),
    }, { merge: true });
  }

  return {
    ...transactionResult,
    facturaSubida,
    facturaError,
  };
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

// ── MERMA ─────────────────────────────────────────────────────────────────────
// Descuenta stock de cada producto y registra en movimientos_inventario
// y en bitácora como merma. NO mueve fondos.
export async function registrarMerma({ usuarioId, usuarioNombre = "", items, motivo = "" }) {
  if (!usuarioId) throw new Error("No se pudo identificar al usuario.");
  if (!Array.isArray(items) || items.length === 0) throw new Error("Agrega al menos un producto.");
  if (!motivo.trim()) throw new Error("El motivo de la merma es requerido.");

  return runTransaction(db, async (tx) => {
    // Leer y validar stock de todos los productos
    const refs   = items.map(it => doc(db, "productos", it.productoId));
    const snaps  = await Promise.all(refs.map(r => tx.get(r)));

    snaps.forEach((snap, i) => {
      if (!snap.exists()) throw new Error(`Producto ${items[i].nombre} no existe.`);
      const stockActual = Number(snap.data().stock || 0);
      if (stockActual < items[i].cantidad) {
        throw new Error(`Stock insuficiente para ${items[i].nombre} (disponible: ${stockActual}).`);
      }
    });

    const mermaRef = doc(collection(db, "mermas"));

    // Documento principal de merma (para bitácora)
    tx.set(mermaRef, {
      usuarioId,
      usuarioNombre,
      items: items.map(it => ({
        productoId:    it.productoId,
        nombre:        it.nombre,
        cantidad:      it.cantidad,
      })),
      motivo: motivo.trim(),
      creadoEn: serverTimestamp(),
    });

    // Descontar stock y crear movimiento por ítem
    snaps.forEach((snap, i) => {
      const it          = items[i];
      const stockActual = Number(snap.data().stock || 0);
      const nuevoStock  = stockActual - it.cantidad;
      const movRef      = doc(collection(db, "movimientos_inventario"));

      tx.update(refs[i], { stock: nuevoStock, actualizadoEn: serverTimestamp() });
      tx.set(movRef, {
        tipo:         "salida",
        origen:       "merma",
        productoId:   it.productoId,
        nombre:       it.nombre,
        cantidad:     it.cantidad,
        antes:        stockActual,
        despues:      nuevoStock,
        motivo:       motivo.trim(),
        referenciaId: mermaRef.id,
        usuarioId,
        creadoEn:     serverTimestamp(),
      });
    });

    return { id: mermaRef.id };
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
