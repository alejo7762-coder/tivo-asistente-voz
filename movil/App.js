import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProveedorSesion, useSesion } from './src/contexto';
import Ayuda from './src/pantallas/Ayuda';
import Configuracion from './src/pantallas/Configuracion';
import Diagnostico from './src/pantallas/Diagnostico';
import EstadoDispositivo from './src/pantallas/EstadoDispositivo';
import Familiares from './src/pantallas/Familiares';
import FormularioFamiliar from './src/pantallas/FormularioFamiliar';
import FormularioMedicamento from './src/pantallas/FormularioMedicamento';
import FormularioRecordatorio from './src/pantallas/FormularioRecordatorio';
import Ingreso from './src/pantallas/Ingreso';
import Medicamentos from './src/pantallas/Medicamentos';
import Mensajes from './src/pantallas/Mensajes';
import PanelPrincipal from './src/pantallas/PanelPrincipal';
import Recordatorios from './src/pantallas/Recordatorios';
import Registro from './src/pantallas/Registro';
import { colores } from './src/tema';

const Pila = createNativeStackNavigator();

function Navegacion() {
  const { cargando, usuario } = useSesion();
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.amarillo }}>
        <ActivityIndicator size="large" color={colores.azulOscuro} />
      </View>
    );
  }
  return (
    <Pila.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {usuario ? (
        <>
          <Pila.Screen name="Panel" component={PanelPrincipal} />
          <Pila.Screen name="Recordatorios" component={Recordatorios} />
          <Pila.Screen name="FormularioRecordatorio" component={FormularioRecordatorio} />
          <Pila.Screen name="Medicamentos" component={Medicamentos} />
          <Pila.Screen name="FormularioMedicamento" component={FormularioMedicamento} />
          <Pila.Screen name="Familiares" component={Familiares} />
          <Pila.Screen name="FormularioFamiliar" component={FormularioFamiliar} />
          <Pila.Screen name="Mensajes" component={Mensajes} />
          <Pila.Screen name="Estado" component={EstadoDispositivo} />
          <Pila.Screen name="Configuracion" component={Configuracion} />
          <Pila.Screen name="Diagnostico" component={Diagnostico} />
          <Pila.Screen name="Ayuda" component={Ayuda} />
        </>
      ) : (
        <>
          <Pila.Screen name="Ingreso" component={Ingreso} />
          <Pila.Screen name="Registro" component={Registro} />
        </>
      )}
    </Pila.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Navegacion />
        </NavigationContainer>
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}
