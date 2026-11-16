#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

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

    // ESC @ (Inicializar impresora) + contenido + corte parcial GS V 66 0
    let mut payload: Vec<u8> = vec![0x1B, 0x40];
    payload.extend_from_slice(content.as_bytes());
    payload.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]);

    stream
        .write_all(&payload)
        .map_err(|e| format!("Error enviando tirilla: {}", e))?;

    Ok("Impreso correctamente".into())
}

#[tauri::command]
fn open_cash_drawer(printer_ip: String) -> Result<String, String> {
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

    // ESC p m t1 t2 -> Pulso estándar RJ11 para cajón monedero
    let pulse: [u8; 5] = [27, 112, 0, 25, 250];
    stream
        .write_all(&pulse)
        .map_err(|e| format!("Error abriendo cajón: {}", e))?;

    Ok("Cajón abierto".into())
}

#[tauri::command]
fn read_scale_weight(port_name: String) -> Result<f64, String> {
    let mut port = serialport::new(&port_name, 9600)
        .timeout(Duration::from_millis(400))
        .open()
        .map_err(|e| format!("No se pudo abrir puerto {}: {}", port_name, e))?;

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
        .map_err(|_| format!("Lectura no numérica desde gramera: {}", text))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            print_escpos_ticket,
            open_cash_drawer,
            read_scale_weight
        ])
        .run(tauri::generate_context!())
        .expect("Error iniciando La Finca POS");
}
