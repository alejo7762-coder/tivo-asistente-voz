// Guarda la sesión de forma segura en el teléfono. En el navegador (solo para pruebas) usa localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const enWeb = Platform.OS === 'web';

export async function leer(clave) {
  try {
    return enWeb ? globalThis.localStorage?.getItem(clave) ?? null : await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}

export async function guardar(clave, valor) {
  try {
    if (enWeb) globalThis.localStorage?.setItem(clave, valor);
    else await SecureStore.setItemAsync(clave, valor);
  } catch {
    // Si el almacenamiento falla, la sesión dura hasta cerrar la app.
  }
}

export async function borrar(clave) {
  try {
    if (enWeb) globalThis.localStorage?.removeItem(clave);
    else await SecureStore.deleteItemAsync(clave);
  } catch {
    // nada que hacer
  }
}
