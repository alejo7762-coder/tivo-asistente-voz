import { Aviso, Pantalla, Tarjeta, Texto, useDatos } from '../componentes';
import { colores, coloresTarjeta } from '../tema';

function hace(iso) {
  if (!iso) return 'nunca se ha conectado';
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 1440) return `hace ${Math.round(minutos / 60)} h`;
  return `hace ${Math.round(minutos / 1440)} días`;
}

export default function EstadoDispositivo() {
  const { datos, error, refrescando, recargar } = useDatos('/dispositivo', { cadaMs: 15000 });
  const e = datos?.estado;
  const enLinea = Boolean(datos?.enLinea);
  // Si el dispositivo no está en línea, los últimos valores conocidos se muestran en gris.
  const punto = (bien) => (!enLinea || !e ? colores.apagado : bien ? colores.verde : colores.rojo);

  const filas = datos ? [
    ['Conexión a Internet', enLinea ? `Estado: ${e?.internet ? 'Conectado' : 'Sin Internet'}` : `Sin conexión — visto ${hace(datos.ultimaConexion)}`, enLinea ? (e?.internet ? colores.verde : colores.ambar) : colores.rojo],
    ['Micrófono', !e ? 'Sin datos' : e.microfono ? 'Funcionando correctamente' : 'No responde', punto(e?.microfono)],
    ['Altavoces', !e ? 'Sin datos' : e.altavoz ? `Nivel: ${e.volumen ?? '—'}%` : 'No responden', punto(e?.altavoz)],
    ['Indicadores LED', !e ? 'Sin datos' : `Estado: ${e.pantalla ? 'Operativos' : 'Con fallas'}`, punto(e?.pantalla)],
    ['Raspberry Pi', !e ? 'Sin datos' : `CPU: ${e.temperaturaCpu === null ? 'sin sensor' : `${Math.round(e.temperaturaCpu)}°C`} — Memoria: ${e.memoriaUsada ?? '—'}%`, punto(e && (e.temperaturaCpu === null || e.temperaturaCpu < 75) && (e.memoriaUsada ?? 0) < 90)],
  ] : [];

  return (
    <Pantalla titulo="Estado del dispositivo" subtitulo={datos ? [datos.nombre, datos.adultoNombre].filter(Boolean).join(' · ') : undefined} alRefrescar={recargar} refrescando={refrescando}>
      <Aviso texto={error} />
      {filas.map(([titulo, detalle, color], i) => (
        <Tarjeta key={titulo} titulo={titulo} detalle={detalle} color={coloresTarjeta[i % 3]} colorPunto={color} />
      ))}
      {datos ? (
        <Texto tam={13} color={colores.textoSuave} centro style={{ marginTop: 6 }}>
          {enLinea ? 'Se actualiza cada 15 segundos' : 'Revise que el TIVO esté encendido y conectado a la red Wi-Fi'}
        </Texto>
      ) : null}
    </Pantalla>
  );
}
