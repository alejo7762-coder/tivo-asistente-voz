// Apoyo visual (pantalla o LED). El hardware cambia de un montaje a otro, así que aquí solo se
// publica el estado; si COMANDO_PANTALLA está definido, se ejecuta ese programa con (estado, texto).
import { execFile } from 'node:child_process';

export class Pantalla {
  constructor({ comando = '' } = {}) {
    this.comando = comando;
    this.estado = 'reposo';
    this.funciona = true;
  }

  mostrar(estado, texto = '') {
    if (estado === this.estado && !texto) return;
    this.estado = estado;
    if (!this.comando) return;
    execFile(this.comando, [estado, texto], { timeout: 5000 }, (error) => {
      if (error && this.funciona) console.error(`[pantalla] ${error.message}`);
      this.funciona = !error;
    });
  }
}
