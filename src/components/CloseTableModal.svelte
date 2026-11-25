<script lang="ts">
	import type { Comanda, Mesa } from '../types';
	import { restaurantStore } from '../store';
	import {
		Button,
		Input,
		Modal,
		Notifier,
		Number as NumberInput,
		Select,
		Switch,
		Tab,
		VoucherPreviewModal
	} from '$lib/components/core/primitives';
	import {
		type PrintableInvoiceData,
		formatAmountInWords,
		readStoredLogoLayout,
		readStoredTextHeaderLayout
	} from '$lib/components/ui/features/print';
	import { resolveCompanyLogoUrl } from '$lib/features/companyLogo';
	import { pluginBillingApi } from '$lib/features/vouchers';
	import { tenantStore } from '$lib/features/tenant';
	import { get } from 'svelte/store';

	interface Props {
		isOpen: boolean;
		mesa: Mesa;
		comanda: Comanda | null;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { isOpen = $bindable(), mesa, comanda, onClose, onSuccess }: Props = $props();

	let tipoComprobante = $state<'ticket' | 'boleta' | 'factura'>('ticket');
	let formaPago = $state<'Contado' | 'Credito'>('Contado');
	let metodoPago = $state<'Efectivo' | 'Yape' | 'Plin' | 'Tarjeta' | 'Transferencia'>('Efectivo');
	let limpiarMesa = $state(false);
	let montoRecibido = $state<number>(0);
	let isSubmitting = $state(false);

	// Datos del cliente según comprobante
	let clienteNombre = $state('');
	let clienteDni = $state('');
	let clienteRuc = $state('');
	let clienteRazonSocial = $state('');
	let clienteDireccion = $state('');

	// Mensajes y alertas de validación
	let aviso = $state<{
		tone: 'info' | 'warning' | 'success' | 'danger';
		title: string;
		texto: string;
	} | null>(null);

	// Visualización del comprobante oficial de Taxorium
	let mostrarPreview = $state(false);
	let printableInvoice = $state<PrintableInvoiceData | null>(null);

	// Total a cobrar
	let total = $derived.by(() => {
		if (!comanda?.detalles) return 0;
		return comanda.detalles
			.filter((d) => d.estado !== 'anulado')
			.reduce((acc, d) => acc + (d.importe || d.cantidad * d.precio_unitario), 0);
	});

	// Actualizar montoRecibido al abrir
	$effect(() => {
		if (isOpen) {
			mostrarPreview = false;
			printableInvoice = null;
			montoRecibido = total;
			aviso = null;
			clienteNombre = '';
			clienteDni = '';
			clienteRuc = '';
			clienteRazonSocial = '';
			clienteDireccion = '';
		}
	});

	let vuelto = $derived(
		metodoPago === 'Efectivo' && montoRecibido >= total ? montoRecibido - total : 0
	);

	async function handleConfirmarCobro() {
		if (!comanda || isSubmitting) return;

		// 1. Validaciones de pago en efectivo
		if (metodoPago === 'Efectivo' && montoRecibido < total) {
			aviso = {
				tone: 'warning',
				title: 'Monto insuficiente',
				texto: `El monto recibido (S/ ${montoRecibido.toFixed(2)}) es menor al total a pagar (S/ ${total.toFixed(2)}).`
			};
			return;
		}

		// 2. Validaciones específicas por tipo de comprobante
		if (tipoComprobante === 'factura') {
			if (!clienteRuc || clienteRuc.trim().length !== 11) {
				aviso = {
					tone: 'warning',
					title: 'RUC requerido',
					texto: 'Para emitir una Factura Electrónica debes ingresar un RUC válido de 11 dígitos.'
				};
				return;
			}
			if (!clienteRazonSocial || !clienteRazonSocial.trim()) {
				aviso = {
					tone: 'warning',
					title: 'Razón Social requerida',
					texto: 'Debes ingresar la Razón Social del cliente para emitir una Factura.'
				};
				return;
			}
		}

		if (tipoComprobante === 'boleta' && clienteDni.trim()) {
			if (clienteDni.trim().length !== 8) {
				aviso = {
					tone: 'warning',
					title: 'DNI inválido',
					texto: 'El DNI debe tener 8 dígitos, o déjalo en blanco para emitir a Clientes Varios.'
				};
				return;
			}
		}

		// 3. Validación de empresa emisora activa en Taxorium
		const tenant = get(tenantStore).tenant;
		if (!tenant?.ruc) {
			aviso = {
				tone: 'danger',
				title: 'Datos de empresa incompletos',
				texto: 'No se encontraron los datos de la empresa emisora en Taxorium. Verifica los Ajustes de Empresa.'
			};
			return;
		}

		// 4. Validación de ítems activos
		const itemsValidos = (comanda.detalles ?? [])
			.filter((det) => det.estado !== 'anulado')
			.map((det) => ({
				unidad: 'NIU',
				cantidad: det.cantidad,
				precio_unitario: det.precio_unitario,
				total: det.importe || det.cantidad * det.precio_unitario,
				afectacion: '10',
				descripcion: det.producto_nombre
			}));

		if (itemsValidos.length === 0) {
			aviso = {
				tone: 'warning',
				title: 'Sin ítems a facturar',
				texto: 'La comanda no tiene productos activos para cobrar y emitir comprobante.'
			};
			return;
		}

		isSubmitting = true;

		try {
			let receptorNombre = clienteNombre.trim() || `Clientes Varios (Mesa #${mesa.numero})`;
			let receptorNumDoc = '00000000';
			let receptorTipoDoc = '0';
			let receptorTipoDocLabel = 'DOC';
			let tipoLabel = 'NOTA DE VENTA';

			if (tipoComprobante === 'boleta') {
				tipoLabel = 'BOLETA DE VENTA ELECTRÓNICA';
				receptorTipoDoc = clienteDni.trim() ? '1' : '0';
				receptorTipoDocLabel = 'DNI';
				receptorNumDoc = clienteDni.trim() || '00000000';
				receptorNombre = clienteNombre.trim() || `Clientes Varios (Mesa #${mesa.numero})`;
			} else if (tipoComprobante === 'factura') {
				tipoLabel = 'FACTURA ELECTRÓNICA';
				receptorTipoDoc = '6';
				receptorTipoDocLabel = 'RUC';
				receptorNumDoc = clienteRuc.trim();
				receptorNombre = clienteRazonSocial.trim();
			}

			// Paso A: Crear comprobante fiscal mediante la fachada oficial de Taxorium
			// Si esto falla, NINGÚN estado de la mesa ni de la comanda cambia.
			let nuevoVoucher;
			try {
				nuevoVoucher = await pluginBillingApi.emitirComprobante({
					tipo: tipoComprobante,
					formaPago,
					metodoPago,
					pagoInicial: total,
					cliente: {
						tipoDoc: receptorTipoDoc,
						numDoc: receptorNumDoc,
						nombreRazonSocial: receptorNombre,
						direccion: clienteDireccion.trim() || undefined
					},
					items: itemsValidos.map((it) => ({
						descripcion: it.descripcion,
						cantidad: it.cantidad,
						precioUnitario: it.precio_unitario,
						total: it.total,
						unidad: it.unidad,
						afectacion: it.afectacion
					}))
				});
			} catch (voucherError) {
				const msg = voucherError instanceof Error ? voucherError.message : String(voucherError);
				aviso = {
					tone: 'danger',
					title: 'Error al emitir comprobante',
					texto: msg
				};
				return;
			}

			// Paso B: El comprobante YA EXISTE en Taxorium.
			// Ahora finalizamos la comanda en el restaurante.
			// Si falla, se aísla el error para NO reintentar la emisión del comprobante ni duplicarlo en SUNAT.
			const comprobanteId = nuevoVoucher.id;
			const hashCpe = nuevoVoucher.hash_cpe;

			let errorCierreComanda: string | null = null;
			try {
				await restaurantStore.finalizarComanda(comprobanteId, limpiarMesa, comanda);
			} catch (cerrarErr) {
				console.error('[CloseTableModal] Error al finalizar comanda tras emitir comprobante:', cerrarErr);
				errorCierreComanda = cerrarErr instanceof Error ? cerrarErr.message : String(cerrarErr);
			}

			// Paso C: Configurar la plantilla oficial de Taxorium con los metadatos MESA y MOZO
			const subtotal = Math.round((total / 1.18) * 100) / 100;
			const igv = Math.round((total - subtotal) * 100) / 100;
			const tenantSummary = pluginBillingApi.getTenantSummary();
			const templateKind =
				tipoComprobante === 'factura'
					? 'factura'
					: tipoComprobante === 'boleta'
						? 'boleta'
						: 'ticket';

			printableInvoice = {
				formato: 'TICKET',
				tipo_comprobante: tipoLabel,
				serie_correlativo: nuevoVoucher.numero_comprobante,
				fecha_emision: nuevoVoucher.fecha_de_emision,
				empresa: {
					ruc: tenantSummary.ruc,
					razon_social: tenantSummary.razonSocial,
					direccion: tenantSummary.direccion,
					ubigeo: tenantSummary.ubigeo,
					telefono: tenantSummary.telefono,
					email: tenantSummary.email,
					logo_url: resolveCompanyLogoUrl(get(tenantStore).tenant ?? undefined),
					logo_layout: readStoredLogoLayout(templateKind),
					text_header_layout: readStoredTextHeaderLayout(templateKind)
				},
				cliente: {
					tipo_doc: receptorTipoDocLabel,
					num_doc: receptorNumDoc,
					nombre_o_razon_social: receptorNombre,
					direccion: clienteDireccion.trim() || undefined
				},
				items: itemsValidos.map((it) => ({
					cantidad: it.cantidad,
					unidad: it.unidad,
					descripcion: it.descripcion,
					precio_unitario: it.precio_unitario,
					total: it.total
				})),
				totales: {
					moneda: 'PEN',
					gravado: subtotal,
					igv,
					total,
					total_letras: formatAmountInWords(total, 'PEN')
				},
				forma_pago: `${formaPago} - ${metodoPago}`,
				estado_pago: 'Pagado',
				hash_cpe: hashCpe ?? undefined,
				metadatos: [
					{ label: 'MESA', value: `#${mesa.numero}` },
					{ label: 'MOZO', value: comanda.mozo ?? 'Mozo de turno' }
				],
				resolucion_sunat: 'Representación impresa de Comprobante de Pago Electrónico'
			};

			// Mostrar directamente la vista previa oficial de Taxorium (VoucherPreviewModal)
			mostrarPreview = true;

			if (errorCierreComanda) {
				aviso = {
					tone: 'warning',
					title: `Comprobante ${nuevoVoucher.numero_comprobante} emitido`,
					texto: `El comprobante se emitió y registró correctamente en Taxorium, pero ocurrió un problema al cerrar la mesa en el restaurante: ${errorCierreComanda}. No intente cobrar nuevamente para evitar duplicar el comprobante.`
				};
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			aviso = {
				tone: 'danger',
				title: 'Error inesperado',
				texto: msg
			};
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancelarCobro() {
		isOpen = false;
		onClose();
	}

	function handleCerrarTodo() {
		mostrarPreview = false;
		isOpen = false;
		onSuccess?.();
		onClose();
	}
</script>

{#if isOpen}
	{#if !mostrarPreview}
		<!-- ─── FORMULARIO DE COBRO Y EMISIÓN ──────────────────────────────── -->
		<Modal
			{isOpen}
			onClose={handleCancelarCobro}
			title={`Cierre y Cobro de Mesa #${mesa.numero}`}
		>
			<div class="w-full max-w-lg space-y-3.5 p-2 text-xs text-brand-text-secondary">
				<!-- Resumen de Consumo -->
				<div class="space-y-2 rounded-lg border border-brand-border bg-brand-bg-secondary p-3">
					<div class="flex items-center justify-between">
						<span>Comanda: <strong class="text-brand-text-primary">{comanda?.numero_comanda}</strong></span>
						<span>Mozo: <strong class="text-brand-text-primary">{comanda?.mozo ?? 'No asignado'}</strong></span>
					</div>

					<div class="max-h-32 space-y-1 divide-y divide-white/5 overflow-y-auto pt-1">
						{#each (comanda?.detalles ?? []).filter((d) => d.estado !== 'anulado') as detalle}
							<div class="flex items-center justify-between pt-1">
								<span class="text-brand-text-primary">
									<span class="font-bold text-sky-400">{detalle.cantidad}x</span>
									{detalle.producto_nombre}
								</span>
								<span class="font-mono font-medium">S/ {detalle.importe.toFixed(2)}</span>
							</div>
						{/each}
					</div>

					<div class="flex items-center justify-between border-t border-brand-border pt-2 text-sm">
						<span class="font-semibold">Total a cobrar:</span>
						<span class="font-mono font-bold text-emerald-400 text-base">S/ {total.toFixed(2)}</span>
					</div>
				</div>

				<!-- Selección del Tipo de Comprobante -->
				<div class="space-y-1">
					<span class="block font-semibold text-brand-text-primary">Tipo de Comprobante:</span>
					<Tab
						bind:value={tipoComprobante}
						size="md"
						fullWidth={true}
						class="rounded [&>button]:rounded"
						items={[
							{ value: 'boleta', label: 'Boleta de Venta' },
							{ value: 'factura', label: 'Factura Electrónica' },
							{ value: 'ticket', label: 'Nota de Venta (NV)' },
						]}
					/>
				</div>

				<!-- Campos específicos del receptor según el comprobante -->
				<div class="space-y-2 rounded border border-brand-border/70 bg-brand-bg-primary p-2.5">
					{#if tipoComprobante === 'factura'}
						<div class="grid grid-cols-2 gap-2">
							<Input
								label="RUC del Cliente *"
								maxlength={11}
								placeholder="20..."
								bind:value={clienteRuc}
							/>
							<Input
								label="Razón Social *"
								placeholder="Empresa S.A.C."
								bind:value={clienteRazonSocial}
							/>
						</div>
						<Input
							label="Dirección Fiscal (Opcional)"
							placeholder="Av. Las Camelias 450..."
							bind:value={clienteDireccion}
						/>
					{:else if tipoComprobante === 'boleta'}
						<div class="grid grid-cols-2 gap-2">
							<Input
								label="DNI del Cliente (Opcional)"
								maxlength={8}
								placeholder="8 dígitos"
								bind:value={clienteDni}
							/>
							<Input
								label="Nombre del Cliente (Opcional)"
								placeholder="Clientes Varios"
								bind:value={clienteNombre}
							/>
						</div>
					{:else}
						<Input
							label="Cliente / Referencia (Opcional)"
							placeholder={`Clientes Varios`}
							bind:value={clienteNombre}
						/>
					{/if}
				</div>

				<!-- Forma y Método de Pago -->
				<div class="grid grid-cols-2 gap-3">
					<Select
						id="forma-pago-select"
						label="Forma de pago"
						bind:value={formaPago}
						options={[
							{ value: 'Contado', label: 'Contado' },
							{ value: 'Credito', label: 'Crédito' }
						]}
					/>

					<Select
						id="metodo-pago-select"
						label="Medio de pago"
						bind:value={metodoPago}
						options={[
							{ value: 'Efectivo', label: 'Efectivo' },
							{ value: 'Yape', label: 'Yape' },
							{ value: 'Plin', label: 'Plin' },
							{ value: 'Tarjeta', label: 'Tarjeta Débito/Crédito' },
							{ value: 'Transferencia', label: 'Transferencia Bancaria' }
						]}
					/>
				</div>

				<!-- Si es efectivo, cálculo de vuelto -->
				{#if metodoPago === 'Efectivo'}
					<div
						class="grid grid-cols-2 gap-3 rounded border border-brand-border bg-brand-bg-primary p-2.5"
					>
						<div>
							<NumberInput
								id="monto-recibido"
								label="Monto recibido (S/)"
								step={0.1}
								min={total}
								bind:value={montoRecibido}
							/>
						</div>
						<div>
							<span class="text-xs font-medium block opacity-75">Vuelto a entregar:</span>
							<div
								class="rounded bg-brand-bg-secondary px-2 py-1 font-mono text-base font-bold text-amber-400 mt-1"
							>
								S/ {vuelto.toFixed(2)}
							</div>
						</div>
					</div>
				{/if}

				<!-- Estado posterior de la mesa -->
				<div
					class="flex items-center justify-between rounded border border-brand-border bg-brand-bg-primary p-2.5"
				>
					<div>
						<span class="block font-medium">Liberar mesa inmediatamente</span>
						<span class="text-[11px] opacity-75">
							{limpiarMesa
								? 'Mesa quedará registrada como LIBRE'
								: 'Mesa quedará registrada como SUCIA (requiere limpieza)'}
						</span>
					</div>
					<Switch bind:checked={limpiarMesa} />
				</div>

				<!-- Botones de Acción -->
				<div class="flex items-center justify-end gap-2 border-t border-brand-border pt-2">
					<Button variant="outline" size="md" onclick={handleCancelarCobro} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button
						variant="secondary"
						size="md"
						onclick={handleConfirmarCobro}
						disabled={isSubmitting || total <= 0}
					>
						{isSubmitting ? 'Emitiendo...' : 'Cobrar y Emitir Comprobante'}
					</Button>
				</div>
			</div>
		</Modal>
	{:else if printableInvoice}
		<!-- ─── PLANTILLA OFICIAL DE TAXORIUM (SUNAT) CON MESA Y MOZO ─────── -->
		<VoucherPreviewModal
			bind:isOpen={mostrarPreview}
			printable={printableInvoice}
			paperFormat="ticket80mm"
			viewOnly={true}
			onClose={handleCerrarTodo}
		/>
	{/if}

	{#if aviso}
		<Notifier
			isOpen={true}
			tone={aviso.tone}
			title={aviso.title}
			onClose={() => (aviso = null)}
		>
			{aviso.texto}
		</Notifier>
	{/if}
{/if}
