import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, dinero, fecha } from "@/lib/formato";
import type { EstadoPedido } from "@/lib/tipos";
import { Cargando, EstadoPedidoBadge, Vacio } from "@/components/ui/basicos";

export const metadata = { title: "Pedidos" };

const VISTAS = {
  activos: { texto: "En curso", estados: ["borrador", "pendiente_pago", "pago_en_revision", "en_lista", "en_tienda_origen", "en_transito", "en_punto_intermedio", "listo_para_retiro"] },
  entregados: { texto: "Entregados", estados: ["entregado"] },
  cancelados: { texto: "Cancelados", estados: ["cancelado"] },
} as const;

export default function PaginaPedidos({ searchParams }: PageProps<"/pedidos">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/pedidos">["searchParams"] }) {
  const { vista: v } = await searchParams;
  const vista = (typeof v === "string" && v in VISTAS ? v : "activos") as keyof typeof VISTAS;
  const usuario = await exigirUsuario(["comprador", "vendedor"]);
  const esVendedor = usuario.perfil.rol === "vendedor";
  const supabase = await crearClienteServidor();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select(
      "id, estado, total, created_at, updated_at, comprador:perfiles!pedidos_comprador_id_fkey(nombre), vendedor:perfiles!pedidos_vendedor_id_fkey(nombre), destino:tiendas!pedidos_tienda_destino_id_fkey(nombre), items:pedido_items(descripcion)",
    )
    .eq(esVendedor ? "vendedor_id" : "comprador_id", usuario.id)
    .in("estado", [...VISTAS[vista].estados])
    .order("updated_at", { ascending: false });

  // Pendientes de acción para el vendedor (RF-05)
  const requiereAccion = (e: EstadoPedido) => (esVendedor ? e === "borrador" || e === "pago_en_revision" : e === "pendiente_pago" || e === "listo_para_retiro");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina">{esVendedor ? "Pedidos de mis cartas" : "Mis pedidos"}</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {esVendedor ? "Consulta, valida o cancela los pedidos de tus cartas." : "Sigue el estado y la ubicación de tus compras."}
        </p>
      </div>

      <nav className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-borde sm:w-fit" aria-label="Filtrar pedidos">
        {Object.entries(VISTAS).map(([clave, { texto }]) => (
          <Link
            key={clave}
            href={`/pedidos?vista=${clave}`}
            className={`flex-1 rounded-lg px-4 py-1.5 text-center text-sm font-medium sm:flex-none ${vista === clave ? "bg-tinta text-white" : "text-tinta-suave hover:bg-fondo"}`}
            aria-current={vista === clave ? "page" : undefined}
          >
            {texto}
          </Link>
        ))}
      </nav>

      {!pedidos?.length ? (
        <Vacio
          titulo={vista === "activos" ? "No tienes pedidos en curso" : "No hay pedidos aquí"}
          texto={esVendedor ? "Los pedidos se crean cuando un comprador te contacta por el chat." : "Encuentra una carta en el catálogo y contacta al vendedor."}
          accion={esVendedor ? undefined : { href: "/", texto: "Ir al catálogo" }}
        />
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => {
            const otro = (esVendedor ? p.comprador : p.vendedor) as unknown as { nombre: string };
            const items = p.items as { descripcion: string }[];
            const accion = requiereAccion(p.estado as EstadoPedido);
            return (
              <li key={p.id}>
                <Link href={`/pedidos/${p.id}`} className={`tarjeta flex flex-col gap-2 p-4 hover:border-marca sm:flex-row sm:items-center ${accion ? "border-l-4 border-l-acento" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{codigoPedido(p.id)}</span>
                      <EstadoPedidoBadge estado={p.estado as EstadoPedido} />
                      {accion && <span className="text-xs font-semibold text-amber-700">Requiere tu acción</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-tinta-suave">
                      {items.length ? items.map((i) => i.descripcion).join(", ") : "Sin artículos todavía"}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {esVendedor ? "Comprador" : "Vendedor"}: {otro?.nombre} · Retiro en {(p.destino as unknown as { nombre: string })?.nombre} · {fecha(p.created_at)}
                    </p>
                  </div>
                  <span className="text-lg font-bold">{dinero(p.total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
