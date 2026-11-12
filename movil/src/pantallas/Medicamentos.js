import { View } from 'react-native';
import { Aviso, Boton, Pantalla, Tarjeta, Texto, Vacio, useDatos } from '../componentes';
import { useSesion } from '../contexto';
import { ESTADOS_HOY, colores } from '../tema';

// Píldora del diseño (figura 8)
function Pildora() {
  return (
    <View style={{ width: 46, height: 30, borderRadius: 15, backgroundColor: colores.azulOscuro, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 22, height: 5, borderRadius: 3, backgroundColor: colores.amarillo }} />
    </View>
  );
}

export default function Medicamentos({ navigation }) {
  const { puedeEditar } = useSesion();
  const { datos, error, refrescando, recargar } = useDatos('/medicamentos');

  return (
    <Pantalla titulo="Medicamentos" subtitulo="Recordatorios programados" alRefrescar={recargar} refrescando={refrescando}>
      <Aviso texto={error} />
      {datos && !datos.length ? <Vacio texto="Todavía no hay medicamentos registrados." /> : null}
      {(datos ?? []).map((m, i) => (
        <Tarjeta
          key={m.id}
          izquierda={<Pildora />}
          titulo={[m.nombre, m.dosis].filter(Boolean).join(' ')}
          detalle={m.frecuenciaTexto}
          estado={ESTADOS_HOY[m.estadoHoy]?.texto}
          color={i % 2 ? '#F7F4F4' : colores.gris}
          colorPunto={ESTADOS_HOY[m.estadoHoy]?.color}
          alPresionar={puedeEditar ? () => navigation.navigate('FormularioMedicamento', { medicamento: m }) : undefined}
        />
      ))}
      {puedeEditar ? (
        <>
          <Boton texto="Agregar medicamento" alPresionar={() => navigation.navigate('FormularioMedicamento')} style={{ marginTop: 22 }} />
          <Texto tam={13} color={colores.textoSuave} centro style={{ marginTop: 12 }}>Toca un medicamento para editarlo o eliminarlo</Texto>
        </>
      ) : null}
    </Pantalla>
  );
}
