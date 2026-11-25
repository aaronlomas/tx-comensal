<script lang="ts">
	import type { Ambiente } from '../types';
	import { restaurantStore } from '../store';
	import { IconTrash } from '@tabler/icons-svelte';
	import {
		Button,
		Input,
		Modal,
		Notifier,
		Number as NumberInput,
		Scroll,
		Select,
		Tab,
		type TabItem
	} from '$lib/components/core/primitives';

	interface Props {
		isOpen: boolean;
		ambientes: Ambiente[];
		onClose: () => void;
	}

	let { isOpen = $bindable(), ambientes, onClose }: Props = $props();

	let pestana = $state<'nueva_mesa' | 'nuevo_ambiente' | 'administrar'>('nueva_mesa');

	// Formulario Nueva Mesa
	let ambienteSeleccionadoId = $state<number>(0);
	let numeroMesa = $state('');
	let capacidadMesa = $state(4);
	let isCreatingMesa = $state(false);

	// Formulario Nuevo Ambiente
	let nombreAmbiente = $state('');
	let isCreatingAmbiente = $state(false);

	// Mensajes solo de JavaScript (validaciones de UI) -> Notifier
	let aviso = $state<{ tone: 'info' | 'warning' | 'success' | 'danger'; title: string; texto: string } | null>(
		null
	);

	function avisar(texto: string, title = 'Validación', tone: 'warning' | 'danger' = 'danger') {
		aviso = { tone, title, texto };
	}

	const ambientesOptions = $derived(
		ambientes.map((ambiente) => ({ value: ambiente.id, label: ambiente.nombre }))
	);

	const tabPestanas = $derived<TabItem[]>([
		{ label: '+ Nueva Mesa', value: 'nueva_mesa' },
		{ label: '+ Nuevo Ambiente', value: 'nuevo_ambiente' },
		{ label: `Listado de Mesas (${ambientes.flatMap((a) => a.mesas).length})`, value: 'administrar' }
	]);

	$effect(() => {
		if (isOpen && ambientes.length > 0 && !ambienteSeleccionadoId) {
			ambienteSeleccionadoId = ambientes[0].id;
		}
		if (isOpen) {
			aviso = null;
		}
	});

	async function handleCrearMesa() {
		if (!numeroMesa.trim()) {
			avisar('Debes ingresar un número o nombre para la mesa.');
			return;
		}
		if (!ambienteSeleccionadoId) {
			avisar('Selecciona un ambiente.');
			return;
		}

		isCreatingMesa = true;
		try {
			await restaurantStore.crearMesa(ambienteSeleccionadoId, numeroMesa.trim(), capacidadMesa);
			numeroMesa = '';
			capacidadMesa = 4;
		} catch {
			// El error de base de datos se registra en el log desde el store.
		} finally {
			isCreatingMesa = false;
		}
	}

	async function handleCrearAmbiente() {
		if (!nombreAmbiente.trim()) {
			avisar('Ingresa el nombre del nuevo ambiente.');
			return;
		}

		isCreatingAmbiente = true;
		try {
			await restaurantStore.crearAmbiente(nombreAmbiente.trim());
			nombreAmbiente = '';
		} catch {
			// El error de base de datos se registra en el log desde el store.
		} finally {
			isCreatingAmbiente = false;
		}
	}

	async function handleEliminarMesa(mesaId: number) {
		try {
			await restaurantStore.eliminarMesa(mesaId);
		} catch {
			// El error de base de datos se registra en el log desde el store.
		}
	}
</script>

{#if isOpen}
	<Modal {isOpen} {onClose} title="Gestión de Mesas y Salones">
		<div class="w-full max-w-xl space-y-2 p-2 text-xs text-brand-text-secondary bg-brand-bg-secondary">
			<!-- Selector de Pestañas con primitiva Tab de Taxorium -->
			<Tab
				items={tabPestanas}
				bind:value={pestana}
				onChange={() => (aviso = null)}
				size="md"
				layout="flex"
			/>

			<!-- Contenido según pestaña -->
			{#if pestana === 'nueva_mesa'}
				<div class="space-y-3 rounded border border-brand-border bg-brand-bg-primary p-4">
					<h4 class="text-sm font-semibold text-brand-text-primary">Agregar una nueva mesa al restaurante</h4>
					<p class="text-xs text-brand-text-secondary">
						Asigna la mesa a un salón y define su número o código visible para mozos y caja.
					</p>

					<div class="space-y-3 pt-2">
						<Select
							id="ambiente-select"
							label="Ambiente / Salón"
							placeholder="Seleccionar ambiente..."
							options={ambientesOptions}
							bind:value={ambienteSeleccionadoId}
						/>

						<div class="grid grid-cols-2 gap-3">
							<Input
								id="numero-mesa-input"
								label="Número o Nombre"
								placeholder="Ej. 9, 10, Barra 1, VIP..."
								bind:value={numeroMesa}
							/>

							<NumberInput
								id="capacidad-mesa-input"
								label="Capacidad (comensales)"
								min={1}
								max={50}
								bind:value={capacidadMesa}
							/>
						</div>

						<div class="flex justify-end pt-2">
							<Button
								variant="primary"
								size="md"
								hotkey="Enter"
								onclick={handleCrearMesa}
								disabled={isCreatingMesa || !numeroMesa.trim()}
							>
								{isCreatingMesa ? 'Creando Mesa...' : 'Crear Mesa'}
							</Button>
						</div>
					</div>
				</div>
			{:else if pestana === 'nuevo_ambiente'}
				<div class="space-y-3 rounded border border-brand-border bg-brand-bg-primary p-4">
					<h4 class="text-sm font-semibold text-brand-text-primary">Crear nuevo ambiente o salón</h4>
					<p class="text-xs text-brand-text-secondary">
						Agrupa mesas por áreas físicas (ej. Salón Principal, Terraza, Segundo Piso, VIP, Barra).
					</p>

					<div class="space-y-3 pt-2">
						<Input
							id="nombre-ambiente-input"
							label="Nombre del Ambiente"
							placeholder="Ej. Segundo Piso, Terraza Exterior, Zona VIP..."
							bind:value={nombreAmbiente}
						/>

						<div class="flex justify-end pt-2">
							<Button
								variant="primary"
								size="md"
								hotkey="Enter"
								onclick={handleCrearAmbiente}
								disabled={isCreatingAmbiente || !nombreAmbiente.trim()}
							>
								{isCreatingAmbiente ? 'Creando Ambiente...' : 'Crear Ambiente'}
							</Button>
						</div>
					</div>
				</div>
			{:else if pestana === 'administrar'}
				<div class="space-y-2">
					<Scroll orientation="vertical" class="min-h-0">
						<div class="max-h-72 space-y-3">
							{#each ambientes as amb}
								<div
									class="space-y-2 rounded border border-brand-border bg-brand-bg-primary p-2"
								>
									<div class="flex items-center justify-between font-semibold text-brand-text-primary">
										<span>{amb.nombre}</span>
										<span class="text-[11px]">{amb.mesas.length} mesas</span>
									</div>

									{#if amb.mesas.length === 0}
										<p class="py-1 text-xs italic">No hay mesas en este ambiente.</p>
									{:else}
										<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
											{#each amb.mesas as m}
												<div
													class="flex items-center justify-between rounded border border-brand-border bg-brand-bg-primary p-2 text-xs"
												>
													<div>
														<span class="font-bold text-brand-text-primary">Mesa {m.numero}</span>
														<span class="block text-[10px]"
															>{m.capacidad} pers. ({m.estado})</span
														>
													</div>
													<button
														type="button"
														class="cursor-pointer rounded p-1.5 transition-colors bg-red-500/20 text-red-400 hover:bg-red-500/40"
														onclick={() => handleEliminarMesa(m.id)}
													>
														<IconTrash class="size-3.5" />
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</Scroll>
				</div>
			{/if}

			<div class="flex justify-end p-2 bg-brand-bg-primary rounded border border-brand-border">
				<Button variant="outline" size="sm" onclick={onClose}>Cerrar</Button>
			</div>
		</div>
	</Modal>

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
