use crate::AppState;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================================
// Structs
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Ambiente {
    pub id: i64,
    pub codigo_sede: String,
    pub nombre: String,
    pub activo: bool,
    pub mesas: Vec<Mesa>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mesa {
    pub id: i64,
    pub ambiente_id: i64,
    pub numero: String,
    pub capacidad: i64,
    pub estado: String,
    pub activo: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Comanda {
    pub id: i64,
    pub mesa_id: i64,
    pub numero_comanda: String,
    pub numero_personas: i64,
    pub codigo_sede: String,
    pub mozo: Option<String>,
    pub estado: String,
    pub fecha_apertura: String,
    pub fecha_cierre: Option<String>,
    pub comprobante_id: Option<i64>,
    pub detalles: Vec<ComandaDetalle>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComandaDetalle {
    pub id: i64,
    pub comanda_id: i64,
    pub producto_id: i64,
    pub producto_nombre: String,
    pub cantidad: f64,
    pub precio_unitario: f64,
    pub importe: f64,
    pub notas: Option<String>,
    pub estado: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateComandaPayload {
    pub mesa_id: i64,
    pub numero_comanda: String,
    pub numero_personas: Option<i64>,
    pub codigo_sede: Option<String>,
    pub mozo: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AddDetallePayload {
    pub producto_id: i64,
    pub cantidad: f64,
    pub precio_unitario: f64,
    pub notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateDetalleEstadoPayload {
    pub estado: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateMesaEstadoPayload {
    pub estado: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinalizarComandaPayload {
    pub comprobante_id: Option<i64>,
    pub limpiar_mesa: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateAmbientePayload {
    pub nombre: String,
    pub codigo_sede: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateMesaPayload {
    pub ambiente_id: i64,
    pub numero: String,
    pub capacidad: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateMesaPayload {
    pub numero: Option<String>,
    pub capacidad: Option<i64>,
    pub ambiente_id: Option<i64>,
}

// ============================================================================
// Core functions
// ============================================================================

pub fn core_get_ambientes_con_mesas(db: &Connection) -> Result<Vec<Ambiente>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id, codigo_sede, nombre, activo FROM ambientes_mesas WHERE activo = 1 ORDER BY nombre",
        )
        .map_err(|e| e.to_string())?;

    let ambientes_raw: Vec<(i64, String, String, bool)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, bool>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut ambientes = Vec::new();

    for (id, codigo_sede, nombre, activo) in ambientes_raw {
        let mut mesa_stmt = db
            .prepare(
                "SELECT id, ambiente_id, numero, capacidad, estado, activo
                 FROM mesas WHERE ambiente_id = ?1 AND activo = 1
                 ORDER BY CAST(numero AS INTEGER), numero",
            )
            .map_err(|e| e.to_string())?;

        let mesas: Vec<Mesa> = mesa_stmt
            .query_map(params![id], |row| {
                Ok(Mesa {
                    id: row.get(0)?,
                    ambiente_id: row.get(1)?,
                    numero: row.get(2)?,
                    capacidad: row.get(3)?,
                    estado: row.get(4)?,
                    activo: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        ambientes.push(Ambiente {
            id,
            codigo_sede,
            nombre,
            activo,
            mesas,
        });
    }

    Ok(ambientes)
}

pub fn core_create_ambiente(
    db: &Connection,
    payload: CreateAmbientePayload,
) -> Result<Ambiente, String> {
    let codigo_sede = payload.codigo_sede.unwrap_or_else(|| "0000".to_string());
    let nombre = payload.nombre.trim();
    if nombre.is_empty() {
        return Err("El nombre del ambiente no puede estar vacío.".to_string());
    }

    db.execute(
        "INSERT INTO ambientes_mesas (codigo_sede, nombre, activo) VALUES (?1, ?2, 1)",
        params![codigo_sede, nombre],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();
    Ok(Ambiente {
        id,
        codigo_sede,
        nombre: nombre.to_string(),
        activo: true,
        mesas: vec![],
    })
}

pub fn core_create_mesa(db: &Connection, payload: CreateMesaPayload) -> Result<Mesa, String> {
    let capacidad = payload.capacidad.unwrap_or(4);
    let numero = payload.numero.trim();
    if numero.is_empty() {
        return Err("El número o identificador de mesa no puede estar vacío.".to_string());
    }

    let existente: Option<Mesa> = db
        .query_row(
            "SELECT id, ambiente_id, numero, capacidad, estado, activo FROM mesas WHERE ambiente_id = ?1 AND numero = ?2 LIMIT 1",
            params![payload.ambiente_id, numero],
            |row| {
                Ok(Mesa {
                    id: row.get(0)?,
                    ambiente_id: row.get(1)?,
                    numero: row.get(2)?,
                    capacidad: row.get(3)?,
                    estado: row.get(4)?,
                    activo: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(mesa) = existente {
        if mesa.activo {
            return Err(format!(
                "Ya existe una mesa con el número '{}' en este ambiente",
                numero
            ));
        }

        db.execute(
            "UPDATE mesas SET capacidad = ?1, estado = 'libre', activo = 1 WHERE id = ?2",
            params![capacidad, mesa.id],
        )
        .map_err(|e| e.to_string())?;

        return Ok(Mesa {
            id: mesa.id,
            ambiente_id: mesa.ambiente_id,
            numero: mesa.numero,
            capacidad,
            estado: "libre".to_string(),
            activo: true,
        });
    }

    db.execute(
        "INSERT INTO mesas (ambiente_id, numero, capacidad, estado, activo) VALUES (?1, ?2, ?3, 'libre', 1)",
        params![payload.ambiente_id, numero, capacidad],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            format!("Ya existe una mesa con el número '{}' en este ambiente", numero)
        } else {
            e.to_string()
        }
    })?;

    let id = db.last_insert_rowid();
    Ok(Mesa {
        id,
        ambiente_id: payload.ambiente_id,
        numero: numero.to_string(),
        capacidad,
        estado: "libre".to_string(),
        activo: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn una_mesa_inactiva_puede_reutilizar_el_numero() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE ambientes_mesas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo_sede TEXT NOT NULL DEFAULT '0000',
                nombre TEXT NOT NULL,
                activo BOOLEAN NOT NULL DEFAULT 1
            );
            CREATE TABLE mesas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ambiente_id INTEGER NOT NULL,
                numero TEXT NOT NULL,
                capacidad INTEGER NOT NULL DEFAULT 4,
                estado TEXT NOT NULL DEFAULT 'libre',
                activo BOOLEAN NOT NULL DEFAULT 1,
                UNIQUE(ambiente_id, numero)
            );
            INSERT INTO ambientes_mesas (id, nombre) VALUES (1, 'Salón Principal');
            INSERT INTO mesas (id, ambiente_id, numero, capacidad, estado, activo)
            VALUES (8, 1, '8', 4, 'libre', 0);",
        )
        .unwrap();

        let mesa = core_create_mesa(
            &conn,
            CreateMesaPayload {
                ambiente_id: 1,
                numero: "8".to_string(),
                capacidad: Some(6),
            },
        )
        .unwrap();

        assert_eq!(mesa.id, 8);
        assert!(mesa.activo);
        assert_eq!(mesa.capacidad, 6);
        assert_eq!(mesa.estado, "libre");

        let activos: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM mesas WHERE ambiente_id = 1 AND numero = '8' AND activo = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(activos, 1);
    }
}

pub fn core_update_mesa(
    db: &Connection,
    mesa_id: i64,
    payload: UpdateMesaPayload,
) -> Result<Mesa, String> {
    if let Some(ref num) = payload.numero {
        let trimmed = num.trim();
        if !trimmed.is_empty() {
            db.execute(
                "UPDATE mesas SET numero = ?1 WHERE id = ?2",
                params![trimmed, mesa_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    if let Some(cap) = payload.capacidad {
        db.execute(
            "UPDATE mesas SET capacidad = ?1 WHERE id = ?2",
            params![cap, mesa_id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(amb_id) = payload.ambiente_id {
        db.execute(
            "UPDATE mesas SET ambiente_id = ?1 WHERE id = ?2",
            params![amb_id, mesa_id],
        )
        .map_err(|e| e.to_string())?;
    }

    db.query_row(
        "SELECT id, ambiente_id, numero, capacidad, estado, activo FROM mesas WHERE id = ?1",
        params![mesa_id],
        |row| {
            Ok(Mesa {
                id: row.get(0)?,
                ambiente_id: row.get(1)?,
                numero: row.get(2)?,
                capacidad: row.get(3)?,
                estado: row.get(4)?,
                activo: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn core_delete_mesa(db: &Connection, mesa_id: i64) -> Result<(), String> {
    let count_activas: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM comandas WHERE mesa_id = ?1 AND estado NOT IN ('facturada', 'anulada')",
            params![mesa_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if count_activas > 0 {
        return Err(
            "No se puede eliminar la mesa porque tiene una comanda activa en curso.".to_string(),
        );
    }

    db.execute(
        "UPDATE mesas SET activo = 0 WHERE id = ?1",
        params![mesa_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn core_get_comanda_activa(db: &Connection, mesa_id: i64) -> Result<Option<Comanda>, String> {
    let result = db.query_row(
        "SELECT id, mesa_id, numero_comanda, numero_personas, codigo_sede,
                mozo, estado, fecha_apertura, fecha_cierre, comprobante_id
         FROM comandas
         WHERE mesa_id = ?1 AND estado NOT IN ('facturada', 'anulada')
         ORDER BY fecha_apertura DESC
         LIMIT 1",
        params![mesa_id],
        |row| {
            Ok(Comanda {
                id: row.get(0)?,
                mesa_id: row.get(1)?,
                numero_comanda: row.get(2)?,
                numero_personas: row.get(3)?,
                codigo_sede: row.get(4)?,
                mozo: row.get(5)?,
                estado: row.get(6)?,
                fecha_apertura: row.get(7)?,
                fecha_cierre: row.get(8)?,
                comprobante_id: row.get(9)?,
                detalles: vec![],
            })
        },
    );

    match result {
        Ok(mut comanda) => {
            comanda.detalles = get_detalles_comanda(db, comanda.id)?;
            Ok(Some(comanda))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn get_detalles_comanda(db: &Connection, comanda_id: i64) -> Result<Vec<ComandaDetalle>, String> {
    let mut stmt = db
        .prepare(
            "SELECT cd.id, cd.comanda_id, cd.producto_id, p.nombre,
                    cd.cantidad, cd.precio_unitario, cd.importe, cd.notas, cd.estado
             FROM comandas_detalles cd
             JOIN productos p ON p.id = cd.producto_id
             WHERE cd.comanda_id = ?1
             ORDER BY cd.id",
        )
        .map_err(|e| e.to_string())?;

    let detalles = stmt
        .query_map(params![comanda_id], |row| {
            Ok(ComandaDetalle {
                id: row.get(0)?,
                comanda_id: row.get(1)?,
                producto_id: row.get(2)?,
                producto_nombre: row.get(3)?,
                cantidad: row.get(4)?,
                precio_unitario: row.get(5)?,
                importe: row.get(6)?,
                notas: row.get(7)?,
                estado: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(detalles)
}

pub fn core_create_comanda(
    db: &Connection,
    payload: CreateComandaPayload,
) -> Result<Comanda, String> {
    let numero_personas = payload.numero_personas.unwrap_or(1);
    let codigo_sede = payload.codigo_sede.unwrap_or_else(|| "0000".to_string());

    db.execute(
        "INSERT INTO comandas (mesa_id, numero_comanda, numero_personas, codigo_sede, mozo)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            payload.mesa_id,
            payload.numero_comanda,
            numero_personas,
            codigo_sede,
            payload.mozo
        ],
    )
    .map_err(|e| e.to_string())?;

    let comanda_id = db.last_insert_rowid();

    db.execute(
        "UPDATE mesas SET estado = 'ocupada' WHERE id = ?1",
        params![payload.mesa_id],
    )
    .map_err(|e| e.to_string())?;

    let comanda = db
        .query_row(
            "SELECT id, mesa_id, numero_comanda, numero_personas, codigo_sede,
                    mozo, estado, fecha_apertura, fecha_cierre, comprobante_id
             FROM comandas WHERE id = ?1",
            params![comanda_id],
            |row| {
                Ok(Comanda {
                    id: row.get(0)?,
                    mesa_id: row.get(1)?,
                    numero_comanda: row.get(2)?,
                    numero_personas: row.get(3)?,
                    codigo_sede: row.get(4)?,
                    mozo: row.get(5)?,
                    estado: row.get(6)?,
                    fecha_apertura: row.get(7)?,
                    fecha_cierre: row.get(8)?,
                    comprobante_id: row.get(9)?,
                    detalles: vec![],
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(comanda)
}

pub fn core_add_detalle(
    db: &Connection,
    comanda_id: i64,
    payload: AddDetallePayload,
) -> Result<ComandaDetalle, String> {
    let importe = payload.cantidad * payload.precio_unitario;

    db.execute(
        "INSERT INTO comandas_detalles (comanda_id, producto_id, cantidad, precio_unitario, importe, notas)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            comanda_id,
            payload.producto_id,
            payload.cantidad,
            payload.precio_unitario,
            importe,
            payload.notas
        ],
    )
    .map_err(|e| e.to_string())?;

    let detalle_id = db.last_insert_rowid();

    let detalle = db
        .query_row(
            "SELECT cd.id, cd.comanda_id, cd.producto_id, p.nombre,
                    cd.cantidad, cd.precio_unitario, cd.importe, cd.notas, cd.estado
             FROM comandas_detalles cd
             JOIN productos p ON p.id = cd.producto_id
             WHERE cd.id = ?1",
            params![detalle_id],
            |row| {
                Ok(ComandaDetalle {
                    id: row.get(0)?,
                    comanda_id: row.get(1)?,
                    producto_id: row.get(2)?,
                    producto_nombre: row.get(3)?,
                    cantidad: row.get(4)?,
                    precio_unitario: row.get(5)?,
                    importe: row.get(6)?,
                    notas: row.get(7)?,
                    estado: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(detalle)
}

pub fn core_update_detalle_estado(
    db: &Connection,
    detalle_id: i64,
    payload: UpdateDetalleEstadoPayload,
) -> Result<ComandaDetalle, String> {
    let estados_validos = ["pedido", "cocinando", "servido", "anulado"];
    if !estados_validos.contains(&payload.estado.as_str()) {
        return Err(format!("Estado inválido: {}", payload.estado));
    }

    db.execute(
        "UPDATE comandas_detalles SET estado = ?1 WHERE id = ?2",
        params![payload.estado, detalle_id],
    )
    .map_err(|e| e.to_string())?;

    let detalle = db
        .query_row(
            "SELECT cd.id, cd.comanda_id, cd.producto_id, p.nombre,
                    cd.cantidad, cd.precio_unitario, cd.importe, cd.notas, cd.estado
             FROM comandas_detalles cd
             JOIN productos p ON p.id = cd.producto_id
             WHERE cd.id = ?1",
            params![detalle_id],
            |row| {
                Ok(ComandaDetalle {
                    id: row.get(0)?,
                    comanda_id: row.get(1)?,
                    producto_id: row.get(2)?,
                    producto_nombre: row.get(3)?,
                    cantidad: row.get(4)?,
                    precio_unitario: row.get(5)?,
                    importe: row.get(6)?,
                    notas: row.get(7)?,
                    estado: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(detalle)
}

pub fn core_update_mesa_estado(
    db: &Connection,
    mesa_id: i64,
    payload: UpdateMesaEstadoPayload,
) -> Result<Mesa, String> {
    let estados_validos = [
        "libre",
        "ocupada",
        "reservada",
        "cuenta_solicitada",
        "sucia",
    ];
    if !estados_validos.contains(&payload.estado.as_str()) {
        return Err(format!("Estado de mesa inválido: {}", payload.estado));
    }

    db.execute(
        "UPDATE mesas SET estado = ?1 WHERE id = ?2",
        params![payload.estado, mesa_id],
    )
    .map_err(|e| e.to_string())?;

    let mesa = db
        .query_row(
            "SELECT id, ambiente_id, numero, capacidad, estado, activo FROM mesas WHERE id = ?1",
            params![mesa_id],
            |row| {
                Ok(Mesa {
                    id: row.get(0)?,
                    ambiente_id: row.get(1)?,
                    numero: row.get(2)?,
                    capacidad: row.get(3)?,
                    estado: row.get(4)?,
                    activo: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(mesa)
}

pub fn core_finalizar_comanda(
    db: &mut Connection,
    comanda_id: i64,
    payload: FinalizarComandaPayload,
) -> Result<(), String> {
    let tx = db.transaction().map_err(|e| e.to_string())?;

    // 1. Verificar que la comanda existe y no está ya facturada
    let (mesa_id, estado_comanda): (i64, String) = tx
        .query_row(
            "SELECT mesa_id, estado FROM comandas WHERE id = ?1",
            params![comanda_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    if estado_comanda == "facturada" || estado_comanda == "anulada" {
        return Err(format!("La comanda ya está en estado '{}'", estado_comanda));
    }

    // 2. Obtener detalles activos (no anulados)
    let mut stmt = tx
        .prepare(
            "SELECT id, producto_id, cantidad, precio_unitario
             FROM comandas_detalles
             WHERE comanda_id = ?1 AND estado != 'anulado'",
        )
        .map_err(|e| e.to_string())?;

    let detalles: Vec<(i64, i64, f64, f64)> = stmt
        .query_map(params![comanda_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Drop stmt to release borrow on tx before further operations
    drop(stmt);

    // 3. Descontar inventario por cada detalle
    for (_detalle_id, producto_id, cantidad, _precio_unitario) in &detalles {
        // Verificar si el producto tiene insumos (receta), en un bloque para liberar el préstamo
        let insumos: Vec<(i64, f64, f64)> = {
            let mut insumo_stmt = tx
                .prepare(
                    "SELECT insumo_id, cantidad, merma_porcentaje
                     FROM producto_insumos
                     WHERE producto_id = ?1 AND activo = 1",
                )
                .map_err(|e| e.to_string())?;

            let rows: Vec<(i64, f64, f64)> = insumo_stmt
                .query_map(params![producto_id], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, f64>(2)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            rows
        };

        if !insumos.is_empty() {
            // Producto con receta → descontar cada insumo
            for (insumo_id, cant_por_unidad, merma_pct) in insumos {
                let costo: f64 = tx
                    .query_row(
                        "SELECT COALESCE(precio_unitario_compra, 0) FROM productos WHERE id = ?1",
                        params![insumo_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0.0);

                let cantidad_total = -(cant_por_unidad * cantidad * (1.0 + merma_pct / 100.0));

                tx.execute(
                    "INSERT INTO movimientos_inventario
                     (producto_id, tipo, cantidad_base, costo_unitario_base, codigo_tipo_operacion,
                      referencia_tipo, referencia_id, fecha, descripcion)
                     VALUES (?1, 'salida', ?2, ?3, '10', 'comanda', ?4, datetime('now'), 'Salida por comanda (insumo)')",
                    params![insumo_id, cantidad_total, costo, comanda_id],
                )
                .map_err(|e| e.to_string())?;
            }
        } else {
            // Producto sin receta → descontar directamente
            let costo: f64 = tx
                .query_row(
                    "SELECT COALESCE(precio_unitario_compra, 0) FROM productos WHERE id = ?1",
                    params![producto_id],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            tx.execute(
                "INSERT INTO movimientos_inventario
                 (producto_id, tipo, cantidad_base, costo_unitario_base, codigo_tipo_operacion,
                  referencia_tipo, referencia_id, fecha, descripcion)
                 VALUES (?1, 'salida', ?2, ?3, '01', 'comanda', ?4, datetime('now'), 'Salida por comanda')",
                params![producto_id, -cantidad, costo, comanda_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // 4. Marcar comanda como facturada
    tx.execute(
        "UPDATE comandas SET estado = 'facturada', fecha_cierre = datetime('now'), comprobante_id = ?1 WHERE id = ?2",
        params![payload.comprobante_id, comanda_id],
    )
    .map_err(|e| e.to_string())?;

    // 5. Actualizar estado de la mesa
    let nuevo_estado_mesa = if payload.limpiar_mesa {
        "libre"
    } else {
        "sucia"
    };
    tx.execute(
        "UPDATE mesas SET estado = ?1 WHERE id = ?2",
        params![nuevo_estado_mesa, mesa_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Tauri commands (ejecución local en el nodo servidor)
// ============================================================================

#[tauri::command]
pub fn get_ambientes(state: State<'_, AppState>) -> Result<Vec<Ambiente>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_get_ambientes_con_mesas(db)
}

#[tauri::command]
pub fn create_ambiente(
    payload: CreateAmbientePayload,
    state: State<'_, AppState>,
) -> Result<Ambiente, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_create_ambiente(db, payload)
}

#[tauri::command]
pub fn create_mesa(payload: CreateMesaPayload, state: State<'_, AppState>) -> Result<Mesa, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_create_mesa(db, payload)
}

#[tauri::command]
pub fn update_mesa(
    id: i64,
    payload: UpdateMesaPayload,
    state: State<'_, AppState>,
) -> Result<Mesa, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_update_mesa(db, id, payload)
}

#[tauri::command]
pub fn delete_mesa(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_delete_mesa(db, id)
}

#[tauri::command]
pub fn get_comanda_activa(
    id: i64,
    state: State<'_, AppState>,
) -> Result<Option<Comanda>, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_get_comanda_activa(db, id)
}

#[tauri::command]
pub fn create_comanda(
    payload: CreateComandaPayload,
    state: State<'_, AppState>,
) -> Result<Comanda, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_create_comanda(db, payload)
}

#[tauri::command]
pub fn add_detalle(
    id: i64,
    payload: AddDetallePayload,
    state: State<'_, AppState>,
) -> Result<ComandaDetalle, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_add_detalle(db, id, payload)
}

#[tauri::command]
pub fn update_detalle_estado(
    id: i64,
    payload: UpdateDetalleEstadoPayload,
    state: State<'_, AppState>,
) -> Result<ComandaDetalle, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_update_detalle_estado(db, id, payload)
}

#[tauri::command]
pub fn update_mesa_estado(
    id: i64,
    payload: UpdateMesaEstadoPayload,
    state: State<'_, AppState>,
) -> Result<Mesa, String> {
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("Database not initialized.")?;
    core_update_mesa_estado(db, id, payload)
}

#[tauri::command]
pub fn finalizar_comanda(
    id: i64,
    payload: FinalizarComandaPayload,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_mut().ok_or("Database not initialized.")?;
    core_finalizar_comanda(db, id, payload)
}
