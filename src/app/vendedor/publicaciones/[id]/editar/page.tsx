import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Juego, Publicacion, Rareza } from "@/lib/tipos";
import { Cargando } from "@/components/ui/basicos";
import { EditorPublicacion } from "../../EditorPublicacion";

export const metadata = { title: "Editar publicación" };

export default function EditarPublicacion({ params }: PageProps<"/vendedor/publicaciones/[id]/editar">) {
  return (
    <div className="space-y-6">
      <h1 className="titulo-pagina">Editar publicación</h1>
      <Suspense fallback={<Cargando />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/vendedor/publicaciones/[id]/editar">["params"] }) {
  const { id: publicacionId } = await params;
  const { id } = await exigirUsuario(["vendedor"]);
  const supabase = await crearClienteServidor();
  const [{ data: p }, { data: juegos }, { data: rarezas }, { data: imagenes }] = await Promise.all([
    supabase.from("publicaciones").select("*").eq("id", Number(publicacionId)).eq("vendedor_id", id).maybeSingle(),
    supabase.from("juegos").select("*").order("orden"),
    supabase.from("rarezas").select("*").order("orden"),
    supabase.from("publicacion_imagenes").select("id, path, orden").eq("publicacion_id", Number(publicacionId)).order("orden"),
  ]);
  if (!p) notFound();
  return (
    <EditorPublicacion
      vendedorId={id}
      juegos={(juegos as Juego[]) ?? []}
      rarezas={(rarezas as Rareza[]) ?? []}
      publicacion={p as Publicacion}
      imagenesIniciales={imagenes ?? []}
    />
  );
}
