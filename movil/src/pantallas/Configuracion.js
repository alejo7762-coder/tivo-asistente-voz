import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Aviso, Boton, Contador, Opciones, Pantalla, Texto, useDatos } from '../componentes';
import { useSesion } from '../contexto';
import { colores } from '../tema';

export default function Configuracion() {
  const { api, puedeEditar, aplicarTamanoLetra, usuario, salir } = useSesion();
  const { datos, error } = useDatos('/dispositivo/configuracion');
  const [c, setC] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'ok' });
  const cambiar = (campo) => (valor) => { setC({ ...c, [campo]: valor }); setMensaje({ texto: '' }); };

  useEffect(() => { if (datos && !c) setC(datos); }, [datos, c]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const guardada = await api('PUT', '/dispositivo/configuracion', c);
      setC(guardada);
      await aplicarTamanoLetra(guardada.tamanoLetra);
      setMensaje({ texto: 'Cambios guardados. TIVO los aplica en menos de un minuto.', tipo: 'ok' });
    } catch (e) {
      setMensaje({ texto: e.message, tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla titulo="Configuración" fondo={colores.amarillo}>
      <Aviso texto={error} />
      {c ? (
        <>
          <Opciones etiqueta="Sensibilidad del micrófono" opciones={[['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']]} valor={c.sensibilidadMicrofono} alCambiar={cambiar('sensibilidadMicrofono')} />
          <Opciones etiqueta={`Activación por voz ("${c.palabraClave}")`} opciones={[[true, 'Activado'], [false, 'Desactivado']]} valor={c.activacionPorVoz} alCambiar={cambiar('activacionPorVoz')} />
          <Contador etiqueta="Volumen del asistente" valor={c.volumen} alCambiar={cambiar('volumen')} minimo={10} sufijo="%" />
          <Opciones etiqueta="Velocidad de la voz" opciones={[['lenta', 'Pausada'], ['normal', 'Normal']]} valor={c.velocidadVoz} alCambiar={cambiar('velocidadVoz')} />
          <Opciones etiqueta="Repetir un aviso sin confirmar cada" opciones={[[2, '2 min'], [5, '5 min'], [10, '10 min']]} valor={c.repetirCadaMinutos} alCambiar={cambiar('repetirCadaMinutos')} />
          <Opciones etiqueta="Tamaño de letra" opciones={[['normal', 'Normal'], ['grande', 'Grande'], ['extra_grande', 'Extra Grande']]} valor={c.tamanoLetra} alCambiar={cambiar('tamanoLetra')} />
          <Aviso texto={mensaje.texto} tipo={mensaje.tipo} />
          {puedeEditar ? <Boton texto="Guardar cambios" alPresionar={guardar} cargando={guardando} style={{ marginTop: 26 }} /> : null}
        </>
      ) : null}

      <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: '#D8CC84', paddingTop: 16 }}>
        <Texto tam={15} color={colores.textoSuave} centro>
          {usuario?.nombre ? `Sesión de ${usuario.nombre} (${usuario.rol})` : 'Sesión iniciada'}
        </Texto>
        <Boton texto="Cerrar sesión" alPresionar={salir} color={colores.blanco} colorTexto={colores.rojo} />
      </View>
    </Pantalla>
  );
}
