// Mide el estado del equipo para la pantalla "Estado del dispositivo" de la app.
import dns from 'node:dns/promises';
import fs from 'node:fs';
import os from 'node:os';

async function hayInternet() {
  try {
    await Promise.race([
      dns.resolve('one.one.one.one'),
      new Promise((_, rechazar) => { setTimeout(() => rechazar(new Error('tiempo')), 3000); }),
    ]);
    return true;
  } catch {
    return false;
  }
}

function temperaturaCpu() {
  try {
    return Number(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000;
  } catch {
    return null; // fuera de la Raspberry Pi no hay sensor
  }
}

export async function medirEstado({ entrada, voz, pantalla, config, volumen, inicio }) {
  return {
    internet: await hayInternet(),
    microfono: entrada.activa,
    altavoz: voz.funciona,
    volumen,
    pantalla: pantalla.funciona,
    temperaturaCpu: temperaturaCpu(),
    memoriaUsada: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    version: config.version,
    modoVoz: `${config.entrada}/${config.salida}`,
    inicio,
  };
}
