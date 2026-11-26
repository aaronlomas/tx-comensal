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
 * Plugin de Rubro: Gastronomía / Comensal (tx-comensal)
 *
 * Se acopla de manera desacoplada al Core Taxor. Toda emisión
 * de comprobantes o consulta de inventario interactúa vía el SDK Taxor.
 */
export const restaurantPlugin: TaxorPlugin = {
	id: 'tx-comensal',
	nombre: 'Comensal',
	rubro: 'gastronomia',
	version: '0.1.0',
	descripcion: 'Gestión de salones, mesas y comandas para gastronomía.',
	icono: IconChefHat,
	activo: true,
	vistas: [
		{
			nombre: 'Comensal',
			icono: IconChefHat,
			vista: RestaurantView
		}
	]
};
