<script lang="ts">
  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();
</script>

<div class="flex items-center justify-between border-b border-brand-border p-2">
  <h1 class="text-sm font-bold">COMANDA</h1>
  <button
    type="button"
    class="cursor-pointer rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-400"
    onclick={onclose}
    aria-label="Cerrar panel"
  >
    <svg
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="size-5"
      viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg
    >
  </button>
</div>
