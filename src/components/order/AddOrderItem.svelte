<script lang="ts">
  import type { Product } from "$lib/features/products";
  import { Button, Input, Number as NumberInput, Select } from "$lib/components/core/primitives";

  interface Props {
    productos: Product[];
    onagregar: (payload: {
      productoId: number;
      cantidad: number;
      precioUnitario: number;
      notas: string | null;
    }) => void | Promise<void>;
    onaviso?: (aviso: { tone: "info" | "warning" | "success" | "danger"; title: string; texto: string }) => void;
  }

  let { productos, onagregar, onaviso }: Props = $props();

  let selectedProductId = $state<string | number>("");
  let cantidadItem = $state(1);
  let notasItem = $state("");
  let isAddingItem = $state(false);

  let productosDisponibles = $derived(productos.filter((p) => p.activo));
  let productoSeleccionado = $derived(
    selectedProductId === ""
      ? null
      : (productos.find((p) => String(p.id) === String(selectedProductId)) ?? null)
  );

  async function handleAgregar() {
    if (!productoSeleccionado) {
      onaviso?.({
        tone: "warning",
        title: "Producto requerido",
        texto: "Selecciona un producto antes de agregarlo a la comanda."
      });
      return;
    }
    if (!Number.isFinite(cantidadItem) || cantidadItem < 1) {
      onaviso?.({
        tone: "warning",
        title: "Cantidad inválida",
        texto: "La cantidad debe ser al menos 1."
      });
      return;
    }

    isAddingItem = true;
    try {
      await onagregar({
        productoId: productoSeleccionado.id,
        cantidad: cantidadItem,
        precioUnitario: productoSeleccionado.precio_unitario_venta,
        notas: notasItem.trim() ? notasItem.trim() : null
      });
      selectedProductId = "";
      cantidadItem = 1;
      notasItem = "";
    } finally {
      isAddingItem = false;
    }
  }
</script>

<div class="gap-2 rounded border border-brand-border bg-brand-bg-primary p-2">
  <div>
    <Select
      id="producto-select"
      label="Agrega el producto"
      placeholder="Buscar producto..."
      search
      bind:value={selectedProductId}
      options={productosDisponibles.map((prod) => ({
        value: prod.id,
        label: `${prod.nombre} - S/ ${prod.precio_unitario_venta.toFixed(2)}`
      }))}
    />
  </div>

  {#if productoSeleccionado}
    <div class="flex flex-col gap-2">
      <div class="grid grid-cols-4 items-end gap-2 pt-1">
        <div class="col-span-1">
          <NumberInput
            id="cant-input"
            label="Cant."
            min={1}
            step={1}
            bind:value={cantidadItem}
          />
        </div>

        <div class="col-span-3">
          <Input
            id="notas-input"
            label="Notas de cocina (ej. papas bien fritas)"
            placeholder="Sin ensalada, parte pecho..."
            bind:value={notasItem}
          />
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        class="w-full"
        hotkey="Enter"
        disabled={isAddingItem}
        onclick={handleAgregar}
      >
        {isAddingItem
          ? "Agregando..."
          : `Agregar S/ ${(cantidadItem * productoSeleccionado.precio_unitario_venta).toFixed(2)}`}
      </Button>
    </div>
  {/if}
</div>
