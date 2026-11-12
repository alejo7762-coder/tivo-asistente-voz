import { useState } from 'react';
import { Aviso, Boton, Campo, Pantalla, confirmar } from '../componentes';
import { useSesion } from '../contexto';
import { colores } from '../tema';

export default function FormularioFamiliar({ navigation, route }) {
  const { api } = useSesion();
  const previo = route.params?.familiar;
  const [f, setF] = useState({ nombre: previo?.nombre ?? '', relacion: previo?.relacion ?? '', telefono: previo?.telefono ?? '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (valor) => setF({ ...f, [campo]: valor });

  const guardar = async () => {
    if (!f.nombre.trim() || !f.relacion.trim() || !f.telefono.trim()) return setError('Complete el nombre, la relación y el teléfono.');
    setGuardando(true);
    try {
      const cuerpo = { nombre: f.nombre.trim(), relacion: f.relacion.trim(), telefono: f.telefono.trim() };
      await api(previo ? 'PUT' : 'POST', previo ? `/familiares/${previo.id}` : '/familiares', cuerpo);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
    return undefined;
  };

  const eliminar = async () => {
    if (!(await confirmar('Eliminar familiar', `¿Eliminar a ${previo.nombre} de los contactos de TIVO?`))) return;
    try {
      await api('DELETE', `/familiares/${previo.id}`);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Pantalla titulo={previo ? 'Editar familiar' : 'Agregar familiar'} fondo={colores.amarillo}>
      <Campo etiqueta="Nombre" valor={f.nombre} alCambiar={cambiar('nombre')} maxLength={60} />
      <Campo etiqueta="Relación" valor={f.relacion} alCambiar={cambiar('relacion')} placeholder="Ej.: hijo, nieta, vecina" autoCapitalize="none" maxLength={30} />
      <Campo etiqueta="Teléfono" valor={f.telefono} alCambiar={cambiar('telefono')} keyboardType="phone-pad" maxLength={20} />
      <Aviso texto={error} />
      <Boton texto="Guardar" alPresionar={guardar} cargando={guardando} style={{ marginTop: 26 }} />
      {previo ? <Boton texto="Eliminar" alPresionar={eliminar} color={colores.blanco} colorTexto={colores.rojo} /> : null}
    </Pantalla>
  );
}
