# LectoVoz

Juego didactico de lectura en espanol con reconocimiento de voz, niveles de practica y panel docente con registros locales.

## Archivos principales

- `index.html`: juego para el alumno.
- `teacher.html`: panel del maestro.
- `app.js`: orquestador del juego, UI y puntuacion.
- `teacher.js`: orquestador de la tabla, filtros y exportacion CSV.
- `teacher-control.js`: orquestador del control de alumnos y configuracion.
- `modules/content.js`: catalogo de ejercicios y configuracion base.
- `modules/evaluation.js`: normalizacion, silabificacion y comparacion fonetica.
- `modules/storage.js`: almacenamiento local de sesiones, alumnos y registros.
- `modules/speech-recognition.js`: reconocimiento de voz y monitoreo de audio.
- `modules/teacher-dashboard.js`: calculos, filtros y CSV del panel docente.
- `modules/teacher-control.js`: helpers del control docente.
- `styles.css`: estilos visuales.

Para usarlo, abre `index.html` en Chrome o Edge y permite el acceso al microfono.

## Pruebas

- `node speech-tests.js`
- `node module-tests.js`
