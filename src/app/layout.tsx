import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TradeNexus · Cartas coleccionables", template: "%s · TradeNexus" },
  description: "Compra y vende cartas TCG con trazabilidad por la red de tiendas afiliadas.",
};

export const viewport: Viewport = { themeColor: "#14112b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-borde bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-texto-suave sm:flex-row sm:justify-between">
            <p>TradeNexus · Proyecto académico de Administración de Proyectos</p>
            <p>Los pagos se acuerdan fuera de la plataforma. TradeNexus no procesa transacciones bancarias.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
