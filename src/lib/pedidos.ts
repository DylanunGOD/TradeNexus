import { diaLargo, proximoDespacho } from "./formato";
import type { Pedido, Tienda } from "./tipos";

export interface NodoRuta {
  orden: number;
  tienda: Tienda;
  tipo: "origen" | "intermedio" | "final";
  estado: "completado" | "actual" | "pendiente";
}

/** Arma la ruta del pedido marcando qué nodos ya se recorrieron (RF-8, RN-05). */
export function construirRuta(pedido: Pedido, ruta: { orden: number; tienda_id: number }[], tiendas: Map<number, Tienda>): NodoRuta[] {
  const ordenada = [...ruta].sort((a, b) => a.orden - b.orden);
  const ultimo = ordenada.length - 1;
  const enRed = !["borrador", "pendiente_pago", "pago_en_revision", "en_lista", "cancelado"].includes(pedido.estado);
  return ordenada.map((r, i) => {
    let estado: NodoRuta["estado"] = "pendiente";
    if (pedido.estado === "entregado") estado = "completado";
    else if (enRed) {
      if (i < pedido.ruta_indice) estado = "completado";
      else if (i === pedido.ruta_indice) estado = pedido.estado === "en_transito" ? "completado" : "actual";
    }
    return {
      orden: r.orden,
      tienda: tiendas.get(r.tienda_id)!,
      tipo: i === 0 && ultimo > 0 ? "origen" : i === ultimo ? "final" : "intermedio",
      estado,
    };
  });
}

/** Texto del siguiente movimiento esperado (HU-14). */
export function siguienteMovimiento(pedido: Pedido, nodos: NodoRuta[], tiendas: Map<number, Tienda>): string | null {
  const origen = tiendas.get(pedido.tienda_origen_id);
  const destino = tiendas.get(pedido.tienda_destino_id);
  switch (pedido.estado) {
    case "borrador":
      return "El vendedor está agregando los artículos y confirmará el pedido.";
    case "pendiente_pago":
      return "El comprador debe pagar por un medio externo y adjuntar el comprobante.";
    case "pago_en_revision":
      return "El vendedor revisará el comprobante de pago.";
    case "en_lista":
      return `El vendedor entregará el paquete en ${origen?.nombre}, que confirmará la recepción física.`;
    case "en_tienda_origen":
    case "en_punto_intermedio": {
      const actual = tiendas.get(pedido.nodo_actual_id!);
      const siguiente = nodos[pedido.ruta_indice + 1];
      if (!actual || !siguiente) return null;
      const dia = proximoDespacho(actual.dias_despacho);
      return `Despacho de ${actual.nombre} hacia ${siguiente.tienda.nombre}${
        siguiente.tipo === "final" ? " (punto de retiro)" : " (punto intermedio)"
      }${dia ? `, previsto para el ${diaLargo(dia)}` : ""}.`;
    }
    case "en_transito": {
      const siguiente = tiendas.get(pedido.siguiente_nodo_id!);
      const esFinal = pedido.siguiente_nodo_id === pedido.tienda_destino_id;
      return `Llegada a ${siguiente?.nombre}${esFinal ? ", tu punto de retiro" : " (punto intermedio)"}.`;
    }
    case "listo_para_retiro":
      return `Retirar en ${destino?.nombre} presentando el código de confirmación.`;
    default:
      return null;
  }
}

export const ESTADOS_ANTES_DE_ENVIO = ["borrador", "pendiente_pago", "pago_en_revision", "en_lista"];
