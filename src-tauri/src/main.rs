#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;

#[derive(Clone)]
struct LanStore {
    file_path: PathBuf,
    lock: Arc<Mutex<()>>,
}

impl LanStore {
    fn read_state(&self) -> String {
        let _guard = self.lock.lock().unwrap();
        fs::read_to_string(&self.file_path).unwrap_or_else(|_| {
            r#"{"success":true,"mesas":[],"ordenes":[],"productos":[],"sesiones":[],"salidasDiaCaja":0,"eventosTurno":[],"creditosClientes":[],"devolucionesDia":[],"pendingOps":[]}"#.to_string()
        })
    }

    fn write_state(&self, content: &str) {
        let _guard = self.lock.lock().unwrap();
        if let Some(parent) = self.file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&self.file_path, content);
    }

    fn append_pending_op(&self, op_json: serde_json::Value) {
        let _guard = self.lock.lock().unwrap();
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
        if let Some(parent) = self.file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&self.file_path, serde_json::to_string(&root).unwrap_or_default());
    }
}

fn handle_lan_connection(mut stream: TcpStream, store: LanStore) {
    let mut buffer = [0u8; 65536];
    let n = match stream.read(&mut buffer) {
        Ok(bytes) if bytes > 0 => bytes,
        _ => return,
    };
    let req = String::from_utf8_lossy(&buffer[..n]);
    let first_line = req.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }
    let method = parts[0];
    let path = parts[1];

    let body = req.split("\r\n\r\n").nth(1).unwrap_or("").trim();

    let (status, resp_body) = if method == "OPTIONS" {
        ("204 No Content", String::new())
    } else if method == "GET" && path == "/lan/health" {
        ("200 OK", r#"{"ok":true,"service":"Eliana POS LAN"}"#.to_string())
    } else if method == "GET" && path == "/lan/state" {
        ("200 OK", store.read_state())
    } else if method == "POST" && path == "/lan/sync-cache" {
        if !body.is_empty() {
            store.write_state(body);
        }
        ("200 OK", r#"{"success":true}"#.to_string())
    } else if method == "POST" && path == "/lan/action" {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
            store.append_pending_op(val);
            ("200 OK", r#"{"success":true,"lanQueued":true}"#.to_string())
        } else {
            ("400 Bad Request", r#"{"success":false,"error":"JSON invalido"}"#.to_string())
        }
    } else {
        ("404 Not Found", r#"{"error":"Not found"}"#.to_string())
    };

    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
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
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
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
    tauri::Builder::default()
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
            read_scale_weight
        ])
        .run(tauri::generate_context!())
        .expect("Error iniciando Eliana POS");
}
