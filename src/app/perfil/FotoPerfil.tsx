"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/basicos";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { comprimirImagen, TIPOS_IMAGEN } from "@/lib/imagenes";
import { nombreArchivo } from "@/lib/storage";

export function FotoPerfil({ usuarioId, nombre, fotoActual }: { usuarioId: string; nombre: string; fotoActual: string | null }) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    if (!TIPOS_IMAGEN.includes(archivo.type)) return setError("Usa una imagen JPG, PNG o WebP.");
    setSubiendo(true);
    const supabase = crearClienteNavegador();
    const blob = await comprimirImagen(archivo, 400);
    const path = `${usuarioId}/${nombreArchivo(archivo.name, "webp")}`;
    const { error: e1 } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp" });
    if (e1) {
      setSubiendo(false);
      return setError("No se pudo subir la foto: " + e1.message);
    }
    const { error: e2 } = await supabase.from("perfiles").update({ foto_path: path }).eq("id", usuarioId);
    if (!e2 && fotoActual) await supabase.storage.from("avatars").remove([fotoActual]);
    setSubiendo(false);
    if (e2) return setError(e2.message);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar nombre={nombre} path={fotoActual} tamano={64} />
      <div>
        <label className="btn-secundario cursor-pointer">
          {subiendo ? "Subiendo…" : fotoActual ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept={TIPOS_IMAGEN.join(",")} onChange={cambiar} disabled={subiendo} className="sr-only" />
        </label>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
