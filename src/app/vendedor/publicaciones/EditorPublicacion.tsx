"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { comprimirImagen, MAX_MB, TIPOS_IMAGEN } from "@/lib/imagenes";
import { nombreArchivo, urlPublica } from "@/lib/storage";
import { RELEVANCIA_META } from "@/lib/formato";
import type { Juego, Publicacion, Rareza } from "@/lib/tipos";

const MAX_IMAGENES = 4;

interface ImagenExistente {
  id: number;
  path: string;
  orden: number;
}

/**
 * Formulario para crear o editar una publicación. Guarda los datos con
 * RLS (solo el dueño puede escribir), comprime cada foto en el navegador
 * y la sube a Storage en la carpeta del vendedor.
 */
export function EditorPublicacion({
  vendedorId,
  juegos,
  rarezas,
  publicacion,
  imagenesIniciales = [],
}: {
  vendedorId: string;
  juegos: Juego[];
  rarezas: Rareza[];
  publicacion?: Publicacion;
  imagenesIniciales?: ImagenExistente[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [juegoId, setJuegoId] = useState<number>(publicacion?.juego_id ?? juegos[0]?.id);
  const [existentes, setExistentes] = useState(imagenesIniciales);
  const [nuevas, setNuevas] = useState<{ archivo: File; vista: string }[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const rarezasJuego = rarezas.filter((r) => r.juego_id === juegoId);
  const espacio = MAX_IMAGENES - existentes.length - nuevas.length;

  function agregarImagenes(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    const validos = archivos.filter((a) => TIPOS_IMAGEN.includes(a.type) && a.size <= MAX_MB * 1024 * 1024);
    if (validos.length < archivos.length) setError(`Solo se aceptan imágenes JPG, PNG o WebP de hasta ${MAX_MB} MB.`);
    if (validos.length > espacio) setError(`Solo puedes tener ${MAX_IMAGENES} imágenes por publicación.`);
    setNuevas((prev) => [...prev, ...validos.slice(0, espacio).map((archivo) => ({ archivo, vista: URL.createObjectURL(archivo) }))]);
  }

  async function quitarExistente(img: ImagenExistente) {
    if (!confirm("¿Eliminar esta imagen?")) return;
    const { error: e } = await supabase.from("publicacion_imagenes").delete().eq("id", img.id);
    if (e) return setError(e.message);
    await supabase.storage.from("publicaciones").remove([img.path]);
    setExistentes((prev) => prev.filter((x) => x.id !== img.id));
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const datos = {
      vendedor_id: vendedorId,
      nombre: String(fd.get("nombre")).trim(),
      descripcion: String(fd.get("descripcion") ?? "").trim(),
      precio: Number(fd.get("precio")),
      juego_id: Number(fd.get("juego_id")),
      rareza_id: Number(fd.get("rareza_id")) || null,
      tipo: String(fd.get("tipo")),
      relevancia_meta: Number(fd.get("relevancia_meta")),
      etiquetas: String(fd.get("etiquetas") ?? "")
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 8),
    };
    if (!(datos.precio >= 0)) return setError("Indica un precio válido.");

    setGuardando(true);
    let id = publicacion?.id;
    if (id) {
      const { error: e1 } = await supabase.from("publicaciones").update(datos).eq("id", id);
      if (e1) return falla(e1.message);
    } else {
      const { data, error: e1 } = await supabase.from("publicaciones").insert(datos).select("id").single();
      if (e1) return falla(e1.message);
      id = data.id as number;
    }

    let orden = existentes.reduce((m, i) => Math.max(m, i.orden), -1) + 1;
    for (const { archivo } of nuevas) {
      const blob = await comprimirImagen(archivo);
      const path = `${vendedorId}/${id}/${nombreArchivo(archivo.name, "webp")}`;
      const { error: e2 } = await supabase.storage.from("publicaciones").upload(path, blob, { contentType: "image/webp" });
      if (e2) return falla("No se pudo subir una imagen: " + e2.message);
      const { error: e3 } = await supabase.from("publicacion_imagenes").insert({ publicacion_id: id, path, orden: orden++ });
      if (e3) return falla(e3.message);
    }

    router.push("/vendedor/publicaciones");
    router.refresh();
  }

  function falla(mensaje: string) {
    setGuardando(false);
    setError(mensaje);
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <fieldset disabled={guardando} className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="tarjeta space-y-4 p-5">
          <div>
            <label htmlFor="nombre" className="etiqueta">
              Nombre de la carta o producto
            </label>
            <input id="nombre" name="nombre" required minLength={2} maxLength={120} defaultValue={publicacion?.nombre} className="campo" placeholder="Ej.: Charizard ex (Obsidian Flames)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="juego_id" className="etiqueta">
                Juego
              </label>
              <select id="juego_id" name="juego_id" value={juegoId} onChange={(e) => setJuegoId(Number(e.target.value))} className="campo">
                {juegos.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rareza_id" className="etiqueta">
                Rareza
              </label>
              <select
                id="rareza_id"
                name="rareza_id"
                key={juegoId}
                defaultValue={publicacion?.juego_id === juegoId ? (publicacion?.rareza_id ?? "") : ""}
                className="campo"
              >
                <option value="">Sin rareza / no aplica</option>
                {rarezasJuego.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="precio" className="etiqueta">
                Precio (colones)
              </label>
              <input id="precio" name="precio" type="number" min={0} step={1} required defaultValue={publicacion?.precio} className="campo" />
            </div>
            <div>
              <label htmlFor="tipo" className="etiqueta">
                Tipo
              </label>
              <select id="tipo" name="tipo" defaultValue={publicacion?.tipo ?? "single"} className="campo">
                <option value="single">Single (carta individual)</option>
                <option value="base">Base (producto sellado o lote)</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="relevancia_meta" className="etiqueta">
              Relevancia en el meta competitivo
            </label>
            <select id="relevancia_meta" name="relevancia_meta" defaultValue={publicacion?.relevancia_meta ?? 0} className="campo">
              {RELEVANCIA_META.map((t, i) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
            </select>
            <p className="ayuda">Los compradores pueden ordenar el catálogo por este criterio. Un administrador puede ajustarlo.</p>
          </div>
          <div>
            <label htmlFor="etiquetas" className="etiqueta">
              Etiquetas
            </label>
            <input id="etiquetas" name="etiquetas" defaultValue={publicacion?.etiquetas.join(", ")} className="campo" placeholder="near-mint, competitivo, coleccion" />
            <p className="ayuda">Sepáralas con comas (máximo 8).</p>
          </div>
          <div>
            <label htmlFor="descripcion" className="etiqueta">
              Descripción
            </label>
            <textarea id="descripcion" name="descripcion" rows={5} maxLength={2000} defaultValue={publicacion?.descripcion} className="campo" placeholder="Estado de la carta, edición, idioma, detalles…" />
          </div>
        </div>

        <div className="tarjeta space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="etiqueta mb-0">Imágenes</p>
            <span className="text-xs text-texto-suave">
              {existentes.length + nuevas.length}/{MAX_IMAGENES}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {existentes.map((img) => (
              <div key={img.id} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-borde">
                <img src={urlPublica("publicaciones", img.path)} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => quitarExistente(img)} className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-red-700 shadow">
                  Quitar
                </button>
              </div>
            ))}
            {nuevas.map((n, i) => (
              <div key={n.vista} className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-dashed border-marca/50">
                <img src={n.vista} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-marca px-1.5 py-0.5 text-[10px] font-bold text-white">Nueva</span>
                <button type="button" onClick={() => setNuevas((prev) => prev.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-red-700 shadow">
                  Quitar
                </button>
              </div>
            ))}
            {espacio > 0 && (
              <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-borde text-center text-sm text-texto-suave hover:border-marca hover:text-marca">
                <span className="text-2xl" aria-hidden>
                  +
                </span>
                Agregar fotos
                <input type="file" accept={TIPOS_IMAGEN.join(",")} multiple onChange={agregarImagenes} className="sr-only" />
              </label>
            )}
          </div>
          <p className="ayuda">Las fotos se comprimen automáticamente antes de subirlas. La primera es la portada.</p>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" className="btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : publicacion ? "Guardar cambios" : "Publicar"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secundario" disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
