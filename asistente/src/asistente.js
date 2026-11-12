// El "cerebro" de TIVO: recibe frases reconocidas, decide qué hacer y responde por voz.
import { ahoraLocal, horaHablada } from '../../compartido/horario.js';
import { esAfirmacion, esNegacion, interpretar, quitarPalabraClave } from './intenciones.js';
import { buscarHora, normalizar } from './texto.js';

const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const PASO_VOLUMEN = 15;
const MAX_ACLARACIONES = 2; // HU-RNF09

export class Asistente {
  constructor({ api, voz, ia, reproductor, planificador, pantalla, requierePalabraClave = false, ventanaEscuchaMs = 12_000, reloj = () => new Date() }) {
    Object.assign(this, { api, voz, ia, reproductor, planificador, pantalla, requierePalabraClave, ventanaEscuchaMs, reloj });
    this.despiertoHasta = 0;
    this.pendiente = null; // pregunta que TIVO hizo y espera respuesta
    this.aclaraciones = 0;
    this.diagnosticos = [];
    this.turno = Promise.resolve();
    this.mensajesAnunciados = new Set();
    this.avisoSinConexion = false;
    this.primeraRespuesta = null;
  }

  get config() { return this.api.datos.configuracion; }

  get ahora() { return ahoraLocal(this.config.zonaHoraria, this.reloj()); }

  get tratamiento() {
    const nombre = this.api.datos.dispositivo?.adultoNombre;
    return nombre ? `${nombre}, ` : '';
  }

  async decir(texto) {
    if (this.primeraRespuesta === null) this.primeraRespuesta = Date.now();
    const pausada = this.reproductor.pausar(); // la música se calla mientras TIVO habla
    await this.voz.decir(texto);
    if (pausada) this.reproductor.continuar();
  }

  mantenerDespierto() {
    this.despiertoHasta = this.reloj().getTime() + this.ventanaEscuchaMs;
  }

  /** Punto de entrada: una frase reconocida por el micrófono o escrita por teclado. */
  escuchar(texto) {
    // Con micrófono, se descarta lo que se oye mientras TIVO habla (su propia voz).
    if (this.requierePalabraClave && (this.voz.hablando || Date.now() - this.voz.finUltimaFrase < 700)) return this.turno;
    this.turno = this.turno.then(() => this.#procesar(texto)).catch((error) => {
      console.error('[asistente]', error);
      this.diagnosticos.push({ tipo: 'error', detalle: error.message, exito: false });
    });
    return this.turno;
  }

  async #procesar(texto) {
    let comando = String(texto ?? '').trim();
    if (!comando) return;
    const ahoraMs = this.reloj().getTime();

    if (this.requierePalabraClave && this.config.activacionPorVoz) {
      const resto = quitarPalabraClave(comando, this.config.palabraClave);
      const atento = ahoraMs < this.despiertoHasta || (this.pendiente && ahoraMs < this.pendiente.vence) || this.planificador.activos(this.reloj()).length > 0;
      if (resto !== null) {
        this.mantenerDespierto();
        this.pantalla.mostrar('escuchando');
        if (!resto) return this.decir('Dígame.');
        comando = resto;
      } else if (!atento) {
        return; // conversación ajena: TIVO no interviene
      }
    }

    const inicio = Date.now();
    this.primeraRespuesta = null;
    this.pantalla.mostrar('pensando');
    const { intencion, exito } = await this.#atender(comando);
    this.diagnosticos.push({ tipo: 'comando', intencion, latenciaMs: (this.primeraRespuesta ?? Date.now()) - inicio, exito });
    if (intencion !== 'despedida') this.mantenerDespierto();
  }

  async #atender(comando) {
    const interpretado = interpretar(comando, this.ahora);
    const { norm } = interpretado;
    let { intencion } = interpretado;

    // 1. ¿TIVO había hecho una pregunta?
    if (this.pendiente && this.reloj().getTime() < this.pendiente.vence) {
      const resuelto = await this.#responderPendiente(interpretado);
      if (resuelto) return resuelto;
    }
    this.pendiente = null;

    // 2. "Sí", "listo" o "ya lo tomé" después de un aviso confirman la toma.
    const activos = this.planificador.activos(this.reloj());
    if (activos.length && (intencion === 'confirmar_toma' || intencion === 'afirmacion')) {
      await this.planificador.confirmar(activos);
      await this.decir('Muy bien, queda anotado.');
      return { intencion: 'confirmar_toma', exito: true };
    }
    if (activos.length && intencion === 'negacion') {
      await this.decir(`Está bien. Se lo recuerdo de nuevo en ${this.config.repetirCadaMinutos} minutos.`);
      return { intencion: 'posponer', exito: true };
    }
    if (intencion === 'confirmar_toma') intencion = 'sin_aviso';

    const manejador = this.#manejadores[intencion];
    if (manejador) {
      this.aclaraciones = 0;
      const exito = (await manejador.call(this, interpretado.datos)) !== false;
      return { intencion, exito };
    }

    // 3. Nada local aplica: pregunta abierta para la IA, o pedir que repita.
    if (this.ia.disponible && norm.split(' ').length >= 3) {
      this.aclaraciones = 0;
      return { intencion: 'pregunta_ia', exito: await this.#preguntarIA(comando) };
    }
    return { intencion: 'desconocido', exito: await this.#pedirAclaracion() };
  }

  async #pedirAclaracion() {
    this.aclaraciones += 1;
    if (this.aclaraciones > MAX_ACLARACIONES) {
      this.aclaraciones = 0;
      this.pendiente = null;
      this.despiertoHasta = 0;
      await this.decir('No logré entenderle. Cuando quiera intentarlo de nuevo, diga: hola TIVO.');
    } else {
      await this.decir(this.aclaraciones === 1 ? 'No le entendí. ¿Me lo puede repetir?' : 'Disculpe, sigo sin entender. Dígalo con pocas palabras, por favor.');
    }
    return false;
  }

  async #preguntarIA(pregunta) {
    // Si la respuesta tarda más de 2 segundos, TIVO avisa que está trabajando (HU-RNF04).
    const aviso = setTimeout(() => { this.decir('Un momento, por favor.'); }, 2000);
    try {
      const { fecha, hora } = this.ahora;
      const respuesta = await this.ia.preguntar(pregunta, `Fecha y hora actuales: ${fecha} ${hora}. ${this.tratamiento ? `La persona se llama ${this.tratamiento.slice(0, -2)}.` : ''}`);
      clearTimeout(aviso);
      await this.decir(respuesta);
      return true;
    } catch (error) {
      clearTimeout(aviso);
      this.diagnosticos.push({ tipo: 'error', intencion: 'pregunta_ia', detalle: error.message, exito: false });
      await this.decir('En este momento no puedo consultar eso. Puede que no haya conexión a Internet.');
      return false;
    }
  }

  #preguntar(pendiente, frase) {
    this.pendiente = { ...pendiente, vence: this.reloj().getTime() + 60_000 };
    return this.decir(frase);
  }

  /** Devuelve { intencion, exito } si la frase respondió la pregunta pendiente; null si era otra cosa. */
  async #responderPendiente({ norm, intencion }) {
    const p = this.pendiente;
    const si = esAfirmacion(norm);
    const no = esNegacion(norm);

    if (p.tipo === 'confirmar_eliminar') {
      if (si) {
        this.pendiente = null;
        await this.api.eliminarRecordatorio(p.recordatorio.id);
        await this.decir(`Listo, eliminé el recordatorio: ${p.recordatorio.titulo}.`);
        return { intencion: 'eliminar_recordatorio', exito: true };
      }
      if (no) {
        this.pendiente = null;
        await this.decir('De acuerdo, no lo elimino.');
        return { intencion: 'eliminar_recordatorio', exito: true };
      }
    }

    if (p.tipo === 'pedir_hora') {
      if (no) {
        this.pendiente = null;
        await this.decir('De acuerdo, no creo el recordatorio.');
        return { intencion: 'crear_recordatorio', exito: true };
      }
      // Acepta "a las ocho", "las ocho de la noche" o solo "ocho".
      const hallada = buscarHora(norm) || buscarHora(`a las ${norm.replace(/^(?:a )?las? /, '')}`);
      if (hallada) {
        this.pendiente = null;
        await this.#crearRecordatorio({ ...p.datos, hora: hallada.hora });
        return { intencion: 'crear_recordatorio', exito: true };
      }
      if (intencion === 'desconocido') {
        p.intentos += 1;
        if (p.intentos >= MAX_ACLARACIONES) {
          this.pendiente = null;
          await this.decir('No entendí la hora, así que no creé el recordatorio. Puede intentarlo de nuevo cuando quiera.');
        } else {
          await this.#preguntar(p, 'No entendí la hora. Dígame, por ejemplo: a las ocho de la noche.');
        }
        return { intencion: 'crear_recordatorio', exito: false };
      }
    }

    if (p.tipo === 'ofrecer_mensajes') {
      if (si) {
        this.pendiente = null;
        await this.#leerMensajes();
        return { intencion: 'leer_mensajes', exito: true };
      }
      if (no) {
        this.pendiente = null;
        await this.decir('Está bien. Cuando quiera oírlo, diga: leer mensajes.');
        return { intencion: 'leer_mensajes', exito: true };
      }
    }
    return null;
  }

  // ---------- Qué hace TIVO con cada intención ----------

  #manejadores = {
    async saludo() { await this.decir(`Hola ${this.tratamiento}¿en qué le ayudo?`.replace(' , ', ', ')); },
    async gracias() { await this.decir('Con mucho gusto.'); },
    async despedida() { this.despiertoHasta = 0; await this.decir('Hasta luego. Aquí estaré cuando me necesite.'); },
    async afirmacion() { await this.decir('Estoy aquí. ¿En qué le ayudo?'); },
    async negacion() { await this.decir('De acuerdo.'); },
    async sin_aviso() { await this.decir('En este momento no tengo ningún aviso pendiente por confirmar.'); },
    async repetir() { await this.decir(this.ultimaRespuesta || 'Todavía no le he dicho nada.'); },

    async ayuda() {
      await this.decir('Puede preguntarme la hora o la fecha, pedirme que le recuerde algo, preguntar por sus medicamentos, '
        + 'pedir el teléfono de un familiar, oír sus mensajes o poner música. También puede hacerme preguntas.');
    },

    async hora() {
      const hablada = horaHablada(this.ahora.hora);
      await this.decir(`${hablada.startsWith('la ') ? 'Es' : 'Son'} ${hablada}.`);
    },

    async fecha() {
      const texto = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: this.config.zonaHoraria }).format(this.reloj());
      await this.decir(`Hoy es ${texto}.`);
    },

    async listar_recordatorios() {
      const { fecha, hora } = this.ahora;
      const agenda = this.planificador.agenda(fecha);
      if (!agenda.length) return this.decir('Hoy no tiene nada programado.');
      const faltan = agenda.filter((a) => a.hora >= hora || this.planificador.estadoDe(a) === 'anunciado');
      if (!faltan.length) return this.decir('Ya no le queda nada pendiente por hoy.');
      const frases = faltan.slice(0, 6).map((a) => `a ${horaHablada(a.hora)}, ${this.#nombreDe(a)}`);
      const cuenta = faltan.length === 1 ? 'Le queda una cosa por hoy' : `Le quedan ${faltan.length} cosas por hoy`;
      return this.decir(`${cuenta}: ${frases.join('; ')}.`);
    },

    async listar_medicamentos() {
      const activos = this.api.datos.medicamentos.filter((m) => m.activo);
      if (!activos.length) return this.decir('No tiene medicamentos registrados.');
      const frases = activos.map((m) => {
        const cuando = { diario: 'todos los días', cada_12_horas: 'cada 12 horas, empezando', cada_8_horas: 'cada 8 horas, empezando', semanal: `los ${DIAS_PLURAL[m.diaSemana]}` }[m.frecuencia];
        return `${m.nombre}${m.dosis ? ` de ${m.dosis}` : ''}, ${cuando} a ${horaHablada(m.hora)}`;
      });
      return this.decir(`Tiene ${activos.length === 1 ? 'un medicamento' : `${activos.length} medicamentos`}: ${frases.join('; ')}.`);
    },

    async crear_recordatorio(datos) {
      if (!datos.hora) return this.#preguntar({ tipo: 'pedir_hora', datos, intentos: 0 }, `¿A qué hora le recuerdo: ${datos.titulo}?`);
      return this.#crearRecordatorio(datos);
    },

    async eliminar_recordatorio({ consulta }) {
      const candidatos = this.api.datos.recordatorios;
      const palabras = normalizar(consulta).split(' ').filter((p) => p.length > 2);
      const coincidencias = candidatos
        .map((r) => ({ r, puntos: palabras.filter((p) => normalizar(r.titulo).includes(p)).length }))
        .filter((c) => c.puntos > 0)
        .sort((a, b) => b.puntos - a.puntos);
      const elegido = coincidencias[0]?.r ?? (candidatos.length === 1 && !palabras.length ? candidatos[0] : null);
      if (!elegido) {
        await this.decir(candidatos.length ? 'No encontré ese recordatorio. Dígame, por ejemplo: elimina el recordatorio de ejercicios.' : 'No tiene recordatorios guardados.');
        return false;
      }
      // Acción crítica: se pide confirmación antes de borrar (HU-RNF09).
      return this.#preguntar({ tipo: 'confirmar_eliminar', recordatorio: elegido }, `¿Quiere eliminar el recordatorio: ${elegido.titulo}, de ${horaHablada(elegido.hora)}? Diga sí o no.`);
    },

    async telefono_familiar({ quien }) {
      const familiar = this.#buscarFamiliar(quien);
      if (!familiar) {
        await this.decir('No tengo guardado ese contacto. Un familiar puede agregarlo desde la aplicación.');
        return false;
      }
      return this.decir(`El número de su ${familiar.relacion}, ${familiar.nombre}, es: ${this.#deletrear(familiar.telefono)}.`);
    },

    async llamar({ quien }) {
      const familiar = this.#buscarFamiliar(quien);
      if (!familiar) {
        await this.decir('No tengo guardado ese contacto. Un familiar puede agregarlo desde la aplicación.');
        return false;
      }
      return this.decir(`Yo no puedo hacer llamadas, pero le digo el número de su ${familiar.relacion}, ${familiar.nombre}: ${this.#deletrear(familiar.telefono)}.`);
    },

    async listar_familiares() {
      const { familiares } = this.api.datos;
      if (!familiares.length) return this.decir('Todavía no hay familiares guardados.');
      return this.decir(`Tengo guardados a: ${familiares.map((f) => `${f.nombre}, su ${f.relacion}`).join('; ')}.`);
    },

    async leer_mensajes() { return this.#leerMensajes(); },

    async musica_reproducir({ consulta }) {
      const canciones = this.reproductor.buscar(consulta);
      if (!canciones.length) {
        await this.decir(this.reproductor.canciones().length ? 'No encontré esa canción.' : 'Todavía no hay música guardada en el dispositivo.');
        return false;
      }
      await this.decir(consulta ? `Claro, aquí va: ${canciones[0].titulo}.` : 'Claro, aquí va la música. Para detenerla diga: hola TIVO, para la música.');
      this.reproductor.reproducir(canciones);
      return true;
    },

    async musica_pausar() {
      const habia = this.reproductor.sonando;
      await this.decir(habia ? 'Música en pausa.' : 'No hay música sonando.');
      if (habia) this.reproductor.pausar();
    },

    async musica_continuar() {
      if (!this.reproductor.sonando) return this.decir('No hay música en pausa.');
      this.reproductor.continuar();
      return undefined;
    },

    async musica_detener() {
      const habia = this.reproductor.detener();
      await this.decir(habia ? 'Listo, detuve la música.' : 'De acuerdo.');
    },

    async volumen_subir() { return this.#cambiarVolumen(this.config.volumen + PASO_VOLUMEN); },
    async volumen_bajar() { return this.#cambiarVolumen(this.config.volumen - PASO_VOLUMEN); },
    async volumen_fijar({ volumen }) { return this.#cambiarVolumen(volumen); },
  };

  get ultimaRespuesta() { return this.voz.ultimaFrase; }

  #nombreDe(aviso) {
    const e = aviso.elemento;
    return aviso.origen === 'medicamento' ? `tomar ${e.nombre}${e.dosis ? ` de ${e.dosis}` : ''}` : e.titulo;
  }

  #buscarFamiliar(quien) {
    const buscado = normalizar(quien).replace(/^(?:mi|la|el|a) /, '');
    return this.api.datos.familiares.find((f) => {
      const relacion = normalizar(f.relacion);
      const nombre = normalizar(f.nombre);
      return buscado.includes(relacion) || buscado.includes(nombre.split(' ')[0]);
    });
  }

  /** "300 555 0101" -> "3 0 0, 5 5 5, 0 1 0 1" para que se oiga dígito por dígito. */
  #deletrear(telefono) {
    const digitos = telefono.replace(/\D/g, '');
    const grupos = digitos.length === 10 ? [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6)] : digitos.match(/.{1,3}/g) ?? [];
    return grupos.map((g) => g.split('').join(' ')).join(', ');
  }

  async #cambiarVolumen(valor) {
    const volumen = Math.max(10, Math.min(100, Math.round(valor)));
    await this.api.fijarVolumen(volumen);
    this.voz.configurar({ volumen });
    await this.decir(`Volumen al ${volumen} por ciento.`);
  }

  async #crearRecordatorio(datos) {
    const creado = await this.api.crearRecordatorio(datos);
    const { fecha } = this.ahora;
    let cuando;
    if (datos.repeticion === 'diario') cuando = 'todos los días';
    else if (datos.repeticion === 'semanal') cuando = `los ${datos.diasSemana.map((d) => DIAS_PLURAL[d]).join(' y ')}`;
    else cuando = datos.fecha === fecha ? 'hoy' : new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${datos.fecha}T12:00:00Z`));
    const manana = datos.repeticion === 'una_vez' && datos.fecha !== fecha && this.#esManana(datos.fecha) ? 'mañana' : cuando;
    await this.decir(`Listo. Le recordaré: ${creado.titulo}, ${manana} a ${horaHablada(datos.hora)}.`);
  }

  #esManana(fecha) {
    const d = new Date(`${this.ahora.fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10) === fecha;
  }

  async #leerMensajes() {
    const mensajes = [...this.api.datos.mensajes].reverse(); // del más antiguo al más nuevo
    if (!mensajes.length) return this.decir('No tiene mensajes nuevos.');
    for (const mensaje of mensajes) {
      await this.decir(`Mensaje de ${mensaje.autor}: ${mensaje.texto}`);
      await this.api.marcarMensajeEscuchado(mensaje.id);
    }
    return this.decir(mensajes.length === 1 ? 'Ese era el mensaje.' : 'Esos eran todos los mensajes.');
  }

  // ---------- Tareas periódicas ----------

  /** Anuncia recordatorios y medicamentos que tocan ahora. */
  anunciarAvisos() {
    this.turno = this.turno.then(async () => {
      const avisos = await this.planificador.revisar(this.reloj());
      if (!avisos.length) return;
      this.pantalla.mostrar('aviso', avisos.map((a) => this.#nombreDe(a)).join(' · '));
      for (const aviso of avisos) {
        const insistencia = aviso.repeticion > 1 ? 'le recuerdo de nuevo: ' : '';
        if (aviso.origen === 'medicamento') {
          await this.decir(`${this.tratamiento}${insistencia}es hora de ${this.#nombreDe(aviso)}. Cuando lo haya tomado, dígame: ya lo tomé.`);
        } else {
          await this.decir(`${this.tratamiento}${insistencia}tiene un recordatorio: ${aviso.elemento.titulo}. Cuando lo haya hecho, dígame: listo.`);
        }
      }
      this.mantenerDespierto();
    }).catch((error) => console.error('[avisos]', error));
    return this.turno;
  }

  /** Después de cada sincronización: aplica la configuración y avisa de mensajes nuevos o de falta de conexión. */
  trasSincronizar(conectado) {
    this.voz.configurar(this.config);
    this.turno = this.turno.then(async () => {
      const horaLocal = Number(this.ahora.hora.slice(0, 2));
      const horarioDiurno = horaLocal >= 7 && horaLocal < 21; // de noche TIVO no habla por su cuenta

      if (!conectado && !this.avisoSinConexion && horarioDiurno) {
        this.avisoSinConexion = true;
        this.pantalla.mostrar('sin_conexion');
        await this.decir('No tengo conexión a Internet. Sus recordatorios siguen funcionando, pero no podré responder preguntas nuevas.');
      } else if (conectado) {
        this.avisoSinConexion = false;
      }

      const nuevos = this.api.datos.mensajes.filter((m) => !this.mensajesAnunciados.has(m.id));
      if (nuevos.length && horarioDiurno && !this.pendiente) {
        nuevos.forEach((m) => this.mensajesAnunciados.add(m.id));
        const autores = [...new Set(nuevos.map((m) => m.autor))].join(' y ');
        await this.#preguntar({ tipo: 'ofrecer_mensajes' }, `${this.tratamiento}tiene ${nuevos.length === 1 ? 'un mensaje nuevo' : `${nuevos.length} mensajes nuevos`} de ${autores}. ¿Quiere que se lo lea?`);
        this.mantenerDespierto();
      }
    }).catch((error) => console.error('[sincronización]', error));
    return this.turno;
  }

  tomarDiagnosticos() {
    const eventos = this.diagnosticos;
    this.diagnosticos = [];
    return eventos;
  }
}
