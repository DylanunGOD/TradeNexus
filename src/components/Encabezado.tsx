import Link from "next/link";
import { obtenerUsuario } from "@/lib/auth";
import { ROLES } from "@/lib/formato";
import type { Rol } from "@/lib/tipos";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { Avatar } from "./ui/basicos";

const ENLACES: Record<Rol, { href: string; texto: string }[]> = {
  comprador: [
    { href: "/", texto: "Catálogo" },
    { href: "/mensajes", texto: "Mensajes" },
    { href: "/pedidos", texto: "Mis pedidos" },
    { href: "/denuncias", texto: "Mis denuncias" },
  ],
  vendedor: [
    { href: "/", texto: "Catálogo" },
    { href: "/vendedor/publicaciones", texto: "Mis publicaciones" },
    { href: "/pedidos", texto: "Pedidos" },
    { href: "/mensajes", texto: "Mensajes" },
  ],
  tienda: [
    { href: "/", texto: "Catálogo" },
    { href: "/tienda", texto: "Panel de tienda" },
  ],
  soporte: [
    { href: "/", texto: "Catálogo" },
    { href: "/soporte", texto: "Denuncias" },
    { href: "/admin/strikes", texto: "Strikes" },
  ],
  admin: [
    { href: "/", texto: "Catálogo" },
    { href: "/admin", texto: "Administración" },
    { href: "/tienda", texto: "Logística" },
    { href: "/soporte", texto: "Denuncias" },
  ],
};

export function MarcoEncabezado({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 bg-tinta text-white shadow-lg shadow-tinta/10">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-marca to-fuchsia-500 text-sm">
            TN
          </span>
          TradeNexus
        </Link>
        {children}
      </div>
    </header>
  );
}

export async function Encabezado() {
  const usuario = await obtenerUsuario();

  if (!usuario) {
    return (
      <MarcoEncabezado>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-xl px-3 py-2 font-medium text-white/90 hover:bg-white/10">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="rounded-xl bg-white px-3 py-2 font-semibold text-tinta hover:bg-marca-clara">
            Crear cuenta
          </Link>
        </nav>
      </MarcoEncabezado>
    );
  }

  const enlaces = ENLACES[usuario.perfil.rol];

  return (
    <MarcoEncabezado>
      <nav className="hidden items-center gap-1 text-sm md:flex">
        {enlaces.map((e) => (
          <Link key={e.href} href={e.href} className="rounded-xl px-3 py-2 font-medium text-white/80 hover:bg-white/10 hover:text-white">
            {e.texto}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <Avatar nombre={usuario.perfil.nombre} path={usuario.perfil.foto_path} tamano={32} />
            <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{usuario.perfil.nombre}</span>
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-white/70" fill="currentColor" aria-hidden>
              <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-borde bg-white py-1 text-sm text-tinta shadow-xl">
            <div className="border-b border-borde px-4 py-3">
              <p className="truncate font-semibold">{usuario.perfil.nombre}</p>
              <p className="truncate text-xs text-texto-suave">
                {ROLES[usuario.perfil.rol]} · {usuario.email}
              </p>
            </div>
            <div className="md:hidden">
              {enlaces.map((e) => (
                <Link key={e.href} href={e.href} className="block px-4 py-2 hover:bg-fondo">
                  {e.texto}
                </Link>
              ))}
              <hr className="my-1 border-borde" />
            </div>
            <Link href="/perfil" className="block px-4 py-2 hover:bg-fondo">
              Mi perfil
            </Link>
            {usuario.perfil.rol === "vendedor" && (
              <Link href={`/vendedores/${usuario.id}`} className="block px-4 py-2 hover:bg-fondo">
                Ver mi perfil público
              </Link>
            )}
            <form action={cerrarSesion}>
              <button type="submit" className="block w-full px-4 py-2 text-left text-red-700 hover:bg-red-50">
                Cerrar sesión
              </button>
            </form>
          </div>
        </details>
      </div>
    </MarcoEncabezado>
  );
}
