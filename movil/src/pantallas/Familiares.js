import { Aviso, Boton, Pantalla, Tarjeta, Vacio, useDatos } from '../componentes';
import { useSesion } from '../contexto';
import { coloresTarjeta } from '../tema';

export default function Familiares({ navigation }) {
  const { puedeEditar } = useSesion();
  const { datos, error, refrescando, recargar } = useDatos('/familiares');
  const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  return (
    <Pantalla titulo="Familiares" subtitulo={'TIVO responde preguntas como\n"¿Cuál es el número de mi hijo?"'} alRefrescar={recargar} refrescando={refrescando}>
      <Aviso texto={error} />
      {datos && !datos.length ? <Vacio texto="Todavía no hay familiares guardados." /> : null}
      {(datos ?? []).map((f, i) => (
        <Tarjeta
          key={f.id}
          titulo={`${f.nombre} — ${mayuscula(f.relacion)}`}
          detalle={f.telefono}
          color={coloresTarjeta[i % 3]}
          alPresionar={puedeEditar ? () => navigation.navigate('FormularioFamiliar', { familiar: f }) : undefined}
        />
      ))}
      {puedeEditar ? <Boton texto="Agregar familiar" alPresionar={() => navigation.navigate('FormularioFamiliar')} style={{ marginTop: 22 }} /> : null}
    </Pantalla>
  );
}
