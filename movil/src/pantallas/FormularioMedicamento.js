import { useState } from 'react';
import { Aviso, Boton, Campo, Opciones, Pantalla, SelectorHora, Texto, confirmar } from '../componentes';
import { useSesion } from '../contexto';
import { colores } from '../tema';

const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const FRECUENCIAS = [['diario', 'Diario'], ['cada_12_horas', 'Cada 12 horas'], ['cada_8_horas', 'Cada 8 horas'], ['semanal', 'Semanal']];

export default function FormularioMedicamento({ navigation, route }) {
  const { api } = useSesion();
  const previo = route.params?.medicamento;
  const [m, setM] = useState({
    nombre: previo?.nombre ?? '',
    dosis: previo?.dosis ?? '',
    frecuencia: previo?.frecuencia ?? 'diario',
    hora: previo?.hora ?? '08:00',
    diaSemana: previo?.diaSemana ?? 1,
    activo: previo?.activo ?? true,
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (valor) => setM({ ...m, [campo]: valor });

  const guardar = async () => {
    if (!m.nombre.trim()) return setError('Escriba el nombre del medicamento.');
    setGuardando(true);
    try {
      const cuerpo = { ...m, nombre: m.nombre.trim(), dosis: m.dosis.trim() || null };
      await api(previo ? 'PUT' : 'POST', previo ? `/medicamentos/${previo.id}` : '/medicamentos', cuerpo);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
    return undefined;
  };

  const eliminar = async () => {
    if (!(await confirmar('Eliminar medicamento', `¿Eliminar "${previo.nombre}"? TIVO dejará de recordarlo.`))) return;
    try {
      await api('DELETE', `/medicamentos/${previo.id}`);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Pantalla titulo={previo ? 'Editar medicamento' : 'Agregar medicamento'} fondo={colores.amarillo}>
      <Campo etiqueta="Nombre del medicamento" valor={m.nombre} alCambiar={cambiar('nombre')} placeholder="Ej.: Losartán" maxLength={60} />
      <Campo etiqueta="Dosis (opcional)" valor={m.dosis} alCambiar={cambiar('dosis')} placeholder="Ej.: 50 mg" maxLength={40} />
      <Opciones etiqueta="Frecuencia" opciones={FRECUENCIAS} valor={m.frecuencia} alCambiar={cambiar('frecuencia')} />
      {m.frecuencia === 'semanal' ? <Opciones etiqueta="Día de la semana" opciones={DIAS} valor={m.diaSemana} alCambiar={cambiar('diaSemana')} /> : null}
      <SelectorHora etiqueta={m.frecuencia.startsWith('cada') ? 'Hora de la primera toma' : 'Hora'} valor={m.hora} alCambiar={cambiar('hora')} />
      {previo ? <Opciones etiqueta="Estado" opciones={[[true, 'Activado'], [false, 'Desactivado']]} valor={m.activo} alCambiar={cambiar('activo')} /> : null}
      <Texto tam={13} color={colores.textoSuave} style={{ marginTop: 12, marginLeft: 4 }}>
        Registre la dosis y el horario tal como los indicó el médico.
      </Texto>
      <Aviso texto={error} />
      <Boton texto="Guardar medicamento" alPresionar={guardar} cargando={guardando} style={{ marginTop: 22 }} />
      {previo ? <Boton texto="Eliminar" alPresionar={eliminar} color={colores.blanco} colorTexto={colores.rojo} /> : null}
    </Pantalla>
  );
}
