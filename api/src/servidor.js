import { crearApp } from './app.js';
import { config } from './config.js';
import { aplicarRetencion } from './db.js';

aplicarRetencion();
setInterval(aplicarRetencion, 24 * 60 * 60 * 1000).unref();

crearApp().listen(config.puerto, '0.0.0.0', () => {
  console.log(`API de TIVO escuchando en http://localhost:${config.puerto}/api`);
});
