import { IconChefHat } from '@tabler/icons-svelte';
import RestaurantView from './components/RestaurantView.svelte';

export interface TaxorPluginView {
	nombre: string;
	icono?: any;
	vista: any;
	props?: Record<string, unknown>;
	accesoRequerido?: string;
}

export interface TaxorPlugin {
	id: string;
	nombre: string;
	version: string;
	descripcion?: string;
	rubro?: string;
	icono?: any;
	activo?: boolean;
	vistas: TaxorPluginView[];
	comandos?: Array<{ id: string; run: () => Promise<void> | void }>;
	onMount?: () => Promise<void> | void;
	onDestroy?: () => Promise<void> | void;
}

/**
 * Plugin de Rubro: Restaurante / Pollería (tx-pl-restaurant)
 *
 * Se acopla de manera desacoplada al Core Taxor. Toda emisión
 * de comprobantes o consulta de inventario interactúa vía el SDK Taxor.
 */
export const restaurantPlugin: TaxorPlugin = {
	id: 'tx-pl-restaurant',
	nombre: 'Restaurante',
	rubro: 'restaurante',
	version: '1.0.0',
	descripcion: 'Gestión de salones, mesas y comandas para restaurantes y pollerías.',
	icono: IconChefHat,
	activo: true,
	vistas: [
		{
			nombre: 'Restaurante',
			icono: IconChefHat,
			vista: RestaurantView
		}
	]
};
