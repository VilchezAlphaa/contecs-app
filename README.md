# CONTECS — Sistema de Gestión Organizacional

App web para gestión de inventario, ventas, fondos y bitácora de CONTECS.

## Stack
- HTML + CSS + JavaScript (vanilla)
- Firebase Firestore (base de datos en tiempo real)
- Firebase Authentication (login)
- GitHub Pages (hosting gratuito)

## Estructura
```

contecs-app/
├── index.html          ← Login
├── dashboard.html      ← Panel principal
├── ventas.html         ← Registro de ventas y mermas
├── compras.html        ← Registro de compras
├── inventario.html     ← Inventario en tiempo real
├── bitacora.html       ← Historial de cierres
├── catalogo.html       ← Productos y categorías
├── fondos.html         ← Control de fondos
├── css/styles.css      ← Estilos globales
└── js/
    ├── firebase-config.js
    ├── auth.js
    └── ...
```

## Para crear el primer usuario admin
En la consola de Firebase → Authentication → agregar usuario manualmente,
luego en Firestore crear el documento:

```
usuarios/{uid}/
  nombre: "Alpha Vilchez"
  rol: "admin"
  email: "tu@correo.com"
```

## Login con Google en GitHub Pages
Si la app está publicada en GitHub Pages, agrega el dominio del sitio en Firebase Console → Authentication → Settings → Authorized domains.
El error `auth/unauthorized-domain` aparece cuando el host actual, por ejemplo `vilchezalphaa.github.io`, todavía no está en esa lista.

## Estado del desarrollo
- [x] Fase 0 — Configuración y estructura base
- [x] Fase 1 — Autenticación y roles
- [ ] Fase 2 — Catálogo de productos
- [ ] Fase 3 — Ventas y mermas
- [ ] Fase 4 — Inventario en tiempo real
- [ ] Fase 5 — Compras
- [ ] Fase 6 — Fondos
- [ ] Fase 7 — Bitácora
- [ ] Fase 8 — Dashboard completo y pulido
