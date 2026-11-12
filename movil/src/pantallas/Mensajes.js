import { useState } from 'react';
import { Aviso, Boton, Campo, Pantalla, Tarjeta, Vacio, confirmar, useDatos } from '../componentes';
import { useSesion } from '../contexto';
import { colores, coloresTarjeta } from '../tema';

export default function Mensajes() {
  const { api, puedeEditar } = useSesion();
  const { datos, error, refrescando, recargar } = useDatos('/mensajes', { cadaMs: 20000 });
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    setErrorEnvio('');
    try {
      await api('POST', '/mensajes', { texto: texto.trim() });
      setTexto('');
      recargar();
    } catch (e) {
      setErrorEnvio(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (mensaje) => {
    if (!(await confirmar('Eliminar mensaje', '¿Eliminar este mensaje?'))) return;
    try {
      await api('DELETE', `/mensajes/${mensaje.id}`);
      recargar();
    } catch (e) {
      setErrorEnvio(e.message);
    }
  };

  const fecha = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Pantalla titulo="Mensajes" subtitulo="TIVO se los lee en voz alta" alRefrescar={recargar} refrescando={refrescando}>
      {puedeEditar ? (
        <>
          <Campo etiqueta="Nuevo mensaje" valor={texto} alCambiar={setTexto} multiline maxLength={500} placeholder="Escriba un mensaje corto y cariñoso" style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }} />
          <Aviso texto={errorEnvio} />
          <Boton texto="Enviar a TIVO" alPresionar={enviar} cargando={enviando} deshabilitado={!texto.trim()} style={{ marginBottom: 22 }} />
        </>
      ) : null}
      <Aviso texto={error} />
      {datos && !datos.length ? <Vacio texto="No hay mensajes enviados." /> : null}
      {(datos ?? []).map((m, i) => (
        <Tarjeta
          key={m.id}
          titulo={m.texto}
          detalle={`${m.autor} · ${fecha(m.creadoEn)}`}
          estado={m.escuchado ? 'Ya lo escuchó' : 'Pendiente por escuchar'}
          color={coloresTarjeta[i % 3]}
          colorPunto={m.escuchado ? colores.verde : colores.ambar}
          alPresionar={puedeEditar ? () => eliminar(m) : undefined}
        />
      ))}
    </Pantalla>
  );
}
