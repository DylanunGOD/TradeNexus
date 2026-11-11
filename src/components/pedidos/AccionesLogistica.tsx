import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { confirmarRetiro, despacharPedido, recibirEnNodo, recibirEnOrigen } from "@/app/tienda/acciones";
import type { Pedido, Tienda } from "@/lib/tipos";

/**
 * Botón de la acción logística que le corresponde a una tienda para un
 * pedido, según su estado. `tiendaId` = tienda del usuario (null para admin).
 */
export function AccionesLogistica({
  pedido,
  tiendaId,
  esAdmin,
  tiendas,
  siguienteId,
}: {
  pedido: Pedido;
  tiendaId: number | null;
  esAdmin: boolean;
  tiendas: Map<number, Tienda>;
  siguienteId?: number;
}) {
  const es = (id: number | null) => esAdmin || (id != null && id === tiendaId);
  const nombre = (id?: number | null) => (id ? tiendas.get(id)?.nombre : "");

  if (pedido.estado === "en_lista" && es(pedido.tienda_origen_id)) {
    return (
      <FormAccion action={recibirEnOrigen.bind(null, pedido.id)}>
        <BotonEnviar className="btn-primario w-full" textoEnviando="Registrando…">
          Confirmar recepción física en {nombre(pedido.tienda_origen_id)}
        </BotonEnviar>
      </FormAccion>
    );
  }
  if ((pedido.estado === "en_tienda_origen" || pedido.estado === "en_punto_intermedio") && es(pedido.nodo_actual_id)) {
    return (
      <FormAccion action={despacharPedido.bind(null, pedido.id)}>
        <BotonEnviar className="btn-primario w-full" textoEnviando="Registrando…">
          Despachar hacia {nombre(siguienteId)}
        </BotonEnviar>
      </FormAccion>
    );
  }
  if (pedido.estado === "en_transito" && es(pedido.siguiente_nodo_id)) {
    return (
      <FormAccion action={recibirEnNodo.bind(null, pedido.id)}>
        <BotonEnviar className="btn-primario w-full" textoEnviando="Registrando…">
          Registrar llegada a {nombre(pedido.siguiente_nodo_id)}
        </BotonEnviar>
      </FormAccion>
    );
  }
  if (pedido.estado === "listo_para_retiro" && es(pedido.tienda_destino_id)) {
    return (
      <FormAccion action={confirmarRetiro.bind(null, pedido.id)} className="flex gap-2">
        <label htmlFor={`codigo-${pedido.id}`} className="sr-only">
          Código de retiro
        </label>
        <input
          id={`codigo-${pedido.id}`}
          name="codigo"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="Código de 6 dígitos"
          className="campo text-center font-mono tracking-[0.3em]"
          autoComplete="off"
        />
        <BotonEnviar className="btn-exito shrink-0" textoEnviando="Verificando…">
          Entregar
        </BotonEnviar>
      </FormAccion>
    );
  }
  return null;
}
