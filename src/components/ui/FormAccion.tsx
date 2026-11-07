"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoAccion } from "@/lib/tipos";

type Accion = (estado: EstadoAccion, formData: FormData) => Promise<EstadoAccion>;

/**
 * Formulario que llama a una Server Action y muestra el error o el
 * mensaje de éxito que esta devuelva. Mientras se envía, los campos
 * quedan deshabilitados para evitar dobles envíos.
 */
export function FormAccion({
  action,
  children,
  className,
  limpiarAlTerminar = false,
}: {
  action: Accion;
  children: React.ReactNode;
  className?: string;
  limpiarAlTerminar?: boolean;
}) {
  const [estado, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (limpiarAlTerminar && estado.ok) ref.current?.reset();
  }, [estado, limpiarAlTerminar]);

  return (
    <form ref={ref} action={formAction} className={className}>
      <Campos>{children}</Campos>
      {estado.error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {estado.ok}
        </p>
      )}
    </form>
  );
}

function Campos({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className="contents">
      {children}
    </fieldset>
  );
}

export function BotonEnviar({
  children,
  className = "btn-primario",
  textoEnviando = "Guardando…",
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  textoEnviando?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  const esEste = !name || data?.get(name) === value;
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending}>
      {pending && esEste ? textoEnviando : children}
    </button>
  );
}
