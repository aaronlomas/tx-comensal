<script lang="ts">
  import type { Comanda, DetalleEstado, Mesa } from "../../types";
  import { restaurantStore } from "../../store";
  import { productsStore } from "$lib/features/products";
  import { Button, Modal, Notifier } from "$lib/components/core/primitives";

  import OrderPanelHeader from "./OrderPanelHeader.svelte";
  import DirtyTableState from "./DirtyTableState.svelte";
  import OpenOrder from "./OpenOrder.svelte";
  import OrderInfo from "./OrderInfo.svelte";
  import AddOrderItem from "./AddOrderItem.svelte";
  import OrderItemList from "./OrderItemList.svelte";
  import OrderTotals from "./OrderTotals.svelte";

  interface Props {
    mesa: Mesa;
    comanda: Comanda | null;
    loadingComanda?: boolean;
    onclose: () => void;
    onopencobro: () => void;
  }

  let {
    mesa,
    comanda,
    loadingComanda = false,
    onclose,
    onopencobro,
  }: Props = $props();

  let aviso = $state<{
    tone: "info" | "warning" | "success" | "danger";
    title: string;
    texto: string;
  } | null>(null);

  let productos = $derived($productsStore);

  let tieneItemsActivos = $derived(
    !!comanda && comanda.detalles.some((d) => d.estado !== "anulado"),
  );

  let confirmarCancelacion = $state(false);
  let cancelando = $state(false);

  let totalComanda = $derived.by(() => {
    if (!comanda?.detalles) return 0;
    return comanda.detalles
      .filter((d) => d.estado !== "anulado")
      .reduce((acc, d) => acc + (d.importe || d.cantidad * d.precio_unitario), 0);
  });

  async function handleOpenOrder(payload: { mozo: string; numeroPersonas: number }) {
    try {
      await restaurantStore.crearComanda({
        mozo: payload.mozo,
        numeroPersonas: payload.numeroPersonas,
      });
    } catch {
      // El error de base de datos se registra en el log desde el store.
    }
  }

  async function handleAddOrderItem(payload: {
    productoId: number;
    cantidad: number;
    precioUnitario: number;
    notas: string | null;
  }) {
    try {
      await restaurantStore.agregarDetalle(payload);
    } catch {
      // El error de base de datos se registra en el log desde el store.
    }
  }

  async function handleAvanzarEstadoDetalle(detalleId: number, estadoActual: DetalleEstado) {
    let siguienteEstado: DetalleEstado = "cocinando";
    if (estadoActual === "pedido") siguienteEstado = "cocinando";
    else if (estadoActual === "cocinando") siguienteEstado = "servido";
    else if (estadoActual === "servido") return;

    try {
      await restaurantStore.cambiarEstadoDetalle(detalleId, siguienteEstado);
    } catch {
      // El error de base de datos se registra en el log desde el store.
    }
  }

  async function handleAnularDetalle(detalleId: number) {
    try {
      await restaurantStore.cambiarEstadoDetalle(detalleId, "anulado");
    } catch {
      // El error de base de datos se registra en el log desde el store.
    }
  }

  async function ejecutarCancelacion() {
    if (cancelando) return;
    cancelando = true;
    try {
      await restaurantStore.cancelarComanda(comanda, mesa.id);
      confirmarCancelacion = false;
      onclose();
    } catch {
      // El error de base de datos se registra en el log desde el store.
    } finally {
      cancelando = false;
    }
  }

  function handleSolicitarCancelacion() {
    if (tieneItemsActivos) {
      confirmarCancelacion = true;
    } else {
      ejecutarCancelacion();
    }
  }

  async function handleLimpiarMesa() {
    try {
      await restaurantStore.cambiarEstadoMesa(mesa.id, "libre");
      onclose();
    } catch {
      // El error de base de datos se registra en el log desde el store.
    }
  }
</script>

<aside
  class="flex h-full w-80 max-w-sm flex-col border-l border-brand-border bg-brand-bg-secondary text-brand-text-secondary shadow-xl sm:max-w-md"
>
  <OrderPanelHeader {onclose} />

  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-1 text-brand-text-secondary">
    {#if mesa.estado === "sucia"}
      <DirtyTableState onlimpiar={handleLimpiarMesa} />
    {:else if mesa.estado === "libre" && !comanda}
      <OpenOrder {mesa} onabrir={handleOpenOrder} />
    {:else if loadingComanda}
      <div class="flex items-center justify-center p-12 text-sm">
        Cargando información de comanda...
      </div>
    {:else if comanda}
      <OrderInfo {comanda} />

      <AddOrderItem
        {productos}
        onagregar={handleAddOrderItem}
        onaviso={(value) => (aviso = value)}
      />

      <OrderItemList
        detalles={comanda.detalles}
        onavanzar={handleAvanzarEstadoDetalle}
        onanular={handleAnularDetalle}
      />
    {/if}
  </div>

  {#if !loadingComanda && (comanda || mesa.estado === "ocupada" || mesa.estado === "cuenta_solicitada")}
    <OrderTotals
      total={totalComanda}
      hasItems={tieneItemsActivos}
      disabled={cancelando}
      oncancelar={handleSolicitarCancelacion}
      {onopencobro}
    />
  {/if}
</aside>

{#if confirmarCancelacion}
  <Modal
    isOpen={confirmarCancelacion}
    onClose={() => (confirmarCancelacion = false)}
    title={`Cancelar Mesa #${mesa.numero}`}
  >
    <div class="w-full max-w-sm space-y-4 p-2 text-xs text-brand-text-secondary">
      <p class="leading-relaxed">
        ¿Estás seguro de cancelar la comanda de la
        <strong class="text-brand-text-primary">Mesa #{mesa.numero}</strong>?
        Se anularán los productos cargados y la mesa volverá a estado
        <strong class="text-emerald-400">LIBRE</strong>.
      </p>

      <div class="flex items-center justify-end gap-2 border-t border-brand-border pt-3">
        <Button
          variant="outline"
          size="md"
          onclick={() => (confirmarCancelacion = false)}
          disabled={cancelando}
        >
          Volver
        </Button>
        <Button
          variant="danger"
          size="md"
          onclick={ejecutarCancelacion}
          disabled={cancelando}
        >
          {cancelando ? "Cancelando..." : "Sí, cancelar y liberar"}
        </Button>
      </div>
    </div>
  </Modal>
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
