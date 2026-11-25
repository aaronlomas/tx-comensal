<script lang="ts">
  import type { ComandaDetalle, DetalleEstado } from "../../types";
  import { IconArrowRight, IconCheck, IconTrash } from "@tabler/icons-svelte";

  interface Props {
    detalle: ComandaDetalle;
    onavanzar: (
      detalleId: number,
      estadoActual: DetalleEstado,
    ) => void | Promise<void>;
    onanular: (detalleId: number) => void | Promise<void>;
  }

  let { detalle, onavanzar, onanular }: Props = $props();
</script>

<div
  class={[
    "flex flex-col rounded border p-2 text-xs transition-colors",
    detalle.estado === "anulado"
      ? "border-brand-border bg-brand-bg-secondary opacity-50"
      : "border-brand-border bg-brand-bg-primary",
  ]}
>
  <div class="flex items-start justify-between gap-2">
    <div class="flex-1">
      <div
        class="flex items-center gap-1.5 font-medium text-brand-text-primary"
      >
        <span class="font-bold text-sky-400">{detalle.cantidad}x</span>
        <span class={detalle.estado === "anulado" ? "line-through" : ""}>
          {detalle.producto_nombre}
        </span>
      </div>
      {#if detalle.notas}
        <div
          class="flex w-fit items-center gap-1 rounded bg-amber-950/40 px-1.5 py-0.5 font-mono text-[11px] text-amber-300"
        >
          <svg
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="size-3 shrink-0"
            viewBox="0 0 24 24"
            ><path
              d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"
            /></svg
          >
          {detalle.notas}
        </div>
      {/if}
    </div>

    <div class="text-right">
      <div class="font-mono font-bold text-brand-text-primary">
        S/ {detalle.importe.toFixed(2)}
      </div>
      <div class="text-xs">c/u S/ {detalle.precio_unitario.toFixed(2)}</div>
    </div>
  </div>

  {#if detalle.estado !== "anulado"}
    <div class="mt-2.5 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span class="text-xs">Estado:</span>
        <button
          type="button"
          class={[
            "cursor-pointer flex items-center rounded px-2 py-1 text-[10px] font-bold tracking-wider text-black uppercase transition-colors",
            detalle.estado === "pedido"
              ? "bg-amber-500 hover:bg-amber-400"
              : detalle.estado === "cocinando"
                ? "bg-sky-500 hover:bg-sky-400"
                : "bg-emerald-500 hover:bg-emerald-400",
          ]}
          onclick={() => onavanzar(detalle.id, detalle.estado)}
        >
          <span>{detalle.estado}</span>
          {#if detalle.estado !== "servido"}
            <IconArrowRight class="inline size-3 ml-1" />
          {:else}
            <IconCheck class="inline size-3 ml-1" />
          {/if}
        </button>
      </div>

      <button
        class="cursor-pointer hover:text-brand-text-error"
        onclick={() => onanular(detalle.id)}
      >
        <IconTrash size={16} />
      </button>
    </div>
  {/if}
</div>
