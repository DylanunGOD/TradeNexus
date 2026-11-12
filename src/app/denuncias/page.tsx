import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, fecha } from "@/lib/formato";
import type { EstadoDenuncia } from "@/lib/tipos";
import { Cargando, EstadoDenunciaBadge, Vacio } from "@/components/ui/basicos";

export const metadata = { title: "Mis denuncias" };

export default function MisDenuncias() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina">Mis denuncias</h1>
        <p className="mt-1 text-sm text-texto-suave">Para reportar un problema, abre el pedido y presiona “Reportar un problema”.</p>
      </div>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { id } = await exigirUsuario(["comprador"]);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("denuncias").select("*").eq("comprador_id", id).order("updated_at", { ascending: false });
  if (!data?.length) return <Vacio titulo="No has presentado denuncias" texto="Esperamos que todas tus compras salgan bien." />;
  return (
    <ul className="tarjeta divide-y divide-borde overflow-hidden">
      {data.map((d) => (
        <li key={d.id}>
          <Link href={`/denuncias/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-fondo">
            <div>
              <p className="text-sm font-semibold">
                #{d.id} · {d.motivo}
              </p>
              <p className="text-xs text-texto-suave">
                Pedido {codigoPedido(d.pedido_id)} · {fecha(d.created_at)}
              </p>
            </div>
            <EstadoDenunciaBadge estado={d.estado as EstadoDenuncia} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
