import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, dinero, ESTADOS_PEDIDO, fechaHora } from "@/lib/formato";
import type { EstadoPedido } from "@/lib/tipos";
import { Cargando, EstadoPedidoBadge, Vacio } from "@/components/ui/basicos";

export const metadata = { title: "Todos los pedidos" };

export default function PedidosAdmin({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/admin/pedidos">["searchParams"] }) {
  await exigirUsuario(["admin"]);
  const { estado } = await searchParams;
  const filtro = typeof estado === "string" && estado in ESTADOS_PEDIDO ? (estado as EstadoPedido) : null;
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("pedidos")
    .select(
      "id, estado, total, updated_at, comprador:perfiles!pedidos_comprador_id_fkey(nombre), vendedor:perfiles!pedidos_vendedor_id_fkey(nombre), origen:tiendas!pedidos_tienda_origen_id_fkey(nombre), destino:tiendas!pedidos_tienda_destino_id_fkey(nombre)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filtro) consulta = consulta.eq("estado", filtro);
  const { data } = await consulta;
  const nombre = (x: unknown) => (x as { nombre: string } | null)?.nombre;

  return (
    <div className="space-y-5">
      <h1 className="titulo-pagina">Pedidos</h1>
      <nav className="flex flex-wrap gap-2">
        <Link href="/admin/pedidos" className={`chip ${!filtro ? "border-tinta bg-tinta text-white" : ""}`}>
          Todos
        </Link>
        {(Object.keys(ESTADOS_PEDIDO) as EstadoPedido[]).map((e) => (
          <Link key={e} href={`/admin/pedidos?estado=${e}`} className={`chip ${filtro === e ? "border-tinta bg-tinta text-white" : ""}`}>
            {ESTADOS_PEDIDO[e].texto}
          </Link>
        ))}
      </nav>
      {!data?.length ? (
        <Vacio titulo="No hay pedidos en esta vista" />
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-borde text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Comprador → Vendedor</th>
                <th className="px-4 py-3">Ruta</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-fondo">
                  <td className="px-4 py-2.5 font-semibold">
                    <Link href={`/pedidos/${p.id}`} className="hover:text-marca">
                      {codigoPedido(p.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <EstadoPedidoBadge estado={p.estado as EstadoPedido} />
                  </td>
                  <td className="px-4 py-2.5">
                    {nombre(p.comprador)} → {nombre(p.vendedor)}
                  </td>
                  <td className="px-4 py-2.5 text-texto-suave">
                    {nombre(p.origen)} → {nombre(p.destino)}
                  </td>
                  <td className="px-4 py-2.5 text-right">{dinero(p.total)}</td>
                  <td className="px-4 py-2.5 text-texto-suave">{fechaHora(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
