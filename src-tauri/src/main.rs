#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, State, WindowEvent};

struct OpenShiftState(Arc<AtomicBool>);

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
            r#"{"success":true,"mesas":[],"ordenes":[],"productos":[],"sesiones":[],"salidasDiaCaja":0,"eventosTurno":[],"creditosClientes":[],"devolucionesDia":[],"pendingOps":[]}"#.to_string()
        })
    }

    fn write_state(&self, content: &str) {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        self.write_atomic(content);
    }

    fn append_pending_op(&self, op_json: serde_json::Value) {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let raw = fs::read_to_string(&self.file_path).unwrap_or_else(|_| "{}".to_string());
        let mut root: serde_json::Value =
            serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
        let arr = root
            .as_object_mut()
            .and_then(|m| {
                m.entry("pendingOps")
                    .or_insert_with(|| serde_json::json!([]))
                    .as_array_mut()
            });
        if let Some(ops) = arr {
            ops.push(op_json);
        }
        if let Ok(serialized) = serde_json::to_string(&root) {
            self.write_atomic(&serialized);
        }
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

fn handle_lan_connection(mut stream: TcpStream, store: LanStore) {
    let (method, path, origin, body) = match read_http_request(&mut stream) {
        Some(parsed) => parsed,
        None => return,
    };

    let allowed_origin = if origin.starts_with("http://localhost:")
        || origin.starts_with("http://127.0.0.1:")
        || origin == "tauri://localhost"
        || origin == "http://tauri.localhost"
        || origin.ends_with(".vercel.app")
    {
        origin
    } else {
        "http://localhost:3000".to_string()
    };

    let (status, resp_body) = if method == "OPTIONS" {
        ("204 No Content", String::new())
    } else if method == "GET" && path == "/lan/health" {
        ("200 OK", r#"{"ok":true,"service":"Eliana POS LAN"}"#.to_string())
    } else if method == "GET" && path == "/lan/state" {
        ("200 OK", store.read_state())
    } else if method == "POST" && path == "/lan/sync-cache" {
        if !body.is_empty() {
            store.write_state(&body);
        }
        ("200 OK", r#"{"success":true}"#.to_string())
    } else if method == "POST" && path == "/lan/action" {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
            store.append_pending_op(val);
            ("200 OK", r#"{"success":true,"lanQueued":true}"#.to_string())
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

fn start_lan_server(store: LanStore) {
    thread::spawn(move || {
        if let Ok(listener) = TcpListener::bind("0.0.0.0:4545") {
            for stream in listener.incoming().flatten() {
                let s = store.clone();
                thread::spawn(move || handle_lan_connection(stream, s));
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

    let mut payload: Vec<u8> = vec![0x1B, 0x40];
    payload.extend_from_slice(content.as_bytes());
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
            let store = LanStore {
                file_path: data_dir.join("eliana_pos_lan_state.json"),
                lock: Arc::new(Mutex::new(())),
            };
            start_lan_server(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_ip,
            print_escpos_ticket,
            open_cash_drawer,
            read_scale_weight,
            set_open_shift_state,
            allow_close_app
        ])
        .run(tauri::generate_context!())
        .expect("Error iniciando ELIANA POS");
}
