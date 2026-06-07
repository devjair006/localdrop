# LocalDrop

LocalDrop es una app de escritorio para transferir archivos entre una computadora y un celular usando la red local WiFi, sin nube, sin login y sin cables.

## Stack del MVP

- Electron
- React
- Vite
- Node.js
- Express
- Multer
- Socket.IO

## Estado actual

La base del proyecto esta pensada para desarrollo local y cubre estos flujos:

- App de escritorio con Electron
- UI desktop con React
- Servidor Express accesible en la red local
- QR con URL para abrir desde el celular
- PIN temporal de 6 digitos
- Subida de uno o varios archivos desde navegador movil hacia la PC
- Envio de archivos desde la PC hacia una sesion movil activa
- Guardado de archivos recibidos en `Downloads/LocalDrop`
- Sanitizacion de nombres y sufijos para evitar sobreescritura
- Lista de archivos recibidos en la app de escritorio
- Presencia y eventos en tiempo real con Socket.IO
- Alias `.local` por mDNS/Bonjour cuando la red y el dispositivo lo soportan

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Esto levanta:

- Vite en `http://127.0.0.1:5173`
- Electron para la app de escritorio
- Express en un puerto disponible empezando en `3030`

## Uso

### Celular -> PC

1. Abre la app de escritorio con `npm run dev`.
2. Espera a que aparezca la URL local, el QR y el PIN temporal.
3. Desde el celular, conectado a la misma red WiFi, escanea el QR o abre la URL manualmente.
4. Ingresa el PIN temporal mostrado en la app.
5. Selecciona uno o varios archivos y subelos.
6. Los archivos quedaran en `Downloads/LocalDrop`.

### PC -> celular

1. Abre la URL de LocalDrop desde el celular y deja la pagina movil abierta.
2. En la app de escritorio, selecciona la sesion movil activa.
3. Elige uno o varios archivos para enviar.
4. La pagina movil mostrara una tarjeta con nombre, cantidad de archivos, tamano total y tiempo restante.
5. Toca `Descargar` en el celular para iniciar la descarga.
6. Si son varios archivos, LocalDrop puede entregarlos como un `.zip`.

## Acceso por IP y por `.local`

LocalDrop mantiene dos caminos de acceso cuando estan disponibles:

- `http://192.168.x.x:3030` o el puerto que toque
- `http://localdrop-<equipo>.local:3030`

Recomendaciones practicas:

- Usa la URL por IP como camino universal. Es el fallback oficial.
- Usa la URL `.local` cuando el navegador y la red resuelvan mDNS/Bonjour correctamente.
- El QR principal deberia seguir apuntando a la IP para compatibilidad maxima.

## Limitaciones conocidas

- La descarga en el celular requiere tocar el boton `Descargar`. No se inicia sola.
- Algunos navegadores Android o redes corporativas no resuelven `.local` correctamente.
- Si el navegador movil corta la conexion en segundo plano, la sesion puede dejar de aparecer en desktop.
- La confirmacion final de una descarga depende del navegador; el archivo puede quedar en la carpeta de descargas del telefono aunque no veas una UI de sistema muy clara.
- La IP local puede cambiar al cambiar de red o al reconectarse al WiFi.

## Checklist manual de validacion

### Flujo celular -> PC

1. Arrancar `npm run dev`.
2. Abrir la URL movil desde el celular.
3. Confirmar que la pagina muestra presencia conectada y un identificador de sesion.
4. Probar PIN invalido y verificar error claro.
5. Probar PIN valido y subir 1 archivo.
6. Probar subida multiple.
7. Confirmar que los archivos aparecen en `Downloads/LocalDrop` y en la lista desktop.

### Flujo PC -> celular

1. Mantener abierta la pagina movil.
2. Crear una transferencia desde la desktop a esa sesion.
3. Verificar que la pagina movil muestra nombre, cantidad, tamano y tiempo restante.
4. Tocar `Descargar` y verificar que el navegador inicia la descarga.
5. Repetir con multiples archivos para validar entrega en `.zip`.
6. Probar reemplazar una transferencia pendiente por otra nueva.
7. Probar dejar expirar una transferencia y validar el estado `Expirada`.

### Red y descubrimiento

1. Verificar acceso por IP.
2. Si el entorno lo soporta, verificar acceso por `.local`.
3. Confirmar que si `.local` falla, la IP sigue funcionando.
4. Probar con iPhone Safari y con Android Chrome de referencia.

## Troubleshooting

- Si el celular no abre la pagina: confirma que ambos dispositivos estan en la misma WiFi y que el firewall local permite conexiones al puerto de LocalDrop.
- Si la presencia no aparece: recarga la pagina movil y revisa que Socket.IO este alcanzable desde el navegador.
- Si el PIN falla siempre: verifica que estas usando el PIN actual de la desktop y no uno viejo.
- Si `.local` no funciona: usa la URL por IP. Eso no se considera un fallo critico del MVP.
- Si una descarga no aparece: revisa la bandeja o carpeta de descargas del navegador del celular y vuelve a tocar `Descargar` si la oferta sigue activa.
- Si una sesion desaparece al bloquear el telefono: desbloquea, vuelve a la pagina y espera la reconexion.

## Estructura

```text
localdrop/
|-- electron/
|-- public/mobile/
|-- server/
|-- src/
`-- README.md
```

## Roadmap sugerido

- Descubrimiento de dispositivos mas robusto
- Historial por sesion
- Reanudacion de transferencias
- Limites configurables de seguridad
- Empaquetado para Windows, macOS y Linux
