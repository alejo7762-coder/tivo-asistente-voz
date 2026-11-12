import { Aviso, Boton, Pantalla, Tarjeta, Vacio, useDatos } from '../componentes';
import { useSesion } from '../contexto';
import { ESTADOS_HOY, coloresTarjeta } from '../tema';

const TIPOS = { medicamento: 'Medicamento', llamada: 'Llamada', otro: '' };

export default function Recordatorios({ navigation }) {
  const { puedeEditar } = useSesion();
  const { datos, error, refrescando, recargar } = useDatos('/recordatorios');

  return (
    <Pantalla titulo="Recordatorios" alRefrescar={recargar} refrescando={refrescando}>
      {puedeEditar ? <Boton texto="+ Agregar recordatorio" alPresionar={() => navigation.navigate('FormularioRecordatorio')} style={{ marginTop: 0, marginBottom: 18 }} /> : null}
      <Aviso texto={error} />
      {datos && !datos.length ? <Vacio texto="Todavía no hay recordatorios. Agregue el primero o pídaselo a TIVO por voz." /> : null}
      {(datos ?? []).map((r, i) => (
        <Tarjeta
          key={r.id}
          titulo={`${r.horaTexto} — ${r.titulo}`}
          detalle={[r.repeticionTexto, TIPOS[r.tipo], r.origen === 'voz' ? 'Creado por voz' : ''].filter(Boolean).join(' · ')}
          estado={ESTADOS_HOY[r.estadoHoy]?.texto}
          color={coloresTarjeta[i % 3]}
          colorPunto={ESTADOS_HOY[r.estadoHoy]?.color}
          alPresionar={puedeEditar ? () => navigation.navigate('FormularioRecordatorio', { recordatorio: r }) : undefined}
        />
      ))}
    </Pantalla>
  );
}
