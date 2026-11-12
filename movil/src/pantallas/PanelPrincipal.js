import { Pressable, StyleSheet } from 'react-native';
import { Pantalla, Texto } from '../componentes';
import { coloresTarjeta } from '../tema';

const OPCIONES = [
  ['Recordatorios', 'Recordatorios'],
  ['Estado', 'Estado del dispositivo'],
  ['Medicamentos', 'Toma de Medicamentos'],
  ['Configuracion', 'Configuración'],
  ['Diagnostico', 'Diagnóstico del asistente'],
  ['Ayuda', 'Ayuda y soporte'],
  ['Familiares', 'Familiares'],
  ['Mensajes', 'Mensajes'],
];

export default function PanelPrincipal({ navigation }) {
  return (
    <Pantalla titulo="Panel principal" atras={false}>
      {OPCIONES.map(([pantalla, nombre], i) => (
        <Pressable
          key={pantalla}
          onPress={() => navigation.navigate(pantalla)}
          accessibilityRole="button"
          accessibilityLabel={nombre}
          style={({ pressed }) => [estilos.opcion, { backgroundColor: coloresTarjeta[i % 3], opacity: pressed ? 0.75 : 1 }]}
        >
          <Texto tam={20} negrita cursiva centro>{nombre}</Texto>
        </Pressable>
      ))}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  opcion: { minHeight: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18, paddingHorizontal: 16 },
});
