# SoundViewer

Reproductor que sincroniza una **transcripción con marcas de tiempo** con un **archivo de audio**, sobre un
visualizador de la onda completa del sonido: el texto se resalta palabra a palabra al ritmo de la
reproducción, con tabla de reparto, aviso de quién habla a continuación y edición del propio documento.

Todo ocurre en el navegador: no se sube nada a ningún servidor.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # bundle de producción en dist/
```

## Uso

1. Arrastra a la ventana la transcripción (`.md` o `.json`) y el audio (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.opus`…).
   También vale soltar un vídeo (`.mp4`, `.mov`): se reproduce su pista de audio.
2. Pulsa play. El bloque que suena se resalta en el panel grande, en la lista y sobre la onda.
3. Haz clic en cualquier punto de la onda, en una línea de la transcripción o en un personaje del reparto
   para saltar ahí.

No hay ningún archivo por defecto: todo (escenas, personajes, tiempos, onda y silencios) se calcula a partir
de lo que subas. La última sesión (audio + transcripción + desfase) se guarda en IndexedDB y se recupera al
recargar; **Limpiar** la borra.

### Reparto y quién sigue

La tabla de reparto lista los personajes con sus intervenciones, palabras, tiempo en pantalla y el minuto de
su **próxima** aparición. El que habla lleva la etiqueta _Ahora_, el siguiente en hablar lleva _Sigue_, y el
ojo de cada fila lo oculta o lo muestra en la transcripción. En el panel grande, la barra inferior dice
siempre quién viene después y en cuánto tiempo; al pulsarla salta a esa intervención.

### Editar la transcripción

El botón **Editar** de la cabecera de la transcripción activa el modo edición:

- Lápiz: cambia tiempos, personaje y texto de una intervención. El icono de reloj de cada campo de tiempo
  pone el **tiempo actual del audio**, que es la forma rápida de cuadrar una línea mientras suena.
- Más: inserta una intervención nueva después de esa (o al principio de todo).
- Papelera: la borra.
- **Exportar** descarga el `.md` regenerado.

Los cambios se reordenan solos por tiempo, recalculan escenas y reparto, y se guardan en la sesión local.
`Ctrl+Enter` guarda y `Esc` cancela.

### Pausa automática

En el engranaje de la cabecera:

- **Entre escenas**: se detiene al terminar cada escena.
- **En los silencios**: se detiene al entrar en un tramo del audio sin sonido. Los tramos se detectan sobre
  la onda ya decodificada, con la duración mínima que indiques (0,8 s por defecto), y se pintan sombreados
  en la propia onda.

### Desfase

Si los tiempos del texto no cuadran con el audio (por ejemplo, porque la transcripción venía de un vídeo con
otra cabecera), el campo **Desfase** desplaza toda la transcripción los segundos que indiques.

### Atajos

| Tecla           | Acción                            |
| --------------- | --------------------------------- |
| `espacio` / `K` | reproducir / pausar               |
| `←` / `→`       | ±5 s                              |
| `J` / `L`       | ±10 s                             |
| `P` / `N`       | intervención anterior / siguiente |
| `↑` / `↓`       | volumen                           |
| `,` / `.`       | velocidad                         |
| `M`             | silenciar                         |
| `Home`          | volver al inicio                  |
| `F` / `/`       | buscar en la transcripción        |

## Formatos de transcripción

### Markdown

```markdown
# Transcripción — El Mago de Oz

**Archivo:** VID-20260817-WA0006.mp4
**Duración:** 09:35 (575,7 s)

## ESCENA 1 — La granja de Kansas (00:04 – 00:32)

**Personajes:** Narrador · Dorothy · Toto

[00:04 - 00:12] Narrador: En una granja gris de Kansas vivia una nina llamada Dorothy...
[00:12 - 00:14] Toto: ¡Hola!
[00:29 - 00:32] _(Cartel): Intermitente de luces_
```

Se reconocen:

- **Escenas** (`## ESCENA n — título (inicio – fin)`), con su lista de personajes.
- **Bloques** `[mm:ss - mm:ss]`, también `hh:mm:ss` y decimales (`mm:ss.mmm`).
- **Personaje** = lo que va antes de los dos puntos, si parece un nombre y no una frase.
- **Carteles y acotaciones** (`*(Cartel): ...*`), marcados como texto en pantalla y no como diálogo.
- Las **tablas de resumen** finales se ignoran.

Las variantes de un mismo nombre se unifican: sin tildes ni mayúsculas (`Espantapajaros` = `Espantapájaros`)
y con una errata de una letra en nombres largos (`Guardia` = `Guardian`); se muestra la forma más repetida.
Los nombres con dígitos nunca se fusionan, para no juntar `Munchkin 1` con `Munchkin 2`.

Con este criterio, el `mago_de_oz.md` de pruebas da 86 bloques, 15 escenas y 19 voces: exactamente lo que
declara el propio documento.

Al exportar se reescribe ese mismo formato (título y cabecera se conservan tal cual; las tablas de resumen
del original no se regeneran). La ida y vuelta parsear → exportar → parsear no pierde ningún bloque.

### JSON de Whisper

Se acepta la salida de `whisper`, `faster-whisper` y el formato `chunks` de transformers:

```json
{
  "segments": [
    {
      "start": 4.0,
      "end": 12.0,
      "text": "En una granja gris de Kansas…",
      "speaker": "Narrador",
      "words": [{ "word": "En", "start": 4.0, "end": 4.2 }]
    }
  ]
}
```

Si el segmento trae `words`, el resaltado usa esos tiempos reales; si no, se reparte el intervalo entre las
palabras según su longitud (karaoke aproximado). El campo `speaker` (diarización) es opcional. Al editar un
`.json`, la transcripción pasa a guardarse como markdown, que es el formato que genera la app.

## Cómo funciona la onda

`AudioContext.decodeAudioData` decodifica el archivo una sola vez y se reduce a 3000 picos normalizados
(`src/lib/peaks.ts`). Al pintar, esos picos se re-muestrean a las barras que caben en pantalla y se dibujan
dos canvas fuera de pantalla: la onda apagada y la encendida (color de acento). En cada frame solo se recorta
la encendida hasta la posición de reproducción, así que el coste por frame es constante aunque el audio dure
horas.

Sobre ella se pintan los tramos de silencio, las marcas de cada intervención con el color de su personaje,
las de escena y el cursor.

## Diseño

La capa visual sigue el sistema de diseño de **lintted** (`frontend_lintted_phylo`):

- **Tailwind v4** con sus tokens: `bg`, `surface`, `elevated`, `ink`, `muted`, `faint`, `hairline`, `line`;
  tipografía **DM Sans**; scrollbars ocultas.
- **Tema oscuro por defecto**, claro con el botón sol/luna; el tema vive en `data-theme` sobre `<html>` y se
  recuerda en localStorage, igual que en lintted.
- Sus mismas recetas de componente: botones pill (`btn-primary` con degradado, `btn-outline`, `btn-icon`),
  `lintted-input` redondeado, tarjetas `rounded-[1.25rem] border-hairline`, tablas con `divide-hairline`.
- El acento es **rojizo/rosado** (rose) en lugar del sky de phylo.
- El `select` nativo está sustituido por uno propio (`src/components/ui/Select.tsx`), porque el desplegable
  del sistema no se puede peinar.

Los colores de personaje se generan en oklch sobre un arco cálido (morado → rosa → rojo → naranja) con dos
niveles de luminosidad, recorridos a saltos para que dos personajes seguidos no compartan tono.

### Animación

Con **GSAP** (`@gsap/react`), centralizado en `src/lib/motion.ts`: entrada en cascada de las tarjetas, cambio
de intervención, filas del reparto, línea activa de la transcripción, desplegables y píldoras de aviso.

Todas las animaciones usan `fromTo` con valores finales explícitos, `overwrite: 'auto'` y `clearProps`: con
`from` a secas, un tween interrumpido (y aquí se interrumpen a cada cambio de línea) deja el elemento en
`opacity: 0` y el contenido desaparece. Se respeta `prefers-reduced-motion`.

## Estructura

```
src/
  lib/           parsers (.md y Whisper), serializador, edición, tiempos, texto,
                 picos de onda, silencios, colores, motion, IndexedDB
  hooks/         useAudioEngine (control del audio + muestreo con rAF) · useTheme
  components/    Waveform · NowPlaying · Transcript · CueRow · CueEditor · CastTable ·
                 Controls · VolumeBar · SettingsMenu · SpeakerMark · DropZone
  components/ui/ Select propio
  styles/        global.css — tokens del sistema de diseño
  App.tsx        estado, sincronía, pausa automática, atajos y drag & drop
```

El código va sin comentarios: la explicación de cada decisión está en este README.
