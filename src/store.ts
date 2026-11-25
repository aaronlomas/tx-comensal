import { writable, get } from 'svelte/store';
import { taxoLog } from '$lib/features/taxoLog';
import { productsStore } from '$lib/features/products';
import { restaurantClient } from './api';
import type {
	Ambiente,
	Comanda,
	ComandaDetalle,
	CreateAmbientePayload,
	CreateMesaPayload,
	DetalleEstado,
	Mesa,
	MesaEstado,
	MesaTimer,
	TimerFase,
	UpdateMesaPayload
} from './types';

interface RestaurantState {
	ambientes: Ambiente[];
	mesaSeleccionada: Mesa | null;
	comandaActiva: Comanda | null;
	loading: boolean;
	loadingComanda: boolean;
	/** Registro de comandas activas por mesaId para alimentar la vista tipo lista */
	comandas: Record<number, Comanda>;
	/** Timers por mesa_id para saber el tiempo activo de cada mesa */
	mesaTimers: Record<number, MesaTimer>;
}

const LOG_SOURCE = 'restaurante';

/** Recalcula el timer de una mesa dado el estado de sus detalles activos.
 *  - Si hay items en 'cocinando' → fase 'cocinando'.
 *  - Si no hay items en 'cocinando' pero sí en 'pedido' → fase 'pedido'.
 *  - Si todos los items activos están en 'servido' → fase 'servido'.
 *  - Si no hay items activos → null (sin timer).
 *  REGLA DE NEGOCIO: El tiempo se reinicia a 0 (Date.now()) SIEMPRE que la fase cambie
 *  (ej: de 'pedido' a 'cocinando', de 'cocinando' a 'servido', etc.).
 */
function calcularTimerMesa(
	detalles: ComandaDetalle[],
	timerActual: MesaTimer | undefined
): MesaTimer | null {
	const activos = detalles.filter((d) => d.estado !== 'anulado');
	if (activos.length === 0) return null;

	let nuevaFase: TimerFase;
	if (activos.some((d) => d.estado === 'cocinando')) {
		nuevaFase = 'cocinando';
	} else if (activos.some((d) => d.estado === 'pedido')) {
		nuevaFase = 'pedido';
	} else if (activos.every((d) => d.estado === 'servido')) {
		nuevaFase = 'servido';
	} else {
		nuevaFase = 'pedido';
	}

	// Si la fase no cambió, mantenemos el inicioMs existente
	if (timerActual && timerActual.fase === nuevaFase) {
		return timerActual;
	}

	// Si la fase cambió (ej: pedido -> cocinando), REINICIAMOS el tiempo desde ahora
	return { inicioMs: Date.now(), fase: nuevaFase };
}

let _localSeq = 0;
/** Genera IDs locales únicos para el fallback offline (evita colisiones de Date.now() en el mismo ms). */
const genLocalId = () => Date.now() * 1000 + ++_localSeq;

const dedupeDetalles = <T extends { id: number }>(items: T[]): T[] => {
	const seen = new Set<number>();
	return items.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
};

const sanitizeComanda = (comanda: Comanda): Comanda => ({
	...comanda,
	detalles: dedupeDetalles(comanda.detalles ?? [])
});
const STORAGE_KEY = 'tx_restaurant_data_v1';

const DEFAULT_AMBIENTES: Ambiente[] = [
	{
		id: 1,
		codigo_sede: '0000',
		nombre: 'Salón Principal',
		activo: true,
		mesas: [
			{ id: 1, ambiente_id: 1, numero: '1', capacidad: 4, estado: 'libre', activo: true },
			{ id: 2, ambiente_id: 1, numero: '2', capacidad: 4, estado: 'libre', activo: true },
			{ id: 3, ambiente_id: 1, numero: '3', capacidad: 4, estado: 'libre', activo: true },
			{ id: 4, ambiente_id: 1, numero: '4', capacidad: 4, estado: 'libre', activo: true },
			{ id: 5, ambiente_id: 1, numero: '5', capacidad: 4, estado: 'libre', activo: true },
			{ id: 6, ambiente_id: 1, numero: '6', capacidad: 4, estado: 'libre', activo: true },
			{ id: 7, ambiente_id: 1, numero: '7', capacidad: 4, estado: 'libre', activo: true },
			{ id: 8, ambiente_id: 1, numero: '8', capacidad: 4, estado: 'libre', activo: true }
		]
	},
	{
		id: 2,
		codigo_sede: '0000',
		nombre: 'Terraza',
		activo: true,
		mesas: [
			{ id: 9, ambiente_id: 2, numero: '101', capacidad: 4, estado: 'libre', activo: true },
			{ id: 10, ambiente_id: 2, numero: '102', capacidad: 4, estado: 'libre', activo: true },
			{ id: 11, ambiente_id: 2, numero: '103', capacidad: 4, estado: 'libre', activo: true },
			{ id: 12, ambiente_id: 2, numero: '104', capacidad: 4, estado: 'libre', activo: true }
		]
	}
];

interface PersistedData {
	ambientes: Ambiente[];
	comandas: Record<number, Comanda>;
	/** Timers de tiempo activo indexados por mesa_id */
	mesaTimers: Record<number, MesaTimer>;
}

function loadPersistedData(): PersistedData {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
		return { ambientes: DEFAULT_AMBIENTES, comandas: {}, mesaTimers: {} };
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && Array.isArray(parsed.ambientes) && parsed.ambientes.length > 0) {
				const comandas: Record<number, Comanda> = {};
				for (const [k, v] of Object.entries(parsed.comandas ?? {})) {
					comandas[Number(k)] = sanitizeComanda(v as Comanda);
				}
				const mesaTimers: Record<number, MesaTimer> = {};
				for (const [k, v] of Object.entries(parsed.mesaTimers ?? {})) {
					mesaTimers[Number(k)] = v as MesaTimer;
				}
				return { ambientes: parsed.ambientes, comandas, mesaTimers };
			}
		}
	} catch (e) {
		console.warn('[tx-pl-restaurant] No se pudo leer datos locales, usando semilla inicial', e);
	}
	return { ambientes: DEFAULT_AMBIENTES, comandas: {}, mesaTimers: {} };
}

function savePersistedData(data: PersistedData) {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (e) {
		console.warn('[tx-pl-restaurant] No se pudo persistir datos locales', e);
	}
}

let localCache = loadPersistedData();

function toErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message;
	}
	return fallback;
}

function logDbError(error: unknown, fallback: string): string {
	const message = toErrorMessage(error, fallback);
	taxoLog.error(message, LOG_SOURCE);
	return message;
}

function createRestaurantStore() {
	const initialData = loadPersistedData();
	const { subscribe, update, set } = writable<RestaurantState>({
		ambientes: initialData.ambientes,
		mesaSeleccionada: null,
		comandaActiva: null,
		loading: false,
		loadingComanda: false,
		comandas: initialData.comandas ?? {},
		mesaTimers: initialData.mesaTimers ?? {}
	});

	async function cargarAmbientes() {
		update((s) => ({ ...s, loading: true }));
		try {
			const ambientes = await restaurantClient.getAmbientes();
			if (Array.isArray(ambientes) && ambientes.length > 0) {
				localCache.ambientes = ambientes;
				savePersistedData(localCache);
				update((s) => ({
					...s,
					ambientes,
					loading: false,
					mesaSeleccionada: s.mesaSeleccionada
						? (ambientes.flatMap((a) => a.mesas).find((m) => m.id === s.mesaSeleccionada?.id) ?? null)
						: null
				}));
				return;
			}
		} catch {
			// Backend no disponible o en modo plugin local: usamos almacenamiento local
		}

		// Fallback local
		localCache = loadPersistedData();
		update((s) => ({
			...s,
			ambientes: localCache.ambientes,
			loading: false,
			mesaSeleccionada: s.mesaSeleccionada
				? (localCache.ambientes.flatMap((a) => a.mesas).find((m) => m.id === s.mesaSeleccionada?.id) ?? null)
				: null
		}));
	}

	async function seleccionarMesa(mesa: Mesa | null) {
		if (!mesa) {
			update((s) => ({ ...s, mesaSeleccionada: null, comandaActiva: null }));
			return;
		}

		update((s) => ({ ...s, mesaSeleccionada: mesa, loadingComanda: true }));
		try {
			const comanda = await restaurantClient.getComandaActiva(mesa.id);
			if (comanda) {
				update((s) => ({ ...s, comandaActiva: sanitizeComanda(comanda), loadingComanda: false }));
				return;
			}
		} catch {
			// Backend no disponible: revisar cache local
		}

		// Fallback local
		try {
			const comandaLocal = localCache.comandas[mesa.id] ?? null;
			update((s) => ({
				...s,
				comandaActiva: comandaLocal ? sanitizeComanda(comandaLocal) : null,
				loadingComanda: false
			}));
		} catch {
			update((s) => ({ ...s, comandaActiva: null, loadingComanda: false }));
		}
	}

	async function crearComanda(payload: {
		numeroComanda?: string;
		numeroPersonas?: number;
		mozo?: string | null;
	}) {
		let currentMesa: Mesa | null = null;
		update((s) => {
			currentMesa = s.mesaSeleccionada;
			return { ...s, loadingComanda: true };
		});

		if (!currentMesa) {
			update((s) => ({ ...s, loadingComanda: false }));
			throw new Error('No hay mesa seleccionada');
		}

		const mesaId = (currentMesa as Mesa).id;
		const numeroComanda =
			payload.numeroComanda || `CMD-${mesaId}-${Date.now().toString().slice(-4)}`;

		try {
			const comanda = await restaurantClient.createComanda({
				mesa_id: mesaId,
				numero_comanda: numeroComanda,
				numero_personas: payload.numeroPersonas ?? 1,
				mozo: payload.mozo ?? null
			});

			taxoLog.info(
				`Comanda ${comanda.numero_comanda} creada para la mesa ${mesaId}`,
				LOG_SOURCE
			);

			const sanitized = sanitizeComanda(comanda);
			const nuevoTimer: MesaTimer = { inicioMs: Date.now(), fase: 'pedido' };
			localCache.mesaTimers[mesaId] = nuevoTimer;
			localCache.comandas[mesaId] = sanitized;
			savePersistedData(localCache);

			update((s) => ({
				...s,
				comandaActiva: sanitized,
				comandas: { ...s.comandas, [mesaId]: sanitized },
				mesaTimers: { ...s.mesaTimers, [mesaId]: nuevoTimer },
				loadingComanda: false
			}));
			await cargarAmbientes();
			return comanda;
		} catch {
			// Fallback local: crear comanda en localCache
			const nuevaComanda: Comanda = {
				id: genLocalId(),
				mesa_id: mesaId,
				numero_comanda: numeroComanda,
				numero_personas: payload.numeroPersonas ?? 1,
				codigo_sede: '0000',
				mozo: payload.mozo ?? null,
				estado: 'abierta',
				fecha_apertura: new Date().toISOString(),
				fecha_cierre: null,
				comprobante_id: null,
				detalles: []
			};

			const nuevoTimer: MesaTimer = { inicioMs: Date.now(), fase: 'pedido' };
			localCache.mesaTimers[mesaId] = nuevoTimer;
			localCache.comandas[mesaId] = nuevaComanda;
			// Marcar mesa como ocupada
			for (const amb of localCache.ambientes) {
				const m = amb.mesas.find((item) => item.id === mesaId);
				if (m) {
					m.estado = 'ocupada';
					break;
				}
			}
			savePersistedData(localCache);

			taxoLog.info(`Comanda ${numeroComanda} creada localmente para la mesa ${mesaId}`, LOG_SOURCE);
			update((s) => ({
				...s,
				ambientes: [...localCache.ambientes],
				comandaActiva: nuevaComanda,
				comandas: { ...s.comandas, [mesaId]: nuevaComanda },
				mesaTimers: { ...s.mesaTimers, [mesaId]: nuevoTimer },
				loadingComanda: false
			}));
			return nuevaComanda;
		}
	}

	async function agregarDetalle(payload: {
		productoId: number;
		cantidad: number;
		precioUnitario: number;
		notas?: string | null;
	}) {
		let currentComanda: Comanda | null = null;
		let currentMesa: Mesa | null = null;
		update((s) => {
			currentComanda = s.comandaActiva;
			currentMesa = s.mesaSeleccionada;
			return s;
		});

		if (!currentComanda) {
			throw new Error('No hay comanda activa');
		}

		try {
			const nuevoDetalle = await restaurantClient.addDetalle((currentComanda as Comanda).id, {
				producto_id: payload.productoId,
				cantidad: payload.cantidad,
				precio_unitario: payload.precioUnitario,
				notas: payload.notas ?? null
			});

			taxoLog.info(
				`Producto "${nuevoDetalle.producto_nombre}" agregado a la comanda ${(currentComanda as Comanda).numero_comanda}`,
				LOG_SOURCE
			);

			update((s) => {
				if (!s.comandaActiva) return s;
				const nuevosDetalles = [
					...s.comandaActiva.detalles.filter((d) => d.id !== nuevoDetalle.id),
					nuevoDetalle
				];
				const mesaId = s.comandaActiva.mesa_id;
				const comandaActualizada = { ...s.comandaActiva, detalles: nuevosDetalles };
				localCache.comandas[mesaId] = comandaActualizada;
				const nuevoTimer = calcularTimerMesa(nuevosDetalles, s.mesaTimers[mesaId]);
				const mesaTimers = { ...s.mesaTimers };
				if (nuevoTimer) mesaTimers[mesaId] = nuevoTimer;
				localCache.mesaTimers = mesaTimers;
				savePersistedData(localCache);
				return {
					...s,
					mesaTimers,
					comandas: { ...s.comandas, [mesaId]: comandaActualizada },
					comandaActiva: comandaActualizada
				};
			});
			return nuevoDetalle;
		} catch {
			// Fallback local: resolver nombre de producto desde productsStore
			const productos = get(productsStore);
			const prod = productos.find((p) => p.id === payload.productoId);
			const productoNombre = prod?.nombre || `Producto #${payload.productoId}`;

			const nuevoDetalle: ComandaDetalle = {
				id: genLocalId(),
				comanda_id: (currentComanda as Comanda).id,
				producto_id: payload.productoId,
				producto_nombre: productoNombre,
				cantidad: payload.cantidad,
				precio_unitario: payload.precioUnitario,
				importe: payload.cantidad * payload.precioUnitario,
				notas: payload.notas ?? null,
				estado: 'pedido'
			};

			const mesaId = (currentComanda as Comanda).mesa_id;
			if (localCache.comandas[mesaId]) {
				const detallesCache = localCache.comandas[mesaId].detalles;
				const idxDetalle = detallesCache.findIndex((d) => d.id === nuevoDetalle.id);
				if (idxDetalle >= 0) detallesCache[idxDetalle] = nuevoDetalle;
				else detallesCache.push(nuevoDetalle);
				savePersistedData(localCache);
			}

			taxoLog.info(`Producto "${productoNombre}" agregado a la comanda`, LOG_SOURCE);
			update((s) => {
				if (!s.comandaActiva) return s;
				const nuevosDetalles = [
					...s.comandaActiva.detalles.filter((d) => d.id !== nuevoDetalle.id),
					nuevoDetalle
				];
				const mId = s.comandaActiva.mesa_id;
				const comandaActualizada = { ...s.comandaActiva, detalles: nuevosDetalles };
				localCache.comandas[mId] = comandaActualizada;
				const nuevoTimer = calcularTimerMesa(nuevosDetalles, s.mesaTimers[mId]);
				const mesaTimers = { ...s.mesaTimers };
				if (nuevoTimer) mesaTimers[mId] = nuevoTimer;
				localCache.mesaTimers = mesaTimers;
				savePersistedData(localCache);
				return {
					...s,
					mesaTimers,
					comandas: { ...s.comandas, [mId]: comandaActualizada },
					comandaActiva: comandaActualizada
				};
			});
			return nuevoDetalle;
		}
	}

	async function cambiarEstadoDetalle(detalleId: number, estado: DetalleEstado) {
		try {
			const actualizado = await restaurantClient.updateDetalleEstado(detalleId, { estado });
			taxoLog.info(
				`Producto "${actualizado.producto_nombre}" actualizado a estado ${estado}`,
				LOG_SOURCE
			);

			let mesaIdToCheck: number | null = null;
			let todosAnulados = false;
			update((s) => {
				if (!s.comandaActiva) return s;
				const nuevosDetalles = s.comandaActiva.detalles.map((d) =>
					d.id === detalleId ? actualizado : d
				);
				const mesaId = s.comandaActiva.mesa_id;
				mesaIdToCheck = mesaId;
				todosAnulados = nuevosDetalles.length > 0 && nuevosDetalles.every((d) => d.estado === 'anulado');
				const comandaActualizada = { ...s.comandaActiva, detalles: nuevosDetalles };
				localCache.comandas[mesaId] = comandaActualizada;
				const nuevoTimer = calcularTimerMesa(nuevosDetalles, s.mesaTimers[mesaId]);
				const mesaTimers = { ...s.mesaTimers };
				if (nuevoTimer) mesaTimers[mesaId] = nuevoTimer;
				else delete mesaTimers[mesaId];
				localCache.mesaTimers = mesaTimers;
				savePersistedData(localCache);
				return {
					...s,
					mesaTimers,
					comandas: { ...s.comandas, [mesaId]: comandaActualizada },
					comandaActiva: comandaActualizada
				};
			});
			if (todosAnulados && mesaIdToCheck !== null) {
				await cambiarEstadoMesa(mesaIdToCheck, 'libre');
			}
		} catch {
			// Fallback local
			let mesaIdToCheck: number | null = null;
			let todosAnulados = false;
			update((s) => {
				if (!s.comandaActiva) return s;
				const detalles = s.comandaActiva.detalles.map((d) =>
					d.id === detalleId ? { ...d, estado } : d
				);
				const mesaId = s.comandaActiva.mesa_id;
				mesaIdToCheck = mesaId;
				todosAnulados = detalles.length > 0 && detalles.every((d) => d.estado === 'anulado');
				const comandaActualizada = { ...s.comandaActiva, detalles };
				localCache.comandas[mesaId] = comandaActualizada;
				const nuevoTimer = calcularTimerMesa(detalles, s.mesaTimers[mesaId]);
				const mesaTimers = { ...s.mesaTimers };
				if (nuevoTimer) mesaTimers[mesaId] = nuevoTimer;
				else delete mesaTimers[mesaId];
				localCache.mesaTimers = mesaTimers;
				savePersistedData(localCache);
				return {
					...s,
					mesaTimers,
					comandas: { ...s.comandas, [mesaId]: comandaActualizada },
					comandaActiva: comandaActualizada
				};
			});
			if (todosAnulados && mesaIdToCheck !== null) {
				await cambiarEstadoMesa(mesaIdToCheck, 'libre');
			}
		}
	}

	async function cambiarEstadoMesa(mesaId: number, estado: MesaEstado) {
		// Si la mesa pasa a libre o sucia, limpiar el timer
		const limpiarTimer = estado === 'libre' || estado === 'sucia';
		try {
			await restaurantClient.updateMesaEstado(mesaId, { estado });
			taxoLog.info(`Mesa ${mesaId} actualizada a estado ${estado}`, LOG_SOURCE);
			if (limpiarTimer) {
				update((s) => {
					const mesaTimers = { ...s.mesaTimers };
					delete mesaTimers[mesaId];
					localCache.mesaTimers = mesaTimers;
					savePersistedData(localCache);
					return { ...s, mesaTimers };
				});
			}
			await cargarAmbientes();
		} catch {
			// Fallback local
			for (const amb of localCache.ambientes) {
				const m = amb.mesas.find((item) => item.id === mesaId);
				if (m) {
					m.estado = estado;
					break;
				}
			}
			if (limpiarTimer) delete localCache.mesaTimers[mesaId];
			savePersistedData(localCache);
			update((s) => {
				const mesaTimers = limpiarTimer
					? (() => { const t = { ...s.mesaTimers }; delete t[mesaId]; return t; })()
					: s.mesaTimers;
				return {
					...s,
					mesaTimers,
					ambientes: [...localCache.ambientes],
					mesaSeleccionada: s.mesaSeleccionada?.id === mesaId
						? { ...s.mesaSeleccionada, estado }
						: s.mesaSeleccionada
				};
			});
		}
	}

	async function finalizarComanda(
		comprobanteId?: number | null,
		limpiarMesa: boolean = false,
		comandaOverride?: Comanda | null
	) {
		let currentComanda: Comanda | null = comandaOverride ?? null;
		update((s) => {
			if (!currentComanda) {
				currentComanda = s.comandaActiva;
			}
			return { ...s, loadingComanda: true };
		});

		if (!currentComanda) {
			update((s) => ({ ...s, loadingComanda: false }));
			throw new Error('No hay comanda activa para finalizar');
		}

		const mesaId = (currentComanda as Comanda).mesa_id;

		try {
			await restaurantClient.finalizarComanda((currentComanda as Comanda).id, {
				comprobante_id: comprobanteId ?? null,
				limpiar_mesa: limpiarMesa
			});

			taxoLog.info(
				`Comanda ${(currentComanda as Comanda).numero_comanda} finalizada${
					comprobanteId ? ` con comprobante ${comprobanteId}` : ''
				}`,
				LOG_SOURCE
			);

			// Limpiar timer y comanda al finalizar comanda
			const nuevoEstadoMesa: MesaEstado = limpiarMesa ? 'sucia' : 'libre';
			for (const amb of localCache.ambientes) {
				const m = amb.mesas.find((item) => item.id === mesaId);
				if (m) {
					m.estado = nuevoEstadoMesa;
					break;
				}
			}
			delete localCache.mesaTimers[mesaId];
			delete localCache.comandas[mesaId];
			savePersistedData(localCache);

			update((s) => {
				const mesaTimers = { ...s.mesaTimers };
				delete mesaTimers[mesaId];
				const comandas = { ...s.comandas };
				delete comandas[mesaId];
				return {
					...s,
					comandas,
					mesaTimers,
					ambientes: [...localCache.ambientes],
					comandaActiva: null,
					mesaSeleccionada: null,
					loadingComanda: false
				};
			});
			await cargarAmbientes();
		} catch {
			// Fallback local: eliminar comanda activa de la mesa y resetear mesa
			delete localCache.comandas[mesaId];
			delete localCache.mesaTimers[mesaId];
			const nuevoEstadoMesa: MesaEstado = limpiarMesa ? 'sucia' : 'libre';
			for (const amb of localCache.ambientes) {
				const m = amb.mesas.find((item) => item.id === mesaId);
				if (m) {
					m.estado = nuevoEstadoMesa;
					break;
				}
			}
			savePersistedData(localCache);

			taxoLog.info(`Comanda finalizada localmente para la mesa ${mesaId}`, LOG_SOURCE);
			update((s) => {
				const mesaTimers = { ...s.mesaTimers };
				delete mesaTimers[mesaId];
				const comandas = { ...s.comandas };
				delete comandas[mesaId];
				return {
					...s,
					comandas,
					mesaTimers,
					ambientes: [...localCache.ambientes],
					comandaActiva: null,
					mesaSeleccionada: null,
					loadingComanda: false
				};
			});
		}
	}

	async function cancelarComanda(comandaOverride?: Comanda | null, mesaIdOverride?: number) {
		let currentComanda: Comanda | null = comandaOverride ?? null;
		let currentMesaId: number | null = mesaIdOverride ?? null;
		update((s) => {
			if (!currentComanda) {
				currentComanda = s.comandaActiva;
			}
			if (currentMesaId === null) {
				currentMesaId = currentComanda?.mesa_id ?? s.mesaSeleccionada?.id ?? null;
			}
			return { ...s, loadingComanda: true };
		});

		if (!currentComanda && currentMesaId === null) {
			update((s) => ({ ...s, loadingComanda: false }));
			return;
		}

		const mesaId = currentComanda?.mesa_id ?? (currentMesaId as number);

		try {
			if (currentComanda) {
				await restaurantClient.finalizarComanda(currentComanda.id, {
					comprobante_id: null,
					limpiar_mesa: false
				});
			}
			await restaurantClient.updateMesaEstado(mesaId, { estado: 'libre' });
		} catch {
			// Fallback local garantizado
		}

		taxoLog.info(
			currentComanda
				? `Comanda ${currentComanda.numero_comanda} cancelada; mesa ${mesaId} liberada`
				: `Mesa ${mesaId} liberada`,
			LOG_SOURCE
		);

		for (const amb of localCache.ambientes) {
			const m = amb.mesas.find((item) => item.id === mesaId);
			if (m) {
				m.estado = 'libre';
				break;
			}
		}
		delete localCache.mesaTimers[mesaId];
		delete localCache.comandas[mesaId];
		savePersistedData(localCache);

		update((s) => {
			const mesaTimers = { ...s.mesaTimers };
			delete mesaTimers[mesaId];
			const comandas = { ...s.comandas };
			delete comandas[mesaId];
			return {
				...s,
				comandas,
				mesaTimers,
				ambientes: [...localCache.ambientes],
				comandaActiva: null,
				mesaSeleccionada: null,
				loadingComanda: false
			};
		});

		try {
			await cargarAmbientes();
		} catch {
			// Ya se actualizó en memoria/localStorage
		}
	}

	async function crearAmbiente(nombre: string, codigoSede?: string) {
		try {
			await restaurantClient.createAmbiente({ nombre, codigo_sede: codigoSede });
			taxoLog.info(`Ambiente "${nombre}" creado`, LOG_SOURCE);
			await cargarAmbientes();
		} catch {
			// Fallback local
			const nuevoAmbiente: Ambiente = {
				id: genLocalId(),
				codigo_sede: codigoSede ?? '0000',
				nombre,
				activo: true,
				mesas: []
			};
			localCache.ambientes.push(nuevoAmbiente);
			savePersistedData(localCache);
			update((s) => ({ ...s, ambientes: [...localCache.ambientes] }));
		}
	}

	async function crearMesa(ambienteId: number, numero: string, capacidad: number) {
		try {
			await restaurantClient.createMesa({
				ambiente_id: ambienteId,
				numero,
				capacidad
			});
			taxoLog.info(`Mesa "${numero}" creada en el ambiente ${ambienteId}`, LOG_SOURCE);
			await cargarAmbientes();
		} catch {
			// Fallback local
			const ambiente = localCache.ambientes.find((a) => a.id === ambienteId);
			if (ambiente) {
				const nuevaMesa: Mesa = {
					id: genLocalId(),
					ambiente_id: ambienteId,
					numero,
					capacidad,
					estado: 'libre',
					activo: true
				};
				ambiente.mesas.push(nuevaMesa);
				savePersistedData(localCache);
				update((s) => ({ ...s, ambientes: [...localCache.ambientes] }));
			}
		}
	}

	async function actualizarMesa(mesaId: number, payload: UpdateMesaPayload) {
		try {
			await restaurantClient.updateMesa(mesaId, payload);
			taxoLog.info(`Mesa ${mesaId} actualizada`, LOG_SOURCE);
			await cargarAmbientes();
		} catch {
			// Fallback local
			for (const amb of localCache.ambientes) {
				const m = amb.mesas.find((item) => item.id === mesaId);
				if (m) {
					if (payload.numero !== undefined) m.numero = payload.numero;
					if (payload.capacidad !== undefined) m.capacidad = payload.capacidad;
					break;
				}
			}
			savePersistedData(localCache);
			update((s) => ({ ...s, ambientes: [...localCache.ambientes] }));
		}
	}

	async function eliminarMesa(mesaId: number) {
		let eliminadaEnBackend = false;
		try {
			await restaurantClient.deleteMesa(mesaId);
			taxoLog.info(`Mesa ${mesaId} eliminada`, LOG_SOURCE);
			eliminadaEnBackend = true;
		} catch {
			// Backend no disponible o en modo plugin local: aplicamos el borrado solo en local
		}

		// Reflejar el borrado en el estado local para que el modal se actualice de inmediato.
		// Usamos .map() para crear nuevas referencias en todos los niveles (outer + inner),
		// de modo que Svelte 5 detecte el cambio por comparación de referencias.
		localCache.ambientes = localCache.ambientes.map((amb) => ({
			...amb,
			mesas: amb.mesas.filter((item) => item.id !== mesaId)
		}));
		delete localCache.comandas[mesaId];
		delete localCache.mesaTimers[mesaId];
		savePersistedData(localCache);
		update((s) => ({
			...s,
			ambientes: localCache.ambientes,
			mesaSeleccionada: s.mesaSeleccionada?.id === mesaId ? null : s.mesaSeleccionada,
			comandaActiva: s.comandaActiva?.mesa_id === mesaId ? null : s.comandaActiva
		}));

		if (eliminadaEnBackend) {
			await cargarAmbientes();
		}
	}

	async function cambiarProcesoMesa(mesaId: number, nuevaFase: TimerFase) {
		const comanda = localCache.comandas[mesaId];
		if (!comanda) {
			// Si no hay comanda, encontrar la mesa y seleccionarla para abrir pedido
			const mesa = localCache.ambientes.flatMap((a) => a.mesas).find((m) => m.id === mesaId);
			if (mesa) {
				await seleccionarMesa(mesa);
			}
			return;
		}

		// Actualizar todos los detalles activos al nuevo estado
		const nuevosDetalles = (comanda.detalles || []).map((d) =>
			d.estado !== 'anulado' ? { ...d, estado: nuevaFase } : d
		);

		// Intentar sincronizar con backend para cada detalle
		for (const d of comanda.detalles || []) {
			if (d.estado !== 'anulado' && d.estado !== nuevaFase) {
				try {
					await restaurantClient.updateDetalleEstado(d.id, { estado: nuevaFase });
				} catch {
					// Fallback local
				}
			}
		}

		const comandaActualizada = { ...comanda, detalles: nuevosDetalles };
		localCache.comandas[mesaId] = comandaActualizada;

		// El tiempo debe de REINICIARSE si el estado pedido y cocinando cambia
		const nuevoTimer: MesaTimer = { inicioMs: Date.now(), fase: nuevaFase };
		localCache.mesaTimers[mesaId] = nuevoTimer;
		savePersistedData(localCache);

		taxoLog.info(`Mesa ${mesaId}: proceso cambiado a ${nuevaFase}`, LOG_SOURCE);

		update((s) => ({
			...s,
			mesaTimers: { ...s.mesaTimers, [mesaId]: nuevoTimer },
			comandas: { ...s.comandas, [mesaId]: comandaActualizada },
			comandaActiva:
				s.comandaActiva && s.comandaActiva.mesa_id === mesaId
					? comandaActualizada
					: s.comandaActiva
		}));
	}

	return {
		subscribe,
		cargarAmbientes,
		seleccionarMesa,
		crearComanda,
		agregarDetalle,
		cambiarEstadoDetalle,
		cambiarProcesoMesa,
		cambiarEstadoMesa,
		finalizarComanda,
		cancelarComanda,
		crearAmbiente,
		crearMesa,
		actualizarMesa,
		eliminarMesa,
		/** Elimina el timer de una mesa (ej: cuando se libera o limpia) */
		clearMesaTimer: (mesaId: number) => {
			update((s) => {
				const mesaTimers = { ...s.mesaTimers };
				delete mesaTimers[mesaId];
				localCache.mesaTimers = mesaTimers;
				savePersistedData(localCache);
				return { ...s, mesaTimers };
			});
		},
		reset: () => {
			localCache = { ambientes: DEFAULT_AMBIENTES, comandas: {}, mesaTimers: {} };
			savePersistedData(localCache);
			set({
				ambientes: DEFAULT_AMBIENTES,
				mesaSeleccionada: null,
				comandaActiva: null,
				loading: false,
				loadingComanda: false,
				comandas: {},
				mesaTimers: {}
			});
		}
	};
}

export const restaurantStore = createRestaurantStore();

// Ticker en segundo plano: verifica mesas en 'servido' con >30 min y las pasa a 'cuenta_solicitada' ('por cobrar')
if (typeof window !== 'undefined') {
	setInterval(() => {
		const ahora = Date.now();
		let huboCambio = false;
		for (const amb of localCache.ambientes) {
			for (const m of amb.mesas) {
				if (m.estado === 'ocupada') {
					const timer = localCache.mesaTimers[m.id];
					if (timer && timer.fase === 'servido') {
						const seg = Math.floor((ahora - timer.inicioMs) / 1000);
						if (seg >= 30 * 60) {
							m.estado = 'cuenta_solicitada';
							huboCambio = true;
							taxoLog.info(
								`Mesa #${m.numero} pasó automáticamente a "Por Cobrar" (>30min en estado servido)`,
								LOG_SOURCE
							);
						}
					}
				}
			}
		}
		if (huboCambio) {
			savePersistedData(localCache);
			restaurantStore.cargarAmbientes();
		}
	}, 3000);
}
