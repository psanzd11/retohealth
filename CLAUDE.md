# CLAUDE.md · Proyecto RETO

## Contexto

Dashboard interno del holding **Reto Health** implementado en un único `index.html` (~5.000 líneas, HTML + CSS + JS vanilla, sin bundler). Estructura: 1 agency (Holding) + 4 sub-cuentas (Clínica, Residences, E-Commerce, R&D).

**Próximo paso macro**: conectar todo a base de datos. Cualquier cambio futuro debe ser **DB-ready** — los nombres de campo, tipos, y relaciones deben mapear a un esquema relacional realista.

---

## Arquitectura frontend (estado actual)

- **Estado global**: objeto `state` (línea ~1204). Propiedades:
  - `ws` (workspace activo), `module` (módulo activo)
  - Sub-state de módulos: `socialTab`, `productosTab`, `churnMode`, `clubTierFilter`, `calFilter`
- **Workspaces**: constante `WORKSPACES` (línea ~1186). Cada WS define `modules: [...]`, opcional `subs: {modulo:[{k,label},...]}`, `accent`, `lead`, `badges`.
- **Templates de vista**: objeto `VIEWS` con función por cada `'<ws>.<modulo>'`. Devuelven HTML como string. Fallback automático a `placeholder()` si el key no existe.
- **Charts**: registradas en `initWidgets()` (línea ~2486). Pattern: `if (document.getElementById('ch-xxx')) charts.xxx = lineChart(...)`. Se destruyen en cada `renderView()`.

### Patrón de navegación: sidebar > chips

- **Sub-módulos viven en el sidebar** (segundo nivel jerárquico estilo VS Code / Notion). Se definen en `WORKSPACES[ws].subs[modulo] = [{k,label}, ...]`. `renderNav` los renderiza identados bajo el módulo padre cuando el padre está activo.
- **Función `goSub(module, sub)`** actualiza el sub-state correspondiente (mapeo en `getActiveSub` + `goSub`) y llama a `go(module)`.
- **Chips inline (`.chip-row` + `.chip` + `.chip.active`)** solo se usan para **filtros transitorios dentro de una vista** (ej. filtro de tier en una tabla), nunca para cambiar de vista completa.
- Para añadir un sub-módulo nuevo en una sub-cuenta: 1) añadir entrada en `WORKSPACES[ws].subs[modulo]`, 2) añadir caso en `getActiveSub`/`goSub` para mapearlo a su state-key, 3) leer ese state-key en el template.

---

## Marketplace · arquitectura central + atribución

El catálogo de productos (artículos · patrocinadores · eventos) **NO pertenece a ninguna sub-cuenta**: es un **marketplace único** que vive en la web pública y se navega desde `holding.marketplace` (sidebar del holding · 4 sub-tabs: overview · artículos · patrocinadores · eventos).

**Atribución del revenue por origen de cliente.** Cada transacción del marketplace lleva tag de la sub-cuenta de origen del cliente (relación más fuerte): si el cliente vino del club o las redes → E-Commerce; si está en el programa 12 sem → Clínica; si es cliente residencial → Residences; si es para estudios académicos → R&D.

Distribución mensual típica (mayo 2026): E-Commerce 65 % · Clínica 28 % · Residences 5 % · R&D 2 % (sobre marketplace total $ 38,4 K). Los patrocinios B2B se atribuyen 100 % a E-Commerce porque viven en sus canales.

**Implementación técnica:**
- `holding.marketplace` template con sub-tabs (overview reutiliza el catálogo de antes, ahora con sección de "Atribución por sub-cuenta" con donut + tabla)
- Las sub-vistas (articulos · patrocinadores · eventos) reutilizan el template `ecommerce.productos` (legacy, ya no en sidebar) vía pass-through: `state.productosTab = state.marketTab` antes de llamar
- `state.marketTab` es el source-of-truth para la navegación del marketplace
- `state.productosTab` se mantiene como variable de paso para no duplicar el template grande de catálogo
- Cada sub-cuenta muestra su slice atribuido en Finanzas y en el dashboard (`ecommerce.dashboard` tiene KPI "Marketplace atribuido" y card "Marketplace · atribuido a E-Commerce" que linka al holding)

**Cuando llegue la BBDD:** la tabla `transactions` lleva `origen_subcuenta_id FK` además de `product_id FK` y `client_id FK`. Las vistas de cada sub-cuenta hacen `WHERE origen_subcuenta_id = X`.

## E-Commerce · estructura final (Fases 1-7 implementadas)

**5 módulos** en sidebar: Dashboard · Club Privado · Redes Sociales · Finanzas · Personal.

(**Productos eliminado de E-Commerce** · el catálogo es marketplace central en holding · cada sub-cuenta solo ve su slice atribuido en Finanzas/dashboard).

### Club Privado · Overview + 4 tier sub-views en sidebar

- **Overview** (default) — vista comprehensiva: 6 KPIs (4 tiers + churn toggle + engagement medio) → pie por tier + multi-line growth 12 m → churn por tier (responde al toggle) + LTV por tier → top inviters + antigüedad media → cohort heatmap M0-M11 × 12 → distribución geográfica + demografía (edad + género) → listado con chip-filter por tier.
- **Miembros · Fundadores · Embajadores · Mentores** — drill-down por tier. Cada uno: 6 KPIs específicos (count, engagement, antigüedad, LTV, churn toggle, posts/miembro) + descripción del tier + growth chart 12 m solo de ese tier + geográfica del tier + demografía (edad) + listado solo del tier.
- Datos servidos por `TIER_DATA` (objeto inline en el template) — añadir un campo nuevo aquí se refleja en todas las vistas.

**Churn = (bajas en el periodo / total al inicio del periodo) × 100**. Duro = bajas formales. Blando = inactivos > 30 d sin baja formal. El toggle `setChurnMode('duro'|'blando')` afecta tanto al Overview como a los tier sub-views.

### Redes Sociales · 6 sub-módulos en sidebar
- Overview (default) — KPIs consolidados + chart 4 redes mismo eje (absolutos · K) + tabla resumen
- TikTok · Instagram · LinkedIn · YouTube — cada una con sus KPIs aislados + chart growth + top posts
- Calendario — calendario multi-canal · alimentará `content_calendar`

### Productos · 3 sub-módulos en sidebar
- Artículos (SKUs, stock, margen) — chart de ventas es **stacked bar por categoría** (Hardware, Digital, Libros, Suplementos, Merch)
- Patrocinadores (contratos, valor, entregables)
- Eventos (fecha, aforo, asistentes ↔ miembros, acceso club/fundadores/público)

### Finanzas · template dedicado (`ecommerce_finanzas`, no comparte `tpl_finanzas`)

6 KPIs (Ingresos · Recurrente mensualizado · Margen · Pendiente · ARR contratado · CAC blended) → Ingresos por fuente stacked 6m + donut mix mes actual → Forecast 6m basado en contratos + tabla próximos cobros → Margen por categoría + CAC por canal → Aportación por tier del club (cross-ref con LTV × miembros) + Gastos del mes desglosados → Facturas recientes.

---

## Clínica · estructura final (basada en doc "Automatización del Negocio - Clínica")

**9 módulos** en sidebar: Dashboard · Funnel cliente · Programa 12 sem · Citas · Productos · Automatizaciones · Inventario · Finanzas · Personal.

El modelo de Clínica NO es el tradicional de "pacientes individuales con consultas sueltas" sino **programa estructurado de 12 semanas con automatización end-to-end + upselling sistemático + API farmacéutica REFILL**. Los conceptos "paciente" del template viejo siguen en código (legacy) pero no se navegan desde sidebar.

**Modelo operativo · no hay inventario.** Reto Health Clínica funciona **on-demand** (estilo print-on-demand pero adaptado): el cliente viene a clínica el día del estudio para tests con máquinas (sangre, HSIC, composición, HRV), tras eso el Agente Evaluador genera 3 planes personalizados (médico · nutricional · ejercicio) y la parte de medicación se dispensa vía API farmacéutica (REFILL). No hay stock físico de suplementos/medicación en clínica. **El módulo `inventario` está eliminado del sidebar de Clínica.** Si en algún momento se vuelve a necesitar, recuperar el template legacy + remontar en `WORKSPACES.clinica.modules`.

**Patrón de chart aprobado · bar + line combinado con puntos entre barras.** Para visualizar simultáneamente n absoluto (bar) y % conversión entre puntos consecutivos (line con dots posicionados entre dos barras), usar `scales.x:{type:'linear', min:0.5, max:N+0.5}` con bars en x=1,2,...,N y line en x=1.5,2.5,...,N-0.5. La línea con `borderWidth:2.6`, color que contraste con las barras (sage + vermillion `#D9531C` funciona), `pointRadius:5.5` con borde paper para que se vea por encima de las barras. Dual axis: `y` izquierdo (n), `y1` derecho (%). Las ticks del eje X usan callback que solo muestra etiquetas en enteros. Ver `ch-cl-prog-personas`.

### Funnel cliente · 6 pasos del journey

`clinica.funnel` muestra los 6 pasos como secciones editoriales con número Fraunces grande + estado de automatización por etapa (⚡ activo · ◷ fase posterior · ✋ manual) + conteo de clientes en cada etapa + conversion bar:

1. **Entrada · lead** (⚡) — captura CRM + email auto
2. **CORE · pago + test** (⚡ PRIORIDAD #1) — firma + link pago + factura + test condicional
3. **Reserva cita** (⚡) — link reserva + confirmación + recordatorio 2 d
4. **Día de estudio** (✋ MANUAL · prioridad automatizar) — subida resultados + notif "listos"
5. **Resultados online** (⚡) — videocall + grabación a perfil
6. **Decisión · acepta** (⚡) — Rama B: cobro + factura + API REFILL · Rama A: test motivos

### Programa 12 sem · Overview + 3 fases en sidebar

- `overview` (default): 6 KPIs + distribución por semana + upselling por producto + cohort heatmap (renderClinicaCohorts) + tabla de adopción de productos
- `sem01-04` Onboarding (62 clientes · 18 upsell)
- `sem05-08` Núcleo (68 · 32)
- `sem09-12` Renovación (56 · 22)

### Productos · 6 sub-tipos en sidebar

Suplementos (API REFILL · auto-pedido) · Tec (wearables · luz roja · CGM · báscula) · Libro · Consultoría 1:1 · Nutrición · Entrenamiento. Cada uno con sub-tab independiente, KPIs y tabla de catálogo.

### Automatizaciones · health-check

Lista de 29 automatizaciones del flujo end-to-end con estado ⚡◷✋, categoría, runs/30 d, success rate. KPIs agregados: activas / pendientes / manuales / runs total / success rate medio. **Prioridad #1 destacada: subida automática de resultados del paso 4**.

### Finanzas · template dedicado (`clinica_finanzas`)

6 KPIs (Ingresos · MRR programa · Margen · Pendiente · % cobros auto · CAC paciente). Stacked bar 6m (estudios + programa recurring + upselling + API REFILL) + donut mix · Upselling revenue por producto + próximos cobros recurrentes · Margen por línea + funnel económico · Facturas recientes.

Las sub-cuentas Residences, R&D y Holding siguen usando `tpl_finanzas` genérico.

---

## Modelo de datos previsto (esquema BBDD futuro)

```
members (id, email, nombre, tier ENUM[miembro|fundador|embajador|mentor],
         fecha_ingreso, invitado_por_id FK, estado, engagement)
member_tier_history (member_id FK, tier_anterior, tier_nuevo, fecha, motivo)

social_accounts (id, plataforma ENUM[tiktok|instagram|linkedin|youtube], handle, url)
social_metrics (account_id FK, fecha, followers, alcance, engagement, conversiones)
social_posts (account_id FK, fecha_publicacion, tipo, kpi_alcance, kpi_engagement)
content_calendar (id, fecha, pieza, canales[], owner_id FK, estado)

products (id, tipo ENUM[articulo|patrocinador|evento], nombre, precio_base, activo)
product_articles (product_id FK, sku, stock, margen, categoria)
product_sponsors (product_id FK, marca, sector, contrato_inicio, contrato_fin, valor, entregables)
product_events (product_id FK, fecha, lugar, aforo, acceso ENUM[club|fundadores|publico])

transactions (id, product_id FK, member_id FK?, monto, fecha) → alimenta finanzas
event_attendees (event_id FK, member_id FK) → habilita el % asistentes ↔ club
```

Las vistas internas (cohortes, scoring AI, calendario) son **queries**, no tablas. Esto evita duplicación cuando llegue la BBDD.

---

## Decisiones de diseño relevantes

- **Skool** es solo plataforma técnica subyacente del club. Toda referencia user-facing usa "Club". La tarjeta de integración Skool está marcada como "legacy · evaluar migración".
- **Tiers**: Miembro (`tag info`) · Fundador (`tag copper`) · Embajador (`tag plum`) · Mentor (`tag sage`).
- **Pipeline de admisión** aplica SOLO a Miembros. Fundadores/Embajadores/Mentores son por invitación directa o promoción interna.
- **Eventos** tienen 3 niveles de acceso (`Solo club`, `Solo fundadores`, `Público`) — mapean a `members.tier` para validación de acceso.
- **Charts inicializadas condicionalmente** permiten añadir nuevas vistas sin tocar lógica de bootstrap.

---

## Patrones que funcionan (mantener)

1. **Plan completo ANTES de tocar código**. Entregar el plan en fases con tabla de decisiones (qué se mantiene, qué se transforma, qué se elimina). Confirmar antes de cada fase.
2. **Ediciones en paralelo** cuando los `old_string` son únicos y no se solapan — un mensaje con múltiples llamadas a `Edit`.
3. **Comentarios marcadores** al eliminar legacy: `// Legacy X eliminado en Fase Y · reemplazado por Z`. Mejor que borrar limpiamente para trazabilidad.
4. **Reutilizar CSS existente** (chip, kpi-grid, kanban, tag, table) — nunca inventar estilos nuevos sin necesidad.
5. **State sub-properties con setters** (`setClubTab`, `setSocialTab`, `setProductosTab`) en lugar de manipulación directa.
6. **Chart inits aditivos** en `initWidgets`: `if (getElementById(...))` permite que el mismo bootstrap inicialice charts de cualquier tab.
7. **Datos mock alineados con el esquema BBDD** — los campos visibles ya son los que existirán como columnas reales.

---

## Anti-patterns (evitar)

- ❌ Re-leer un archivo justo después de editarlo (el harness lo tiene actualizado).
- ❌ Crear nuevos archivos cuando se puede editar el existente.
- ❌ `replace_all` cuando hay variantes contextuales (ej. "Skool" en tarjeta de integración vs. "Skool" en analítica de origen requieren tratamientos distintos).
- ❌ Verificar tras Edit con un Read inmediato — el Edit ya reportaría el error.
- ❌ Resumir todo lo que se hizo al final de cada respuesta — el usuario lo prefiere conciso.
- ❌ Crear módulos/tablas nuevas cuando un sub-tab + query basta (cohortes/scoring son vistas, no entidades).
- ❌ **Inventar contenido de dashboards sin preguntar primero**. Los datos mock se ven plausibles pero no reflejan el modelo mental del usuario. Antes de rellenar un módulo, preguntar qué métricas tienen valor real en su negocio (qué quiere ver, qué decisiones toma con cada KPI).
- ❌ **Cambiar un concepto fundamental (tiers, fuentes de ingreso, plataformas) y limpiar solo lo evidente**. Hay tablas de fallback para queries del copilot, saved views, regex matchers, demos de búsqueda — todos ellos contienen el modelo viejo y hay que actualizarlos a la par. Hacer un sweep exhaustivo con OR-pattern grep antes de cerrar la fase.
- ❌ **Poner sub-navegación como chips encima del contenido**. La sub-navegación debe vivir en el sidebar como segundo nivel jerárquico (estilo VS Code / Notion). Las chips inline solo se justifican para filtros transitorios (ej. filtro de tier dentro de una tabla), no para cambiar de vista completa.

---

## Sistema de diseño · "Specimen" (Fases A-H)

Bio-editorial × Lab precision. Wellness en cuerpo + futurismo en sidebar.

**Tokens · `:root`**
- Wellness body: `--bg #F4EFE6`, `--paper #FAF6EE`, `--ink #1B1816`, `--rule #E2DAC9`, `--ink-deep #0E0C0A`.
- Futurismo sidebar: `--side-bg #0F0E0C`, `--side-glow #C4F45E` (lab-glow signature).
- Workspace accents: holding `#A05A1F` cobre · clinica `#4A6A48` sage · residences `#B86433` terracota · ecommerce `#3A6FD1` azul tinta · rd `#6E4F7A` plum.

**Tipografía**
- `--display`: **Fraunces** variable (opsz 9..144) — page titles, KPI numbers, brand name.
- `--sans`: **Geist** (Vercel) — body, UI, card-h h3, page-sub italic.
- `--mono`: **Geist Mono** — KPI labels, data, tabla headers, ticks de charts, tooltips title, nav-group, nav-sub-num, tags, ws-badge, crumbs, sec-num, fig-marker, n-marker, live-indicator, kpi-seg.
- Body siempre: `font-feature-settings:'tnum','lnum','ss01','cv11'; font-optical-sizing:auto`.

**Charts (Chart.js defaults globales en `initWidgets`)**
- Sin gridlines en eje X (categórica limpia); hairlines en Y `rgba(27,24,22,.05)` con ticks 4 px tipo regla.
- Numerales en Geist Mono 10.5 px.
- Líneas 1.5 px, tension .32, puntos invisibles excepto al hover (5 px con borde 2 px y centro paper).
- Barras radius 2 px (casi cuadradas).
- Tooltip: bg `--ink #1B1816`, title color `--side-glow` (lab readout feel), title Geist Mono, body Geist sans.

**KPI editorial block (`.kpi-grid` + `.kpi`)**
- Sin caja · sin borde · sin sombra. Strip horizontal con hairline top/bottom.
- `grid-template-columns: repeat(auto-fit, minmax(170px,1fr))` (adapta a 4/5/6 KPIs).
- Divisores verticales 1 px entre KPIs (`border-left`).
- Label: Geist Mono 9.5 px uppercase `.20em` tracking.
- Value: Fraunces 38 px weight 400, `opsz 96`, `font-variant-numeric:tabular-nums`.
- Trend: Geist Mono 11 px.
- Hover en clickable: warm wash + número cambia a `--ws-accent`.

**Sidebar futurista**
- Background warm-black + linear gradient sutil arriba + radial halo lab-glow.
- Nav items: borde-left 2 px lab-glow al activarse + pulsing dot derecha (animación `pulseGlow` 2.4 s, glow box-shadow 8 px).
- Sub-items numerados `01 · 02 · 03` en Geist Mono 9 px tracked; active state es lab-glow color (sin fill).
- Group labels: Geist Mono 9 px `.22em` tracking.

**Page head editorial**
- Hairline border-bottom (no card).
- `ws-badge` ahora kicker mono con dot del ws-accent + `live · 30 d` indicator (pulsing lab-glow).
- Title: Fraunces 40 px peso 400 (`opsz 144`).
- Page-sub: italic Fraunces — dek editorial.

**Tables**
- Headers Geist Mono uppercase `.18em` tracking, sin background fill.
- Hover row warm wash, no zebra-stripes.
- Active row con `box-shadow: inset 2px 0 0 var(--ws-accent)`.

**Tags**
- Geist Mono uppercase `.08em` tracking, border-radius 3 px (casi cuadrado, no pill).

**Botones**
- Border-radius 4 px (sharper).
- Primary: warm-black bg → hover muestra `lab-glow` en texto (mini reveal).

**Micro-details disponibles como helpers CSS**
- `.n-marker` — `n = 2.184` con bg lab-glow al 10 %.
- `.fig-marker` — `[fig. 01]` mono pequeño.
- `.live-indicator` — pulsing dot + `live · 30 d` (en page-head por defecto).
- `.reg-corner` (tl/tr/bl/br) — registration marks `+` en esquinas de cards.
- `.sec-num` — numeral Fraunces para encabezados de bloque.

**Motion**
- `.content > *` con `fadeInUp .55s cubic-bezier(.16,1,.3,1)` en stagger 70 ms.
- `prefers-reduced-motion: reduce` desactiva animaciones y pulsing.

**Paper grain**
- Body `::after` con SVG noise overlay al 2.5 % opacity, `mix-blend-mode:multiply`.

**Scan-line topbar**
- `::before` con linear-gradient lab-glow al 15 % en el top de la topbar.

## Layout de charts — gotcha conocido

Los `.grid-2`, `.grid-2-eq` y `.grid-3` tienen `align-items:start` para que las cards no estiren a la altura de su fila. **Sin esto**, cuando una card es un chart de altura fija (ej. 210px) y la card vecina es una tabla larga (ej. 450px), el grid estiraría la card del chart a 450px y dejaría **170px de relleno blanco bajo el canvas** (porque el contenedor interno del chart tiene height fijo).

Si en el futuro se quiere que ambas cards crezcan al unísono, hay que: 1) eliminar el height fijo del contenedor del chart, 2) hacer que `.card-b` sea flex-column con `flex:1` en el chart wrapper. De momento `align-items:start` es la solución barata y suficiente.

## Optimización de tokens (lecciones acumuladas)

- Los `grep` con `head_limit` y patrón específico son **mucho más baratos** que leer archivos enteros.
- **Una edición grande > muchas pequeñas** cuando el contexto del `old_string` es claro (ej. eliminación de 5 templates legacy en una sola edición).
- Pestañas con `state.xTab + setXTab` reusan template, son **más baratas** que 4 templates separados.
- No re-emitir la propuesta entera en cada respuesta — apuntar al cambio puntual.
- Para verificar después de muchas ediciones: un `grep` con OR-pattern detecta residuales más eficientemente que reads múltiples.

---

## Pendientes futuros

- **Backend / BBDD**: implementar el esquema descrito arriba.
- **Filtro real por tier en Club Privado** (hoy visual): query `WHERE tier=X` cuando haya BBDD.
- **Tarjeta Skool** (línea ~4127): decisión final — ¿migra a plataforma propia o se mantiene?
- **Sub-cuentas Clínica, Residences, R&D**: mismo tratamiento (alinear cuando se decida su evolución).
- **Comentarios JS internos** con MRR/churn (líneas 2561-2562, 4650-4653): cosméticos, baja prioridad.
