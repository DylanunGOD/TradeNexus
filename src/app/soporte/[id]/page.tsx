import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { Cargando } from "@/components/ui/basicos";
import { DetalleDenuncia } from "@/components/DetalleDenuncia";

export const metadata = { title: "Gestionar denuncia" };

export default function GestionDenuncia({ params }: PageProps<"/soporte/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/soporte/[id]">["params"] }) {
  const { id } = await params;
  const usuario = await exigirUsuario(["soporte", "admin"]);
  return <DetalleDenuncia id={Number(id)} usuario={usuario} />;
}
