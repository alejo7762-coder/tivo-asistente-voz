import { StyleSheet, View } from 'react-native';
import { Aviso, Pantalla, Texto, Vacio, useDatos } from '../componentes';
import { colores } from '../tema';

const INTENCIONES = {
  hora: 'Preguntó la hora', fecha: 'Preguntó la fecha', listar_recordatorios: 'Consultó sus pendientes', listar_medicamentos: 'Consultó sus medicamentos',
  crear_recordatorio: 'Creó un recordatorio', eliminar_recordatorio: 'Eliminó un recordatorio', confirmar_toma: 'Confirmó un aviso', posponer: 'Pospuso un aviso',
  telefono_familiar: 'Pidió un teléfono', llamar: 'Pidió llamar', listar_familiares: 'Consultó sus familiares', leer_mensajes: 'Escuchó mensajes',
  musica_reproducir: 'Pidió música', musica_pausar: 'Pausó la música', musica_continuar: 'Reanudó la música', musica_detener: 'Detuvo la música',
  volumen_subir: 'Subió el volumen', volumen_bajar: 'Bajó el volumen', volumen_fijar: 'Cambió el volumen', pregunta_ia: 'Pregunta abierta (IA)',
  desconocido: 'Orden no entendida', repetir: 'Pidió repetir', ayuda: 'Pidió ayuda', saludo: 'Saludó', gracias: 'Agradeció', despedida: 'Se despidió',
};

function Cifra({ valor, nombre, color = colores.gris }) {
  return (
    <View style={[estilos.cifra, { backgroundColor: color }]}>
      <Texto tam={24} negrita centro>{valor}</Texto>
      <Texto tam={13} color={colores.textoSuave} centro>{nombre}</Texto>
    </View>
  );
}

export default function Diagnostico() {
  const { datos, error, refrescando, recargar } = useDatos('/diagnostico');
  const segundos = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`);
  const hora = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Pantalla titulo="Diagnóstico del asistente" subtitulo="Últimos 7 días" alRefrescar={recargar} refrescando={refrescando}>
      <Aviso texto={error} />
      {datos ? (
        <>
          <View style={estilos.cifras}>
            <Cifra valor={datos.comandos} nombre="Órdenes recibidas" color={colores.azulClaro} />
            <Cifra valor={datos.porcentajeExito === null ? '—' : `${datos.porcentajeExito}%`} nombre="Entendidas" />
            <Cifra valor={segundos(datos.latenciaPromedioMs)} nombre="Respuesta promedio" color={colores.amarillo} />
            <Cifra valor={datos.porcentajeBajo2s === null ? '—' : `${datos.porcentajeBajo2s}%`} nombre="En menos de 2 s" color={colores.azulClaro} />
          </View>
          <Texto tam={18} negrita cursiva style={{ marginTop: 22, marginBottom: 10 }}>Actividad reciente</Texto>
          {!datos.recientes.length ? <Vacio texto="El asistente todavía no ha reportado actividad." /> : null}
          {datos.recientes.map((r, i) => (
            <View key={`${r.creadoEn}-${i}`} style={estilos.fila}>
              <View style={[estilos.marca, { backgroundColor: r.exito ? colores.verde : colores.rojo }]} />
              <View style={{ flex: 1 }}>
                <Texto tam={15} negrita>{r.tipo === 'error' ? 'Error' : INTENCIONES[r.intencion] ?? r.intencion ?? 'Sistema'}</Texto>
                <Texto tam={13} color={colores.textoSuave}>{[hora(r.creadoEn), r.latenciaMs !== null ? segundos(r.latenciaMs) : null, r.detalle].filter(Boolean).join(' · ')}</Texto>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cifra: { flexBasis: '46%', flexGrow: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD2DE' },
  marca: { width: 10, height: 10, borderRadius: 5 },
});
