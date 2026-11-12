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
const tiendaHeredia = await sesion("tienda2@tradenexus.test");
const tiendaAlajuela = await sesion("tienda3@tradenexus.test");
const soporte = await sesion("soporte@tradenexus.test");
const admin = await sesion("admin@tradenexus.test");

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

// ---------------------------------------------------------------------
seccion("Trazabilidad por la red (RF-7, RF-8, RN-04, RN-05)");
{
  const { error: eWrong } = await tiendaHeredia.rpc("recibir_en_origen", { p_pedido: pedido });
  check("Una tienda distinta a la de origen no puede recibirlo", !!eWrong);
  const { error: eRuta } = await admin.rpc("definir_ruta", { p_pedido: pedido, p_paradas: [idTienda("Alajuela")] });
  check("El admin agrega un punto intermedio a la ruta", !eRuta, eRuta?.message);
  const { error: e1 } = await tiendaOrigen.rpc("recibir_en_origen", { p_pedido: pedido });
  check("La tienda de origen confirma la recepción física", !e1, e1?.message);
  const { error: e2 } = await tiendaOrigen.rpc("despachar_pedido", { p_pedido: pedido });
  check("La tienda de origen despacha hacia el punto intermedio", !e2, e2?.message);
  const { error: e3x } = await tiendaHeredia.rpc("recibir_en_nodo", { p_pedido: pedido });
  check("Solo la tienda destino del tramo puede registrar la llegada", !!e3x);
  const { error: e3 } = await tiendaAlajuela.rpc("recibir_en_nodo", { p_pedido: pedido });
  check("Llega al punto intermedio (Alajuela)", !e3, e3?.message);
  let { data: p } = await comprador.from("pedidos").select("estado").eq("id", pedido).single();
  check('Estado = "en_punto_intermedio"', p.estado === "en_punto_intermedio", p.estado);
  await tiendaAlajuela.rpc("despachar_pedido", { p_pedido: pedido });
  const { error: e4 } = await tiendaHeredia.rpc("recibir_en_nodo", { p_pedido: pedido });
  check("Llega al punto de retiro (Heredia)", !e4, e4?.message);
  ({ data: p } = await comprador.from("pedidos").select("estado").eq("id", pedido).single());
  check('Estado = "listo_para_retiro"', p.estado === "listo_para_retiro", p.estado);
}

// ---------------------------------------------------------------------
seccion("Código de retiro (RF-9, RN-11)");
{
  const { data: c } = await comprador.from("codigos_retiro").select("codigo").eq("pedido_id", pedido).maybeSingle();
  check("El comprador ve su código de 6 dígitos", /^\d{6}$/.test(c?.codigo ?? ""));
  const { data: cv } = await vendedor.from("codigos_retiro").select("codigo").eq("pedido_id", pedido);
  const { data: ct } = await tiendaHeredia.from("codigos_retiro").select("codigo").eq("pedido_id", pedido);
  check("Ni el vendedor ni la tienda pueden leer el código", cv.length === 0 && ct.length === 0);
  const incorrecto = c.codigo === "000000" ? "111111" : "000000";
  const { error: eMal } = await tiendaHeredia.rpc("confirmar_retiro", { p_pedido: pedido, p_codigo: incorrecto });
  check("Un código incorrecto es rechazado", eMal?.message.includes("incorrecto"), eMal?.message);
  const { error: eBien } = await tiendaHeredia.rpc("confirmar_retiro", { p_pedido: pedido, p_codigo: c.codigo });
  check('Con el código correcto pasa a "entregado"', !eBien, eBien?.message);
}

// ---------------------------------------------------------------------
seccion("Historial inmutable (RNF-06)");
{
  const { data: ev } = await comprador.from("eventos_pedido").select("*").eq("pedido_id", pedido).order("created_at");
  check(`Se registraron ${ev.length} eventos con fecha, hora y usuario`, ev.length >= 10 && ev.every((e) => e.created_at && e.descripcion));
  check("Cada evento tiene usuario responsable", ev.every((e) => e.usuario_id));
  const { error: eUpd } = await admin.from("eventos_pedido").update({ descripcion: "alterado" }).eq("pedido_id", pedido).select();
  const { data: ev2 } = await admin.from("eventos_pedido").select("descripcion").eq("pedido_id", pedido);
  check("Ni el admin puede modificar el historial", !!eUpd || ev2.every((e) => e.descripcion !== "alterado"));
  await admin.from("eventos_pedido").delete().eq("pedido_id", pedido);
  const { data: ev3 } = await admin.from("eventos_pedido").select("id").eq("pedido_id", pedido);
  check("Ni el admin puede borrar el historial", ev3.length === ev.length);
  const { data: n } = await comprador.from("notificaciones").select("titulo").ilike("titulo", "%listo para retiro%");
  check("El comprador recibió la notificación de listo para retiro", n.length >= 1);
}

// ---------------------------------------------------------------------
seccion("Reputación (RF-11)");
{
  const { error: e1 } = await comprador.from("calificaciones").insert({ pedido_id: pedido, estrellas: 5, comentario: "Excelente vendedor" });
  check("El comprador califica al vendedor", !e1, e1?.message);
  const { error: e2 } = await comprador.from("calificaciones").insert({ pedido_id: pedido, estrellas: 1 });
  check("Solo se califica una vez por pedido", !!e2);
  const { data: r } = await comprador2.from("vendedores_resumen").select("*").eq("id", vendedor.uid).single();
  check("Las estrellas y ventas son públicas en el perfil", Number(r.estrellas) > 0 && Number(r.ventas) >= 1, JSON.stringify(r));
}

// ---------------------------------------------------------------------
seccion("Denuncias y strikes (RF-12, RF-13)");
{
  const { data: d, error: e1 } = await comprador
    .from("denuncias")
    .insert({ pedido_id: pedido, motivo: "Producto dañado", descripcion: "La carta llegó con una esquina doblada." })
    .select()
    .single();
  check("El comprador presenta una denuncia", !e1, e1?.message);
  const { error: eEv } = await comprador.storage.from("evidencias").upload(`${d.id}/foto.png`, png());
  await comprador.from("denuncia_evidencias").insert({ denuncia_id: d.id, path: `${d.id}/foto.png`, nombre: "foto.png" });
  check("Adjunta evidencia", !eEv, eEv?.message);
  const { data: vista2 } = await comprador2.from("denuncias").select("id").eq("id", d.id);
  check("Otro comprador no ve la denuncia", vista2.length === 0);
  const { data: vistaV } = await vendedor.from("denuncias").select("id").eq("id", d.id);
  check("El vendedor no ve la denuncia", vistaV.length === 0);
  const { error: eS } = await soporte.storage.from("evidencias").createSignedUrl(`${d.id}/foto.png`, 60);
  check("Soporte ve la evidencia", !eS, eS?.message);
  await soporte.from("denuncia_comentarios").insert({ denuncia_id: d.id, autor_id: soporte.uid, contenido: "Estamos revisando tu caso." });
  const { error: eC0 } = await soporte.rpc("gestionar_denuncia", { p_denuncia: d.id, p_estado: "cerrada" });
  check("No se puede cerrar sin resolución", !!eC0);
  const { error: eC } = await soporte.rpc("gestionar_denuncia", { p_denuncia: d.id, p_estado: "cerrada", p_resolucion: "Se acordó un reembolso parcial." });
  check("Soporte gestiona la denuncia hasta su cierre", !eC, eC?.message);
  const { error: eC2 } = await comprador.rpc("gestionar_denuncia", { p_denuncia: d.id, p_estado: "abierta" });
  check("El comprador no puede gestionar denuncias", !!eC2);

  const { error: eSt0 } = await soporte.from("strikes").insert({ vendedor_id: vendedor.uid, admin_id: soporte.uid, motivo: "Intento de soporte" });
  check("Soporte no puede registrar strikes (solo admin)", !!eSt0);
  const { error: eSt } = await admin.from("strikes").insert({ vendedor_id: vendedor.uid, admin_id: admin.uid, denuncia_id: d.id, motivo: "Producto entregado en mal estado" });
  check("El admin registra un strike", !eSt, eSt?.message);
  const { data: sc } = await comprador.from("strikes").select("id");
  check("Los compradores NO ven los strikes", sc.length === 0);
  const { data: ss } = await soporte.from("strikes").select("id");
  check("Soporte sí ve los strikes", ss.length >= 1);
}

// ---------------------------------------------------------------------
seccion("Cancelación antes del envío (RF-05)");
{
  const { data: p2 } = await comprador.rpc("crear_pedido", { p_conversacion: conv });
  await vendedor.from("pedido_items").insert({ pedido_id: p2, descripcion: "Gardevoir ex", precio_unitario: 9500 });
  await vendedor.rpc("confirmar_pedido", { p_pedido: p2 });
  const { error: e0 } = await vendedor.rpc("cancelar_pedido", { p_pedido: p2, p_motivo: "" });
  check("Cancelar exige un motivo", !!e0);
  const { error: e1 } = await vendedor.rpc("cancelar_pedido", { p_pedido: p2, p_motivo: "Me quedé sin stock" });
  check("El vendedor cancela antes del envío", !e1, e1?.message);
  const { data: n } = await comprador.from("notificaciones").select("mensaje").ilike("titulo", `%${String(p2).padStart(6, "0")}%cancelado%`);
  check("La cancelación se notifica al comprador", n.length === 1 && n[0].mensaje.includes("sin stock"));
}

console.log(`\nResultado: ${ok} pruebas correctas, ${fallos} fallidas.`);
process.exit(fallos ? 1 : 0);
