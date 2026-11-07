"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoAccion } from "@/lib/tipos";

export async function iniciarSesion(_: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "Correo o contraseña incorrectos." };
  const destino = String(formData.get("destino") ?? "/");
  redirect(destino.startsWith("/") ? destino : "/");
}

export async function registrarse(_: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rol = formData.get("rol") === "vendedor" ? "vendedor" : "comprador";
  const tienda = String(formData.get("tienda") ?? "");

  if (nombre.length < 2) return { error: "Escribe tu nombre." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (!tienda) {
    return {
      error: rol === "vendedor" ? "Selecciona la tienda donde entregarás tus paquetes." : "Selecciona tu tienda de preferencia.",
    };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: rol === "vendedor" ? { nombre, rol, tienda_id: tienda } : { nombre, rol, tienda_preferida_id: tienda },
    },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return { error: "Ya existe una cuenta con ese correo." };
    return { error: "No se pudo crear la cuenta: " + error.message };
  }
  if (!data.session) {
    return { ok: "Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión." };
  }
  redirect(rol === "vendedor" ? "/vendedor/publicaciones" : "/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/");
}
