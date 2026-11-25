<script lang="ts">
  import type { Ambiente, Mesa, MesaEstado } from "../types";
  import TableRow from "./TableRow.svelte";
  import TableCard from "./TableCard.svelte";
  import { Tab, type TabItem } from "$lib/components/core/primitives";
  import { restaurantStore } from "../store";

  interface Props {
    ambientes: Ambiente[];
    mesaSeleccionada: Mesa | null;
    onselectmesa: (mesa: Mesa) => void;
  }

  let { ambientes, mesaSeleccionada, onselectmesa }: Props = $props();

  let ambienteActivoId = $state<string>("todos");
  let filtroEstado = $state<MesaEstado | "todos">("todos");
  let modoVista = $state<"lista" | "grid">("lista");

  const restaurant = $derived($restaurantStore);

  const tabAmbientes = $derived<TabItem[]>([
    { label: "Todos los ambientes", value: "todos" },
    ...ambientes.map((ambiente) => ({
      label: `${ambiente.nombre} (${ambiente.mesas.length})`,
      value: String(ambiente.id),
    })),
  ]);

  // Prioridad de ordenamiento: MESAS OCUPADAS AL PRINCIPIO
  const prioridadEstado: Record<MesaEstado, number> = {
    ocupada: 0,
    cuenta_solicitada: 1,
    sucia: 2,
    reservada: 3,
    libre: 4,
  };

  // Ambientes filtrados y ordenados
  let mesasFiltradas = $derived.by(() => {
    const todasLasMesas = ambientes
      .filter(
        (a) =>
          ambienteActivoId === "todos" || String(a.id) === ambienteActivoId,
      )
      .flatMap((a) => a.mesas);

    let lista =
      filtroEstado === "todos"
        ? [...todasLasMesas]
        : todasLasMesas.filter((m) => m.estado === filtroEstado);

    // Ordenar: Ocupadas al principio, y dentro del mismo estado por número de mesa
    return lista.sort((a, b) => {
      const prioA = prioridadEstado[a.estado] ?? 99;
      const prioB = prioridadEstado[b.estado] ?? 99;
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      const numA = parseInt(a.numero, 10);
      const numB = parseInt(b.numero, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.numero.localeCompare(b.numero);
    });
  });

  // Conteo de estados
  let conteos = $derived.by(() => {
    const todas = ambientes.flatMap((a) => a.mesas);
    return {
      total: todas.length,
      libres: todas.filter((m) => m.estado === "libre").length,
      ocupadas: todas.filter((m) => m.estado === "ocupada").length,
      porCobrar: todas.filter((m) => m.estado === "cuenta_solicitada").length,
      sucias: todas.filter((m) => m.estado === "sucia").length,
    };
  });
</script>

<!-- CONTENEDOR PRINCIPAL DE MESAS -->
<div
  class="flex h-full min-h-0 flex-1 flex-col gap-3 bg-brand-bg-primary rounded p-3 text-brand-text-secondary"
>
  <!-- Barra superior: Selector de Ambientes y Filtros de Estado -->
  <div
    class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-brand-border/40 pb-2"
  >
    <!-- Pestañas de Ambientes -->
    <Tab
      items={tabAmbientes}
      bind:value={ambienteActivoId}
      size="md"
      layout="flex"
    />

    <!-- Opciones de la derecha: Chips de filtro + Toggle de vista -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Chips de filtro de estado rápido -->
      <div class="flex items-center gap-1.5 text-xs text-brand-text-secondary">
        <button
          type="button"
          class={[
            "cursor-pointer rounded-full bg-brand-bg-secondary px-2.5 py-1 transition-colors",
            filtroEstado === "todos"
              ? "font-semibold text-sky-300 ring-1 ring-sky-400/40"
              : "hover:text-sky-300",
          ]}
          onclick={() => (filtroEstado = "todos")}
        >
          Todas: {conteos.total}
        </button>
        <button
          type="button"
          class={[
            "cursor-pointer rounded-full bg-brand-bg-secondary px-2.5 py-1 transition-colors",
            filtroEstado === "ocupada"
              ? "font-semibold text-sky-400 ring-1 ring-sky-400/40"
              : "border-brand-border hover:text-sky-400",
          ]}
          onclick={() => (filtroEstado = "ocupada")}
        >
          Ocupadas: {conteos.ocupadas}
        </button>
        <button
          type="button"
          class={[
            "cursor-pointer rounded-full bg-brand-bg-secondary px-2.5 py-1 transition-colors",
            filtroEstado === "libre"
              ? "font-semibold text-emerald-400 ring-1 ring-emerald-400/40"
              : "hover:text-emerald-400",
          ]}
          onclick={() => (filtroEstado = "libre")}
        >
          Libres: {conteos.libres}
        </button>
        <button
          type="button"
          class={[
            "cursor-pointer rounded-full bg-brand-bg-secondary px-2.5 py-1 transition-colors",
            filtroEstado === "cuenta_solicitada"
              ? "font-semibold text-amber-400 ring-1 ring-amber-400/40"
              : "hover:text-amber-400",
          ]}
          onclick={() => (filtroEstado = "cuenta_solicitada")}
        >
          Por cobrar: {conteos.porCobrar}
        </button>
        <button
          type="button"
          class={[
            "cursor-pointer rounded-full bg-brand-bg-secondary px-2.5 py-1 transition-colors",
            filtroEstado === "sucia"
              ? "font-semibold text-rose-400 ring-1 ring-rose-400/40"
              : "hover:text-rose-400",
          ]}
          onclick={() => (filtroEstado = "sucia")}
        >
          Sucias: {conteos.sucias}
        </button>
      </div>

      <!-- Selector de Vista: Lista vs Cuadrícula -->
      <div
        class="flex items-center gap-0.5 rounded-lg border border-brand-border/60 bg-brand-bg-secondary p-0.5 text-xs"
      >
        <button
          type="button"
          title="Vista Lista"
          class={[
            "flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-medium transition-colors",
            modoVista === "lista"
              ? "bg-sky-500 font-semibold text-white shadow-sm"
              : "text-brand-text-secondary hover:text-brand-text-primary",
          ]}
          onclick={() => (modoVista = "lista")}
        >
          <svg
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="size-3.5"
            viewBox="0 0 24 24"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span class="hidden sm:inline">Lista</span>
        </button>

        <button
          type="button"
          title="Vista Cuadrícula"
          class={[
            "flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-medium transition-colors",
            modoVista === "grid"
              ? "bg-sky-500 font-semibold text-white shadow-sm"
              : "text-brand-text-secondary hover:text-brand-text-primary",
          ]}
          onclick={() => (modoVista = "grid")}
        >
          <svg
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="size-3.5"
            viewBox="0 0 24 24"
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
          <span class="hidden sm:inline">Cards</span>
        </button>
      </div>
    </div>
  </div>

  {#if mesasFiltradas.length === 0}
    <div
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-brand-border bg-brand-bg-secondary/40 p-12 text-center text-brand-text-secondary"
    >
      <p class="text-sm font-medium text-brand-text-primary">
        No se encontraron mesas
      </p>
      <p class="mt-1 text-xs">
        Intenta cambiando el filtro o agrega mesas en configuración.
      </p>
    </div>
  {:else if modoVista === "lista"}
    <!-- Vista Lista (según boceto del usuario + columna Proceso) -->
    <div class="flex flex-col gap-1">
      <!-- Encabezado de columnas: MESA | PERSONAS | DISPONIBILIDAD | TIEMPO | ESTADO | PROCESO -->
      <div
        class="grid grid-cols-[3.5rem_4.5rem_7.5rem_8rem_6.5rem_1fr] items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-text-secondary opacity-60 border-b border-brand-border/40"
      >
        <span class="text-center">Mesa</span>
        <span class="text-center">Personas</span>
        <span>Estado</span>
        <span class="text-center">Tiempo</span>
        <span class="text-center">Proceso</span>
        <span class="text-right pr-2">Acciones</span>
      </div>

      <!-- Filas de mesas tipo lista -->
      <div class="flex flex-col gap-1.5 pt-1">
        {#each mesasFiltradas as mesa (mesa.id)}
          <TableRow
            {mesa}
            comanda={restaurant.comandas?.[mesa.id] ?? null}
            timer={restaurant.mesaTimers?.[mesa.id] ?? null}
            selected={mesaSeleccionada?.id === mesa.id}
            onclick={() => onselectmesa(mesa)}
          />
        {/each}
      </div>
    </div>
  {:else}
    <!-- Vista Cuadrícula (Cards) -->
    <div
      class="grid w-full auto-rows-[115px] grid-cols-[repeat(auto-fill,minmax(115px,1fr))] content-start items-start gap-3 pt-1"
    >
      {#each mesasFiltradas as mesa (mesa.id)}
        <TableCard
          {mesa}
          timer={restaurant.mesaTimers?.[mesa.id] ?? null}
          selected={mesaSeleccionada?.id === mesa.id}
          onclick={() => onselectmesa(mesa)}
        />
      {/each}
    </div>
  {/if}
</div>
