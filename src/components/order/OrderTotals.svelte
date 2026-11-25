<script lang="ts">
  import { Button } from "$lib/components/core/primitives";

  interface Props {
    total: number;
    hasItems?: boolean;
    disabled?: boolean;
    oncancelar: () => void | Promise<void>;
    onopencobro: () => void;
  }

  let {
    total,
    hasItems = true,
    disabled = false,
    oncancelar,
    onopencobro,
  }: Props = $props();
</script>

<div class="m-1 rounded border text-sm border-brand-border bg-brand-bg-primary p-4">
  <div class="flex items-center justify-between">
    <span class="font-medium text-brand-text-secondary uppercase">Total:</span>
    <span class="font-mono font-bold text-emerald-400">
      S/ {total.toFixed(2)}
    </span>
  </div>

  <div class="mt-3 grid grid-cols-2 gap-2">
    <Button variant="danger" size="md" onclick={oncancelar} {disabled}>
      Cancelar
    </Button>

    <Button
      variant="secondary"
      size="md"
      onclick={onopencobro}
      disabled={disabled || !hasItems}
      class={!hasItems ? "opacity-50 cursor-not-allowed" : ""}
    >
      Cobrar / Cerrar
    </Button>
  </div>
</div>
