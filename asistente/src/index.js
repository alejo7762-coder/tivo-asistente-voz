// Arranque del asistente TIVO.
import { ClienteApi } from './api.js';
import { Asistente } from './asistente.js';
import { config } from './config.js';
import { medirEstado } from './estado.js';
import { AsistenteIA } from './ia.js';
import { Pantalla } from './pantalla.js';
import { Planificador } from './planificador.js';
import { Reproductor } from './reproductor.js';
import { EntradaTexto, EntradaVosk } from './voz/entrada.js';
import { SalidaVoz } from './voz/salida.js';

const inicio = new Date().toISOString();

if (!config.tokenDispositivo) {
  console.warn('[config] Falta TOKEN_DISPOSITIVO en asistente/.env: TIVO funcionará sin sincronizar con la app.');
}

const pantalla = new Pantalla({ comando: config.comandoPantalla });
const voz = new SalidaVoz({ modo: config.salida, piperModelo: config.piperModelo, alCambiar: (estado, texto) => pantalla.mostrar(estado, texto) });
const api = new ClienteApi({ urlApi: config.urlApi, token: config.tokenDispositivo, rutaDatos: config.rutaDatos });
const entrada = config.entrada === 'vosk' ? new EntradaVosk({ rutaModelo: config.rutaModeloVosk, microfono: config.microfono }) : new EntradaTexto();
const asistente = new Asistente({
  api,
  voz,
  pantalla,
  ia: new AsistenteIA({ clave: config.claveOpenAI, modelo: config.modeloIA }),
  reproductor: new Reproductor({ rutaMusica: config.rutaMusica }),
  planificador: new Planificador({ api, rutaDatos: config.rutaDatos }),
  requierePalabraClave: entrada.requierePalabraClave,
  ventanaEscuchaMs: config.ventanaEscuchaMs,
});

async function sincronizar() {
  const conectado = config.tokenDispositivo ? await api.sincronizar() : false;
  if (!conectado && api.ultimoError && config.tokenDispositivo) console.error(`[api] Sin conexión con la API: ${api.ultimoError}`);
  entrada.configurar(api.datos.configuracion);
  // Solo se le avisa a la persona cuando de verdad falta la red, no por un error de configuración.
  await asistente.trasSincronizar(conectado || !config.tokenDispositivo || api.rechazado);
  if (conectado) {
    await api.enviarEstado(await medirEstado({ entrada, voz, pantalla, config, volumen: api.datos.configuracion.volumen, inicio }));
    const eventos = asistente.tomarDiagnosticos();
    if (!(await api.enviarDiagnostico(eventos))) asistente.diagnosticos.unshift(...eventos);
  }
}

console.log(`TIVO ${config.version} — entrada: ${config.entrada}, voz: ${config.salida}, API: ${config.urlApi}`);
if (config.tokenDispositivo) await api.sincronizar(); // primero la configuración (volumen, velocidad de la voz)
voz.configurar(api.datos.configuracion);
await voz.decir(entrada.requierePalabraClave ? 'Hola, soy TIVO. Para hablar conmigo diga: hola TIVO.' : 'Hola, soy TIVO. ¿En qué le ayudo?');
await sincronizar();
await asistente.anunciarAvisos();

setInterval(sincronizar, config.sincronizarCadaMs);
setInterval(() => asistente.anunciarAvisos(), config.revisarAvisosCadaMs);
// Al apagar se envía lo que quedó pendiente del diagnóstico.
async function apagar() {
  if (config.tokenDispositivo) await api.enviarDiagnostico(asistente.tomarDiagnosticos());
  process.exit(0);
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);

entrada.iniciar((texto) => asistente.escuchar(texto), apagar);

// Un error inesperado no debe apagar el asistente (HU-RNF05).
process.on('uncaughtException', (error) => console.error('[error]', error));
process.on('unhandledRejection', (error) => console.error('[error]', error));
