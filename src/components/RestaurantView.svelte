<script lang="ts">
  import { onMount } from "svelte";
  import { IconRefresh } from "@tabler/icons-svelte";

  import { restaurantStore } from "../store";
  import { productsStore } from "$lib/features/products";
  import type { Comanda, Mesa } from "../types";

  import TableGrid from "./TableGrid.svelte";
  import OrderPanel from "./order/OrderPanel.svelte";
  import CloseTableModal from "./CloseTableModal.svelte";
  import TableManagementModal from "./TableManagementModal.svelte";
  import { Button, Scroll } from "$lib/components/core/primitives";

  let isModalCobroOpen = $state(false);
  let isModalGestionOpen = $state(false);
  let mesaParaCobro = $state<Mesa | null>(null);
  let comandaParaCobro = $state<Comanda | null>(null);

  const restaurant = $derived($restaurantStore);

  onMount(() => {
    restaurantStore.cargarAmbientes();
    productsStore.load();
  });

  function handleSelectMesa(mesa: Mesa) {
    restaurantStore.seleccionarMesa(mesa);
  }

  function handleDeselectMesa() {
    restaurantStore.seleccionarMesa(null);
  }

  function handleOpenCobro() {
    mesaParaCobro = restaurant.mesaSeleccionada;
    comandaParaCobro = restaurant.comandaActiva;
    isModalCobroOpen = true;
  }

  function handleCloseCobro() {
    isModalCobroOpen = false;
    mesaParaCobro = null;
    comandaParaCobro = null;
  }

  function handleCobroExitoso() {
    handleCloseCobro();
    restaurantStore.seleccionarMesa(null);
  }
</script>

<div
  class="flex h-full w-full flex-col bg-brand-bg-secondary text-brand-text-secondary gap-1"
>
  <!-- Encabezado Principal del Módulo -->
  <header
    class="flex shrink-0 items-center justify-between border-b border-brand-border bg-brand-bg-primary rounded-b p-2"
  >
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={() => (isModalGestionOpen = true)}
      >
        Gestionar Mesas
      </Button>
    </div>
  </header>

  <!-- Cuerpo: Mesas a la izquierda, Panel de Comanda a la derecha -->
  <div class="flex min-h-0 flex-1">
    <Scroll orientation="vertical" class="h-full min-h-0 flex-1">
      <!-- Sección de Mesas -->
      <main
        class="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-brand-bg-primary"
      >
        {#if restaurant.loading && restaurant.ambientes.length === 0}
          <div
            class="flex h-64 flex-col items-center justify-center gap-2 text-slate-400"
          >
            <IconRefresh class="size-6 animate-spin text-sky-400" />
            <p class="text-sm">Cargando salones y mesas...</p>
          </div>
        {:else}
          <TableGrid
            ambientes={restaurant.ambientes}
            mesaSeleccionada={restaurant.mesaSeleccionada}
            onselectmesa={handleSelectMesa}
          />
        {/if}
      </main>
    </Scroll>
    <!-- Panel Lateral de Comanda (si hay mesa seleccionada) -->
    {#if restaurant.mesaSeleccionada}
      <OrderPanel
        mesa={restaurant.mesaSeleccionada}
        comanda={restaurant.comandaActiva}
        loadingComanda={restaurant.loadingComanda}
        onclose={handleDeselectMesa}
        onopencobro={handleOpenCobro}
      />
    {/if}
  </div>

  <!-- Modal de Cobro y Cierre de Mesa (persistente durante emisión de comprobante) -->
  {#if mesaParaCobro}
    <CloseTableModal
      bind:isOpen={isModalCobroOpen}
      mesa={mesaParaCobro}
      comanda={comandaParaCobro}
      onClose={handleCloseCobro}
      onSuccess={handleCobroExitoso}
    />
  {/if}

  <!-- Modal de Gestión y Creación de Mesas y Salones -->
  <TableManagementModal
    bind:isOpen={isModalGestionOpen}
    ambientes={restaurant.ambientes}
    onClose={() => (isModalGestionOpen = false)}
  />
</div>
