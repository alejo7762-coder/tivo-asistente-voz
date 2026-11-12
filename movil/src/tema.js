// Colores y medidas tomados del diseño de interfaz (figuras 3 a 9 del documento).
export const colores = {
  azulOscuro: '#1B2A4E',
  amarillo: '#F5EAA3',
  azulClaro: '#AFBFDF',
  azulMedio: '#7B94C8',
  gris: '#E1E5EA',
  blanco: '#FFFFFF',
  campo: '#E6E8F2',
  bordeCampo: '#8FA3D0',
  textoSuave: '#4A5568',
  verde: '#4CAF50',
  ambar: '#FFC107',
  rojo: '#D9534F',
  apagado: '#9AA3B2',
};

// Las tarjetas alternan estos tres colores, como en el diseño.
export const coloresTarjeta = [colores.azulClaro, colores.gris, colores.amarillo];

export const ESCALAS_LETRA = { normal: 1, grande: 1.15, extra_grande: 1.3 };

export const PIE = '© 2025 Asistente Voz — Proyecto UMB';

export const ESTADOS_HOY = {
  confirmado: { color: colores.verde, texto: 'Confirmado hoy' },
  pendiente: { color: colores.ambar, texto: 'Pendiente hoy' },
  omitido: { color: colores.rojo, texto: 'No se confirmó hoy' },
  sin_aviso_hoy: { color: colores.apagado, texto: 'Hoy no toca' },
  inactivo: { color: colores.apagado, texto: 'Desactivado' },
};
