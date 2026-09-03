# Instrucciones para Codex

## Proyecto

LectoVoz es una app web local para practicar lectura con reconocimiento de voz en espanol.

Archivos principales:

- `index.html`: interfaz del estudiante.
- `app.js`: flujo principal de practica, calibracion, avance de palabras y feedback.
- `modules/speech-recognition.js`: controlador de microfono, volumen y Web Speech API.
- `modules/evaluation.js`: normalizacion, similitud, avance correcto, aproximado e incorrecto.
- `modules/content.js`: silabas, palabras y frases disponibles.
- `speech-tests.js` y `module-tests.js`: pruebas automatizadas.

## Comandos de verificacion

Antes de cerrar cambios de logica, correr:

```bash
node speech-tests.js
node module-tests.js
```

## Reglas importantes de reconocimiento

- En modo palabras (`simpleWords` y `complexWords`), una transcripcion visible que no coincide con la palabra objetivo debe convertirse en intento incorrecto y pintar la palabra en rojo.
- No reiniciar `SpeechRecognition` en cada palabra, porque algunos navegadores vuelven a pedir permiso de microfono.
- Al avanzar automaticamente a la siguiente palabra, conservar temporalmente la ultima palabra aceptada para ignorar resultados tardios arrastrados del navegador.
- El texto de "Escuchado" no debe actualizarse con una palabra arrastrada de la tarjeta anterior.
- El estado naranja debe reservarse para errores cercanos de pronunciacion o lectura, no para palabras claramente distintas.
- La calibracion debe usar muestras variables y no repetir siempre la misma silaba, palabra y frase.

## Estilo de cambios

- Mantener los cambios acotados a la logica del problema.
- Evitar dependencias nuevas salvo que sean realmente necesarias.
- Si se cambia evaluacion o reconocimiento, agregar o actualizar pruebas en `speech-tests.js`.
