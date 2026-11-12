import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido } from "@/lib/formato";
import { Cargando } from "@/components/ui/basicos";
import { FormularioDenuncia } from "./FormularioDenuncia";

export const metadata = { title: "Reportar un problema" };

export default function NuevaDenuncia({ searchParams }: PageProps<"/denuncias/nueva">) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="titulo-pagina">Reportar un problema</h1>
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/denuncias/nueva">["searchParams"] }) {
  const { pedido } = await searchParams;
  const { id } = await exigirUsuario(["comprador"]);
  const supabase = await crearClienteServidor();
  const { data: p } = await supabase
    .from("pedidos")
    .select("id, vendedor:perfiles!pedidos_vendedor_id_fkey(nombre)")
    .eq("id", Number(pedido))
    .eq("comprador_id", id)
    .maybeSingle();
  if (!p) notFound();

  return (
    <>
      <p className="text-sm text-texto-suave">
        Pedido{" "}
        <Link href={`/pedidos/${p.id}`} className="enlace">
          {codigoPedido(p.id)}
        </Link>{" "}
        con {(p.vendedor as unknown as { nombre: string }).nombre}. El equipo de soporte revisará tu caso y te responderá aquí.
      </p>
      <FormularioDenuncia pedidoId={p.id} compradorId={id} />
    </>
  );
}
