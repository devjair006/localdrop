# LocalDrop

LocalDrop es una app de escritorio para transferir archivos entre una computadora y un celular usando la red local WiFi, sin nube, sin login y sin cables.

## Stack del MVP

- Electron
- React
- Vite
- Node.js
- Express
- Multer

## Estado actual

Esta primera base deja funcionando el flujo principal en desarrollo:

- App de escritorio con Electron
- UI desktop con React
- Servidor Express accesible en la red local
- QR con URL para abrir desde el celular
- PIN temporal de 6 digitos
- Subida de uno o varios archivos desde navegador movil
- Guardado en `Downloads/LocalDrop`
- Sanitizacion de nombres y sufijos para evitar sobreescritura
- Lista de archivos recibidos en la app de escritorio

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

## Uso del MVP

1. Abre la app de escritorio con `npm run dev`.
2. Espera a que aparezca la URL local y el QR.
3. Desde el celular, conectado a la misma red WiFi, escanea el QR o abre la URL manualmente.
4. Ingresa el PIN temporal mostrado en la app.
5. Selecciona archivos y subelos.
6. Los archivos quedaran en `Downloads/LocalDrop`.

## Estructura

```text
localdrop/
├── electron/
├── public/mobile/
├── server/
├── src/
└── README.md
```

## Roadmap sugerido

- Notificaciones en tiempo real con Socket.IO
- Indicador de conectividad de red
- Modo claro/oscuro mas trabajado
- Historial por sesion
- Soporte de empaquetado para Windows, macOS y Linux
- Endurecimiento de seguridad y limites configurables
