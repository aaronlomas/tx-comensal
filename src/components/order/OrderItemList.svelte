<script lang="ts">
  import type { ComandaDetalle, DetalleEstado } from "../../types";
  import { Scroll } from "$lib/components/core/primitives";
  import OrderItem from "./OrderItem.svelte";

  interface Props {
    detalles: ComandaDetalle[];
    onavanzar: (detalleId: number, estadoActual: DetalleEstado) => void | Promise<void>;
    onanular: (detalleId: number) => void | Promise<void>;
  }

  let { detalles, onavanzar, onanular }: Props = $props();

  let detallesVisibles = $derived(detalles.filter((d) => d.estado !== "anulado"));
</script>

<Scroll orientation="vertical" class="min-h-0 flex-1">
  <div class="min-h-0">
    <div
      class="flex shrink-0 items-center justify-between rounded text-xs font-semibold tracking-wider uppercase"
    >
      <span>Consumos Actuales</span>
      <span>{detallesVisibles.length} ítems</span>
    </div>

    {#if detallesVisibles.length === 0}
      <p class="py-6 text-center text-xs italic">
        No hay pedidos registrados en esta comanda aún.
      </p>
    {:else}
      <div class="rounded bg-brand-bg-primary">
        {#each detallesVisibles as detalle (detalle.id)}
          <OrderItem {detalle} {onavanzar} {onanular} />
        {/each}
      </div>
    {/if}
  </div>
</Scroll>
