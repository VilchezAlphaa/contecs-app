// =============================================
// CONTECS — Sistema de Roles y Permisos
// =============================================
// Niveles de autoridad:
// 5 = Máxima autoridad
// 4 = Autoridad alta
// 3 = Autoridad media
// 2 = Autoridad baja-media
// 1 = Mínima autoridad

export const ROLES = {
  ceo:            { label: "CEO / Desarrollador",    nivel: 6, color: "#1a1a2e" },
  junta:          { label: "Junta Directiva",        nivel: 5, color: "#6C3483" },
  coordinador:    { label: "Coordinador",            nivel: 5, color: "#6C3483" },
  finanzas:       { label: "Líder de Finanzas",      nivel: 5, color: "#6C3483" },
  logistica:      { label: "Líder de Logística",     nivel: 5, color: "#6C3483" },
  ventas:         { label: "Líder de Ventas",        nivel: 4, color: "#1A5276" },
  secretario:     { label: "Secretario",             nivel: 4, color: "#1A5276" },
  actividades:    { label: "Líder de Actividades",   nivel: 3, color: "#1E8449" },
  patrocinios:    { label: "Líder de Patrocinios",   nivel: 3, color: "#1E8449" },
  investigacion:  { label: "Líder de Investigación", nivel: 3, color: "#1E8449" },
  voluntariado:   { label: "Líder de Voluntariado",  nivel: 3, color: "#1E8449" },
  giras:          { label: "Líder de Giras",         nivel: 3, color: "#1E8449" },
  comunicaciones: { label: "Líder de Comunicaciones",nivel: 2, color: "#B7950B" },
  miembro:        { label: "Miembro General",        nivel: 1, color: "#717D7E" },
};

// Permisos por módulo
// Cada permiso lista los roles que tienen acceso
export const PERMISOS = {
  ver_inventario:    ["junta", "logistica"],
  registrar_ventas:  ["logistica", "ventas"],
  registrar_compras: ["junta", "finanzas", "logistica"],
  ver_fondos:        ["junta", "finanzas"],
  editar_fondos:     ["junta", "finanzas"],
  ver_bitacora:      ["junta","coordinador","finanzas","logistica","ventas","secretario","actividades","patrocinios","investigacion","voluntariado","giras","comunicaciones","miembro"],
  ver_reportes:      ["junta","coordinador","finanzas","logistica","ventas","secretario","actividades","patrocinios","investigacion","voluntariado","giras","comunicaciones","miembro"],
  editar_catalogo:   ["junta", "coordinador", "finanzas", "logistica", "actividades"],
  ver_precios:       ["junta", "coordinador", "finanzas"],
  aprobar_gastos:    ["junta", "coordinador"],
  exportar_datos:    ["junta", "coordinador", "finanzas", "logistica", "actividades"],
};

// Función para verificar si un rol tiene un permiso
export function tienePermiso(rol, permiso) {
  if (!rol || !permiso) return false;
  if (rol === "ceo") return true; // CEO tiene acceso a todo sin excepción
  return (PERMISOS[permiso] || []).includes(rol);
}

// Función para obtener todos los permisos de un rol
export function permisosDeRol(rol) {
  return Object.keys(PERMISOS).filter(p => tienePermiso(rol, p));
}

// Función para obtener info del rol
export function infoRol(rol) {
  return ROLES[rol] || { label: rol, nivel: 0, color: "#717D7E" };
}
