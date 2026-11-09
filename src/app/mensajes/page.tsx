import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { Cargando } from "@/components/ui/basicos";
import { ListaConversaciones } from "./ListaConversaciones";

export const metadata = { title: "Mensajes" };

export default function Mensajes() {
  return (
    <div className="space-y-4">
      <h1 className="titulo-pagina">Mensajes</h1>
      <div className="tarjeta overflow-hidden">
        <Suspense fallback={<Cargando />}>
          <Contenido />
        </Suspense>
      </div>
    </div>
  );
}

async function Contenido() {
  const { id } = await exigirUsuario(["comprador", "vendedor"]);
  return <ListaConversaciones usuarioId={id} />;
}
