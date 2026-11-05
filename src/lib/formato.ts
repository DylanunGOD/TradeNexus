import type { EstadoDenuncia, EstadoPedido, Rol, TipoProducto } from "./tipos";

const ZONA = "America/Costa_Rica";

const colones = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 });
export const dinero = (n: number | string) => colones.format(Number(n));

export const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeZone: ZONA }).format(new Date(iso));

export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: ZONA }).format(new Date(iso));

export const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CR", { timeStyle: "short", timeZone: ZONA }).format(new Date(iso));

export const codigoPedido = (id: number) => `TN-${String(id).padStart(6, "0")}`;

export const ESTADOS_PEDIDO: Record<EstadoPedido, { texto: string; color: string }> = {
  borrador: { texto: "En preparación", color: "bg-slate-100 text-slate-700" },
  pendiente_pago: { texto: "Pendiente de pago", color: "bg-amber-100 text-amber-800" },
  pago_en_revision: { texto: "Pago en revisión", color: "bg-amber-100 text-amber-800" },
  en_lista: { texto: "En lista", color: "bg-sky-100 text-sky-800" },
  en_tienda_origen: { texto: "En tienda de origen", color: "bg-indigo-100 text-indigo-800" },
  en_transito: { texto: "En tránsito", color: "bg-violet-100 text-violet-800" },
  en_punto_intermedio: { texto: "En punto intermedio", color: "bg-violet-100 text-violet-800" },
  listo_para_retiro: { texto: "Listo para retiro", color: "bg-emerald-100 text-emerald-800" },
  entregado: { texto: "Entregado", color: "bg-emerald-600 text-white" },
  cancelado: { texto: "Cancelado", color: "bg-red-100 text-red-700" },
};

/** Pasos visibles en la línea de tiempo del comprador (RF-8). */
export const PASOS_SEGUIMIENTO: { estado: EstadoPedido; texto: string }[] = [
  { estado: "pendiente_pago", texto: "Pedido confirmado" },
  { estado: "en_lista", texto: "Pago validado" },
  { estado: "en_tienda_origen", texto: "En tienda de origen" },
  { estado: "en_transito", texto: "En camino" },
  { estado: "listo_para_retiro", texto: "Listo para retiro" },
  { estado: "entregado", texto: "Entregado" },
];

const ORDEN: EstadoPedido[] = [
  "borrador",
  "pendiente_pago",
  "pago_en_revision",
  "en_lista",
  "en_tienda_origen",
  "en_transito",
  "en_punto_intermedio",
  "listo_para_retiro",
  "entregado",
];
export const indiceEstado = (e: EstadoPedido) => ORDEN.indexOf(e);

export const ROLES: Record<Rol, string> = {
  comprador: "Comprador",
  vendedor: "Vendedor",
  tienda: "Personal de tienda",
  soporte: "Soporte",
  admin: "Administrador",
};

export const TIPOS: Record<TipoProducto, string> = { single: "Single", base: "Base" };

export const RELEVANCIA_META = ["Sin relevancia", "Casual", "Competitivo", "Top meta"];

export const ESTADOS_DENUNCIA: Record<EstadoDenuncia, { texto: string; color: string }> = {
  abierta: { texto: "Abierta", color: "bg-amber-100 text-amber-800" },
  en_revision: { texto: "En revisión", color: "bg-sky-100 text-sky-800" },
  resuelta: { texto: "Resuelta", color: "bg-emerald-100 text-emerald-800" },
  cerrada: { texto: "Cerrada", color: "bg-slate-200 text-slate-700" },
};

export const MOTIVOS_DENUNCIA = [
  "El producto no coincide con la publicación",
  "Producto dañado",
  "El pedido no llegó",
  "Problema con el pago",
  "Comportamiento del vendedor",
  "Otro",
];

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const diasTexto = (dias: number[]) =>
  dias.length ? dias.map((d) => DIAS[d]).join(" y ") : "sin días definidos";

/** Próxima fecha (desde hoy, hora de Costa Rica) que cae en uno de los días de despacho. */
export function proximoDespacho(dias: number[], desde = new Date()): Date | null {
  if (!dias.length) return null;
  const hoyCR = new Date(desde.toLocaleString("en-US", { timeZone: ZONA }));
  for (let i = 0; i < 8; i++) {
    const d = new Date(hoyCR);
    d.setDate(hoyCR.getDate() + i);
    if (dias.includes(d.getDay())) return d;
  }
  return null;
}

export const diaLargo = (d: Date) =>
  new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long" }).format(d);
