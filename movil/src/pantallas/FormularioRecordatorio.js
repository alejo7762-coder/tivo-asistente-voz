import { useState } from 'react';
import { Aviso, Boton, Campo, Opciones, Pantalla, SelectorFecha, SelectorHora, confirmar, fechaLocal } from '../componentes';
import { useSesion } from '../contexto';
import { colores } from '../tema';

const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];

export default function FormularioRecordatorio({ navigation, route }) {
  const { api } = useSesion();
  const previo = route.params?.recordatorio;
  const [r, setR] = useState({
    titulo: previo?.titulo ?? '',
    hora: previo?.hora ?? '08:00',
    fecha: previo && previo.fecha >= fechaLocal() ? previo.fecha : fechaLocal(),
    tipo: previo?.tipo ?? 'otro',
    repeticion: previo?.repeticion ?? 'diario',
    diasSemana: previo?.diasSemana ?? [],
    activo: previo?.activo ?? true,
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (valor) => setR({ ...r, [campo]: valor });

  const guardar = async () => {
    if (!r.titulo.trim()) return setError('Escriba un título breve para el recordatorio.');
    if (r.repeticion === 'semanal' && !r.diasSemana.length) return setError('Elija al menos un día de la semana.');
    setGuardando(true);
    try {
      await api(previo ? 'PUT' : 'POST', previo ? `/recordatorios/${previo.id}` : '/recordatorios', { ...r, titulo: r.titulo.trim() });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
    return undefined;
  };

  const eliminar = async () => {
    if (!(await confirmar('Eliminar recordatorio', `¿Eliminar "${previo.titulo}"? TIVO dejará de avisarlo.`))) return;
    try {
      await api('DELETE', `/recordatorios/${previo.id}`);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Pantalla titulo={previo ? 'Editar recordatorio' : 'Crear recordatorio'} fondo={colores.amarillo}>
      <SelectorHora valor={r.hora} alCambiar={cambiar('hora')} />
      <Campo etiqueta="Título del recordatorio" valor={r.titulo} alCambiar={cambiar('titulo')} placeholder="Escribe un título breve" maxLength={60} />
      <Opciones etiqueta="Tipo" opciones={[['medicamento', 'Medicamentos'], ['llamada', 'Llamada'], ['otro', 'Otros']]} valor={r.tipo} alCambiar={cambiar('tipo')} />
      <Opciones etiqueta="Repetición" opciones={[['diario', 'Diario'], ['semanal', 'Semanal'], ['una_vez', 'Una vez']]} valor={r.repeticion} alCambiar={cambiar('repeticion')} />
      {r.repeticion === 'semanal' ? <Opciones etiqueta="Días de la semana" opciones={DIAS} valor={r.diasSemana} alCambiar={cambiar('diasSemana')} multiple /> : null}
      {r.repeticion === 'una_vez' ? <SelectorFecha valor={r.fecha} alCambiar={cambiar('fecha')} /> : null}
      {previo ? <Opciones etiqueta="Estado" opciones={[[true, 'Activado'], [false, 'Desactivado']]} valor={r.activo} alCambiar={cambiar('activo')} /> : null}
      <Aviso texto={error} />
      <Boton texto="Guardar recordatorio" alPresionar={guardar} cargando={guardando} style={{ marginTop: 26 }} />
      {previo ? <Boton texto="Eliminar" alPresionar={eliminar} color={colores.blanco} colorTexto={colores.rojo} /> : null}
    </Pantalla>
  );
}
