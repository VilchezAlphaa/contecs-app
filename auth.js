/* ===========================
   CONTECS — Estilos Globales
   =========================== */

:root {
  --azul:        #1A5676;
  --azul-claro:  #2980B9;
  --azul-fondo:  #EBF5FB;
  --verde:       #1E8449;
  --verde-claro: #27AE60;
  --rojo:        #C0392B;
  --amarillo:    #F39C12;
  --gris-texto:  #2C3E50;
  --gris-suave:  #F4F6F7;
  --gris-borde:  #D5D8DC;
  --blanco:      #FFFFFF;
  --sombra:      0 2px 8px rgba(0,0,0,0.08);
  --radio:       12px;
  --radio-sm:    8px;
  --fuente:      'Segoe UI', system-ui, -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: var(--fuente);
  background: var(--gris-suave);
  color: var(--gris-texto);
  min-height: 100vh;
  font-size: 15px;
  line-height: 1.5;
}

/* ---- TOPBAR ---- */
.topbar {
  background: var(--azul);
  color: var(--blanco);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--sombra);
}
.topbar h1 {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.topbar .usuario {
  font-size: 13px;
  opacity: 0.85;
}
.btn-logout {
  background: rgba(255,255,255,0.15);
  border: none;
  color: var(--blanco);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
}
.btn-logout:hover { background: rgba(255,255,255,0.25); }

/* ---- CONTENEDOR PRINCIPAL ---- */
.container {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

/* ---- CARDS ---- */
.card {
  background: var(--blanco);
  border-radius: var(--radio);
  box-shadow: var(--sombra);
  padding: 20px;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--azul);
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1.5px solid var(--azul-fondo);
}

/* ---- BOTONES ---- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 20px;
  border-radius: var(--radio-sm);
  border: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  width: 100%;
  min-height: 48px;
  transition: opacity 0.15s, transform 0.1s;
}
.btn:active { transform: scale(0.98); opacity: 0.9; }
.btn-primary  { background: var(--azul);        color: var(--blanco); }
.btn-success  { background: var(--verde);        color: var(--blanco); }
.btn-danger   { background: var(--rojo);         color: var(--blanco); }
.btn-outline  { background: transparent; border: 1.5px solid var(--azul); color: var(--azul); }
.btn-sm       { padding: 8px 14px; font-size: 13px; min-height: 36px; width: auto; }

/* ---- FORMULARIOS ---- */
.form-group { margin-bottom: 14px; }
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--gris-texto);
  margin-bottom: 5px;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid var(--gris-borde);
  border-radius: var(--radio-sm);
  font-size: 15px;
  font-family: var(--fuente);
  background: var(--blanco);
  color: var(--gris-texto);
  transition: border-color 0.15s;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--azul-claro);
}

/* ---- ALERTAS ---- */
.alert {
  padding: 12px 16px;
  border-radius: var(--radio-sm);
  font-size: 14px;
  margin-bottom: 14px;
  display: none;
}
.alert.show { display: block; }
.alert-error   { background: #FDEDEC; color: var(--rojo);    border-left: 4px solid var(--rojo); }
.alert-success { background: #EAFAF1; color: var(--verde);   border-left: 4px solid var(--verde); }
.alert-warning { background: #FEF9E7; color: var(--amarillo);border-left: 4px solid var(--amarillo); }

/* ---- BADGE DE ROL ---- */
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}
.badge-admin    { background: #D6EAF8; color: var(--azul); }
.badge-empleado { background: #D5F5E3; color: var(--verde); }

/* ---- SPINNER ---- */
.spinner-wrap {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--gris-borde);
  border-top-color: var(--azul);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---- TABLA ---- */
.tabla-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th {
  background: var(--azul-fondo);
  color: var(--azul);
  font-weight: 600;
  padding: 10px 12px;
  text-align: left;
}
td { padding: 10px 12px; border-bottom: 1px solid var(--gris-borde); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--gris-suave); }

/* ---- CHIP DE ALERTA DE STOCK ---- */
.stock-ok    { color: var(--verde); font-weight: 600; }
.stock-bajo  { color: var(--rojo);  font-weight: 600; }
.stock-medio { color: var(--amarillo); font-weight: 600; }

/* ---- RESPONSIVE ---- */
@media (max-width: 400px) {
  .topbar h1 { font-size: 16px; }
  .container { padding: 14px 12px 32px; }
  .card { padding: 16px; }
}
