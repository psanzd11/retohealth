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

## E-Commerce · estructura final (Fases 1-7 implementadas)

**6 módulos** en sidebar: Dashboard · Club Privado · Redes Sociales · Productos · Finanzas · Personal.

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

Las otras 3 sub-cuentas siguen usando `tpl_finanzas` genérico.

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
