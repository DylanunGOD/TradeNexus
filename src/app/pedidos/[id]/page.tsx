import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, dinero, fecha, fechaHora } from "@/lib/formato";
import { ESTADOS_ANTES_DE_ENVIO } from "@/lib/pedidos";
import type { Pedido, PedidoItem, Tienda } from "@/lib/tipos";
import { Cargando, EstadoPedidoBadge, Seccion } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { agregarItem, cancelarPedido, confirmarPedido, eliminarItem, revisarPago } from "./acciones";
import { SubirComprobante } from "./SubirComprobante";

export const metadata = { title: "Pedido" };

export default function PaginaPedido({ params }: PageProps<"/pedidos/[id]">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando pedido…" />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/pedidos/[id]">["params"] }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  const supabase = await crearClienteServidor();

  const { data } = await supabase.from("pedidos").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();
  const pedido = data as Pedido;

  const [{ data: items }, { data: tiendasData }] = await Promise.all([
    supabase.from("pedido_items").select("*").eq("pedido_id", pedido.id).order("id"),
    supabase.from("tiendas").select("*").order("nombre"),
  ]);

  const idsPersonas = [pedido.comprador_id, pedido.vendedor_id];
  const { data: personas } = await supabase.from("perfiles").select("id, nombre").in("id", idsPersonas);
  const tiendas = new Map(((tiendasData as Tienda[]) ?? []).map((t) => [t.id, t]));
  const nombres = new Map((personas ?? []).map((p) => [p.id as string, p.nombre as string]));
  const rol = usuario.perfil.rol;
  const esComprador = usuario.id === pedido.comprador_id;
  const esVendedor = usuario.id === pedido.vendedor_id;
  const esAdmin = rol === "admin";
  const esStaff = rol === "tienda";
  const antesDeEnvio = ESTADOS_ANTES_DE_ENVIO.includes(pedido.estado);
  const puedeCancelar =
    antesDeEnvio && (esVendedor || esAdmin || (esComprador && ["borrador", "pendiente_pago"].includes(pedido.estado)));

  let urlComprobante: string | null = null;
  if (pedido.comprobante_path && (esComprador || esVendedor)) {
    const { data: firmado } = await supabase.storage.from("comprobantes").createSignedUrl(pedido.comprobante_path, 600);
    urlComprobante = firmado?.signedUrl ?? null;
  }

  const { data: misPublicaciones } =
    esVendedor && pedido.estado === "borrador"
      ? await supabase.from("publicaciones").select("id, nombre, precio").eq("vendedor_id", usuario.id).eq("estado", "activa")
      : { data: null };

  const destino = tiendas.get(pedido.tienda_destino_id)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={esStaff || esAdmin ? "/tienda" : "/pedidos"} className="text-sm text-texto-suave hover:text-marca">
            ← {esStaff || esAdmin ? "Panel de logística" : "Mis pedidos"}
          </Link>
          <h1 className="titulo-pagina mt-1 flex flex-wrap items-center gap-3">
            Pedido {codigoPedido(pedido.id)} <EstadoPedidoBadge estado={pedido.estado} />
          </h1>
          <p className="mt-1 text-sm text-texto-suave">
            Comprador: <strong className="text-tinta">{nombres.get(pedido.comprador_id)}</strong> · Vendedor:{" "}
            <Link href={`/vendedores/${pedido.vendedor_id}`} className="font-semibold text-tinta hover:text-marca">
              {nombres.get(pedido.vendedor_id)}
            </Link>{" "}
            · Creado el {fecha(pedido.created_at)}
          </p>
        </div>
        {pedido.conversacion_id && (esComprador || esVendedor) && (
          <Link href={`/mensajes/${pedido.conversacion_id}`} className="btn-secundario shrink-0">
            💬 Ir al chat
          </Link>
        )}
      </div>

      {pedido.estado === "cancelado" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Este pedido fue cancelado.</p>
          {pedido.motivo_cancelacion && <p className="mt-1">Motivo: {pedido.motivo_cancelacion}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Artículos del pedido */}
          <Seccion
            titulo="Artículos"
            accion={<span className="text-lg font-bold">{dinero(pedido.total)}</span>}
          >
            {items?.length ? (
              <ul className="divide-y divide-borde">
                {(items as PedidoItem[]).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {it.publicacion_id ? (
                          <Link href={`/publicaciones/${it.publicacion_id}`} className="hover:text-marca">
                            {it.descripcion}
                          </Link>
                        ) : (
                          it.descripcion
                        )}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {it.cantidad} × {dinero(it.precio_unitario)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{dinero(it.cantidad * it.precio_unitario)}</span>
                      {esVendedor && pedido.estado === "borrador" && (
                        <FormAccion action={eliminarItem.bind(null, it.id)}>
                          <BotonEnviar className="text-xs font-medium text-red-700 hover:underline" textoEnviando="…">
                            Quitar
                          </BotonEnviar>
                        </FormAccion>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-texto-suave">
                {esVendedor ? "Agrega los artículos que acordaron en el chat." : "El vendedor todavía no agrega artículos."}
              </p>
            )}

            {esVendedor && pedido.estado === "borrador" && (
              <div className="mt-4 space-y-4 border-t border-borde pt-4">
                <FormAccion action={agregarItem.bind(null, pedido.id)} limpiarAlTerminar className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_80px_120px_auto] sm:items-end">
                  <div className="sm:col-span-4">
                    <label htmlFor="publicacion_id" className="etiqueta">
                      Desde una de tus publicaciones (opcional)
                    </label>
                    <select id="publicacion_id" name="publicacion_id" className="campo" defaultValue="">
                      <option value="">— Artículo libre —</option>
                      {misPublicaciones?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} · {dinero(p.precio)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="descripcion" className="etiqueta">
                      Descripción
                    </label>
                    <input id="descripcion" name="descripcion" className="campo" placeholder="Se toma de la publicación si la eliges" />
                  </div>
                  <div>
                    <label htmlFor="cantidad" className="etiqueta">
                      Cant.
                    </label>
                    <input id="cantidad" name="cantidad" type="number" min={1} defaultValue={1} className="campo" />
                  </div>
                  <div>
                    <label htmlFor="precio_unitario" className="etiqueta">
                      Precio unit.
                    </label>
                    <input id="precio_unitario" name="precio_unitario" type="number" min={0} className="campo" placeholder="Auto" />
                  </div>
                  <BotonEnviar className="btn-secundario" textoEnviando="…">
                    Agregar
                  </BotonEnviar>
                </FormAccion>
                <FormAccion action={confirmarPedido.bind(null, pedido.id)}>
                  <BotonEnviar className="btn-primario w-full" textoEnviando="Confirmando…">
                    Confirmar pedido ({dinero(pedido.total)})
                  </BotonEnviar>
                  <p className="ayuda text-center">Después de confirmar, el comprador podrá adjuntar el comprobante de pago.</p>
                </FormAccion>
              </div>
            )}
          </Seccion>

          {/* Pago (RN-03 / RN-10) */}
          {!["borrador", "cancelado"].includes(pedido.estado) && (esComprador || esVendedor || esAdmin) && (
            <Seccion titulo="Pago">
              <p className="mb-3 text-xs text-texto-suave">
                El pago se acuerda por fuera de TradeNexus. La plataforma no procesa ni guarda datos bancarios.
              </p>
              {pedido.motivo_rechazo_pago && pedido.estado === "pendiente_pago" && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  El vendedor rechazó el comprobante anterior: <strong>{pedido.motivo_rechazo_pago}</strong>
                </p>
              )}
              {pedido.estado === "pendiente_pago" && esComprador && <SubirComprobante pedidoId={pedido.id} />}
              {pedido.estado === "pendiente_pago" && !esComprador && (
                <p className="text-sm text-texto-suave">Esperando que el comprador adjunte el comprobante.</p>
              )}
              {urlComprobante && (
                <div className="space-y-3">
                  <p className="text-sm">
                    Comprobante enviado el {fechaHora(pedido.comprobante_subido_at!)} ·{" "}
                    <a href={urlComprobante} target="_blank" rel="noreferrer" className="enlace">
                      Abrir en otra pestaña
                    </a>
                  </p>
                  {!pedido.comprobante_path!.endsWith(".pdf") && (
                    <img src={urlComprobante} alt="Comprobante de pago" className="max-h-80 rounded-xl border border-borde object-contain" />
                  )}
                </div>
              )}
              {pedido.estado === "pago_en_revision" && esVendedor && (
                <FormAccion action={revisarPago.bind(null, pedido.id)} className="mt-4 space-y-3 border-t border-borde pt-4">
                  <p className="text-sm font-semibold">¿El pago es correcto?</p>
                  <input name="motivo" className="campo" placeholder="Motivo (obligatorio si lo rechazas)" />
                  <div className="flex gap-2">
                    <BotonEnviar name="decision" value="aprobar" className="btn-exito flex-1" textoEnviando="Validando…">
                      Validar pago
                    </BotonEnviar>
                    <BotonEnviar name="decision" value="rechazar" className="btn-peligro flex-1" textoEnviando="Rechazando…">
                      Rechazar
                    </BotonEnviar>
                  </div>
                </FormAccion>
              )}
              {pedido.estado === "pago_en_revision" && esComprador && (
                <p className="mt-2 text-sm text-texto-suave">El vendedor está revisando tu comprobante.</p>
              )}
              {!antesDeEnvio || pedido.estado === "en_lista" ? (
                <p className="mt-2 text-sm font-medium text-emerald-700">✓ Pago validado por el vendedor</p>
              ) : null}
            </Seccion>
          )}

        </div>

        <div className="space-y-6">
          <Seccion titulo="Punto de retiro">
            <p className="text-sm font-semibold">{destino.nombre}</p>
            <p className="text-sm text-texto-suave">
              {destino.direccion} · {destino.provincia}
            </p>
            {destino.horario && <p className="text-sm text-texto-suave">Horario: {destino.horario}</p>}
          </Seccion>

          {puedeCancelar && (
            <Seccion titulo="Cancelar pedido">
              <FormAccion action={cancelarPedido.bind(null, pedido.id)} className="space-y-3">
                <p className="text-xs text-texto-suave">Solo se puede cancelar antes de que el paquete llegue a la tienda de origen. Se notificará a la otra parte.</p>
                <input name="motivo" required minLength={3} className="campo" placeholder="Motivo de la cancelación" />
                <BotonEnviar className="btn-peligro w-full" textoEnviando="Cancelando…">
                  Cancelar pedido
                </BotonEnviar>
              </FormAccion>
            </Seccion>
          )}
        </div>
      </div>
    </div>
  );
}
