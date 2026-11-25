<script lang="ts">
  import type { Comanda } from "../../types";
  import { Badge } from "$lib/components/core/primitives";

  interface Props {
    comanda: Comanda;
  }

  let { comanda }: Props = $props();
</script>

<div class="rounded border border-brand-border bg-brand-bg-primary p-2 text-xs">
  <div class="flex items-center justify-between">
    <span class="font-medium text-blue-400">{comanda.numero_comanda}</span>
    <Badge variant="basic" class="text-[10px]">
      {comanda.estado}
    </Badge>
  </div>
  <div class="flex items-center justify-between text-[11px]">
    <span
      >Mozo: <strong class="text-brand-text-primary"
        >{comanda.mozo ?? "No asignado"}</strong
      ></span
    >
    <span
      >Comensales: <strong class="text-brand-text-primary"
        >{comanda.numero_personas}</strong
      ></span
    >
  </div>
</div>
