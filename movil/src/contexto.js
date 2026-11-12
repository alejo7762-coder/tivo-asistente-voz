import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { borrar, guardar, leer } from './almacen';
import { URL_INICIAL, normalizarUrl, pedir } from './api';
import { ESCALAS_LETRA } from './tema';

const Sesion = createContext(null);
export const useSesion = () => useContext(Sesion);

export function ProveedorSesion({ children }) {
  const [cargando, setCargando] = useState(true);
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [urlApi, setUrlApi] = useState(URL_INICIAL);
  const [tamanoLetra, setTamanoLetra] = useState('grande');

  const salir = useCallback(async () => {
    setToken(null);
    setUsuario(null);
    await borrar('tivo_token');
  }, []);

  // Al abrir la app se recupera la sesión guardada.
  useEffect(() => {
    (async () => {
      const url = (await leer('tivo_url')) || URL_INICIAL;
      const guardado = await leer('tivo_token');
      const letra = await leer('tivo_letra');
      setUrlApi(url);
      if (letra) setTamanoLetra(letra);
      if (guardado) {
        try {
          const { usuario: u } = await pedir(url, 'GET', '/auth/yo', { token: guardado });
          setToken(guardado);
          setUsuario(u);
        } catch (error) {
          if (error.estado === 401) await borrar('tivo_token');
          else { setToken(guardado); setUsuario({ nombre: '', rol: 'familiar' }); } // sin red: se entra con la sesión guardada
        }
      }
      setCargando(false);
    })();
  }, []);

  const valor = useMemo(() => {
    const abrir = async (ruta, cuerpo) => {
      const datos = await pedir(urlApi, 'POST', ruta, { cuerpo });
      await guardar('tivo_token', datos.token);
      setToken(datos.token);
      setUsuario(datos.usuario);
    };
    return {
      cargando,
      usuario,
      urlApi,
      escala: ESCALAS_LETRA[tamanoLetra] ?? 1,
      puedeEditar: usuario?.rol !== 'usuario',
      ingresar: (correo, clave) => abrir('/auth/ingresar', { correo, clave }),
      registrar: (datos) => abrir('/auth/registro', datos),
      salir,
      cambiarUrl: async (url) => {
        const limpia = normalizarUrl(url) || URL_INICIAL;
        setUrlApi(limpia);
        await guardar('tivo_url', limpia);
        return limpia;
      },
      aplicarTamanoLetra: async (valorNuevo) => {
        setTamanoLetra(valorNuevo);
        await guardar('tivo_letra', valorNuevo);
      },
      // Llamada autenticada; si la sesión venció, vuelve a la pantalla de ingreso.
      api: async (metodo, ruta, cuerpo) => {
        try {
          return await pedir(urlApi, metodo, ruta, { cuerpo, token });
        } catch (error) {
          if (error.estado === 401) await salir();
          throw error;
        }
      },
    };
  }, [cargando, usuario, urlApi, token, tamanoLetra, salir]);

  return <Sesion.Provider value={valor}>{children}</Sesion.Provider>;
}
