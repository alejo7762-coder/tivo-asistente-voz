// Rutas que usa el dispositivo físico (Raspberry Pi). Se autentican con el token del dispositivo.
import { Router } from 'express';
import { requiereDispositivo } from '../auth.js';
import * as m from '../modelos.js';
import { idDe } from '../util/validar.js';

export const rutasEquipo = Router();
rutasEquipo.use(requiereDispositivo);

// Todo lo que el asistente necesita para funcionar, en una sola consulta.
rutasEquipo.get('/sincronizar', (req, res) => {
  const id = req.dispositivoId;
  const d = m.estadoDispositivo(id);
  res.json({
    dispositivo: { nombre: d.nombre, adultoNombre: d.adultoNombre, codigoVinculacion: d.codigoVinculacion },
    configuracion: m.configDe(id),
    recordatorios: m.listarRecordatorios(id),
    medicamentos: m.listarMedicamentos(id),
    familiares: m.listarFamiliares(id),
    mensajes: m.listarMensajes(id, { soloPendientes: true }),
  });
});

rutasEquipo.post('/estado', (req, res) => res.json(m.guardarEstado(req.dispositivoId, req.body)));
rutasEquipo.post('/registros', (req, res) => { m.guardarRegistro(req.dispositivoId, req.body); res.status(204).end(); });
rutasEquipo.post('/diagnostico', (req, res) => { m.guardarDiagnosticos(req.dispositivoId, req.body.eventos); res.status(204).end(); });

// Cambios hechos por voz
rutasEquipo.post('/recordatorios', (req, res) => res.status(201).json(m.crearRecordatorio(req.dispositivoId, req.body, 'voz')));
rutasEquipo.delete('/recordatorios/:id', (req, res) => { m.eliminarRecordatorio(req.dispositivoId, idDe(req)); res.status(204).end(); });
rutasEquipo.put('/configuracion', (req, res) => res.json(m.actualizarConfig(req.dispositivoId, { volumen: req.body.volumen })));
rutasEquipo.post('/mensajes/:id/escuchado', (req, res) => { m.marcarMensajeEscuchado(req.dispositivoId, idDe(req)); res.status(204).end(); });
