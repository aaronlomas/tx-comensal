# tx-comensal

Extensión de **gastronomía para Taxorium**: gestión de salones, mesas, comandas y cobro con comprobante electrónico.

## Uso en Taxorium

1. Esta carpeta debe quedar al lado de `taxorium/` (en `tsconfig.json` ya se resuelve `$lib/*` hacia `../taxorium/src/lib/*`).
2. Ejecutar `schema.sql` en la base de datos de Taxorium. Crea mesas, comandas, insumos y siembra `Salón Principal` y `Terraza`.
3. Registrar los comandos de `backend/restaurant.rs` en `src-tauri` (`get_ambientes`, `create_comanda`, `finalizar_comanda`, etc.).
4. Cargar `src/index.ts` como entry. La vista `Comensal` aparece en `sidebar:rubros` según `manifest.json`.

## Qué hace

- Lista/cards de mesas con filtros por ambiente y estado, temporizadores y alertas de 15/20 min.
- Apertura de comanda, alta de productos, avance `pedido → cocinando → servido`, anulación y limpieza de mesa.
- Cobro con boleta, factura o nota de venta: valida RUC/DNI, efectivo y vuelto, emite el comprobante con `pluginBillingApi.emitirComprobante` y muestra la vista previa de Taxorium.
- Descuento de inventario al cerrar la comanda (por receta de insumos o producto directo).
- Gestión de salones y mesas: crear, editar y eliminar.
- Si el backend no responde, sigue funcionando con `localStorage` (`tx_restaurant_data_v1`).

## Archivos principales

```text
manifest.json          # id, vista, comandos y permisos
schema.sql             # tablas y datos iniciales
src/index.ts           # exports de la extensión
src/plugin.ts          # contrato TaxorPlugin
src/api.ts             # llamadas a api/restaurant/*
src/store.ts           # estado de mesas/comandas + fallback local
src/types.ts           # tipos
src/components/        # UI Svelte 5 (el panel de comanda está en order/)
backend/restaurant.rs  # comandos Tauri
```

## Estilos

La UI usa las utilidades del host (`brand-*`, primitivas de Taxorium). En `taxorium/src/routes/layout.css` agregar:

```css
@source '../../../tx-comensal/src';
```

Ajustar la ruta si la carpeta tiene otro nombre. Mantener las clases completas en el código (`min-h-27.5`, `bg-purple-950/25`, `border-emerald-500/70`); no construirlas por concatenación.
