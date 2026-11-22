#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, State, WindowEvent};

struct OpenShiftState(Arc<AtomicBool>);

#[derive(Clone, Default)]
struct LanServerHealth {
    running: bool,
    port: u16,
    bind_error: Option<String>,
    store_path: String,
}

struct LanHealthState {
    health: Arc<Mutex<LanServerHealth>>,
    store: LanStore,
}

#[tauri::command]
fn set_open_shift_state(is_open: bool, state: State<'_, OpenShiftState>) {
    state.0.store(is_open, Ordering::SeqCst);
}

#[tauri::command]
fn allow_close_app(window: tauri::Window, state: State<'_, OpenShiftState>) {
    state.0.store(false, Ordering::SeqCst);
    let _ = window.close();
}

#[derive(Clone)]
struct LanStore {
    file_path: PathBuf,
    lock: Arc<Mutex<()>>,
}

static LAN_SEQ: AtomicU64 = AtomicU64::new(1);

fn next_off_seq() -> u64 {
    LAN_SEQ.fetch_add(1, Ordering::SeqCst)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

impl LanStore {
    fn write_atomic(&self, content: &str) {
        if let Some(parent) = self.file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let tmp_path = self.file_path.with_extension("json.tmp");
        if let Ok(mut file) = fs::File::create(&tmp_path) {
            if file.write_all(content.as_bytes()).is_ok() {
                let _ = file.sync_all();
                let _ = fs::rename(&tmp_path, &self.file_path);
            }
        }
    }

    fn read_state(&self) -> String {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        fs::read_to_string(&self.file_path).unwrap_or_else(|_| {
            r#"{"success":true,"mesas":[],"ordenes":[],"productos":[],"sesiones":[],"salidasDiaCaja":0,"eventosTurno":[],"creditosClientes":[],"devolucionesDia":[],"pendingOps":[],"lanVersion":1}"#.to_string()
        })
    }

    fn stats(&self) -> (usize, u64) {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let bytes = fs::metadata(&self.file_path).map(|m| m.len()).unwrap_or(0);
        let raw = fs::read_to_string(&self.file_path).unwrap_or_default();
        let pending = serde_json::from_str::<serde_json::Value>(&raw)
            .ok()
            .and_then(|v| v.get("pendingOps").and_then(|p| p.as_array()).map(|a| a.len()))
            .unwrap_or(0);
        (pending, bytes)
    }

    fn write_state(&self, content: &str) {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        // Preservar pendingOps locales si ya existen
        let existing_raw = fs::read_to_string(&self.file_path).unwrap_or_default();
        let existing_ops = serde_json::from_str::<serde_json::Value>(&existing_raw)
            .ok()
            .and_then(|v| v.get("pendingOps").cloned());

        if let Ok(mut next_root) = serde_json::from_str::<serde_json::Value>(content) {
            if let Some(ops) = existing_ops {
                if ops.as_array().map(|a| !a.is_empty()).unwrap_or(false) {
                    if let Some(obj) = next_root.as_object_mut() {
                        obj.insert("pendingOps".to_string(), ops);
                    }
                }
            }
            if let Ok(merged) = serde_json::to_string(&next_root) {
                self.write_atomic(&merged);
                return;
            }
        }
        self.write_atomic(content);
    }

    fn read_pending_ops(&self) -> String {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let raw = fs::read_to_string(&self.file_path).unwrap_or_else(|_| "{}".to_string());
        let root: serde_json::Value =
            serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
        let ops = root
            .get("pendingOps")
            .cloned()
            .unwrap_or_else(|| serde_json::json!([]));
        serde_json::json!({ "success": true, "pendingOps": ops }).to_string()
    }

    fn ack_pending_ops(&self, op_ids: &[String]) -> usize {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let raw = fs::read_to_string(&self.file_path).unwrap_or_else(|_| "{}".to_string());
        let mut root: serde_json::Value =
            serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
        let mut remaining = 0usize;
        if let Some(arr) = root.get_mut("pendingOps").and_then(|v| v.as_array_mut()) {
            arr.retain(|item| {
                let id = item.get("op_id").and_then(|v| v.as_str()).unwrap_or("");
                !op_ids.iter().any(|ack| ack == id)
            });
            remaining = arr.len();
        }
        if let Ok(serialized) = serde_json::to_string(&root) {
            self.write_atomic(&serialized);
        }
        remaining
    }

    fn apply_and_queue_action(&self, mut op_json: serde_json::Value) -> serde_json::Value {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let raw = fs::read_to_string(&self.file_path).unwrap_or_else(|_| {
            r#"{"success":true,"mesas":[],"ordenes":[],"productos":[],"sesiones":[],"salidasDiaCaja":0,"eventosTurno":[],"creditosClientes":[],"devolucionesDia":[],"pendingOps":[],"lanVersion":1}"#.to_string()
        });
        let mut root: serde_json::Value =
            serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));

        // Deduplicar por idempotency_key
        let idemp = op_json
            .get("idempotency_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if !idemp.is_empty() {
            if let Some(ops) = root.get("pendingOps").and_then(|v| v.as_array()) {
                if ops.iter().any(|o| {
                    o.get("idempotency_key")
                        .and_then(|k| k.as_str())
                        .unwrap_or("")
                        == idemp
                }) {
                    let ver = root.get("lanVersion").and_then(|v| v.as_u64()).unwrap_or(1);
                    return serde_json::json!({ "success": true, "lanQueued": true, "deduplicated": true, "lanVersion": ver });
                }
            }
        }

        let seq = next_off_seq();
        let ts = now_millis();
        let op_id = format!("off-op-{}-{}", ts, seq);
        let action = op_json
            .get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let mut extra_resp = serde_json::Map::new();

        if action == "ABRIR_TURNO_CAJA" {
            let ses_id = format!("off-ses-{}-{}", ts, seq);
            let caja_nombre = op_json
                .get("caja_nombre")
                .and_then(|v| v.as_str())
                .unwrap_or("CAJA PRINCIPAL");
            let cajero = op_json
                .get("cajero_nombre")
                .and_then(|v| v.as_str())
                .unwrap_or("CAJERO");
            let base = op_json
                .get("efectivo_inicial")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let ses_obj = serde_json::json!({
                "id": ses_id,
                "caja_nombre": caja_nombre,
                "cajero_nombre": cajero,
                "efectivo_inicial": base,
                "estado": "ABIERTA",
                "numero_turno": 1
            });
            if let Some(obj) = root.as_object_mut() {
                obj.insert("sesionActiva".to_string(), ses_obj.clone());
                let arr = obj
                    .entry("sesiones")
                    .or_insert_with(|| serde_json::json!([]))
                    .as_array_mut();
                if let Some(a) = arr {
                    a.push(ses_obj.clone());
                }
            }
            if let Some(op_obj) = op_json.as_object_mut() {
                op_obj.insert("temp_sesion_id".to_string(), serde_json::json!(ses_id));
            }
            extra_resp.insert("sesion".to_string(), ses_obj);
        } else if action == "ABRIR_O_AGREGAR_ORDEN" {
            let existing_id = op_json
                .get("orden_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let mesa_num = op_json.get("mesa_numero").and_then(|v| v.as_i64());
            let canal = op_json
                .get("canal_venta")
                .and_then(|v| v.as_str())
                .unwrap_or("SALON_MESA");
            let prod_id = op_json
                .get("producto_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let prod_nombre = op_json
                .get("nombre_producto")
                .and_then(|v| v.as_str())
                .unwrap_or("Producto");
            let cantidad = op_json
                .get("cantidad")
                .and_then(|v| v.as_f64())
                .unwrap_or(1.0);
            let precio = op_json
                .get("precio_unitario")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let subtotal = (cantidad * precio).round();
            let item_obj = serde_json::json!({
                "id": format!("off-item-{}-{}", ts, seq),
                "producto_id": prod_id,
                "nombre_producto": prod_nombre,
                "cantidad": cantidad,
                "precio_unitario": precio,
                "subtotal": subtotal,
                "estado_comanda": "PENDIENTE",
                "notas": op_json.get("notas").cloned().unwrap_or(serde_json::json!(""))
            });

            let mut target_id = existing_id.clone();
            let mut result_orden = serde_json::Value::Null;

            if let Some(ordenes) = root.get_mut("ordenes").and_then(|v| v.as_array_mut()) {
                if !target_id.is_empty() {
                    if let Some(ord) = ordenes.iter_mut().find(|o| {
                        o.get("id").and_then(|i| i.as_str()).unwrap_or("") == target_id
                    }) {
                        if let Some(items) = ord.get_mut("items").and_then(|i| i.as_array_mut()) {
                            items.push(item_obj.clone());
                            let sum: f64 = items
                                .iter()
                                .filter(|it| {
                                    it.get("estado_comanda")
                                        .and_then(|s| s.as_str())
                                        .unwrap_or("")
                                        != "ANULADO"
                                })
                                .map(|it| it.get("subtotal").and_then(|s| s.as_f64()).unwrap_or(0.0))
                                .sum();
                            if let Some(o_obj) = ord.as_object_mut() {
                                o_obj.insert("subtotal_bruto".to_string(), serde_json::json!(sum));
                                o_obj.insert("gran_total".to_string(), serde_json::json!(sum));
                            }
                        }
                        result_orden = ord.clone();
                    }
                }

                if result_orden.is_null() {
                    target_id = format!("off-ord-{}-{}", ts, seq);
                    let consecutivo = format!("OFF-{:04}", seq % 10000);
                    let new_ord = serde_json::json!({
                        "id": target_id,
                        "consecutivo": consecutivo,
                        "canal_venta": canal,
                        "mesa_numero": mesa_num,
                        "estado": "ABIERTA",
                        "subtotal_bruto": subtotal,
                        "gran_total": subtotal,
                        "descuento": 0,
                        "propina": 0,
                        "items": [item_obj],
                        "pagos": []
                    });
                    ordenes.insert(0, new_ord.clone());
                    result_orden = new_ord;
                }
            }

            if let Some(m_num) = mesa_num {
                if let Some(mesas) = root.get_mut("mesas").and_then(|v| v.as_array_mut()) {
                    for m in mesas.iter_mut() {
                        if m.get("numero").and_then(|n| n.as_i64()) == Some(m_num) {
                            if let Some(m_obj) = m.as_object_mut() {
                                m_obj.insert("estado".to_string(), serde_json::json!("OCUPADA"));
                                m_obj.insert("orden_activa_id".to_string(), serde_json::json!(target_id));
                            }
                        }
                    }
                }
            }

            if existing_id.is_empty() {
                if let Some(op_obj) = op_json.as_object_mut() {
                    op_obj.insert("temp_orden_id".to_string(), serde_json::json!(target_id));
                }
            }
            extra_resp.insert("orden".to_string(), result_orden);
        } else if action == "ENVIAR_COMANDA" {
            let ord_id = op_json.get("orden_id").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(ordenes) = root.get_mut("ordenes").and_then(|v| v.as_array_mut()) {
                if let Some(ord) = ordenes
                    .iter_mut()
                    .find(|o| o.get("id").and_then(|i| i.as_str()).unwrap_or("") == ord_id)
                {
                    if let Some(items) = ord.get_mut("items").and_then(|i| i.as_array_mut()) {
                        for it in items.iter_mut() {
                            if it.get("estado_comanda").and_then(|s| s.as_str()) == Some("PENDIENTE")
                            {
                                if let Some(it_obj) = it.as_object_mut() {
                                    it_obj.insert(
                                        "estado_comanda".to_string(),
                                        serde_json::json!("ENVIADO"),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        } else if action == "FACTURAR_ORDEN" || action == "ANULAR_ORDEN_COMPLETA" {
            let ord_id = op_json.get("orden_id").and_then(|v| v.as_str()).unwrap_or("");
            let next_estado = if action == "FACTURAR_ORDEN" {
                "PAGADA"
            } else {
                "ANULADA"
            };
            let mut mesa_to_free: Option<i64> = None;
            if let Some(ordenes) = root.get_mut("ordenes").and_then(|v| v.as_array_mut()) {
                if let Some(ord) = ordenes
                    .iter_mut()
                    .find(|o| o.get("id").and_then(|i| i.as_str()).unwrap_or("") == ord_id)
                {
                    mesa_to_free = ord.get("mesa_numero").and_then(|n| n.as_i64());
                    if let Some(o_obj) = ord.as_object_mut() {
                        o_obj.insert("estado".to_string(), serde_json::json!(next_estado));
                        if action == "FACTURAR_ORDEN" {
                            if let Some(mp) = op_json.get("metodo_pago").cloned() {
                                o_obj.insert("metodo_pago".to_string(), mp);
                            }
                            if let Some(pe) = op_json.get("pago_efectivo").cloned() {
                                o_obj.insert("pago_efectivo".to_string(), pe);
                            }
                            if let Some(pd) = op_json.get("pago_datafono").cloned() {
                                o_obj.insert("pago_datafono".to_string(), pd);
                            }
                            if let Some(pt) = op_json.get("pago_transferencia").cloned() {
                                o_obj.insert("pago_transferencia".to_string(), pt);
                            }
                        }
                    }
                }
            }
            if let Some(m_num) = mesa_to_free {
                if let Some(mesas) = root.get_mut("mesas").and_then(|v| v.as_array_mut()) {
                    for m in mesas.iter_mut() {
                        if m.get("numero").and_then(|n| n.as_i64()) == Some(m_num) {
                            if let Some(m_obj) = m.as_object_mut() {
                                m_obj.insert("estado".to_string(), serde_json::json!("LIBRE"));
                                m_obj.insert("orden_activa_id".to_string(), serde_json::Value::Null);
                            }
                        }
                    }
                }
            }
        } else if action == "MOVIMIENTO_EFECTIVO_CAJA" {
            let tipo = op_json.get("tipo").and_then(|v| v.as_str()).unwrap_or("SALIDA");
            let monto = op_json.get("monto").and_then(|v| v.as_f64()).unwrap_or(0.0);
            if tipo == "SALIDA" {
                let prev = root
                    .get("salidasDiaCaja")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                if let Some(obj) = root.as_object_mut() {
                    obj.insert("salidasDiaCaja".to_string(), serde_json::json!(prev + monto));
                }
                let rc_off = format!("RC-OFF-{:04}", seq % 10000);
                let recibo = serde_json::json!({
                    "consecutivo": rc_off,
                    "fecha": "OFFLINE",
                    "hora": "LOCAL",
                    "cajaNombre": op_json.get("caja_nombre").and_then(|v| v.as_str()).unwrap_or("CAJA"),
                    "cajeroNombre": op_json.get("cajero_nombre").and_then(|v| v.as_str()).unwrap_or("CAJERO"),
                    "clasificacion": op_json.get("clasificacion").and_then(|v| v.as_str()).unwrap_or("Gasto Operativo"),
                    "categoria": op_json.get("categoria").and_then(|v| v.as_str()).unwrap_or(""),
                    "concepto": op_json.get("concepto").and_then(|v| v.as_str()).unwrap_or(""),
                    "beneficiario": op_json.get("descripcion_beneficiario").and_then(|v| v.as_str()).unwrap_or(""),
                    "valor": monto
                });
                extra_resp.insert("recibo".to_string(), recibo);
            }
        }

        if let Some(op_obj) = op_json.as_object_mut() {
            op_obj.insert("op_id".to_string(), serde_json::json!(op_id));
            op_obj.insert("queuedAt".to_string(), serde_json::json!(ts as u64));
        }

        let next_ver = root.get("lanVersion").and_then(|v| v.as_u64()).unwrap_or(0) + 1;
        if let Some(obj) = root.as_object_mut() {
            obj.insert("lanVersion".to_string(), serde_json::json!(next_ver));
            let arr = obj
                .entry("pendingOps")
                .or_insert_with(|| serde_json::json!([]))
                .as_array_mut();
            if let Some(ops) = arr {
                ops.push(op_json);
            }
        }

        if let Ok(serialized) = serde_json::to_string(&root) {
            self.write_atomic(&serialized);
        }

        let mut resp = serde_json::json!({
            "success": true,
            "lanQueued": true,
            "lanVersion": next_ver,
            "op_id": op_id
        });
        if let Some(resp_obj) = resp.as_object_mut() {
            for (k, v) in extra_resp {
                resp_obj.insert(k, v);
            }
        }
        resp
    }
}

fn read_http_request(stream: &mut TcpStream) -> Option<(String, String, String, String)> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut raw: Vec<u8> = Vec::with_capacity(8192);
    let mut chunk = [0u8; 4096];
    let mut header_end: Option<usize> = None;

    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                raw.extend_from_slice(&chunk[..n]);
                if raw.len() > 5 * 1024 * 1024 {
                    return None;
                }
                if header_end.is_none() {
                    if let Some(pos) = raw.windows(4).position(|w| w == b"\r\n\r\n") {
                        header_end = Some(pos + 4);
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }

    let h_end = header_end?;
    let headers_str = String::from_utf8_lossy(&raw[..h_end]).to_string();
    let mut content_length: usize = 0;
    let mut origin = String::new();
    for line in headers_str.lines() {
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("content-length:") {
            if let Ok(len) = line.split(':').nth(1).unwrap_or("0").trim().parse::<usize>() {
                content_length = len.min(5 * 1024 * 1024);
            }
        } else if lower.starts_with("origin:") {
            origin = line.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
        }
    }

    while raw.len() < h_end + content_length {
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                raw.extend_from_slice(&chunk[..n]);
                if raw.len() > 5 * 1024 * 1024 {
                    return None;
                }
            }
        }
    }

    let first_line = headers_str.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    let body_end = (h_end + content_length).min(raw.len());
    let body = String::from_utf8_lossy(&raw[h_end..body_end]).trim().to_string();
    Some((parts[0].to_string(), parts[1].to_string(), origin, body))
}

fn is_allowed_lan_origin(origin: &str) -> bool {
    origin.starts_with("http://localhost:")
        || origin.starts_with("http://127.0.0.1:")
        || origin.starts_with("http://192.168.")
        || origin.starts_with("http://10.")
        || origin.starts_with("http://172.")
        || origin == "tauri://localhost"
        || origin == "http://tauri.localhost"
        || origin == "https://tauri.localhost"
        || origin.ends_with(".vercel.app")
}

fn handle_lan_connection(mut stream: TcpStream, store: LanStore) {
    let (method, path, origin, body) = match read_http_request(&mut stream) {
        Some(parsed) => parsed,
        None => return,
    };

    let allowed_origin = if is_allowed_lan_origin(&origin) {
        origin
    } else {
        "http://tauri.localhost".to_string()
    };

    let (status, resp_body) = if method == "OPTIONS" {
        ("204 No Content", String::new())
    } else if method == "GET" && path == "/lan/health" {
        ("200 OK", r#"{"ok":true,"service":"Eliana POS LAN"}"#.to_string())
    } else if method == "GET" && path == "/lan/state" {
        ("200 OK", store.read_state())
    } else if method == "GET" && path == "/lan/pending" {
        ("200 OK", store.read_pending_ops())
    } else if method == "POST" && path == "/lan/pending/ack" {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
            let ids: Vec<String> = val
                .get("opIds")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            let remaining = store.ack_pending_ops(&ids);
            (
                "200 OK",
                serde_json::json!({ "success": true, "remaining": remaining }).to_string(),
            )
        } else {
            ("400 Bad Request", r#"{"success":false,"error":"JSON invalido"}"#.to_string())
        }
    } else if method == "POST" && path == "/lan/sync-cache" {
        if !body.is_empty() {
            store.write_state(&body);
        }
        ("200 OK", r#"{"success":true}"#.to_string())
    } else if method == "POST" && path == "/lan/action" {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
            let res = store.apply_and_queue_action(val);
            ("200 OK", res.to_string())
        } else {
            ("400 Bad Request", r#"{"success":false,"error":"JSON invalido"}"#.to_string())
        }
    } else {
        ("404 Not Found", r#"{"error":"Not found"}"#.to_string())
    };

    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: {}\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        allowed_origin,
        resp_body.len(),
        resp_body
    );
    let _ = stream.write_all(response.as_bytes());
}

fn start_lan_server(store: LanStore, health_state: Arc<Mutex<LanServerHealth>>) {
    thread::spawn(move || match TcpListener::bind("0.0.0.0:4545") {
        Ok(listener) => {
            if let Ok(mut h) = health_state.lock() {
                h.running = true;
                h.port = 4545;
                h.bind_error = None;
            }
            for stream in listener.incoming().flatten() {
                let s = store.clone();
                thread::spawn(move || handle_lan_connection(stream, s));
            }
        }
        Err(e) => {
            if let Ok(mut h) = health_state.lock() {
                h.running = false;
                h.port = 4545;
                h.bind_error = Some(format!("No se pudo abrir puerto LAN 4545: {}", e));
            }
        }
    });
}

#[tauri::command]
fn get_local_ip() -> String {
    for target in ["192.168.1.1:80", "10.0.0.1:80", "8.8.8.8:80"] {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect(target).is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    let ip = addr.ip().to_string();
                    if ip != "127.0.0.1" && ip != "0.0.0.0" {
                        return ip;
                    }
                }
            }
        }
    }
    "127.0.0.1".to_string()
}

fn encode_cp850(text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len());
    for ch in text.chars() {
        let byte = match ch {
            '\u{0000}'..='\u{007F}' => ch as u8,
            'á' => 0xA0,
            'é' => 0x82,
            'í' => 0xA1,
            'ó' => 0xA2,
            'ú' => 0xA3,
            'Á' => 0xB5,
            'É' => 0x90,
            'Í' => 0xD6,
            'Ó' => 0xE0,
            'Ú' => 0xE9,
            'ñ' => 0xA4,
            'Ñ' => 0xA5,
            'ü' => 0x81,
            'Ü' => 0x9A,
            '¿' => 0xA8,
            '¡' => 0xAD,
            '°' => 0xF8,
            _ => b'?',
        };
        out.push(byte);
    }
    out
}

#[tauri::command]
fn test_printer_connection(printer_ip: String) -> Result<String, String> {
    let addr = if printer_ip.contains(':') {
        printer_ip
    } else {
        format!("{}:9100", printer_ip)
    };
    let parsed = addr
        .parse()
        .map_err(|e| format!("Dirección inválida ({}): {}", addr, e))?;
    TcpStream::connect_timeout(&parsed, Duration::from_secs(2))
        .map_err(|e| format!("Sin respuesta de impresora {}: {}", addr, e))?;
    Ok(format!("Conexión TCP exitosa con {}", addr))
}

#[tauri::command]
fn get_desktop_diagnostics(state: State<'_, LanHealthState>) -> serde_json::Value {
    let local_ip = get_local_ip();
    let health = state.health.lock().map(|h| h.clone()).unwrap_or_default();
    let (pending_ops, state_bytes) = state.store.stats();
    let serial_ports: Vec<String> = serialport::available_ports()
        .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
        .unwrap_or_default();

    serde_json::json!({
        "localIp": local_ip,
        "lanServerRunning": health.running,
        "lanPort": health.port,
        "lanBindError": health.bind_error,
        "lanStorePath": health.store_path,
        "pendingOpsCount": pending_ops,
        "stateFileBytes": state_bytes,
        "serialPorts": serial_ports,
    })
}

#[tauri::command]
fn print_escpos_ticket(printer_ip: String, content: String) -> Result<String, String> {
    let addr = if printer_ip.contains(':') {
        printer_ip
    } else {
        format!("{}:9100", printer_ip)
    };

    let mut stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Dirección inválida: {}", e))?,
        Duration::from_secs(3),
    )
    .map_err(|e| format!("No se pudo conectar con impresora {}: {}", addr, e))?;

    // ESC @ (init) + ESC t 2 (PC850 Multilingual) + texto CP850 + GS V B 0 (corte)
    let mut payload: Vec<u8> = vec![0x1B, 0x40, 0x1B, 0x74, 0x02];
    payload.extend_from_slice(&encode_cp850(&content));
    payload.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]);

    stream
        .write_all(&payload)
        .map_err(|e| format!("Error enviando tirilla: {}", e))?;

    Ok("Impreso correctamente".into())
}

#[tauri::command]
fn open_cash_drawer(printer_ip: String, model: Option<String>) -> Result<String, String> {
    let addr = if printer_ip.contains(':') {
        printer_ip
    } else {
        format!("{}:9100", printer_ip)
    };

    let mut stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Dirección inválida: {}", e))?,
        Duration::from_secs(2),
    )
    .map_err(|e| format!("No se pudo conectar con impresora {}: {}", addr, e))?;

    // Perfiles de pulso RJ11 extraídos para Epson, Star, Citizen y PosLine
    let pulse: Vec<u8> = match model.unwrap_or_else(|| "EPSON_STD".into()).as_str() {
        "STAR_TSP" => vec![0x07],
        "POSLINE" => vec![27, 112, 48, 55, 121],
        "CITIZEN" => vec![27, 112, 0, 50, 250],
        _ => vec![27, 112, 0, 25, 250],
    };

    stream
        .write_all(&pulse)
        .map_err(|e| format!("Error abriendo cajón: {}", e))?;

    Ok("Cajón abierto".into())
}

#[tauri::command]
fn read_scale_weight(port_name: String, model: Option<String>) -> Result<f64, String> {
    let model_str = model.unwrap_or_else(|| "TORREY_MFQ".into());
    let mut port = serialport::new(&port_name, 9600)
        .timeout(Duration::from_millis(450))
        .open()
        .map_err(|e| format!("No se pudo abrir puerto {}: {}", port_name, e))?;

    // Solicitud de trama según marca de gramera (Torrey, Rhino, CAS, Kretz)
    match model_str.as_str() {
        "TORREY_MFQ" | "RHINO_BAR" | "KRETZ" => {
            let _ = port.write_all(b"P");
        }
        "CAS_PDII" => {
            let _ = port.write_all(&[0x05]);
        }
        _ => {}
    }

    let mut buf: [u8; 64] = [0; 64];
    let n = port
        .read(&mut buf)
        .map_err(|e| format!("Error leyendo gramera: {}", e))?;

    let text = String::from_utf8_lossy(&buf[..n]);
    let filtered: String = text
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();

    filtered
        .parse::<f64>()
        .map_err(|_| format!("Lectura no numérica desde gramera ({}): {}", model_str, text))
}

fn main() {
    let shift_flag = Arc::new(AtomicBool::new(false));
    let shift_flag_for_event = shift_flag.clone();

    tauri::Builder::default()
        .manage(OpenShiftState(shift_flag))
        .on_window_event(move |window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if shift_flag_for_event.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("eliana-close-requested", ());
                }
            }
        })
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let file_path = data_dir.join("eliana_pos_lan_state.json");
            let store = LanStore {
                file_path: file_path.clone(),
                lock: Arc::new(Mutex::new(())),
            };
            let health = Arc::new(Mutex::new(LanServerHealth {
                running: false,
                port: 4545,
                bind_error: None,
                store_path: file_path.to_string_lossy().to_string(),
            }));
            app.manage(LanHealthState {
                health: health.clone(),
                store: store.clone(),
            });
            start_lan_server(store, health);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_ip,
            print_escpos_ticket,
            open_cash_drawer,
            read_scale_weight,
            set_open_shift_state,
            allow_close_app,
            test_printer_connection,
            get_desktop_diagnostics
        ])
        .run(tauri::generate_context!())
        .expect("Error iniciando ELIANA POS");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_cp850_spanish_chars() {
        let encoded = encode_cp850("ñÑáéíóú¿");
        assert_eq!(encoded, vec![0xA4, 0xA5, 0xA0, 0x82, 0xA1, 0xA2, 0xA3, 0xA8]);
    }

    #[test]
    fn test_lan_store_atomic_write_and_append() {
        let tmp_file = std::env::temp_dir().join(format!(
            "eliana_pos_test_{}.json",
            std::process::id()
        ));
        let _ = fs::remove_file(&tmp_file);
        let store = LanStore {
            file_path: tmp_file.clone(),
            lock: Arc::new(Mutex::new(())),
        };
        store.write_state(r#"{"mesas":[{"numero":2,"estado":"LIBRE"}],"ordenes":[],"pendingOps":[]}"#);
        let r1 = store.apply_and_queue_action(serde_json::json!({
            "action": "ABRIR_O_AGREGAR_ORDEN",
            "mesa_numero": 2,
            "nombre_producto": "Punta de Anca",
            "cantidad": 2,
            "precio_unitario": 45000,
            "idempotency_key": "k-1"
        }));
        assert_eq!(r1.get("success").and_then(|v| v.as_bool()), Some(true));
        let ord_id = r1["orden"]["id"].as_str().unwrap().to_string();
        assert_eq!(r1["orden"]["gran_total"].as_f64(), Some(90000.0));

        let state_mid: serde_json::Value = serde_json::from_str(&store.read_state()).unwrap();
        assert_eq!(state_mid["mesas"][0]["estado"].as_str(), Some("OCUPADA"));

        let op_id = r1["op_id"].as_str().unwrap().to_string();
        store.apply_and_queue_action(serde_json::json!({
            "action": "FACTURAR_ORDEN",
            "orden_id": ord_id,
            "metodo_pago": "EFECTIVO",
            "pago_efectivo": 90000
        }));
        let state_after: serde_json::Value = serde_json::from_str(&store.read_state()).unwrap();
        assert_eq!(state_after["mesas"][0]["estado"].as_str(), Some("LIBRE"));
        assert_eq!(state_after["ordenes"][0]["estado"].as_str(), Some("PAGADA"));

        let remaining = store.ack_pending_ops(&[op_id]);
        assert_eq!(remaining, 1);
        let _ = fs::remove_file(&tmp_file);
    }
}
