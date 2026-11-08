import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Juego, Rareza } from "@/lib/tipos";
import { Cargando } from "@/components/ui/basicos";
import { EditorPublicacion } from "../EditorPublicacion";

export const metadata = { title: "Nueva publicación" };

export default function NuevaPublicacion() {
  return (
    <div className="space-y-6">
      <h1 className="titulo-pagina">Nueva publicación</h1>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { id } = await exigirUsuario(["vendedor"]);
  const supabase = await crearClienteServidor();
  const [{ data: juegos }, { data: rarezas }] = await Promise.all([
    supabase.from("juegos").select("*").order("orden"),
    supabase.from("rarezas").select("*").order("orden"),
  ]);
  return <EditorPublicacion vendedorId={id} juegos={(juegos as Juego[]) ?? []} rarezas={(rarezas as Rareza[]) ?? []} />;
}
