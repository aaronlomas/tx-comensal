<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Mesa, MesaEstado, MesaTimer } from "../types";
  import { Badge, type BadgeVariant } from "$lib/components/core/primitives";

  interface Props {
    mesa: Mesa;
    timer?: MesaTimer | null;
    selected?: boolean;
    onclick?: () => void;
  }

  let { mesa, timer = null, selected = false, onclick }: Props = $props();

  const estadoConfig: Record<
    MesaEstado,
    {
      label: string;
      badgeVariant: BadgeVariant;
      borderClass: string;
      bgClass: string;
      circleBg: string;
      textClass: string;
    }
  > = {
    libre: {
      label: "Libre",
      badgeVariant: "success",
      borderClass: "border-emerald-500/70 hover:border-emerald-400",
      bgClass: "bg-emerald-950/25 hover:bg-emerald-950/40",
      circleBg: "bg-emerald-600",
      textClass: "text-emerald-400",
    },
    ocupada: {
      label: "Ocupada",
      badgeVariant: "info",
      borderClass: "border-sky-500/80 hover:border-sky-400",
      bgClass: "bg-sky-950/30 hover:bg-sky-950/50",
      circleBg: "bg-sky-600",
      textClass: "text-sky-300",
    },
    cuenta_solicitada: {
      label: "Por Cobrar",
      badgeVariant: "warning",
      borderClass: "border-amber-400/90 hover:border-amber-300 ring-1 ring-amber-400/30",
      bgClass: "bg-amber-950/30 hover:bg-amber-950/50",
      circleBg: "bg-amber-600",
      textClass: "text-amber-300",
    },
    reservada: {
      label: "Reservada",
      badgeVariant: "basic",
      borderClass: "border-purple-500/70 hover:border-purple-400",
      bgClass: "bg-purple-950/25 hover:bg-purple-950/40",
      circleBg: "bg-purple-600",
      textClass: "text-purple-300",
    },
    sucia: {
      label: "Sucia",
      badgeVariant: "alert",
      borderClass: "border-rose-500/80 hover:border-rose-400",
      bgClass: "bg-rose-950/30 hover:bg-rose-950/50",
      circleBg: "bg-rose-600",
      textClass: "text-rose-400",
    },
  };

  let cfg = $derived(estadoConfig[mesa.estado] ?? estadoConfig.libre);

  // ─── Timer Reactivo ─────────────────────────────────────────────────────────
  let segundosTranscurridos = $state(0);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function calcularSegundos() {
    if (timer && timer.inicioMs) {
      segundosTranscurridos = Math.max(
        0,
        Math.floor((Date.now() - timer.inicioMs) / 1000),
      );
    } else {
      segundosTranscurridos = 0;
    }
  }

  $effect(() => {
    calcularSegundos();
    if (timer) {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(calcularSegundos, 1000);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const MIN_15 = 15 * 60;
  const MIN_20 = 20 * 60;

  let nivelAlerta = $derived.by(() => {
    if (!timer) return "none";
    if (timer.fase === "pedido" || timer.fase === "cocinando") {
      if (segundosTranscurridos >= MIN_20) return "rojo";
      if (segundosTranscurridos >= MIN_15) return "ambar";
    }
    return "none";
  });

  let shadowClass = $derived.by(() => {
    if (nivelAlerta === "rojo") {
      return "!border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)] ring-2 ring-red-500 animate-pulse";
    }
    if (nivelAlerta === "ambar") {
      return "!border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.85)] ring-2 ring-amber-400 animate-pulse";
    }
    return "";
  });

  function formatMMSS(seg: number): string {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  let tiempoStr = $derived(timer ? formatMMSS(segundosTranscurridos) : "");
</script>

<button
  type="button"
  class={[
    "group relative flex h-full min-h-27.5 w-full cursor-pointer flex-col justify-between rounded-lg border p-2 text-left transition-all duration-150 select-none",
    cfg.borderClass,
    cfg.bgClass,
    shadowClass,
    selected
      ? "-translate-y-0.5 shadow-lg ring-2 shadow-sky-500/20 ring-sky-400"
      : "shadow-sm hover:-translate-y-0.5",
  ]}
  {onclick}
>
  <!-- Encabezado de la mesa: Círculo con número únicamente -->
  <div class="flex flex-col items-center justify-center pt-1">
    <div
      class={[
        "flex size-10 items-center justify-center rounded-full font-black text-base text-white shadow-md transition-transform group-hover:scale-105",
        cfg.circleBg,
      ]}
    >
      {mesa.numero}
    </div>
    {#if timer}
      <span
        class={[
          "mt-1 font-mono text-[11px] font-bold tabular-nums",
          nivelAlerta === "rojo"
            ? "text-red-400"
            : nivelAlerta === "ambar"
              ? "text-amber-400"
              : "text-brand-text-secondary opacity-90",
        ]}
      >
        [{timer.fase}] {tiempoStr}
      </span>
    {/if}
  </div>

  <!-- Info adicional inferior -->
  <div class="flex items-center justify-between text-xs mt-1">
    <span class="flex items-center gap-1 opacity-80 text-brand-text-white">
      <svg
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="size-3.5"
        viewBox="0 0 24 24"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87m-3-12a4 4 0 0 1 0 7.75" />
      </svg>
      <span>{mesa.capacidad}</span>
    </span>

    <Badge variant={cfg.badgeVariant}>
      {cfg.label}
    </Badge>
  </div>
</button>
