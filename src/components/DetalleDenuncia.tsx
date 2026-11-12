import Link from "next/link";
import { notFound } from "next/navigation";
import type { Usuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, ESTADOS_DENUNCIA, fecha, fechaHora } from "@/lib/formato";
import type { Denuncia, EstadoDenuncia } from "@/lib/tipos";
import { EstadoDenunciaBadge, Seccion } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { comentarDenuncia, gestionarDenuncia } from "@/app/denuncias/acciones";

/** Detalle de una denuncia. El comprador conversa con soporte; soporte la gestiona hasta su cierre. */
export async function DetalleDenuncia({ id, usuario }: { id: number; usuario: Usuario }) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("denuncias").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const d = data as Denuncia;
  const esSoporte = ["soporte", "admin"].includes(usuario.perfil.rol);

  const [{ data: evidencias }, { data: comentarios }, { data: personas }, { data: strikes }] = await Promise.all([
    supabase.from("denuncia_evidencias").select("*").eq("denuncia_id", d.id),
    supabase.from("denuncia_comentarios").select("*").eq("denuncia_id", d.id).order("created_at"),
    supabase.from("perfiles").select("id, nombre, rol").in("id", [d.comprador_id, d.vendedor_id, d.asignado_a].filter(Boolean) as string[]),
    esSoporte && d.vendedor_id
      ? supabase.from("strikes").select("*").eq("vendedor_id", d.vendedor_id).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);
  const idsAutores = [...new Set((comentarios ?? []).map((c) => c.autor_id))];
  const { data: autores } = idsAutores.length ? await supabase.from("perfiles").select("id, nombre, rol").in("id", idsAutores) : { data: [] };
  const nombres = new Map([...(personas ?? []), ...(autores ?? [])].map((p) => [p.id, p]));

  const urls = await Promise.all(
    (evidencias ?? []).map(async (e) => {
      const { data: firmado } = await supabase.storage.from("evidencias").createSignedUrl(e.path, 600);
      return { ...e, url: firmado?.signedUrl };
    }),
  );
  const cerrada = d.estado === "cerrada";

  return (
    <div className="space-y-6">
      <div>
        <Link href={esSoporte ? "/soporte" : "/denuncias"} className="text-sm text-texto-suave hover:text-marca">
          ← {esSoporte ? "Denuncias" : "Mis denuncias"}
        </Link>
        <h1 className="titulo-pagina mt-1 flex flex-wrap items-center gap-3">
          Denuncia #{d.id} <EstadoDenunciaBadge estado={d.estado} />
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          {d.motivo} · Pedido{" "}
          <Link href={`/pedidos/${d.pedido_id}`} className="enlace">
            {codigoPedido(d.pedido_id)}
          </Link>{" "}
          · Presentada el {fecha(d.created_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Seccion titulo="Descripción del problema">
            <p className="whitespace-pre-line text-sm text-tinta-suave">{d.descripcion}</p>
            {urls.length > 0 && (
              <div className="mt-4">
                <p className="etiqueta">Evidencia adjunta</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {urls.map((e) =>
                    e.path.endsWith(".pdf") ? (
                      <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="flex aspect-square items-center justify-center rounded-xl border border-borde text-sm font-medium text-marca">
                        📄 PDF
                      </a>
                    ) : (
                      <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-borde">
                        <img src={e.url} alt={e.nombre ?? "Evidencia"} className="h-full w-full object-cover" />
                      </a>
                    ),
                  )}
                </div>
              </div>
            )}
          </Seccion>

          <Seccion titulo="Seguimiento">
            {d.resolucion && (
              <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-semibold">Resolución</p>
                <p>{d.resolucion}</p>
              </div>
            )}
            {comentarios?.length ? (
              <ul className="space-y-3">
                {comentarios.map((c) => {
                  const autor = nombres.get(c.autor_id);
                  const deSoporte = autor && ["soporte", "admin"].includes(autor.rol);
                  return (
                    <li key={c.id} className={`rounded-xl p-3 text-sm ${deSoporte ? "bg-marca-clara/60" : "bg-fondo"}`}>
                      <p className="text-xs font-semibold">
                        {autor?.nombre} {deSoporte && <span className="font-normal text-marca">· Soporte</span>}
                        <span className="ml-2 font-normal text-texto-suave">{fechaHora(c.created_at)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line">{c.contenido}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-texto-suave">Aún no hay comentarios.</p>
            )}
            {!cerrada && (
              <FormAccion action={comentarDenuncia.bind(null, d.id)} limpiarAlTerminar className="mt-4 space-y-2">
                <textarea name="contenido" rows={3} required maxLength={2000} className="campo" placeholder={esSoporte ? "Responder al comprador…" : "Agregar información para soporte…"} />
                <BotonEnviar className="btn-secundario">Enviar comentario</BotonEnviar>
              </FormAccion>
            )}
          </Seccion>
        </div>

        <div className="space-y-6">
          <Seccion titulo="Involucrados">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-texto-suave">Comprador</dt>
                <dd className="font-medium">{nombres.get(d.comprador_id)?.nombre}</dd>
              </div>
              <div>
                <dt className="text-xs text-texto-suave">Vendedor</dt>
                <dd>
                  {d.vendedor_id && (
                    <Link href={`/vendedores/${d.vendedor_id}`} className="font-medium hover:text-marca">
                      {nombres.get(d.vendedor_id)?.nombre}
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-texto-suave">Atendida por</dt>
                <dd className="font-medium">{d.asignado_a ? nombres.get(d.asignado_a)?.nombre : "Sin asignar"}</dd>
              </div>
            </dl>
          </Seccion>

          {esSoporte && !cerrada && (
            <Seccion titulo="Gestionar denuncia">
              <FormAccion action={gestionarDenuncia.bind(null, d.id)} className="space-y-3">
                <div>
                  <label htmlFor="estado" className="etiqueta">
                    Estado
                  </label>
                  <select id="estado" name="estado" defaultValue={d.estado === "abierta" ? "en_revision" : d.estado} className="campo">
                    {(Object.keys(ESTADOS_DENUNCIA) as EstadoDenuncia[]).map((e) => (
                      <option key={e} value={e}>
                        {ESTADOS_DENUNCIA[e].texto}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="resolucion" className="etiqueta">
                    Resolución
                  </label>
                  <textarea id="resolucion" name="resolucion" rows={3} defaultValue={d.resolucion ?? ""} className="campo" placeholder="Obligatoria para resolver o cerrar" />
                </div>
                <BotonEnviar className="btn-primario w-full">Guardar</BotonEnviar>
              </FormAccion>
            </Seccion>
          )}

          {esSoporte && d.vendedor_id && (
            <Seccion titulo={`Strikes del vendedor (${strikes?.length ?? 0})`}>
              <p className="mb-3 text-xs text-texto-suave">Registro interno: los compradores no pueden verlo.</p>
              {strikes?.length ? (
                <ul className="mb-3 space-y-2 text-sm">
                  {strikes.map((s) => (
                    <li key={s.id} className="rounded-lg bg-red-50 px-3 py-2 text-red-900">
                      {s.motivo} <span className="block text-xs text-red-700/70">{fecha(s.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-texto-suave">Sin strikes registrados.</p>
              )}
            </Seccion>
          )}
        </div>
      </div>
    </div>
  );
}
