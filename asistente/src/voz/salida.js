// Síntesis de voz. Todas las frases pasan por una cola para que nunca se pisen.
import { spawn } from 'node:child_process';

function ejecutar(comando, argumentos, entrada) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(comando, argumentos, { stdio: [entrada === undefined ? 'ignore' : 'pipe', 'ignore', 'ignore'] });
    proceso.on('error', rechazar);
    proceso.on('close', (codigo) => (codigo === 0 ? resolver() : rechazar(new Error(`${comando} terminó con código ${codigo}`))));
    if (entrada !== undefined) proceso.stdin.end(entrada);
  });
}

function piper(texto, modelo, lenta) {
  return new Promise((resolver, rechazar) => {
    const sintetizador = spawn('piper', ['--model', modelo, '--output-raw', '--length_scale', lenta ? '1.25' : '1.0'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const parlante = spawn('aplay', ['-q', '-r', '22050', '-f', 'S16_LE', '-t', 'raw', '-'], { stdio: ['pipe', 'ignore', 'ignore'] });
    sintetizador.stdout.pipe(parlante.stdin);
    sintetizador.on('error', rechazar);
    parlante.on('error', rechazar);
    parlante.on('close', (codigo) => (codigo === 0 ? resolver() : rechazar(new Error('aplay falló'))));
    sintetizador.stdin.end(texto);
  });
}

export class SalidaVoz {
  constructor({ modo = 'consola', piperModelo, alCambiar = () => {} } = {}) {
    this.modo = modo;
    this.piperModelo = piperModelo;
    this.alCambiar = alCambiar;
    this.cola = Promise.resolve();
    this.hablando = false;
    this.finUltimaFrase = 0;
    this.funciona = true;
    this.velocidad = 'lenta';
    this.volumen = 70;
    this.ultimaFrase = '';
  }

  configurar({ velocidadVoz, volumen }) {
    if (velocidadVoz) this.velocidad = velocidadVoz;
    if (typeof volumen === 'number' && volumen !== this.volumen) {
      this.volumen = volumen;
      // Volumen general del sistema en la Raspberry Pi (se ignora si no existe amixer).
      if (process.platform === 'linux' && this.modo !== 'consola') ejecutar('amixer', ['-q', 'sset', 'Master', `${volumen}%`]).catch(() => {});
    }
  }

  /** Dice una frase y espera a que termine. */
  decir(texto) {
    this.ultimaFrase = texto;
    this.cola = this.cola.then(() => this.#decirAhora(texto));
    return this.cola;
  }

  async #decirAhora(texto) {
    this.hablando = true;
    this.alCambiar('hablando', texto);
    console.log(`\n  TIVO: ${texto}\n`);
    const lenta = this.velocidad === 'lenta';
    try {
      if (this.modo === 'espeak') {
        await ejecutar('espeak-ng', ['-v', 'es-419', '-s', lenta ? '135' : '160', '-g', lenta ? '4' : '1', texto]);
      } else if (this.modo === 'piper') {
        await piper(texto, this.piperModelo, lenta);
      } else if (this.modo === 'sistema' && process.platform === 'darwin') {
        await ejecutar('say', ['-r', lenta ? '150' : '180', texto]);
      } else if (this.modo === 'sistema' && process.platform === 'win32') {
        const guion = `Add-Type -AssemblyName System.Speech; $v = New-Object System.Speech.Synthesis.SpeechSynthesizer; $v.Rate = ${lenta ? -2 : 0}; $v.Volume = ${this.volumen}; $v.Speak([Console]::In.ReadToEnd())`;
        await ejecutar('powershell', ['-NoProfile', '-Command', guion], texto);
      }
      this.funciona = true;
    } catch (error) {
      if (this.funciona) console.error(`[voz] No se pudo reproducir la voz (${error.message}). Se sigue mostrando el texto.`);
      this.funciona = false;
    } finally {
      this.hablando = false;
      this.finUltimaFrase = Date.now();
      this.alCambiar('reposo', '');
    }
  }
}
