// Decide qué recordatorios y medicamentos toca anunciar, repetir o dar por omitidos.
import fs from 'node:fs';
import path from 'node:path';
import { aMinutos, ahoraLocal, horasMedicamento, horasRecordatorio } from '../../compartido/horario.js';

const TOLERANCIA_MINUTOS = 60; // si el equipo estuvo apagado más de este tiempo, el aviso se da por omitido

export class Planificador {
  constructor({ api, rutaDatos }) {
    this.api = api;
    this.ruta = rutaDatos ? path.join(rutaDatos, 'avisos.json') : null;
    try {
      this.avisos = this.ruta ? JSON.parse(fs.readFileSync(this.ruta, 'utf8')) : {};
    } catch {
      this.avisos = {};
    }
  }

  #guardar() {
    if (!this.ruta) return;
    fs.mkdirSync(path.dirname(this.ruta), { recursive: true });
    fs.writeFileSync(this.ruta, JSON.stringify(this.avisos));
  }

  /** Todo lo programado para una fecha, ordenado por hora. */
  agenda(fecha) {
    const { recordatorios, medicamentos } = this.api.datos;
    const lista = [];
    for (const r of recordatorios) for (const hora of horasRecordatorio(r, fecha)) lista.push({ origen: 'recordatorio', id: r.id, hora, fecha, elemento: r });
    for (const m of medicamentos) for (const hora of horasMedicamento(m, fecha)) lista.push({ origen: 'medicamento', id: m.id, hora, fecha, elemento: m });
    return lista
      .map((a) => ({ ...a, clave: `${a.origen}:${a.id}:${a.fecha}:${a.hora}` }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }

  /** Devuelve los avisos que hay que decir ahora (nuevos o repetidos). */
  async revisar(instante = new Date()) {
    const config = this.api.datos.configuracion;
    const local = ahoraLocal(config.zonaHoraria, instante);
    const ahoraMs = instante.getTime();
    const porAnunciar = [];

    for (const clave of Object.keys(this.avisos)) {
      if (!clave.includes(`:${local.fecha}:`)) delete this.avisos[clave]; // limpia los días anteriores
    }

    for (const aviso of this.agenda(local.fecha)) {
      if (aviso.hora > local.hora) continue;
      const previo = this.avisos[aviso.clave];
      if (!previo) {
        const tarde = aMinutos(local.hora) - aMinutos(aviso.hora);
        if (tarde > TOLERANCIA_MINUTOS) {
          this.avisos[aviso.clave] = { estado: 'omitido', anuncios: 0, ultimo: ahoraMs };
          await this.api.registrar(aviso.origen, aviso.id, aviso.fecha, aviso.hora, 'omitido');
        } else {
          this.avisos[aviso.clave] = { estado: 'anunciado', anuncios: 1, ultimo: ahoraMs };
          await this.api.registrar(aviso.origen, aviso.id, aviso.fecha, aviso.hora, 'anunciado');
          porAnunciar.push({ ...aviso, repeticion: 1 });
        }
      } else if (previo.estado === 'anunciado' && ahoraMs - previo.ultimo >= config.repetirCadaMinutos * 60_000) {
        if (previo.anuncios >= config.repeticionesMaximas) {
          previo.estado = 'omitido';
          await this.api.registrar(aviso.origen, aviso.id, aviso.fecha, aviso.hora, 'omitido');
        } else {
          previo.anuncios += 1;
          previo.ultimo = ahoraMs;
          porAnunciar.push({ ...aviso, repeticion: previo.anuncios });
        }
      }
    }
    this.#guardar();
    return porAnunciar;
  }

  /** Avisos ya dichos que siguen esperando un "ya lo tomé". */
  activos(instante = new Date()) {
    const fecha = ahoraLocal(this.api.datos.configuracion.zonaHoraria, instante).fecha;
    return this.agenda(fecha).filter((a) => this.avisos[a.clave]?.estado === 'anunciado');
  }

  async confirmar(avisos) {
    for (const aviso of avisos) {
      this.avisos[aviso.clave] = { ...this.avisos[aviso.clave], estado: 'confirmado' };
      await this.api.registrar(aviso.origen, aviso.id, aviso.fecha, aviso.hora, 'confirmado');
    }
    this.#guardar();
  }

  estadoDe(aviso) {
    return this.avisos[aviso.clave]?.estado ?? null;
  }
}
