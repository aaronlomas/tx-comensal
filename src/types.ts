export type MesaEstado = 'libre' | 'ocupada' | 'reservada' | 'cuenta_solicitada' | 'sucia';
export type TimerFase = 'pedido' | 'cocinando' | 'servido';

/** Tracking de tiempo activo por mesa (guardado en localStorage junto a las comandas) */
export interface MesaTimer {
	/** Timestamp (ms) desde el que se inició el conteo del estado actual */
	inicioMs: number;
	/** Estado que disparó el timer: 'pedido' | 'cocinando' | 'servido' */
	fase: TimerFase;
}
export type ComandaEstado = 'abierta' | 'en_preparacion' | 'servida' | 'facturada' | 'anulada';
export type DetalleEstado = 'pedido' | 'cocinando' | 'servido' | 'anulado';

export interface Mesa {
	id: number;
	ambiente_id: number;
	numero: string;
	capacidad: number;
	estado: MesaEstado;
	activo: boolean;
}

export interface Ambiente {
	id: number;
	codigo_sede: string;
	nombre: string;
	activo: boolean;
	mesas: Mesa[];
}

export interface ComandaDetalle {
	id: number;
	comanda_id: number;
	producto_id: number;
	producto_nombre: string;
	cantidad: number;
	precio_unitario: number;
	importe: number;
	notas?: string | null;
	estado: DetalleEstado;
}

export interface Comanda {
	id: number;
	mesa_id: number;
	numero_comanda: string;
	numero_personas: number;
	codigo_sede: string;
	mozo?: string | null;
	estado: ComandaEstado;
	fecha_apertura: string;
	fecha_cierre?: string | null;
	comprobante_id?: number | null;
	detalles: ComandaDetalle[];
}

export interface CreateComandaPayload {
	mesa_id: number;
	numero_comanda: string;
	numero_personas?: number;
	codigo_sede?: string;
	mozo?: string | null;
}

export interface AddDetallePayload {
	producto_id: number;
	cantidad: number;
	precio_unitario: number;
	notas?: string | null;
}

export interface UpdateDetalleEstadoPayload {
	estado: DetalleEstado;
}

export interface UpdateMesaEstadoPayload {
	estado: MesaEstado;
}

export interface FinalizarComandaPayload {
	comprobante_id?: number | null;
	limpiar_mesa: boolean;
}

export interface CreateAmbientePayload {
	nombre: string;
	codigo_sede?: string;
}

export interface CreateMesaPayload {
	ambiente_id: number;
	numero: string;
	capacidad?: number;
}

export interface UpdateMesaPayload {
	numero?: string;
	capacidad?: number;
	ambiente_id?: number;
}
