import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, dinero, diasTexto, fecha, ROLES } from "@/lib/formato";
import type { EstadoPedido, Tienda } from "@/lib/tipos";
import { Cargando, EstadoPedidoBadge, Seccion } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { guardarPerfil } from "./acciones";
import { FotoPerfil } from "./FotoPerfil";
import { HistorialCompras } from "./HistorialCompras";

export const metadata = { title: "Mi perfil" };

export default function PaginaPerfil() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const { id, email, perfil } = await exigirUsuario();
  const supabase = await crearClienteServidor();
  const { data: tiendasData } = await supabase.from("tiendas").select("*").eq("activa", true).order("nombre");
  const tiendas = (tiendasData as Tienda[]) ?? [];
  const preferida = tiendas.find((t) => t.id === perfil.tienda_preferida_id);
  const propia = tiendas.find((t) => t.id === perfil.tienda_id);

  const { data: compras } =
    perfil.rol === "comprador"
      ? await supabase
          .from("pedidos")
          .select("id, estado, total, created_at, vendedor:perfiles!pedidos_vendedor_id_fkey(nombre)")
          .eq("comprador_id", id)
          .neq("estado", "borrador")
          .order("created_at", { ascending: false })
      : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Mi perfil</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {ROLES[perfil.rol]} · {email} · Cuenta creada el {fecha(perfil.created_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Seccion titulo="Datos de la cuenta">
          <div className="mb-5">
            <FotoPerfil usuarioId={id} nombre={perfil.nombre} fotoActual={perfil.foto_path} />
          </div>
          <FormAccion action={guardarPerfil} className="space-y-4">
            <div>
              <label htmlFor="nombre" className="etiqueta">
                Nombre
              </label>
              <input id="nombre" name="nombre" defaultValue={perfil.nombre} required minLength={2} className="campo" />
            </div>

            {perfil.rol === "comprador" && (
              <div>
                <label htmlFor="tienda_preferida_id" className="etiqueta">
                  Tienda de preferencia
                </label>
                <select id="tienda_preferida_id" name="tienda_preferida_id" defaultValue={perfil.tienda_preferida_id ?? ""} className="campo" required>
                  <option value="" disabled>
                    Selecciona una tienda
                  </option>
                  {tiendas
                    .filter((t) => t.es_punto_retiro)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} · {t.provincia}
                      </option>
                    ))}
                </select>
                <p className="ayuda">
                  Esta es tu <strong>punto de retiro</strong>: todas tus compras nuevas se enviarán aquí. Los pedidos ya creados
                  conservan su destino.
                </p>
              </div>
            )}

            {perfil.rol === "vendedor" && (
              <>
                <div>
                  <label htmlFor="tienda_id" className="etiqueta">
                    Tienda donde entrego mis paquetes
                  </label>
                  <select id="tienda_id" name="tienda_id" defaultValue={perfil.tienda_id ?? ""} className="campo" required>
                    <option value="" disabled>
                      Selecciona una tienda
                    </option>
                    {tiendas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} · {t.provincia}
                      </option>
                    ))}
                  </select>
                  <p className="ayuda">Es la tienda de origen de tus pedidos.</p>
                </div>
                <div>
                  <label htmlFor="bio" className="etiqueta">
                    Descripción pública
                  </label>
                  <textarea id="bio" name="bio" defaultValue={perfil.bio ?? ""} rows={3} maxLength={400} className="campo" />
                </div>
              </>
            )}
            <BotonEnviar>Guardar cambios</BotonEnviar>
          </FormAccion>
        </Seccion>

        <div className="space-y-6">
          {perfil.rol === "comprador" && (
            <>
              <section className="tarjeta border-marca/30 bg-marca-clara/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-marca">Tu punto de retiro</p>
                {preferida ? (
                  <>
                    <p className="mt-1 text-lg font-semibold">{preferida.nombre}</p>
                    <p className="text-sm text-tinta-suave">
                      {preferida.direccion} · {preferida.provincia}
                    </p>
                    {preferida.horario && <p className="text-sm text-tinta-suave">Horario: {preferida.horario}</p>}
                  </>
                ) : (
                  <p className="mt-1 text-sm">Aún no eliges una tienda de preferencia. Necesitas una para poder comprar.</p>
                )}
              </section>
              <Seccion titulo="Historial de compras">
                <HistorialCompras
                  compras={(compras ?? []).map((c) => ({
                    id: c.id,
                    codigo: codigoPedido(c.id),
                    estado: c.estado as EstadoPedido,
                    total: dinero(c.total),
                    fecha: fecha(c.created_at),
                    vendedor: (c.vendedor as unknown as { nombre: string } | null)?.nombre ?? "",
                  }))}
                  badges={Object.fromEntries((compras ?? []).map((c) => [c.id, <EstadoPedidoBadge key={c.id} estado={c.estado as EstadoPedido} />]))}
                />
              </Seccion>
            </>
          )}

          {perfil.rol === "vendedor" && (
            <section className="tarjeta p-5">
              <p className="text-sm text-tinta-suave">
                Tus paquetes se entregan en <strong>{propia?.nombre ?? "—"}</strong>
                {propia && ` (despacha los ${diasTexto(propia.dias_despacho)})`}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/vendedores/${id}`} className="btn-secundario">
                  Ver mi perfil público
                </Link>
                <Link href="/vendedor/publicaciones" className="btn-primario">
                  Mis publicaciones
                </Link>
              </div>
            </section>
          )}

          {(perfil.rol === "tienda" || perfil.rol === "soporte" || perfil.rol === "admin") && (
            <section className="tarjeta p-5 text-sm text-tinta-suave">
              {perfil.rol === "tienda" ? (
                <p>
                  Trabajas en <strong>{propia?.nombre}</strong>. Gestiona los paquetes desde el{" "}
                  <Link href="/tienda" className="enlace">
                    panel de tienda
                  </Link>
                  .
                </p>
              ) : (
                <p>Tu rol y tus permisos los administra un administrador de TradeNexus.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
