import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { Cargando } from "@/components/ui/basicos";
import { DetalleDenuncia } from "@/components/DetalleDenuncia";

export const metadata = { title: "Denuncia" };

export default function PaginaDenuncia({ params }: PageProps<"/denuncias/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/denuncias/[id]">["params"] }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  return <DetalleDenuncia id={Number(id)} usuario={usuario} />;
}
