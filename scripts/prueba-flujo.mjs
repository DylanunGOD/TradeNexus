// Prueba automatizada del flujo completo de TradeNexus contra Supabase.
// Inicia sesión con las cuentas de demostración y verifica reglas de negocio
// y de seguridad (RLS). Crea datos nuevos en cada ejecución.
//
// Uso:  node --env-file=.env.local scripts/prueba-flujo.mjs
// Requiere haber ejecutado antes scripts/seed-demo.mjs.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const CLAVE = process.env.CLAVE_DEMO || "TradeNexus2026!";

let ok = 0;
let fallos = 0;
function check(descripcion, condicion, detalle = "") {
  if (condicion) {
    ok++;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos++;
    console.log(`  ✗ ${descripcion} ${detalle}`);
  }
}
const seccion = (t) => console.log(`\n▸ ${t}`);

async function sesion(email) {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: CLAVE });
  if (error) throw new Error(`${email}: ${error.message}`);
  c.uid = data.user.id;
  return c;
}

const png = () => new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(64).fill(0)])], { type: "image/png" });

const comprador = await sesion("comprador@tradenexus.test");
const comprador2 = await sesion("comprador2@tradenexus.test");
const vendedor = await sesion("burro@tradenexus.test");
const vendedor2 = await sesion("vendedor@tradenexus.test");
const tiendaOrigen = await sesion("tienda1@tradenexus.test"); // Burro Singles

const { data: tiendas } = await comprador.from("tiendas").select("id, nombre");
const idTienda = (n) => tiendas.find((t) => t.nombre.includes(n)).id;

// ---------------------------------------------------------------------
seccion("Perfiles y roles (RNF-05)");
{
  const { error } = await comprador.from("perfiles").update({ rol: "admin" }).eq("id", comprador.uid);
  check("Un comprador no puede darse el rol de administrador", !!error, error ? "" : "(se permitió)");
  const { data } = await comprador.from("perfiles").select("rol").eq("id", comprador.uid).single();
  check("El rol del comprador sigue igual", data.rol === "comprador");
  await comprador.from("perfiles").update({ tienda_preferida_id: idTienda("Heredia") }).eq("id", comprador.uid);
}

// ---------------------------------------------------------------------
seccion("Publicaciones (RF-04)");
{
  const { data: j } = await vendedor.from("juegos").select("id").eq("slug", "pokemon").single();
  const { error } = await vendedor.from("publicaciones").insert({ vendedor_id: vendedor.uid, juego_id: j.id, nombre: "Sexta carta", precio: 1000 });
  check("No se permite una 6.ª publicación activa", error?.message.includes("5 publicaciones"), error?.message);
  const { error: e2 } = await comprador.from("publicaciones").insert({ vendedor_id: comprador.uid, juego_id: j.id, nombre: "No soy vendedor", precio: 1 });
  check("Un comprador no puede publicar", !!e2);
  const { data: mias } = await vendedor.from("publicaciones").select("id").eq("vendedor_id", vendedor.uid).limit(1);
  const { error: e3 } = await vendedor2.from("publicaciones").update({ precio: 1 }).eq("id", mias[0].id).select().single();
  check("Un vendedor no puede editar publicaciones ajenas", !!e3);
  const { data: r } = await vendedor.from("rarezas").select("id").neq("juego_id", j.id).limit(1).single();
  const { error: e4 } = await vendedor.from("publicaciones").update({ rareza_id: r.id }).eq("id", mias[0].id);
  check("La rareza debe corresponder al juego", e4?.message.includes("rareza"), e4?.message);
}

// ---------------------------------------------------------------------
seccion("Chat y creación del pedido (RN-02)");
const { data: conv, error: eConv } = await comprador.rpc("iniciar_conversacion", { p_vendedor: vendedor.uid });
check("El comprador inicia una conversación", !!conv, eConv?.message);
await comprador.from("mensajes").insert({ conversacion_id: conv, autor_id: comprador.uid, contenido: "Hola, ¿tienes el Charizard?" });
await vendedor.from("mensajes").insert({ conversacion_id: conv, autor_id: vendedor.uid, contenido: "¡Sí! Te armo el pedido." });
{
  const { data } = await comprador2.from("mensajes").select("id").eq("conversacion_id", conv);
  check("Otro comprador no puede leer el chat ajeno", data.length === 0);
  const { data: n } = await vendedor.from("notificaciones").select("*").eq("referencia", `conversacion:${conv}`);
  check("El vendedor recibió la notificación del mensaje", n.length >= 1);
}

const { data: pedido, error: ePed } = await comprador.rpc("crear_pedido", { p_conversacion: conv });
check("El comprador crea el pedido vacío desde el chat", !!pedido, ePed?.message);
{
  const { error } = await comprador.from("pedido_items").insert({ pedido_id: pedido, descripcion: "Intento del comprador", precio_unitario: 1 });
  check("El comprador no puede llenar el pedido", !!error);
  const { error: e0 } = await vendedor.rpc("confirmar_pedido", { p_pedido: pedido });
  check("No se puede confirmar un pedido sin artículos", e0?.message.includes("al menos un artículo"), e0?.message);
  const { error: e1 } = await vendedor.from("pedido_items").insert([
    { pedido_id: pedido, descripcion: "Charizard ex (Obsidian Flames)", cantidad: 1, precio_unitario: 85000 },
    { pedido_id: pedido, descripcion: "Sleeves", cantidad: 2, precio_unitario: 2500 },
  ]);
  check("El vendedor agrega los artículos", !e1, e1?.message);
  const { data: p } = await vendedor.from("pedidos").select("total").eq("id", pedido).single();
  check("El total se calcula automáticamente (₡90 000)", Number(p.total) === 90000, String(p.total));
  const { error: e2 } = await vendedor.rpc("confirmar_pedido", { p_pedido: pedido });
  check("El vendedor confirma el pedido", !e2, e2?.message);
  const { error: e3 } = await vendedor.from("pedido_items").insert({ pedido_id: pedido, descripcion: "Extra", precio_unitario: 1 });
  check("Tras confirmar, ya no se pueden cambiar los artículos", !!e3);
  const { error: e4 } = await vendedor.from("pedidos").update({ estado: "entregado" }).eq("id", pedido).select().single();
  check("Nadie puede cambiar el estado directamente (solo vía RPC)", !!e4);
}

// ---------------------------------------------------------------------
seccion("Comprobante de pago (RN-03, RNF-05)");
{
  const { error: e0 } = await tiendaOrigen.rpc("recibir_en_origen", { p_pedido: pedido });
  check('Sin comprobante validado no pasa a "en tienda de origen"', e0?.message.includes("comprobante validado"), e0?.message);

  const ruta1 = `${pedido}/comprobante-1.png`;
  const { error: eUp2 } = await comprador2.storage.from("comprobantes").upload(`${pedido}/intruso.png`, png());
  check("Otro comprador no puede subir comprobantes a este pedido", !!eUp2);
  const { error: eUp } = await comprador.storage.from("comprobantes").upload(ruta1, png());
  check("El comprador sube el comprobante", !eUp, eUp?.message);
  const { error: eReg } = await comprador.rpc("registrar_comprobante", { p_pedido: pedido, p_path: ruta1 });
  check("El comprador registra el comprobante", !eReg, eReg?.message);

  const { error: eVer } = await vendedor.storage.from("comprobantes").createSignedUrl(ruta1, 60);
  check("El vendedor puede ver el comprobante", !eVer, eVer?.message);
  const { error: eVer2 } = await comprador2.storage.from("comprobantes").createSignedUrl(ruta1, 60);
  check("Un tercero NO puede ver el comprobante", !!eVer2);
  const { error: eVer3 } = await tiendaOrigen.storage.from("comprobantes").createSignedUrl(ruta1, 60);
  check("La tienda NO puede ver el comprobante", !!eVer3);

  const { error: eRech0 } = await vendedor.rpc("revisar_pago", { p_pedido: pedido, p_aprobado: false, p_motivo: "" });
  check("Rechazar exige un motivo", !!eRech0);
  const { error: eRech } = await vendedor.rpc("revisar_pago", { p_pedido: pedido, p_aprobado: false, p_motivo: "El monto no coincide" });
  check("El vendedor rechaza el comprobante con motivo", !eRech, eRech?.message);

  const ruta2 = `${pedido}/comprobante-2.png`;
  await comprador.storage.from("comprobantes").upload(ruta2, png());
  await comprador.rpc("registrar_comprobante", { p_pedido: pedido, p_path: ruta2 });
  const { error: eAprob } = await vendedor.rpc("revisar_pago", { p_pedido: pedido, p_aprobado: true });
  check('El vendedor valida el pago → "en lista"', !eAprob, eAprob?.message);
  const { error: eCanc } = await comprador.rpc("cancelar_pedido", { p_pedido: pedido, p_motivo: "Ya no lo quiero" });
  check("El comprador ya no puede cancelar un pedido pagado", !!eCanc);
}

console.log(`\nResultado: ${ok} pruebas correctas, ${fallos} fallidas.`);
process.exit(fallos ? 1 : 0);
