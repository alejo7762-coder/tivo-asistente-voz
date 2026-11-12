// Reproduce canciones de una carpeta local (HU-RF08). Usa mpg123 para .mp3 y aplay para .wav.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { normalizar } from './texto.js';

const EXTENSIONES = ['.mp3', '.wav', '.ogg'];

export class Reproductor {
  constructor({ rutaMusica }) {
    this.rutaMusica = rutaMusica;
    this.proceso = null;
    this.pausado = false;
    this.cola = [];
  }

  canciones() {
    try {
      return fs.readdirSync(this.rutaMusica)
        .filter((archivo) => EXTENSIONES.includes(path.extname(archivo).toLowerCase()))
        .map((archivo) => ({ archivo, titulo: path.basename(archivo, path.extname(archivo)).replace(/[_-]+/g, ' ') }));
    } catch {
      return [];
    }
  }

  /** Busca por nombre; sin consulta devuelve todas en orden aleatorio. */
  buscar(consulta) {
    const todas = this.canciones();
    if (!consulta) return todas.sort(() => Math.random() - 0.5);
    const palabras = normalizar(consulta).split(' ').filter((p) => p.length > 2);
    return todas.filter((c) => palabras.some((p) => normalizar(c.titulo).includes(p)));
  }

  get sonando() {
    return Boolean(this.proceso);
  }

  reproducir(lista) {
    this.detener();
    this.cola = [...lista];
    this.#siguiente();
  }

  #siguiente() {
    const cancion = this.cola.shift();
    if (!cancion) return;
    const ruta = path.join(this.rutaMusica, cancion.archivo);
    const esWav = cancion.archivo.toLowerCase().endsWith('.wav');
    const proceso = spawn(esWav ? 'aplay' : 'mpg123', esWav ? ['-q', ruta] : ['-q', ruta], { stdio: 'ignore' });
    this.proceso = proceso;
    this.pausado = false;
    proceso.on('error', () => { if (this.proceso === proceso) this.proceso = null; });
    proceso.on('close', () => {
      if (this.proceso !== proceso) return;
      this.proceso = null;
      this.#siguiente();
    });
  }

  pausar() {
    if (!this.proceso || this.pausado || process.platform === 'win32') return false;
    this.proceso.kill('SIGSTOP');
    this.pausado = true;
    return true;
  }

  continuar() {
    if (!this.proceso || !this.pausado) return false;
    this.proceso.kill('SIGCONT');
    this.pausado = false;
    return true;
  }

  detener() {
    this.cola = [];
    if (!this.proceso) return false;
    const proceso = this.proceso;
    this.proceso = null;
    if (this.pausado && process.platform !== 'win32') proceso.kill('SIGCONT');
    proceso.kill();
    this.pausado = false;
    return true;
  }
}
