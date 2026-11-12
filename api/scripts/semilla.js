// Carga datos de demostración (los mismos de las figuras del documento).
// Uso: npm run semilla
import bcrypt from 'bcryptjs';
import { ahoraLocal } from '../../compartido/horario.js';
import { db } from '../src/db.js';
import * as m from '../src/modelos.js';
import { crearDispositivo } from './crear-dispositivo.js';

const CORREO = 'demo@tivo.app';
const CLAVE = 'tivo1234';

if (db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(CORREO)) {
  console.log('Los datos de demostración ya existen. Borre la carpeta api/datos para empezar de cero.');
  process.exit(0);
}

const d = crearDispositivo('TIVO de la sala', 'Doña Carmen');
db.prepare('INSERT INTO usuarios (nombre, correo, clave_hash, rol, dispositivo_id) VALUES (?, ?, ?, ?, ?)')
  .run('Familiar de prueba', CORREO, bcrypt.hashSync(CLAVE, 10), 'administrador', d.id);

const hoy = ahoraLocal().fecha;
m.crearRecordatorio(d.id, { titulo: 'Desayuno', tipo: 'otro', hora: '08:00', repeticion: 'diario' });
m.crearRecordatorio(d.id, { titulo: 'Ejercicios', tipo: 'otro', hora: '11:00', repeticion: 'semanal', diasSemana: [1, 3, 5] });
m.crearRecordatorio(d.id, { titulo: 'Llamar a la familia', tipo: 'llamada', hora: '15:00', repeticion: 'una_vez', fecha: hoy });
m.crearMedicamento(d.id, { nombre: 'Losartán', dosis: '50 mg', frecuencia: 'diario', hora: '08:00' });
m.crearMedicamento(d.id, { nombre: 'Metformina', dosis: '500 mg', frecuencia: 'cada_12_horas', hora: '09:00' });
m.crearMedicamento(d.id, { nombre: 'Vitamina D', frecuencia: 'semanal', hora: '07:00', diaSemana: 1 });
m.crearFamiliar(d.id, { nombre: 'Andrés', relacion: 'hijo', telefono: '300 555 0101' });
m.crearFamiliar(d.id, { nombre: 'Laura', relacion: 'nieta', telefono: '310 555 0102' });
m.crearMensaje(d.id, 'Laura', { texto: 'Hola abuela, el domingo vamos a almorzar con usted. La quiero mucho.' });

console.log('\nDatos de demostración creados.\n');
console.log(`  App móvil  ->  correo: ${CORREO}   contraseña: ${CLAVE}`);
console.log(`  Código de vinculación: ${d.codigo}`);
console.log(`  Token del dispositivo (asistente/.env, TOKEN_DISPOSITIVO):\n  ${d.token}\n`);
