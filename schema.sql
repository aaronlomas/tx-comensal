-- ============================================================================
-- EXTENSION SCHEMA: tx-comensal
-- Base de datos aislada para el rubro gastronómico / restaurante de Taxorium.
-- Este archivo se ejecuta en el espacio de la extensión y no altera las
-- tablas del core de facturación.
-- ============================================================================

CREATE TABLE IF NOT EXISTS producto_insumos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    insumo_id INTEGER NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    codigo_unidad TEXT NOT NULL DEFAULT 'NIU',
    merma_porcentaje REAL NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT 1,
    UNIQUE (producto_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_insumos_prod ON producto_insumos(producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_insumos_insumo ON producto_insumos(insumo_id);

CREATE TABLE IF NOT EXISTS ambientes_mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_sede TEXT NOT NULL DEFAULT '0000',
    nombre TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ambiente_id INTEGER NOT NULL REFERENCES ambientes_mesas(id),
    numero TEXT NOT NULL,
    capacidad INTEGER NOT NULL DEFAULT 4,
    estado TEXT NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupada', 'reservada', 'cuenta_solicitada', 'sucia')),
    activo BOOLEAN NOT NULL DEFAULT 1,
    UNIQUE(ambiente_id, numero)
);

CREATE TABLE IF NOT EXISTS comandas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id INTEGER NOT NULL REFERENCES mesas(id),
    numero_comanda TEXT NOT NULL,
    numero_personas INTEGER NOT NULL DEFAULT 1,
    codigo_sede TEXT NOT NULL DEFAULT '0000',
    mozo TEXT,
    estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_preparacion', 'servida', 'facturada', 'anulada')),
    fecha_apertura TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    fecha_cierre TEXT,
    comprobante_id INTEGER
);

CREATE TABLE IF NOT EXISTS comandas_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL DEFAULT 0,
    importe REAL NOT NULL DEFAULT 0,
    notas TEXT,
    estado TEXT NOT NULL DEFAULT 'pedido' CHECK (estado IN ('pedido', 'cocinando', 'servido', 'anulado'))
);

CREATE INDEX IF NOT EXISTS idx_mesas_ambiente ON mesas(ambiente_id);
CREATE INDEX IF NOT EXISTS idx_comandas_mesa ON comandas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_estado ON comandas(estado);
CREATE INDEX IF NOT EXISTS idx_comandas_detalles_comanda ON comandas_detalles(comanda_id);

-- Sembrado inicial por defecto (Salón Principal y Terraza)
INSERT OR IGNORE INTO ambientes_mesas (id, codigo_sede, nombre, activo) VALUES (1, '0000', 'Salón Principal', 1);
INSERT OR IGNORE INTO ambientes_mesas (id, codigo_sede, nombre, activo) VALUES (2, '0000', 'Terraza', 1);

INSERT OR IGNORE INTO mesas (ambiente_id, numero, capacidad, estado, activo) VALUES 
    (1, '1', 4, 'libre', 1),
    (1, '2', 4, 'libre', 1),
    (1, '3', 4, 'libre', 1),
    (1, '4', 4, 'libre', 1),
    (1, '5', 4, 'libre', 1),
    (1, '6', 4, 'libre', 1),
    (1, '7', 4, 'libre', 1),
    (1, '8', 4, 'libre', 1),
    (2, '101', 4, 'libre', 1),
    (2, '102', 4, 'libre', 1),
    (2, '103', 4, 'libre', 1),
    (2, '104', 4, 'libre', 1);

