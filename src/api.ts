import { ApiClient } from '$lib/core/http';
import type {
	AddDetallePayload,
	Ambiente,
	Comanda,
	ComandaDetalle,
	CreateAmbientePayload,
	CreateComandaPayload,
	CreateMesaPayload,
	FinalizarComandaPayload,
	Mesa,
	UpdateDetalleEstadoPayload,
	UpdateMesaEstadoPayload,
	UpdateMesaPayload
} from './types';

class RestaurantClient extends ApiClient {
	async getAmbientes(): Promise<Ambiente[]> {
		return this.request<Ambiente[]>('api/restaurant/ambientes', 'get_ambientes');
	}

	async createAmbiente(payload: CreateAmbientePayload): Promise<Ambiente> {
		return this.request<Ambiente>(
			'api/restaurant/ambientes',
			'create_ambiente',
			{ method: 'POST' },
			payload
		);
	}

	async createMesa(payload: CreateMesaPayload): Promise<Mesa> {
		return this.request<Mesa>(
			'api/restaurant/mesas',
			'create_mesa',
			{ method: 'POST' },
			payload
		);
	}

	async updateMesa(mesaId: number, payload: UpdateMesaPayload): Promise<Mesa> {
		return this.request<Mesa>(
			`api/restaurant/mesas/${mesaId}`,
			'update_mesa',
			{ method: 'PUT' },
			payload,
			{ id: mesaId }
		);
	}

	async deleteMesa(mesaId: number): Promise<void> {
		return this.request<void>(
			`api/restaurant/mesas/${mesaId}`,
			'delete_mesa',
			{ method: 'DELETE' },
			undefined,
			{ id: mesaId }
		);
	}

	async getComandaActiva(mesaId: number): Promise<Comanda | null> {
		return this.request<Comanda | null>(
			`api/restaurant/mesas/${mesaId}/comanda`,
			'get_comanda_activa',
			{},
			undefined,
			{ id: mesaId }
		);
	}

	async createComanda(payload: CreateComandaPayload): Promise<Comanda> {
		return this.request<Comanda>(
			'api/restaurant/comandas',
			'create_comanda',
			{ method: 'POST' },
			payload
		);
	}

	async addDetalle(comandaId: number, payload: AddDetallePayload): Promise<ComandaDetalle> {
		return this.request<ComandaDetalle>(
			`api/restaurant/comandas/${comandaId}/detalles`,
			'add_detalle',
			{ method: 'POST' },
			payload,
			{ id: comandaId }
		);
	}

	async updateDetalleEstado(
		detalleId: number,
		payload: UpdateDetalleEstadoPayload
	): Promise<ComandaDetalle> {
		return this.request<ComandaDetalle>(
			`api/restaurant/detalles/${detalleId}/estado`,
			'update_detalle_estado',
			{ method: 'PUT' },
			payload,
			{ id: detalleId }
		);
	}

	async updateMesaEstado(mesaId: number, payload: UpdateMesaEstadoPayload): Promise<Mesa> {
		return this.request<Mesa>(
			`api/restaurant/mesas/${mesaId}/estado`,
			'update_mesa_estado',
			{ method: 'PUT' },
			payload,
			{ id: mesaId }
		);
	}

	async finalizarComanda(comandaId: number, payload: FinalizarComandaPayload): Promise<void> {
		return this.request<void>(
			`api/restaurant/comandas/${comandaId}/finalizar`,
			'finalizar_comanda',
			{ method: 'POST' },
			payload,
			{ id: comandaId }
		);
	}
}

export const restaurantClient = new RestaurantClient();
