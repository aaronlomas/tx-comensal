<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Comanda, Mesa, MesaEstado, MesaTimer, TimerFase } from "../types";
  import { restaurantStore } from "../store";

  interface Props {
    mesa: Mesa;
    comanda?: Comanda | null;
    timer?: MesaTimer | null;
    selected?: boolean;
    onclick?: () => void;
  }

  let {
    mesa,
    comanda = null,
    timer = null,
    selected = false,
    onclick,
  }: Props = $props();

  // ─── Configuración de Colores y Borde según Estado de la Mesa ───────────────
  const estadoVisualConfig: Record<
    MesaEstado,
    {
      label: string;
      borderClass: string;
      badgeText: string;
      badgeBg: string;
      circleBg: string;
      rowBg: string;
    }
  > = {
    libre: {
      label: "LIBRE",
      borderClass: "border-emerald-500/60 hover:border-emerald-400",
      badgeText: "text-emerald-300 font-bold",
      badgeBg: "bg-emerald-950/60 border border-emerald-500/30",
      circleBg: "bg-emerald-600",
      rowBg: "bg-emerald-950/5",
    },
    ocupada: {
      label: "OCUPADA",
      borderClass: "border-sky-500/70 hover:border-sky-400",
      badgeText: "text-sky-300 font-bold",
      badgeBg: "bg-sky-950/60 border border-sky-500/30",
      circleBg: "bg-sky-600",
      rowBg: "bg-sky-950/10",
    },
    cuenta_solicitada: {
      label: "POR COBRAR",
      borderClass: "border-amber-400/90 hover:border-amber-300 ring-1 ring-amber-400/40",
      badgeText: "text-amber-300 font-bold",
      badgeBg: "bg-amber-950/60 border border-amber-500/40",
      circleBg: "bg-amber-600",
      rowBg: "bg-amber-950/15",
    },
    reservada: {
      label: "RESERVADA",
      borderClass: "border-purple-500/60 hover:border-purple-400",
      badgeText: "text-purple-300 font-bold",
      badgeBg: "bg-purple-950/60 border border-purple-500/30",
      circleBg: "bg-purple-600",
      rowBg: "bg-purple-950/5",
    },
    sucia: {
      label: "SUCIA",
      borderClass: "border-rose-500/70 hover:border-rose-400",
      badgeText: "text-rose-300 font-bold",
      badgeBg: "bg-rose-950/60 border border-rose-500/30",
      circleBg: "bg-rose-600",
      rowBg: "bg-rose-950/10",
    },
  };

  let cfg = $derived(
    estadoVisualConfig[mesa.estado] ?? estadoVisualConfig.libre,
  );

  // ─── Timer Reactivo en Tiempo Real ──────────────────────────────────────────
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

  // ─── Alertas de Tiempo (>15min Ámbar vibrante, >20min Rojo vibrante) ────────
  const MIN_15 = 15 * 60;
  const MIN_20 = 20 * 60;
  const MIN_30 = 30 * 60;

  let nivelAlerta = $derived.by(() => {
    if (!timer) return "none";
    if (timer.fase === "pedido" || timer.fase === "cocinando") {
      if (segundosTranscurridos >= MIN_20) return "rojo";
      if (segundosTranscurridos >= MIN_15) return "ambar";
    }
    return "none";
  });

  /** Clases de sombra y borde de alerta */
  let alertaClases = $derived.by(() => {
    if (nivelAlerta === "rojo") {
      return "!border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.95)] ring-2 ring-red-500 animate-pulse";
    }
    if (nivelAlerta === "ambar") {
      return "!border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.85)] ring-2 ring-amber-400 animate-pulse";
    }
    return "";
  });

  // ─── Auto-pasar a "Por cobrar" tras 30 min en "servido" ─────────────────────
  let autoCobrarDisparado = $state(false);
  $effect(() => {
    if (
      timer?.fase === "servido" &&
      segundosTranscurridos >= MIN_30 &&
      mesa.estado === "ocupada" &&
      !autoCobrarDisparado
    ) {
      autoCobrarDisparado = true;
      restaurantStore.cambiarEstadoMesa(mesa.id, "cuenta_solicitada");
    }
    if (mesa.estado === "cuenta_solicitada" || !timer || timer.fase !== "servido") {
      autoCobrarDisparado = false;
    }
  });

  // ─── Formato de Tiempo ──────────────────────────────────────────────────────
  function formatMMSS(seg: number): string {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  let tiempoStr = $derived(
    timer ? formatMMSS(segundosTranscurridos) : "--:--",
  );

  let personas = $derived(comanda?.numero_personas ?? mesa.capacidad);

  // ─── Estado de Cocina / Comanda ─────────────────────────────────────────────
  const estadoDetalleConfig: Record<
    TimerFase,
    { label: string; bgClass: string }
  > = {
    cocinando: {
      label: "COCINANDO",
      bgClass: "bg-sky-600 text-white font-bold shadow-sm",
    },
    pedido: {
      label: "PEDIDO",
      bgClass: "bg-amber-500 text-black font-bold shadow-sm",
    },
    servido: {
      label: "SERVIDO",
      bgClass: "bg-emerald-600 text-white font-bold shadow-sm",
    },
  };

  let faseActiva = $derived<TimerFase | null>(timer?.fase ?? null);

  let estadoDetalleCfg = $derived(
    faseActiva ? estadoDetalleConfig[faseActiva] : null,
  );

  // ─── Manejador de botones de proceso ────────────────────────────────────────
  async function handleCambiarProceso(e: MouseEvent, nuevaFase: TimerFase) {
    e.stopPropagation();
    await restaurantStore.cambiarProcesoMesa(mesa.id, nuevaFase);
  }
</script>

<div
  role="button"
  tabindex="0"
  onclick={() => onclick?.()}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onclick?.();
    }
  }}
  class={[
    "group grid w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-150 select-none",
    "grid-cols-[3.5rem_4.5rem_7.5rem_8rem_6.5rem_1fr]",
    cfg.borderClass,
    cfg.rowBg,
    alertaClases,
    selected
      ? "!border-sky-400 bg-sky-950/40 ring-2 ring-sky-400"
      : "",
  ]}
>
  <!-- 1. MESA: ÚNICAMENTE el círculo con el número (sin '#', sin texto extra) -->
  <div class="flex items-center justify-center">
    <div
      class={[
        "flex size-9 shrink-0 items-center justify-center rounded-full font-black text-sm text-white shadow-md transition-transform group-hover:scale-105",
        cfg.circleBg,
      ]}
    >
      {mesa.numero}
    </div>
  </div>

  <!-- 2. PERSONAS -->
  <div class="flex items-center justify-center gap-1 text-sm font-semibold text-brand-text-primary">
    <svg
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="size-3.5 opacity-60"
      viewBox="0 0 24 24"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87m-3-12a4 4 0 0 1 0 7.75" />
    </svg>
    <span>{personas}</span>
  </div>

  <!-- 3. DISPONIBILIDAD: con badge y color del estado -->
  <div class="flex items-center">
    <span
      class={[
        "inline-flex items-center rounded px-2 py-0.5 text-xs tracking-wide",
        cfg.badgeBg,
        cfg.badgeText,
      ]}
    >
      {cfg.label}
    </span>
  </div>

  <!-- 4. TIEMPO: [cocinando] 3:23 con alertas ámbar/rojo -->
  <div class="flex items-center justify-center">
    {#if timer}
      <div class="flex items-center gap-1 font-mono text-sm tabular-nums">
        <span
          class={[
            nivelAlerta === "rojo"
              ? "font-extrabold text-red-400"
              : nivelAlerta === "ambar"
                ? "font-extrabold text-amber-400"
                : "font-semibold text-brand-text-primary",
          ]}
        >
          [{timer.fase}] {tiempoStr}
        </span>
      </div>
    {:else}
      <span class="font-mono text-xs text-brand-text-secondary opacity-40">--:--</span>
    {/if}
  </div>

  <!-- 5. ESTADO: Badge con el estado culinario activo -->
  <div class="flex items-center justify-center">
    {#if estadoDetalleCfg}
      <span
        class={[
          "inline-flex items-center justify-center rounded px-2.5 py-0.5 text-[11px] tracking-wider uppercase",
          estadoDetalleCfg.bgClass,
        ]}
      >
        {estadoDetalleCfg.label}
      </span>
    {:else}
      <span class="text-xs text-brand-text-secondary opacity-40 uppercase">-</span>
    {/if}
  </div>

  <!-- 6. PROCESO: Botones de Pedido, Cocinar, Servir -->
  <div class="flex items-center justify-end">
    <div
      class="inline-flex items-center gap-0.5 rounded-lg border border-brand-border/60 bg-brand-bg-secondary p-0.5"
    >
      <button
        type="button"
        title="Cambiar a Pedido"
        class={[
          "cursor-pointer rounded px-2 py-1 text-[11px] font-bold transition-all",
          faseActiva === "pedido"
            ? "bg-amber-500 text-black shadow-sm"
            : "text-brand-text-secondary hover:bg-brand-bg-primary hover:text-amber-400",
        ]}
        onclick={(e) => handleCambiarProceso(e, "pedido")}
      >
        Pedido
      </button>

      <button
        type="button"
        title="Cambiar a Cocinando"
        class={[
          "cursor-pointer rounded px-2 py-1 text-[11px] font-bold transition-all",
          faseActiva === "cocinando"
            ? "bg-sky-500 text-white shadow-sm"
            : "text-brand-text-secondary hover:bg-brand-bg-primary hover:text-sky-400",
        ]}
        onclick={(e) => handleCambiarProceso(e, "cocinando")}
      >
        Cocinar
      </button>

      <button
        type="button"
        title="Cambiar a Servido"
        class={[
          "cursor-pointer rounded px-2 py-1 text-[11px] font-bold transition-all",
          faseActiva === "servido"
            ? "bg-emerald-500 text-white shadow-sm"
            : "text-brand-text-secondary hover:bg-brand-bg-primary hover:text-emerald-400",
        ]}
        onclick={(e) => handleCambiarProceso(e, "servido")}
      >
        Servir
      </button>
    </div>
  </div>
</div>
