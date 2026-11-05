// Tipos de las tablas principales (reflejan db/sql/migrations/*.sql)

export type Rol = "comprador" | "vendedor" | "tienda" | "soporte" | "admin";

export type EstadoPedido =
  | "borrador"
  | "pendiente_pago"
  | "pago_en_revision"
  | "en_lista"
  | "en_tienda_origen"
  | "en_transito"
  | "en_punto_intermedio"
  | "listo_para_retiro"
  | "entregado"
  | "cancelado";

export type EstadoDenuncia = "abierta" | "en_revision" | "resuelta" | "cerrada";
export type TipoProducto = "single" | "base";

export interface Tienda {
  id: number;
  nombre: string;
  provincia: string;
  direccion: string;
  telefono: string | null;
  horario: string | null;
  dias_despacho: number[];
  es_punto_retiro: boolean;
  es_ancla: boolean;
  lat: number | null;
  lng: number | null;
  activa: boolean;
}

export interface Juego {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
}

export interface Rareza {
  id: number;
  juego_id: number;
  nombre: string;
  orden: number;
}

export interface Perfil {
  id: string;
  nombre: string;
  rol: Rol;
  tienda_preferida_id: number | null;
  tienda_id: number | null;
  foto_path: string | null;
  bio: string | null;
  created_at: string;
}

export interface Publicacion {
  id: number;
  vendedor_id: string;
  juego_id: number;
  rareza_id: number | null;
  nombre: string;
  descripcion: string;
  precio: number;
  tipo: TipoProducto;
  relevancia_meta: number;
  etiquetas: string[];
  estado: "activa" | "retirada";
  created_at: string;
  updated_at: string;
}

export interface ImagenPublicacion {
  id: number;
  publicacion_id: number;
  path: string;
  orden: number;
}

export interface Pedido {
  id: number;
  comprador_id: string;
  vendedor_id: string;
  conversacion_id: number | null;
  tienda_origen_id: number;
  tienda_destino_id: number;
  estado: EstadoPedido;
  nodo_actual_id: number | null;
  siguiente_nodo_id: number | null;
  ruta_indice: number;
  total: number;
  comprobante_path: string | null;
  comprobante_subido_at: string | null;
  motivo_rechazo_pago: string | null;
  motivo_cancelacion: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  publicacion_id: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export interface EventoPedido {
  id: number;
  pedido_id: number;
  estado: EstadoPedido;
  tienda_id: number | null;
  descripcion: string;
  usuario_id: string | null;
  created_at: string;
}

export interface Mensaje {
  id: number;
  conversacion_id: number;
  autor_id: string;
  contenido: string;
  created_at: string;
}

export interface Notificacion {
  id: number;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  created_at: string;
}

export interface Denuncia {
  id: number;
  pedido_id: number;
  comprador_id: string;
  vendedor_id: string | null;
  motivo: string;
  descripcion: string;
  estado: EstadoDenuncia;
  asignado_a: string | null;
  resolucion: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumenVendedor {
  id: string;
  nombre: string;
  foto_path: string | null;
  bio: string | null;
  tienda_id: number | null;
  created_at: string;
  estrellas: number;
  total_calificaciones: number;
  pedidos: number;
  ventas: number;
}

/** Resultado estándar de una Server Action que usa un formulario. */
export type EstadoAccion = { error?: string; ok?: string };
