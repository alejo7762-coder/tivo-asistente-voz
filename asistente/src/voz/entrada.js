// Entrada de comandos: por teclado (para probar) o por micrófono con Vosk (reconocimiento local).
import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const GANANCIA = { baja: 0.6, media: 1.0, alta: 1.8 };

export class EntradaTexto {
  constructor() {
    this.activa = true;
    this.requierePalabraClave = false;
  }

  iniciar(alEscuchar, alCerrar = () => process.exit(0)) {
    const consola = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Usted: ' });
    console.log('Modo texto: escriba lo que le diría a TIVO y presione Enter. (Ctrl+C para salir)\n');
    consola.prompt();
    let turno = Promise.resolve();
    consola.on('line', (linea) => {
      turno = turno.then(() => alEscuchar(linea)).then(() => consola.prompt());
    });
    consola.on('close', () => turno.then(alCerrar));
  }

  configurar() {}
}

export class EntradaVosk {
  constructor({ rutaModelo, microfono }) {
    this.rutaModelo = rutaModelo;
    this.microfono = microfono;
    this.sensibilidad = 'media';
    this.activa = false;
    this.requierePalabraClave = true;
    this.proceso = null;
  }

  iniciar(alEscuchar) {
    this.alEscuchar = alEscuchar;
    this.#lanzar();
  }

  /** Si cambia la sensibilidad del micrófono desde la app, se reinicia la escucha con la nueva ganancia. */
  configurar({ sensibilidadMicrofono }) {
    if (sensibilidadMicrofono && sensibilidadMicrofono !== this.sensibilidad) {
      this.sensibilidad = sensibilidadMicrofono;
      if (this.proceso) this.proceso.kill();
    }
  }

  #lanzar() {
    const guion = path.join(path.dirname(fileURLToPath(import.meta.url)), 'escucha_vosk.py');
    const argumentos = [guion, '--modelo', this.rutaModelo, '--ganancia', String(GANANCIA[this.sensibilidad] ?? 1)];
    if (this.microfono) argumentos.push('--microfono', this.microfono);
    this.proceso = spawn('python3', argumentos, { stdio: ['ignore', 'pipe', 'pipe'] });

    readline.createInterface({ input: this.proceso.stdout }).on('line', (linea) => {
      let evento;
      try { evento = JSON.parse(linea); } catch { return; }
      if (evento.evento === 'listo') {
        this.activa = true;
        console.log('[micrófono] Escuchando.');
      } else if (evento.texto) {
        this.alEscuchar(evento.texto);
      }
    });
    readline.createInterface({ input: this.proceso.stderr }).on('line', (linea) => {
      if (!linea.startsWith('LOG ')) console.error(`[micrófono] ${linea}`);
    });
    this.proceso.on('error', (error) => console.error(`[micrófono] No se pudo iniciar python3: ${error.message}`));
    // Si la escucha se cae, se vuelve a levantar sola (HU-RNF05).
    this.proceso.on('close', () => {
      this.activa = false;
      this.proceso = null;
      setTimeout(() => this.#lanzar(), 3000);
    });
  }
}
