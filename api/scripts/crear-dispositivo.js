// Registra un dispositivo TIVO y muestra su código de vinculación y su token.
// Uso: npm run crear-dispositivo -- "TIVO de la sala" "Nombre del adulto mayor"
import { CONFIG_DISPOSITIVO_INICIAL } from '../src/config.js';
import { db } from '../src/db.js';
import { codigoVinculacion, hashToken, tokenAleatorio } from '../src/util/cifrado.js';

export function crearDispositivo(nombre, adultoNombre = null) {
  const token = tokenAleatorio();
  const codigo = codigoVinculacion();
  const { lastInsertRowid } = db.prepare('INSERT INTO dispositivos (nombre, adulto_nombre, codigo_vinculacion, token_hash, config) VALUES (?, ?, ?, ?, ?)')
    .run(nombre, adultoNombre, codigo, hashToken(token), JSON.stringify(CONFIG_DISPOSITIVO_INICIAL));
  return { id: Number(lastInsertRowid), codigo, token };
}

if (import.meta.filename === process.argv[1]) {
  const [nombre = 'TIVO', adulto] = process.argv.slice(2);
  const d = crearDispositivo(nombre, adulto);
  console.log(`\nDispositivo "${nombre}" creado.\n`);
  console.log(`  Código de vinculación (para registrarse en la app): ${d.codigo}`);
  console.log(`  Token del dispositivo (va en asistente/.env como TOKEN_DISPOSITIVO):\n  ${d.token}\n`);
  console.log('Guarde el token ahora: no se puede volver a consultar.');
}
