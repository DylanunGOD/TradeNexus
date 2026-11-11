import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, diaLargo, diasTexto, fechaHora, proximoDespacho } from "@/lib/formato";
import type { Pedido, Tienda } from "@/lib/tipos";
import { Cargando, EstadoPedidoBadge } from "@/components/ui/basicos";
import { AccionesLogistica } from "@/components/pedidos/AccionesLogistica";

export const metadata = { title: "Panel de tienda" };

type PedidoPanel = Pedido & {
  comprador: { nombre: string } | null;
  vendedor: { nombre: string } | null;
  ruta: { orden: number; tienda_id: number }[];
};

/** Panel logístico de cada tienda de la red (RF-7, HU-11). */
export default function PanelTienda({ searchParams }: PageProps<"/tienda">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/tienda">["searchParams"] }) {
  const usuario = await exigirUsuario(["tienda", "admin"]);
  const esAdmin = usuario.perfil.rol === "admin";
  const sp = await searchParams;
  const supabase = await crearClienteServidor();

  const { data: tiendasData } = await supabase.from("tiendas").select("*").order("nombre");
  const tiendas = new Map(((tiendasData as Tienda[]) ?? []).map((t) => [t.id, t]));
  const tiendaId = esAdmin ? Number(sp.tienda) || null : usuario.perfil.tienda_id;
  const tienda = tiendaId ? tiendas.get(tiendaId) : null;

  const { data } = await supabase
    .from("pedidos")
    .select(
      "*, comprador:perfiles!pedidos_comprador_id_fkey(nombre), vendedor:perfiles!pedidos_vendedor_id_fkey(nombre), ruta:pedido_ruta(orden, tienda_id)",
    )
    .in("estado", ["en_lista", "en_tienda_origen", "en_transito", "en_punto_intermedio", "listo_para_retiro", "entregado"])
    .order("updated_at", { ascending: false })
    .limit(300);
  const pedidos = (data as PedidoPanel[]) ?? [];
  const mia = (id: number | null) => tiendaId == null || id === tiendaId;

  const grupos = [
    {
      titulo: "Por recibir del vendedor",
      ayuda: "Paquetes con pago validado que el vendedor debe entregar aquí. Confirma la recepción física al recibirlos.",
      lista: pedidos.filter((p) => p.estado === "en_lista" && mia(p.tienda_origen_id)),
    },
    {
      titulo: "En tienda para despachar",
      ayuda: "Paquetes que están físicamente en la tienda y siguen su ruta.",
      lista: pedidos.filter((p) => ["en_tienda_origen", "en_punto_intermedio"].includes(p.estado) && mia(p.nodo_actual_id)),
    },
    {
      titulo: "En camino hacia la tienda",
      ayuda: "Registra la llegada cuando el paquete entre a la tienda.",
      lista: pedidos.filter((p) => p.estado === "en_transito" && mia(p.siguiente_nodo_id)),
    },
    {
      titulo: "Listos para retiro",
      ayuda: "Pide al comprador su código de 6 dígitos para entregar el pedido.",
      lista: pedidos.filter((p) => p.estado === "listo_para_retiro" && mia(p.tienda_destino_id)),
    },
  ];
  const entregados = pedidos.filter((p) => p.estado === "entregado" && mia(p.tienda_destino_id)).slice(0, 8);
  const despacho = tienda ? proximoDespacho(tienda.dias_despacho) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="titulo-pagina">{esAdmin ? "Logística de la red" : `Panel · ${tienda?.nombre ?? "Tienda"}`}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {tienda
              ? `Despacha los ${diasTexto(tienda.dias_despacho)}${despacho ? ` · próximo despacho: ${diaLargo(despacho)}` : ""}`
              : "Vista de todas las tiendas. Como administrador puedes registrar movimientos en cualquier punto."}
          </p>
        </div>
        {esAdmin && (
          <form className="flex gap-2" action="/tienda">
            <select name="tienda" defaultValue={tiendaId ?? ""} className="campo">
              <option value="">Todas las tiendas</option>
              {[...tiendas.values()].map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secundario">
              Ver
            </button>
          </form>
        )}
      </div>

      {!esAdmin && !tienda && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Tu cuenta no tiene una tienda asignada. Pide a un administrador que la asigne.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {grupos.map((g) => (
          <div key={g.titulo} className="tarjeta p-4">
            <p className="text-xs font-medium text-texto-suave">{g.titulo}</p>
            <p className="text-3xl font-bold">{g.lista.length}</p>
          </div>
        ))}
      </div>

      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{g.titulo}</h2>
            <p className="text-xs text-texto-suave">{g.ayuda}</p>
          </div>
          {g.lista.length === 0 ? (
            <p className="rounded-xl border border-dashed border-borde px-4 py-5 text-center text-sm text-texto-suave">Nada pendiente.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {g.lista.map((p) => {
                const ruta = [...p.ruta].sort((a, b) => a.orden - b.orden);
                const siguienteId = ruta[p.ruta_indice + 1]?.tienda_id;
                return (
                  <li key={p.id} className="tarjeta space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/pedidos/${p.id}`} className="font-semibold hover:text-marca">
                          {codigoPedido(p.id)}
                        </Link>
                        <p className="text-xs text-texto-suave">
                          {p.vendedor?.nombre} → {p.comprador?.nombre}
                        </p>
                      </div>
                      <EstadoPedidoBadge estado={p.estado} />
                    </div>
                    <p className="text-xs text-tinta-suave">
                      Ruta: {ruta.map((r) => tiendas.get(r.tienda_id)?.nombre.replace("Punto TN ", "")).join(" → ")}
                    </p>
                    <p className="text-[11px] text-texto-suave">Último movimiento: {fechaHora(p.updated_at)}</p>
                    <AccionesLogistica pedido={p} tiendaId={tiendaId} esAdmin={esAdmin} tiendas={tiendas} siguienteId={siguienteId} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {entregados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Entregados recientemente</h2>
          <ul className="tarjeta divide-y divide-borde">
            {entregados.map((p) => (
              <li key={p.id}>
                <Link href={`/pedidos/${p.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-fondo">
                  <span className="font-medium">{codigoPedido(p.id)}</span>
                  <span className="text-texto-suave">
                    {p.comprador?.nombre} · {fechaHora(p.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
