import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Aviso, Boton, Campo, Logo, Pantalla, Texto } from '../componentes';
import { useSesion } from '../contexto';
import { colores } from '../tema';

export default function Ingreso({ navigation }) {
  const { ingresar, urlApi, cambiarUrl } = useSesion();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verServidor, setVerServidor] = useState(false);
  const [servidor, setServidor] = useState(urlApi);

  const entrar = async () => {
    if (!correo.trim() || !clave) return setError('Escriba su correo y su contraseña.');
    setError('');
    setCargando(true);
    try {
      if (verServidor) await cambiarUrl(servidor);
      await ingresar(correo.trim(), clave);
    } catch (e) {
      setError(e.message);
      setCargando(false);
    }
    return undefined;
  };

  return (
    <Pantalla fondo={colores.amarillo} sinEncabezado>
      <Texto tam={21} negrita cursiva centro style={{ marginTop: 36 }} accessibilityRole="header">TIVO – Tu asistente de apoyo diario</Texto>
      <Texto tam={16} color={colores.textoSuave} centro style={{ marginTop: 8 }}>Asistente de voz inteligente</Texto>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Logo alto={150} />
        <Texto tam={40} negrita color="#3E6589" style={{ marginTop: -4, textDecorationLine: 'underline' }}>tivo</Texto>
      </View>

      <Campo etiqueta="Correo electrónico" valor={correo} alCambiar={setCorreo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <Campo etiqueta="Contraseña" valor={clave} alCambiar={setClave} secureTextEntry autoCapitalize="none" autoComplete="current-password" onSubmitEditing={entrar} />
      {verServidor ? (
        <Campo etiqueta="Dirección del servidor" valor={servidor} alCambiar={setServidor} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.20:3000" />
      ) : null}
      <Aviso texto={error} />
      <Boton texto="Ingresar" alPresionar={entrar} cargando={cargando} style={{ marginTop: 24 }} />

      <Pressable onPress={() => navigation.navigate('Registro')} accessibilityRole="button" style={{ paddingVertical: 16 }}>
        <Texto tam={16} negrita centro style={{ textDecorationLine: 'underline' }}>Crear una cuenta</Texto>
      </Pressable>
      <Pressable onPress={() => setVerServidor(!verServidor)} accessibilityRole="button" style={{ paddingVertical: 6 }}>
        <Texto tam={14} color={colores.textoSuave} centro>{verServidor ? 'Ocultar dirección del servidor' : 'Cambiar dirección del servidor'}</Texto>
      </Pressable>
    </Pantalla>
  );
}
