"use client";

export default function ErrorPagina({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="tarjeta flex flex-col items-center px-6 py-12 text-center">
        <span className="text-4xl" aria-hidden>
          ⚠️
        </span>
        <p className="mt-3 font-semibold">Algo salió mal</p>
        <p className="mt-1 text-sm text-texto-suave">Intenta de nuevo. Si el problema continúa, avisa al equipo de soporte.</p>
        {digest && <p className="mt-2 font-mono text-xs text-texto-suave">Código: {digest}</p>}
        <button type="button" onClick={() => retry()} className="btn-primario mt-4">
          Reintentar
        </button>
      </div>
    </div>
  );
}
