# Plan de Fases — Implementación Dashboard
**Estrategia**: cada fase entrega valor visible, construye sobre la anterior, y se valida antes de pasar a la siguiente.

---

## FASE 0 — Fundamentos (Design System)
**Objetivo**: crear los componentes reutilizables que apalancarán las fases 1-4.
**Entrega**: librería de componentes lista, no impacta UI todavía.

- [ ] `<InsightCard>` — sustituye `Detalle 1/2/3`. Props: título, valor, delta, sparkline opcional, CTA opcional.
- [ ] `<ExpandableMiniDashboard>` — wrapper estándar. Click → panel lateral o modal con detalle.
- [ ] `<InteractiveCalendar>` — click en día → emite evento `onDateSelect(date)` con panel de eventos.
- [ ] `<DrillDownItem>` — wrapper para items clicables (cotizaciones, protocolos, estudios, propuestas, vendors).
- [ ] `<AlertBanner>` — banner accionable tipo "3 pacientes riesgo no-show".
- [ ] **Paleta categórica** definida en tokens: leads (4 colores), orígenes (4 colores), pipeline (5 colores), gastos (N colores).

**Validación**: storybook o página demo con los 6 componentes funcionando.

---

## FASE 1 — Matar los placeholders
**Objetivo**: eliminar todos los `Detalle 1/2/3` del producto. Insights reales en todas partes.
**Dependencia**: Fase 0.

- [ ] Auditoría: listar TODAS las ubicaciones de `Detalle 1/2/3` (Holding, Clínicas, Residencies, E-commerce, R&D × Finanzas, Pipeline, Personal, Inventario, Grants…).
- [ ] Para cada ubicación, definir los 3 insights útiles (variación %, top N, alerta, comparativa, recomendación).
- [ ] Sustituir con `<InsightCard>`.
- [ ] Reducir Forecast R&D de 5 → 4 mini dashboards (eliminar el menos útil).

**Validación**: 0 ocurrencias de "Detalle 1/2/3" en la UI.

---

## FASE 2 — Interactividad básica
**Objetivo**: que todo lo que parece clicable, lo sea.
**Dependencia**: Fase 0.

- [ ] Calendario interactivo en TODAS las cuentas (Holding, Clínicas, Residencies, E-commerce, R&D).
- [ ] Mini dashboards expandibles en TODAS las ubicaciones:
  - Holding: top bar (4 cuentas)
  - Clínicas: Inventario, Personal, Finanzas (gastos + pendiente cobro)
  - Residencies: Personal, Finanzas, Instalación
  - R&D: Personal, Grants, Finanzas
  - Cross: Pipeline mini dashboards
- [ ] Items de listas drill-down: cotizaciones (ej. "Hacienda de Sevilla"), protocolos, estudios, propuestas.

**Validación**: ningún elemento visualmente "tocable" debe ser inerte.

---

## FASE 3 — Layout y color
**Objetivo**: arreglar la jerarquía visual del Holding y diferenciar categorías.
**Dependencia**: Fase 0 (paleta).

- [ ] Holding: layout **2x2** (Clínicas + Residencies arriba / E-commerce + R&D abajo).
- [ ] Aplicar paleta categórica diferenciada:
  - Estados de lead (Lead/Visit/Activo/VIP) — 4 colores distintos
  - Origen de leads (Instagram/Skool/Web/Red) — 4 colores distintos
  - Aplicar mismo principio a todos los gráficos categóricos (estados pipeline, tipos gasto, etc.)
- [ ] Añadir **R&D** al apartado Finanzas del Holding.

**Validación**: revisión visual del Holding, ninguna categoría comparte color con otra adyacente.

---

## FASE 4 — Filtrado contextual de Finanzas
**Objetivo**: en cada subcuenta, los gráficos de Ingresos y Margen muestran SOLO sus datos.
**Dependencia**: ninguna.

- [ ] Implementar scope contextual: cuando estás en Clínicas, Ingresos = solo Clínicas (no el split del Holding).
- [ ] Aplicar a Clínicas, Residencies, E-commerce, R&D.
- [ ] En Holding: mantener vista consolidada con split por cuenta.
- [ ] Reemplazar también los placeholders de "Gastos del mes" y "Pendiente de cobro" con insights reales (ya cubierto en Fase 1, validar aquí).

**Validación**: en cada subcuenta, los números cuadran solo con esa subcuenta.

---

## FASE 5 — Sección Personal completa
**Objetivo**: hacer útil la gestión de personal en las 4 cuentas.
**Dependencia**: Fase 2 (mini dashboards expandibles).

- [ ] Mostrar por persona: pagos, horas trabajadas, productividad por hora.
- [ ] Vista lista + drill-down a ficha individual.
- [ ] Mini dashboards superiores con insights reales (no placeholders).
- [ ] Replicar en Clínicas, Residencies, E-commerce, R&D.

**Validación**: puedes ver cuánto cobra y cuántas horas hace cualquier persona del equipo.

---

## FASE 6 — Pipeline y Vendors enriquecidos
**Objetivo**: cards más informativas sin perder compacidad.
**Dependencia**: Fase 0 (DrillDownItem).

- [ ] Clínicas Pipeline cards: añadir próxima acción, valor estimado, prioridad/temperatura, días en etapa.
- [ ] Residencies Vendors: enriquecer con KPIs (lead time, % on-time, calidad, último pedido, condiciones).
- [ ] Ambos con drill-down al hacer click.

**Validación**: las cards comunican el estado del pipeline/vendor de un vistazo.

---

## FASE 7 — Banners accionables cross-account
**Objetivo**: replicar el patrón "3 pacientes riesgo no-show" en todas las cuentas.
**Dependencia**: Fase 0 (AlertBanner).

- [ ] Clínicas: ya existe (mantener).
- [ ] Residencies: alertas mantenimiento + ocupación crítica.
- [ ] E-commerce: stock crítico + ROAS bajo + carritos abandonados de alto valor.
- [ ] R&D: deadlines de grants en riesgo + hitos retrasados.
- [ ] Holding: alertas consolidadas cross-account (top 3 por urgencia).

**Validación**: cada cuenta muestra 1-3 alertas reales y accionables al entrar.

---

## FASE 8 — Cohortes simplificadas + Forecast estandarizado
**Objetivo**: cerrar con las funcionalidades analíticas avanzadas.
**Dependencia**: ninguna estricta.

- [ ] Cohortes en formato simplificado: una métrica única por cohorte ("% activo a 90 días" en barras), no la matriz clásica.
- [ ] Adaptar a cada cuenta:
  - Clínicas: cohorte = mes primera visita → % retención a 90d
  - R&D: cohorte = trimestre inicio estudio → % hitos completados
  - E-commerce: cohorte = mes primera compra → LTV a 90d
  - Residencies: cohorte = mes check-in → duración media
- [ ] Replicar el formato del Forecast cash flow (que te gustó) en: Forecast Pipeline (Clínicas/R&D), Forecast Inventario (E-commerce/Residencies), Forecast Grants (R&D).

**Validación**: las cohortes se entienden de un vistazo. Los forecast tienen formato consistente.

---

## Resumen de orden y dependencias

```
Fase 0 (Fundamentos) ─┬─→ Fase 1 (Placeholders)
                      ├─→ Fase 2 (Interactividad) ──→ Fase 5 (Personal)
                      ├─→ Fase 3 (Layout/Color)
                      ├─→ Fase 6 (Pipeline/Vendors)
                      └─→ Fase 7 (Banners)

Fase 4 (Filtrado Finanzas) — independiente
Fase 8 (Cohortes/Forecast) — independiente, al final
```

**Mi recomendación**: ir 0 → 1 → 2 → 3 → 4 en orden estricto. A partir de la 5 ya puedes paralelizar si trabajas con más de un frente.

---

## Estado actual

| Fase | Estado | Notas |
|---|---|---|
| 0 — Fundamentos | ⏳ Pendiente | Empezar aquí |
| 1 — Placeholders | ⏳ Pendiente | |
| 2 — Interactividad | ⏳ Pendiente | |
| 3 — Layout/Color | ⏳ Pendiente | |
| 4 — Finanzas filtrado | ⏳ Pendiente | |
| 5 — Personal | ⏳ Pendiente | |
| 6 — Pipeline/Vendors | ⏳ Pendiente | |
| 7 — Banners | ⏳ Pendiente | |
| 8 — Cohortes/Forecast | ⏳ Pendiente | |
