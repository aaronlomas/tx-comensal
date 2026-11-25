<script lang="ts">
  import { Button } from "$lib/components/core/primitives";

  interface Props {
    onlimpiar: () => void;
  }

  let { onlimpiar }: Props = $props();
</script>

<div
  class="flex flex-col items-center justify-center rounded border border-rose-500/30 bg-rose-950/20 p-8 text-center"
>
  <div class="rounded-full bg-rose-500/20 p-3 text-rose-400">
    <svg
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="size-8"
      viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4v18m6 0V11l-6-4" /></svg
    >
  </div>
  <h4 class="text-base font-semibold text-rose-200">
    Mesa desocupada pendiente de limpieza
  </h4>
  <p class="text-xs">
    La comanda anterior ha sido cobrada y cerrada. Una vez limpia y desinfectada
    la mesa, márcala como lista para nuevos comensales.
  </p>
  <Button variant="secondary" size="md" class="mt-2" onclick={onlimpiar}>
    Marcar como Limpia y Disponible
  </Button>
</div>
