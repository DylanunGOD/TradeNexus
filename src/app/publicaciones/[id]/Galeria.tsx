"use client";

import { useState } from "react";
import { ImagenCarta } from "@/components/ui/basicos";

export function Galeria({ imagenes, nombre, juegoSlug }: { imagenes: string[]; nombre: string; juegoSlug: string }) {
  const [actual, setActual] = useState(0);
  return (
    <div className="space-y-3">
      <div className="tarjeta aspect-[3/4] overflow-hidden">
        <ImagenCarta path={imagenes[actual]} nombre={nombre} juegoSlug={juegoSlug} className="object-contain bg-white" />
      </div>
      {imagenes.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {imagenes.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActual(i)}
              className={`aspect-square overflow-hidden rounded-xl border-2 ${i === actual ? "border-marca" : "border-transparent opacity-70 hover:opacity-100"}`}
              aria-label={`Ver imagen ${i + 1}`}
            >
              <ImagenCarta path={img} nombre={`${nombre} ${i + 1}`} juegoSlug={juegoSlug} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
