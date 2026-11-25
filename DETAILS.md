---
accent: "#f59e0b"
---

<div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: 12px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(239, 68, 68, 0.12)); border: 1px solid rgba(245, 158, 11, 0.35); margin-bottom: 18px;">
  <div style="display: flex; align-items: center; gap: 14px;">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
      <path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zm0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3" />
    </svg>
    <div>
      <div style="font-size: 16px; font-weight: 700; color: #fbbf24;">Comensal — Edición Gastronomía</div>
      <div style="font-size: 12px; opacity: 0.85; margin-top: 2px;">Paquete independiente (`tx-comensal`) para atención en salón, comandas y cobro en caja.</div>
    </div>
  </div>
  <span style="padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); white-space: nowrap;">Gastronomía</span>
</div>

## Arquitectura independiente (`tx-comensal`)

Cada extensión define su propia ficha en `DETAILS.md`, incluyendo paleta de acento, tarjetas, tablas, stickers SVG e imágenes locales sin hardcodear texto en Taxorium.

<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 14px 0;">
  <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(245, 158, 11, 0.25); background: rgba(245, 158, 11, 0.06);">
    <div style="font-size: 12px; font-weight: 700; color: #fbbf24;">Salones y Mesas</div>
    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Distribución por ambientes con actualización de estado en un clic.</div>
  </div>
  <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.25); background: rgba(56, 189, 248, 0.06);">
    <div style="font-size: 12px; font-weight: 700; color: #38bdf8;">Comandas</div>
    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Control por mesa, cantidad de comensales y mozo responsable.</div>
  </div>
  <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.25); background: rgba(16, 185, 129, 0.06);">
    <div style="font-size: 12px; font-weight: 700; color: #34d399;">Facturación Core</div>
    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Emisión electrónica SUNAT y cuadre directo con caja abierta.</div>
  </div>
</div>

## Requisitos del Core

- `taxor:drafts` — Persistencia temporal de pedidos de mesa.
- `taxor:vouchers` — Generación de comprobantes electrónicos.
- `taxor:products` — Catálogo de platos, bebidas e insumos.
- `taxor:cash` — Registro de ingresos en la sesión de caja.

