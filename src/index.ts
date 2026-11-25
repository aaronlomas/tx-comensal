import manifest from '../manifest.json';

export { manifest };
export { restaurantClient } from './api';
export { restaurantStore } from './store';
export { restaurantPlugin } from './plugin';
export { default as RestaurantView } from './components/RestaurantView.svelte';

export type {
	AddDetallePayload,
	Ambiente,
	Comanda,
	ComandaDetalle,
	CreateAmbientePayload,
	CreateComandaPayload,
	CreateMesaPayload,
	DetalleEstado,
	FinalizarComandaPayload,
	Mesa,
	MesaEstado,
	UpdateDetalleEstadoPayload,
	UpdateMesaEstadoPayload,
	UpdateMesaPayload
} from './types';
