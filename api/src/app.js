import cors from 'cors';
import express from 'express';
import { rutasApp } from './rutas/app.js';
import { rutasAuth } from './rutas/auth.js';
import { rutasEquipo } from './rutas/equipo.js';
import { ErrorHttp } from './util/validar.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/salud', (_req, res) => res.json({ ok: true, servicio: 'tivo-api', hora: new Date().toISOString() }));
  app.use('/api/auth', rutasAuth);
  app.use('/api/equipo', rutasEquipo);
  app.use('/api', rutasApp);

  app.use((_req, _res, next) => next(new ErrorHttp(404, 'Ruta no encontrada.')));

  // Todas las respuestas de error tienen la forma { error: "mensaje" }.
  app.use((error, _req, res, _next) => {
    if (error instanceof ErrorHttp) return res.status(error.estado).json({ error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
    console.error(error);
    res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
  });

  return app;
}
