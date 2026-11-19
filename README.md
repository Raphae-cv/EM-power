# Lyndon · Tu vida, en orden

Aplicación web adaptable para organizar tareas, recordatorios, finanzas, medicamentos y fechas de vencimiento de documentos. El backend usa Node.js, Express y SQLite; la base de datos se crea automáticamente en `data/lyndon.sqlite`.

## Requisitos

- Node.js 22.13 o superior.
- npm incluido con Node.js.

## Puesta en marcha

Desde esta carpeta:

```powershell
npm install
npm start
```

Abre <http://localhost:3000>. Para desarrollo con reinicio automático usa `npm run dev`. Para ejecutar las pruebas automatizadas: `npm test`.

La carpeta `data/` se crea en el primer inicio y está excluida de Git. Para hacer una copia de seguridad, detén el servidor y respalda `data/lyndon.sqlite`; protege esa copia como información personal.

## Recuperación de contraseña por correo

La aplicación genera enlaces de un solo uso, válidos durante 30 minutos. En desarrollo, el enlace se imprime en la terminal del servidor. Para enviar mensajes de recuperación reales, configura las variables SMTP antes de iniciar la aplicación:

```powershell
$env:SMTP_HOST = "smtp.tu-proveedor.com"
$env:SMTP_PORT = "587"
$env:SMTP_SECURE = "false"
$env:SMTP_USER = "tu-usuario-smtp"
$env:SMTP_PASSWORD = "tu-clave-smtp"
$env:SMTP_FROM = "Lyndon <no-reply@tu-dominio.com>"
$env:APP_URL = "https://tu-dominio.com"
$env:NODE_ENV = "production"
npm start
```

No uses datos de usuarios reales en pruebas ni publiques credenciales. En producción, sirve la aplicación exclusivamente detrás de HTTPS y configura SMTP con una cuenta dedicada.

## Módulos

- Cuentas: registro, inicio/cierre de sesión, edición de nombre y moneda y recuperación de contraseña.
- Tareas: creación, edición, eliminación, prioridades, fechas, finalización y agenda semanal.
- Recordatorios: registro, filtros y avisos del navegador mientras Lyndon esté abierto y con permiso.
- Finanzas: ingresos, gastos, categorías, presupuestos mensuales y resumen del balance.
- Medicamentos: horarios, frecuencia, duración, registro e historial de tomas. Es una herramienta organizativa, no consejo médico.
- Documentos: notas y fechas de vencimiento; la aplicación guarda metadatos, no archivos escaneados.
- Asistente: respuestas de organización y resumen financiero calculadas en el servidor con los datos propios de la cuenta. No envía la conversación a un proveedor de IA.

Las notificaciones de navegador solo se procesan con la aplicación abierta. Las notificaciones push en segundo plano requieren un proveedor de push y una configuración adicional. El correo de recuperación requiere SMTP.

## Privacidad y límites de alcance

- Cada consulta y cambio de datos queda asociado a la cuenta autenticada; se comprueba la propiedad en el servidor y las relaciones usan claves foráneas.
- Las contraseñas se almacenan con scrypt; las sesiones usan tokens aleatorios de alta entropía, se guardan como hashes y se transmiten en cookies `HttpOnly` y `SameSite=Strict`.
- Hay validación del origen en operaciones de escritura, límites de solicitudes en autenticación, cabeceras seguras y límites al tamaño de las solicitudes.
- SQLite se almacena localmente. Configura acceso al equipo, cifrado del disco, copias de seguridad y HTTPS del servidor según el entorno.
- El plan gratuito/premium/familiar/empresarial, los pagos, el uso compartido familiar, una aplicación móvil nativa y la IA generativa no se incluyen en esta entrega; requieren decisiones de producto y servicios externos. La aplicación web sí se adapta a pantallas móviles.

## Estructura

```text
.
├── database.js       # Esquema SQLite y apertura de la base de datos
├── server.js         # API, autenticación, autorización y servidor web
├── public/
│   ├── app.js        # Navegación, formularios y acciones de la interfaz
│   ├── index.html    # Aplicación web
│   └── styles.css    # Diseño responsive
├── test/
│   └── app.test.js   # Pruebas de API, aislamiento, sesiones y recuperación
├── .env.example      # Variables opcionales para SMTP
└── package.json
```
