import { View } from 'react-native';
import { Pantalla, Texto, useDatos } from '../componentes';
import { colores, coloresTarjeta } from '../tema';

const COMANDOS = [
  ['Para empezar', ['"Hola TIVO"']],
  ['Hora y fecha', ['"¿Qué hora es?"', '"¿Qué día es hoy?"']],
  ['Recordatorios', ['"Recuérdame tomar agua todos los días a las tres"', '"¿Qué tengo para hoy?"', '"Elimina el recordatorio de ejercicios"']],
  ['Medicamentos', ['"¿Qué medicamentos tengo?"', 'Después de un aviso: "Ya lo tomé"']],
  ['Familia', ['"¿Cuál es el número de mi hijo?"', '"Léeme los mensajes"']],
  ['Música y volumen', ['"Pon música"', '"Para la música"', '"Sube el volumen"']],
];

export default function Ayuda() {
  const { datos } = useDatos('/dispositivo');
  return (
    <Pantalla titulo="Ayuda y soporte" subtitulo="Lo que se le puede decir a TIVO">
      {COMANDOS.map(([titulo, frases], i) => (
        <View key={titulo} style={{ backgroundColor: coloresTarjeta[i % 3], borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <Texto tam={18} negrita cursiva>{titulo}</Texto>
          {frases.map((f) => <Texto key={f} tam={15} color={colores.textoSuave} style={{ marginTop: 6 }}>{f}</Texto>)}
        </View>
      ))}
      <View style={{ backgroundColor: colores.azulOscuro, borderRadius: 16, padding: 18 }}>
        <Texto tam={16} negrita color={colores.amarillo}>Invitar a otro familiar</Texto>
        <Texto tam={15} color={colores.blanco} style={{ marginTop: 6 }}>
          Pídale que cree una cuenta en la app con este código de vinculación:
        </Texto>
        <Texto tam={28} negrita color={colores.amarillo} centro style={{ marginTop: 10, letterSpacing: 6 }} selectable>{datos?.codigoVinculacion ?? '······'}</Texto>
      </View>
      <Texto tam={14} color={colores.textoSuave} centro style={{ marginTop: 18 }}>
        Si TIVO no responde, revise que esté conectado a la corriente y al Wi-Fi, y consulte la pantalla "Estado del dispositivo".
      </Texto>
    </Pantalla>
  );
}
