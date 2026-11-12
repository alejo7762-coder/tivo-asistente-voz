// Rutas que usa la app móvil (requieren sesión).
import { Router } from 'express';
import { puedeEditar, requiereRol, requiereSesion } from '../auth.js';
import { db, transaccion } from '../db.js';
import * as m from '../modelos.js';
import { ErrorHttp, idDe, opcion } from '../util/validar.js';

export const rutasApp = Router();
rutasApp.use(requiereSesion);

// Recordatorios (HU-RF04)
rutasApp.get('/recordatorios', (req, res) => res.json(m.listarRecordatorios(req.dispositivoId)));
rutasApp.post('/recordatorios', puedeEditar, (req, res) => res.status(201).json(m.crearRecordatorio(req.dispositivoId, req.body)));
rutasApp.put('/recordatorios/:id', puedeEditar, (req, res) => res.json(m.actualizarRecordatorio(req.dispositivoId, idDe(req), req.body)));
rutasApp.delete('/recordatorios/:id', puedeEditar, (req, res) => { m.eliminarRecordatorio(req.dispositivoId, idDe(req)); res.status(204).end(); });

// Medicamentos (HU-RF03)
rutasApp.get('/medicamentos', (req, res) => res.json(m.listarMedicamentos(req.dispositivoId)));
rutasApp.post('/medicamentos', puedeEditar, (req, res) => res.status(201).json(m.crearMedicamento(req.dispositivoId, req.body)));
rutasApp.put('/medicamentos/:id', puedeEditar, (req, res) => res.json(m.actualizarMedicamento(req.dispositivoId, idDe(req), req.body)));
rutasApp.delete('/medicamentos/:id', puedeEditar, (req, res) => { m.eliminarMedicamento(req.dispositivoId, idDe(req)); res.status(204).end(); });

// Información familiar (HU-RF06)
rutasApp.get('/familiares', (req, res) => res.json(m.listarFamiliares(req.dispositivoId)));
rutasApp.post('/familiares', puedeEditar, (req, res) => res.status(201).json(m.crearFamiliar(req.dispositivoId, req.body)));
rutasApp.put('/familiares/:id', puedeEditar, (req, res) => res.json(m.actualizarFamiliar(req.dispositivoId, idDe(req), req.body)));
rutasApp.delete('/familiares/:id', puedeEditar, (req, res) => { m.eliminarFamiliar(req.dispositivoId, idDe(req)); res.status(204).end(); });

// Mensajes que el asistente le lee al adulto mayor (HU-RF08)
rutasApp.get('/mensajes', (req, res) => res.json(m.listarMensajes(req.dispositivoId)));
rutasApp.post('/mensajes', puedeEditar, (req, res) => res.status(201).json(m.crearMensaje(req.dispositivoId, req.usuario.nombre, req.body)));
rutasApp.delete('/mensajes/:id', puedeEditar, (req, res) => { m.eliminarMensaje(req.dispositivoId, idDe(req)); res.status(204).end(); });

// Estado del dispositivo y configuración (HU-RF09)
rutasApp.get('/dispositivo', (req, res) => res.json(m.estadoDispositivo(req.dispositivoId)));
rutasApp.get('/dispositivo/configuracion', (req, res) => res.json(m.configDe(req.dispositivoId)));
rutasApp.put('/dispositivo/configuracion', puedeEditar, (req, res) => res.json(m.actualizarConfig(req.dispositivoId, req.body)));

// Diagnóstico del asistente (HU-RNF04)
rutasApp.get('/diagnostico', (req, res) => res.json(m.resumenDiagnostico(req.dispositivoId)));

// Cuentas vinculadas al dispositivo (solo administrador)
const soloAdmin = requiereRol('administrador');
rutasApp.get('/usuarios', soloAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, nombre, correo, rol FROM usuarios WHERE dispositivo_id = ? ORDER BY id').all(req.dispositivoId));
});
rutasApp.put('/usuarios/:id/rol', soloAdmin, (req, res) => {
  const id = idDe(req);
  if (id === req.usuario.id) throw new ErrorHttp(400, 'No puede cambiar su propio rol.');
  const rol = opcion(req.body.rol, 'rol', ['administrador', 'familiar', 'usuario']);
  const { changes } = db.prepare('UPDATE usuarios SET rol = ? WHERE id = ? AND dispositivo_id = ?').run(rol, id, req.dispositivoId);
  if (!changes) throw new ErrorHttp(404, 'Cuenta no encontrada.');
  res.json({ id, rol });
});
rutasApp.delete('/usuarios/:id', soloAdmin, (req, res) => {
  const id = idDe(req);
  if (id === req.usuario.id) throw new ErrorHttp(400, 'No puede eliminar su propia cuenta desde aquí.');
  const { changes } = db.prepare('DELETE FROM usuarios WHERE id = ? AND dispositivo_id = ?').run(id, req.dispositivoId);
  if (!changes) throw new ErrorHttp(404, 'Cuenta no encontrada.');
  res.status(204).end();
});

// Exportar y eliminar datos (HU-RNF06)
rutasApp.get('/datos/exportar', (req, res) => {
  const id = req.dispositivoId;
  res.json({
    exportadoEn: new Date().toISOString(),
    dispositivo: m.estadoDispositivo(id),
    configuracion: m.configDe(id),
    recordatorios: m.listarRecordatorios(id),
    medicamentos: m.listarMedicamentos(id),
    familiares: m.listarFamiliares(id),
    mensajes: m.listarMensajes(id),
    registros: db.prepare('SELECT origen, origen_id AS origenId, fecha_local AS fecha, hora_programada AS hora, estado FROM registros WHERE dispositivo_id = ? ORDER BY id').all(id),
  });
});
rutasApp.delete('/datos', soloAdmin, (req, res) => {
  const id = req.dispositivoId;
  transaccion(() => {
    for (const tabla of ['recordatorios', 'medicamentos', 'familiares', 'mensajes', 'registros', 'diagnosticos']) {
      db.prepare(`DELETE FROM ${tabla} WHERE dispositivo_id = ?`).run(id);
    }
  });
  res.status(204).end();
});
