<script lang="ts">
  import type { Mesa } from "../../types";
  import { Button, Input, Number as NumberInput } from "$lib/components/core/primitives";

  interface Props {
    mesa: Mesa;
    onabrir: (payload: { mozo: string; numeroPersonas: number }) => void | Promise<void>;
  }

  let { mesa, onabrir }: Props = $props();

  let mozoNuevo = $state("Mozo 1");
  let personasNuevo = $state(4);

  $effect(() => {
    personasNuevo = mesa.capacidad;
  });

  async function handleAbrir() {
    await onabrir({ mozo: mozoNuevo, numeroPersonas: personasNuevo });
  }
</script>

<div class="rounded border border-brand-border bg-brand-bg-primary p-2">
  <h4 class="flex items-center gap-2 text-sm font-semibold">
    <svg
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="size-4 text-emerald-400"
      viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg
    >
    Mesa #{mesa.numero}
  </h4>

  <div>
    <NumberInput
      id="personas-input"
      label="Número de personas"
      min={1}
      max={30}
      bind:value={personasNuevo}
    />

    <Input
      id="mozo-input"
      label="Mozo / Atendido por"
      placeholder="Ej. Mozo 1, Carlos..."
      bind:value={mozoNuevo}
    />

    <Button
      variant="primary"
      size="md"
      class="mt-3 w-full"
      hotkey="Enter"
      onclick={handleAbrir}
    >
      Ocupar Mesa y Crear Comanda
    </Button>
  </div>
</div>
