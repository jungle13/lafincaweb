import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DEFAULT_ORIGIN_ADDRESS = 'Avenida Pasoancho con Calle 72, Cali, Valle del Cauca, Colombia';
const DEFAULT_ORIGIN_COORDS = { lat: 3.3976, lon: -76.5303 };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function sugerirTarifaPorDistancia(km: number): number {
  if (km <= 2.0) return 4000;
  if (km <= 4.0) return 5000;
  if (km <= 6.0) return 7000;
  if (km <= 8.0) return 9000;
  const extraKm = Math.ceil(km - 8.0);
  const raw = 9000 + extraKm * 1200;
  return Math.round(raw / 500) * 500;
}

function normalizeCaliAddress(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';
  if (clean.toLowerCase().includes('cali')) return clean;
  return `${clean}, Cali, Valle del Cauca, Colombia`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawAddress = String(body?.direccion || '').trim();
    if (rawAddress.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Ingresa una dirección válida para calcular la distancia.' },
        { status: 400 }
      );
    }

    const destination = normalizeCaliAddress(rawAddress);

    // Obtener dirección configurada del restaurante si existe
    let originAddress = DEFAULT_ORIGIN_ADDRESS;
    try {
      const supabase = getSupabase();
      const { data: emp } = await supabase
        .from('empresa_config')
        .select('direccion')
        .eq('id', 1)
        .maybeSingle();
      if (emp?.direccion && String(emp.direccion).trim().length > 5) {
        originAddress = normalizeCaliAddress(String(emp.direccion));
      }
    } catch {
      // Usar dirección por defecto
    }

    // 1. Modo Principal: Google Maps Distance Matrix API (si GOOGLE_MAPS_API_KEY está configurada)
    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (googleKey) {
      const gmUrl = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      gmUrl.searchParams.set('origins', originAddress);
      gmUrl.searchParams.set('destinations', destination);
      gmUrl.searchParams.set('mode', 'driving');
      gmUrl.searchParams.set('language', 'es');
      gmUrl.searchParams.set('region', 'co');
      gmUrl.searchParams.set('key', googleKey);

      const gmRes = await fetch(gmUrl.toString(), { cache: 'no-store' });
      if (gmRes.ok) {
        const gmData = await gmRes.json();
        const el = gmData?.rows?.[0]?.elements?.[0];
        if (gmData?.status === 'OK' && el?.status === 'OK' && el?.distance?.value) {
          const distanciaKm = Math.round((Number(el.distance.value) / 1000) * 10) / 10;
          const duracionMin = Math.max(1, Math.round(Number(el.duration?.value || 300) / 60));
          return NextResponse.json({
            success: true,
            proveedor: 'google_maps',
            origen: originAddress,
            direccionResuelta: gmData?.destination_addresses?.[0] || destination,
            distanciaKm,
            duracionMin,
            tarifaSugerida: sugerirTarifaPorDistancia(distanciaKm),
          });
        }
      }
    }

    // 2. Respaldo Automático Gratuito: Nominatim (OpenStreetMap) + OSRM
    const nomUrl = new URL('https://nominatim.openstreetmap.org/search');
    nomUrl.searchParams.set('q', destination);
    nomUrl.searchParams.set('format', 'json');
    nomUrl.searchParams.set('limit', '1');
    nomUrl.searchParams.set('countrycodes', 'co');

    const nomRes = await fetch(nomUrl.toString(), {
      headers: { 'User-Agent': 'ElianaPOS-Domicilios/1.0' },
      cache: 'no-store',
    });
    if (!nomRes.ok) {
      return NextResponse.json(
        { success: false, error: 'No se pudo consultar el servicio de mapas.' },
        { status: 502 }
      );
    }
    const nomData = await nomRes.json();
    const destPlace = Array.isArray(nomData) ? nomData[0] : null;
    if (!destPlace?.lat || !destPlace?.lon) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se encontró esa dirección en Cali. Intenta incluir barrio o carrera/calle.',
        },
        { status: 404 }
      );
    }

    const destLat = Number(destPlace.lat);
    const destLon = Number(destPlace.lon);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${DEFAULT_ORIGIN_COORDS.lon},${DEFAULT_ORIGIN_COORDS.lat};${destLon},${destLat}?overview=false`;
    const osrmRes = await fetch(osrmUrl, { cache: 'no-store' });
    let distanciaKm = 0;
    let duracionMin = 10;

    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      const route = osrmData?.routes?.[0];
      if (route?.distance) {
        distanciaKm = Math.round((Number(route.distance) / 1000) * 10) / 10;
        duracionMin = Math.max(1, Math.round(Number(route.duration || 600) / 60));
      }
    }

    if (distanciaKm <= 0) {
      // Haversine fallback si OSRM no responde
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(destLat - DEFAULT_ORIGIN_COORDS.lat);
      const dLon = toRad(destLon - DEFAULT_ORIGIN_COORDS.lon);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(DEFAULT_ORIGIN_COORDS.lat)) *
          Math.cos(toRad(destLat)) *
          Math.sin(dLon / 2) ** 2;
      const straight = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanciaKm = Math.round(straight * 1.25 * 10) / 10;
      duracionMin = Math.max(3, Math.round(distanciaKm * 3));
    }

    return NextResponse.json({
      success: true,
      proveedor: 'osrm',
      origen: originAddress,
      direccionResuelta: destPlace.display_name || destination,
      distanciaKm,
      duracionMin,
      tarifaSugerida: sugerirTarifaPorDistancia(distanciaKm),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error calculando distancia';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
