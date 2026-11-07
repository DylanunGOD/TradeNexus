"use client";

import { useState } from "react";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import type { Tienda } from "@/lib/tipos";
import { registrarse } from "../acciones";

export function FormularioRegistro({ tiendas }: { tiendas: Tienda[] }) {
  const [rol, setRol] = useState<"comprador" | "vendedor">("comprador");

  return (
    <FormAccion action={registrarse} className="mt-6 space-y-4">
      <fieldset>
        <legend className="etiqueta">¿Qué quieres hacer?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["comprador", "Comprar cartas", "Busca, chatea y sigue tus pedidos"],
              ["vendedor", "Vender cartas", "Publica hasta 5 cartas a la vez"],
            ] as const
          ).map(([valor, titulo, texto]) => (
            <label
              key={valor}
              className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                rol === valor ? "border-marca bg-marca-clara ring-2 ring-marca/20" : "border-borde hover:bg-fondo"
              }`}
            >
              <input type="radio" name="rol" value={valor} checked={rol === valor} onChange={() => setRol(valor)} className="sr-only" />
              <span className="block font-semibold text-tinta">{titulo}</span>
              <span className="text-xs text-texto-suave">{texto}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="nombre" className="etiqueta">
          Nombre {rol === "vendedor" ? "o nombre de tu tienda" : ""}
        </label>
        <input id="nombre" name="nombre" required minLength={2} autoComplete="name" className="campo" />
      </div>
      <div>
        <label htmlFor="email" className="etiqueta">
          Correo electrónico
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="campo" />
      </div>
      <div>
        <label htmlFor="password" className="etiqueta">
          Contraseña
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="campo" />
        <p className="ayuda">Mínimo 8 caracteres.</p>
      </div>
      <div>
        <label htmlFor="tienda" className="etiqueta">
          {rol === "vendedor" ? "Tienda donde entregarás tus paquetes" : "Tienda de preferencia (punto de retiro)"}
        </label>
        <select id="tienda" name="tienda" required defaultValue="" className="campo">
          <option value="" disabled>
            Selecciona una tienda
          </option>
          {tiendas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} · {t.provincia}
            </option>
          ))}
        </select>
        <p className="ayuda">
          {rol === "vendedor"
            ? "La tienda confirmará la recepción física de cada paquete antes de enviarlo."
            : "Todas tus compras llegarán a esta tienda. Puedes cambiarla luego en tu perfil."}
        </p>
      </div>
      <BotonEnviar className="btn-primario w-full" textoEnviando="Creando cuenta…">
        Crear cuenta
      </BotonEnviar>
    </FormAccion>
  );
}
