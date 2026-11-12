// Piezas de interfaz compartidas por todas las pantallas.
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSesion } from './contexto';
import { PIE, colores } from './tema';

const logo = require('../assets/tivo.png');

/** Texto que respeta el tamaño de letra elegido en Configuración. */
export function Texto({ tam = 16, negrita = false, cursiva = false, color = colores.azulOscuro, centro = false, style, ...resto }) {
  const { escala } = useSesion();
  return (
    <Text
      style={[{ fontSize: tam * escala, color, fontWeight: negrita ? '700' : '400', fontStyle: cursiva ? 'italic' : 'normal', textAlign: centro ? 'center' : 'left' }, style]}
      {...resto}
    />
  );
}

export function Logo({ alto = 120 }) {
  return <Image source={logo} style={{ height: alto, width: alto * 1.07 }} resizeMode="contain" accessibilityLabel="Robot TIVO" />;
}

const SECCIONES = [
  ['Panel', 'Panel principal'],
  ['Recordatorios', 'Recordatorios'],
  ['Medicamentos', 'Toma de medicamentos'],
  ['Familiares', 'Familiares'],
  ['Mensajes', 'Mensajes'],
  ['Estado', 'Estado del dispositivo'],
  ['Configuracion', 'Configuración'],
  ['Diagnostico', 'Diagnóstico del asistente'],
  ['Ayuda', 'Ayuda y soporte'],
];

function Encabezado({ atras }) {
  const navegacion = useNavigation();
  const margen = useSafeAreaInsets();
  const { salir } = useSesion();
  const [menu, setMenu] = useState(false);
  const ir = (pantalla) => { setMenu(false); navegacion.navigate(pantalla); };

  return (
    <View style={[estilos.encabezado, { paddingTop: margen.top + 10 }]}>
      {atras ? (
        <Pressable onPress={() => navegacion.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.atras}>
          <Text style={estilos.flecha}>‹</Text>
        </Pressable>
      ) : null}
      <Logo alto={52} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Texto tam={17} negrita cursiva color={colores.blanco}>TIVO</Texto>
        <Texto tam={13} color={colores.amarillo}>Asistente de voz inteligente</Texto>
      </View>
      <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Abrir menú" style={{ padding: 6 }}>
        {[0, 1, 2].map((i) => <View key={i} style={estilos.rayaMenu} />)}
      </Pressable>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={estilos.fondoMenu} onPress={() => setMenu(false)} accessibilityLabel="Cerrar menú">
          <View style={[estilos.menu, { marginTop: margen.top + 8 }]}>
            {SECCIONES.map(([pantalla, nombre]) => (
              <Pressable key={pantalla} onPress={() => ir(pantalla)} style={estilos.opcionMenu} accessibilityRole="button">
                <Texto tam={17} negrita>{nombre}</Texto>
              </Pressable>
            ))}
            <Pressable onPress={() => { setMenu(false); salir(); }} style={[estilos.opcionMenu, { borderBottomWidth: 0 }]} accessibilityRole="button">
              <Texto tam={17} negrita color={colores.rojo}>Cerrar sesión</Texto>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Marco de cada pantalla: encabezado, título, contenido desplazable y pie. */
export function Pantalla({ titulo, subtitulo, fondo = colores.blanco, atras = true, sinEncabezado = false, alRefrescar, refrescando = false, children }) {
  const margen = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: fondo }}>
      {sinEncabezado ? <View style={{ height: margen.top }} /> : <Encabezado atras={atras} />}
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={alRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={colores.azulOscuro} /> : undefined}
      >
        <View style={estilos.columna}>
          {titulo ? <Texto tam={24} negrita cursiva centro style={{ marginTop: 22, marginBottom: subtitulo ? 4 : 18 }} accessibilityRole="header">{titulo}</Texto> : null}
          {subtitulo ? <Texto tam={15} color={colores.textoSuave} centro style={{ marginBottom: 18 }}>{subtitulo}</Texto> : null}
          {children}
        </View>
        <Texto tam={12} color={colores.textoSuave} centro style={{ marginTop: 28 }}>{PIE}</Texto>
      </ScrollView>
    </View>
  );
}

export function Boton({ texto, alPresionar, color = colores.azulOscuro, colorTexto = colores.amarillo, cargando = false, deshabilitado = false, style }) {
  return (
    <Pressable
      onPress={alPresionar}
      disabled={cargando || deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => [estilos.boton, { backgroundColor: color, opacity: pressed || deshabilitado ? 0.7 : 1 }, style]}
    >
      {cargando ? <ActivityIndicator color={colorTexto} /> : <Texto tam={18} negrita cursiva color={colorTexto} centro>{texto}</Texto>}
    </Pressable>
  );
}

export function Punto({ color }) {
  return <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color }} />;
}

/** Tarjeta de una lista: título, detalle y, a la derecha, un punto de estado. */
export function Tarjeta({ titulo, detalle, color, colorPunto, estado, alPresionar, izquierda }) {
  const Contenedor = alPresionar ? Pressable : View;
  return (
    <Contenedor
      onPress={alPresionar}
      accessibilityRole={alPresionar ? 'button' : undefined}
      accessibilityLabel={[titulo, detalle, estado].filter(Boolean).join('. ')}
      style={[estilos.tarjeta, { backgroundColor: color }]}
    >
      {izquierda}
      <View style={{ flex: 1 }}>
        <Texto tam={18} negrita cursiva>{titulo}</Texto>
        {detalle ? <Texto tam={15} color={colores.textoSuave} style={{ marginTop: 4 }}>{detalle}</Texto> : null}
        {estado ? <Texto tam={13} color={colores.textoSuave} style={{ marginTop: 2 }}>{estado}</Texto> : null}
      </View>
      {colorPunto ? <Punto color={colorPunto} /> : null}
    </Contenedor>
  );
}

export function Etiqueta({ children }) {
  return <Texto tam={16} negrita cursiva style={{ marginTop: 14, marginBottom: 6, marginLeft: 4 }}>{children}</Texto>;
}

export function Campo({ etiqueta, valor, alCambiar, style, ...resto }) {
  const { escala } = useSesion();
  return (
    <View>
      <Etiqueta>{etiqueta}</Etiqueta>
      <TextInput
        value={valor}
        onChangeText={alCambiar}
        accessibilityLabel={etiqueta}
        placeholderTextColor="#7A8499"
        style={[estilos.campo, { fontSize: 17 * escala }, style]}
        {...resto}
      />
    </View>
  );
}

/** Varias opciones en fila, de las que se elige una (o varias con `multiple`). */
export function Opciones({ etiqueta, opciones, valor, alCambiar, multiple = false }) {
  const elegida = (v) => (multiple ? valor.includes(v) : valor === v);
  const alTocar = (v) => {
    if (!multiple) return alCambiar(v);
    return alCambiar(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);
  };
  return (
    <View>
      {etiqueta ? <Etiqueta>{etiqueta}</Etiqueta> : null}
      <View style={estilos.opciones}>
        {opciones.map(([v, nombre]) => (
          <Pressable
            key={String(v)}
            onPress={() => alTocar(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: elegida(v) }}
            accessibilityLabel={nombre}
            style={[estilos.opcion, elegida(v) && estilos.opcionElegida]}
          >
            <Texto tam={15} negrita={elegida(v)} color={elegida(v) ? colores.amarillo : colores.azulOscuro} centro>{nombre}</Texto>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Paso({ texto, alPresionar, etiqueta }) {
  return (
    <Pressable onPress={alPresionar} accessibilityRole="button" accessibilityLabel={etiqueta} style={estilos.paso} hitSlop={6}>
      <Text style={estilos.pasoTexto}>{texto}</Text>
    </Pressable>
  );
}

/** Selector de hora con botones grandes (más fácil que una rueda para quien tiene poca precisión). */
export function SelectorHora({ etiqueta = 'Hora', valor, alCambiar }) {
  const [h, m] = valor.split(':').map(Number);
  const fijar = (hora, minuto) => alCambiar(`${String((hora + 24) % 24).padStart(2, '0')}:${String((minuto + 60) % 60).padStart(2, '0')}`);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const franja = (tarde) => (
    <Pressable
      onPress={() => { if ((h >= 12) !== tarde) fijar(h + 12, m); }}
      accessibilityRole="button"
      accessibilityState={{ selected: (h >= 12) === tarde }}
      accessibilityLabel={tarde ? 'PM, tarde o noche' : 'AM, mañana'}
      style={[estilos.opcion, (h >= 12) === tarde && estilos.opcionElegida]}
    >
      <Texto tam={15} negrita color={(h >= 12) === tarde ? colores.amarillo : colores.azulOscuro} centro>{tarde ? 'PM' : 'AM'}</Texto>
    </Pressable>
  );
  return (
    <View>
      <Etiqueta>{etiqueta}</Etiqueta>
      <View style={estilos.selector}>
        <Paso texto="−" etiqueta="Una hora menos" alPresionar={() => fijar(h - 1, m)} />
        <Texto tam={26} negrita style={{ minWidth: 44 }} centro numberOfLines={1}>{h12}</Texto>
        <Paso texto="+" etiqueta="Una hora más" alPresionar={() => fijar(h + 1, m)} />
        <Texto tam={26} negrita>:</Texto>
        <Paso texto="−" etiqueta="Cinco minutos menos" alPresionar={() => fijar(h, m - 5)} />
        <Texto tam={26} negrita style={{ minWidth: 44 }} centro numberOfLines={1}>{String(m).padStart(2, '0')}</Texto>
        <Paso texto="+" etiqueta="Cinco minutos más" alPresionar={() => fijar(h, m + 5)} />
      </View>
      <View style={[estilos.opciones, { marginTop: 8 }]}>{franja(false)}{franja(true)}</View>
    </View>
  );
}

/** Valor numérico con botones de menos y más (volumen). */
export function Contador({ etiqueta, valor, alCambiar, paso = 5, minimo = 0, maximo = 100, sufijo = '' }) {
  const fijar = (v) => alCambiar(Math.max(minimo, Math.min(maximo, v)));
  return (
    <View>
      <Etiqueta>{etiqueta}</Etiqueta>
      <View style={estilos.selector}>
        <Paso texto="−" etiqueta={`Bajar ${etiqueta}`} alPresionar={() => fijar(valor - paso)} />
        <Texto tam={22} negrita centro style={{ flex: 1 }}>{valor}{sufijo}</Texto>
        <Paso texto="+" etiqueta={`Subir ${etiqueta}`} alPresionar={() => fijar(valor + paso)} />
      </View>
    </View>
  );
}

export function fechaLocal(desplazamientoDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fechaLegible(fecha) {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function SelectorFecha({ etiqueta = 'Fecha', valor, alCambiar }) {
  const mover = (dias) => {
    const d = new Date(`${valor}T12:00:00`);
    d.setDate(d.getDate() + dias);
    const nueva = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (nueva >= fechaLocal()) alCambiar(nueva);
  };
  const nombre = valor === fechaLocal() ? 'Hoy' : valor === fechaLocal(1) ? 'Mañana' : fechaLegible(valor);
  return (
    <View>
      <Etiqueta>{etiqueta}</Etiqueta>
      <View style={estilos.selector}>
        <Paso texto="−" etiqueta="Día anterior" alPresionar={() => mover(-1)} />
        <Texto tam={18} negrita centro style={{ flex: 1 }}>{nombre}</Texto>
        <Paso texto="+" etiqueta="Día siguiente" alPresionar={() => mover(1)} />
      </View>
    </View>
  );
}

export function Aviso({ texto, tipo = 'error' }) {
  if (!texto) return null;
  return (
    <View style={[estilos.aviso, { borderColor: tipo === 'error' ? colores.rojo : colores.verde }]} accessibilityLiveRegion="polite">
      <Texto tam={15} color={tipo === 'error' ? '#8A1F1B' : '#1E5E22'}>{texto}</Texto>
    </View>
  );
}

export function Vacio({ texto }) {
  return <Texto tam={16} color={colores.textoSuave} centro style={{ marginVertical: 24 }}>{texto}</Texto>;
}

/** Pregunta antes de una acción que no se puede deshacer. */
export function confirmar(titulo, mensaje, textoAccion = 'Eliminar') {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
      { text: textoAccion, style: 'destructive', onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) });
  });
}

/** Carga datos de la API cada vez que la pantalla queda visible. */
export function useDatos(ruta, { cadaMs } = {}) {
  const { api } = useSesion();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async (manual = false) => {
    if (manual) setRefrescando(true);
    try {
      setDatos(await api('GET', ruta));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setRefrescando(false);
    }
  }, [api, ruta]);

  useFocusEffect(useCallback(() => {
    cargar();
    if (!cadaMs) return undefined;
    const reloj = setInterval(cargar, cadaMs);
    return () => clearInterval(reloj);
  }, [cargar, cadaMs]));

  return { datos, error, refrescando, recargar: () => cargar(true) };
}

const estilos = StyleSheet.create({
  encabezado: { backgroundColor: colores.azulOscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  atras: { paddingRight: 8, paddingVertical: 4 },
  flecha: { color: colores.blanco, fontSize: 40, lineHeight: 42, fontWeight: '300' },
  rayaMenu: { width: 34, height: 4, borderRadius: 2, backgroundColor: colores.blanco, marginVertical: 3 },
  fondoMenu: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', alignItems: 'flex-end' },
  menu: { backgroundColor: colores.blanco, borderRadius: 16, marginRight: 12, paddingVertical: 6, minWidth: 260 },
  opcionMenu: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD2DE' },
  contenido: { flexGrow: 1, paddingHorizontal: 24 },
  columna: { width: '100%', maxWidth: 480, alignSelf: 'center', flexGrow: 1 },
  boton: { minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, marginTop: 14 },
  tarjeta: { borderRadius: 16, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 78 },
  campo: { backgroundColor: colores.campo, borderColor: colores.bordeCampo, borderWidth: 1, borderRadius: 12, minHeight: 54, paddingHorizontal: 14, color: colores.azulOscuro },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: { flexGrow: 1, minHeight: 50, borderRadius: 12, backgroundColor: colores.gris, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  opcionElegida: { backgroundColor: colores.azulOscuro },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colores.gris, borderRadius: 12, padding: 8, minHeight: 62 },
  paso: { width: 46, height: 46, borderRadius: 23, backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 26, lineHeight: 30, color: colores.azulOscuro, fontWeight: '700' },
  aviso: { borderWidth: 1.5, borderRadius: 12, padding: 12, marginTop: 14, backgroundColor: colores.blanco },
});
