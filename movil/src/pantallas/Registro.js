import { useState } from 'react';
import { Pressable } from 'react-native';
import { Aviso, Boton, Campo, Pantalla, Texto } from '../componentes';
import { useSesion } from '../contexto';
import { colores } from '../tema';

export default function Registro({ navigation }) {
  const { registrar } = useSesion();
  const [datos, setDatos] = useState({ nombre: '', correo: '', clave: '', codigoVinculacion: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const cambiar = (campo) => (valor) => setDatos({ ...datos, [campo]: valor });

  const crear = async () => {
    if (datos.clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setError('');
    setCargando(true);
    try {
      await registrar({ ...datos, nombre: datos.nombre.trim(), correo: datos.correo.trim(), codigoVinculacion: datos.codigoVinculacion.trim().toUpperCase() });
    } catch (e) {
      setError(e.message);
      setCargando(false);
    }
    return undefined;
  };

  return (
    <Pantalla fondo={colores.amarillo} sinEncabezado titulo="Crear cuenta" subtitulo="Para familiares y cuidadores">
      <Campo etiqueta="Su nombre" valor={datos.nombre} alCambiar={cambiar('nombre')} autoComplete="name" />
      <Campo etiqueta="Correo electrónico" valor={datos.correo} alCambiar={cambiar('correo')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Campo etiqueta="Contraseña (mínimo 8 caracteres)" valor={datos.clave} alCambiar={cambiar('clave')} secureTextEntry autoCapitalize="none" />
      <Campo etiqueta="Código de vinculación del TIVO" valor={datos.codigoVinculacion} alCambiar={cambiar('codigoVinculacion')} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="6 letras y números" />
      <Texto tam={14} color={colores.textoSuave} style={{ marginTop: 8, marginLeft: 4 }}>
        El código aparece al registrar el dispositivo. La primera cuenta que lo usa queda como administradora.
      </Texto>
      <Aviso texto={error} />
      <Boton texto="Crear cuenta" alPresionar={crear} cargando={cargando} style={{ marginTop: 24 }} />
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ paddingVertical: 16 }}>
        <Texto tam={16} negrita centro style={{ textDecorationLine: 'underline' }}>Ya tengo cuenta</Texto>
      </Pressable>
    </Pantalla>
  );
}
