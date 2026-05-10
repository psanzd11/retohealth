# Roadmap Dashboard — Iteración 1
**Fecha:** 7 May 2026
**Fuente:** Feedback narrado tras revisión de Holding, Clínicas, Residencies, R&D

---

## 1. LO QUE FUNCIONA → Replicar en más sitios

| Patrón que te gusta | Dónde está hoy | Dónde más debería aplicarse |
|---|---|---|
| Mini dashboards expandibles con micro-gráfica + lead/dato | Holding (top bar) | **TODOS** los mini dashboards de TODAS las cuentas y TODOS los apartados (Finanzas, Personal, Pipeline, Inventario, Grants, etc.) |
| Forecast de cash flow | Holding · Finanzas | Replicar formato visual a: Forecast de Pipeline (Clínicas/R&D), Forecast de Inventario (E-commerce/Residencies), Forecast de Grants (R&D) |
| Banner superior accionable ("3 pacientes riesgo no-show 48h") | Clínicas (top) | Adaptar a cada cuenta: Residencies → alertas mantenimiento/ocupación · E-commerce → stock crítico/ROAS bajo · R&D → deadlines grants/hitos en riesgo · Holding → alertas consolidadas cross-account |
| Margen por unidad con colores diferenciados | Analítica · Margen | **Paleta categórica diferenciada** en TODOS los gráficos por categoría: leads (Lead/Visit/Activo/VIP), orígenes (Instagram/Skool/Web/Red), estados de pipeline, tipos de gasto, etc. |
| Insights reales en los 4 mini dashboards | R&D (top) | **Estándar obligatorio** para TODOS los mini dashboards en TODAS las cuentas — eliminar placeholders |

---

## 2. LO QUE NO FUNCIONA → Plan de corrección

### 🔴 CRÍTICOS (afectan a todas las cuentas)

1. **Eliminar `Detalle 1 / Detalle 2 / Detalle 3`** en TODOS los mini dashboards. Sustituir por insights reales (variación %, comparativa, top N, alerta accionable, recomendación).
2. **Calendario interactivo en todas las cuentas**: click en fecha → panel lateral con eventos/citas/hitos del día. Hoy no responde a clicks.
3. **Mini dashboards tocables / expandibles** en:
   - Clínicas: Protocolos, Inventario (banners), Personal
   - Residencies: Cotizaciones (ej. abrir "Hacienda de Sevilla"), Vendors, Personal, Instalación
   - R&D: Estudios, Propuestas, Personal, Grants
   - Finanzas (todas): "Gastos del mes" y "Pendiente de cobro"
4. **Filtrado por subcuenta en Finanzas**: en Clínicas, Residencies, E-commerce, R&D los gráficos de Ingresos y Margen deben mostrar SOLO los datos de esa subcuenta. Hoy muestran el split del Holding completo (incorrecto en vista filial).

### 🟠 POR CUENTA

**HOLDING**
- Reorganizar layout: **2x2** (Clínicas + Residencies arriba / E-commerce + R&D abajo). Hoy es 3+1 desigual.
- Añadir **R&D** al apartado Finanzas (ahora solo aparecen Clínicas, Residencies y E-commerce).
- Diferenciar colores en categorías: estados de lead (Lead/Visit/Activo/VIP) y origen de leads (Instagram/Skool/Web/Red).

**CLÍNICAS**
- Pipeline cards: hoy solo se ve "Marina Call · mañana pendiente". Añadir compacto: próxima acción, valor estimado, prioridad/temperatura, días en etapa.
- Protocolos: drill-down al tocar (versión, owner, última edición, casos asociados).
- Inventario: banners superiores tocables → vista detalle de stock por SKU.
- Personal: mostrar **pagos por persona, horas trabajadas, productividad por hora**.

**RESIDENCIES**
- Cotizaciones: drill-down al tocar cualquier item (ej. "Hacienda de Sevilla" → desglose, márgenes, status, próxima acción).
- Vendors: enriquecer con KPIs (lead time, % on-time, calidad, último pedido, condiciones).
- Personal: igual que Clínicas (pagos + horas + productividad).

**R&D**
- Pipeline · Forecast: reducir de **5 → 4 mini dashboards** (quedarse con los más útiles).
- Grants: sustituir placeholders por insights (% completado, próximo hito, riesgo de incumplimiento, monto en juego).
- Estudios y Propuestas: hacer clicables con drill-down.

---

## 3. Cohortes — Explicación que pediste

Un **análisis de cohortes** agrupa entidades (clientes, leads, pacientes, residentes) que comparten un evento temporal (típicamente el mes de adquisición o primer contacto) y rastrea cómo se comportan a lo largo del tiempo.

Aplicado a tus cuentas:
- **Clínicas**: cohorte = mes de primera visita. Mides retención/recompra a 30/60/90 días → detectas si los pacientes nuevos vuelven menos que los del trimestre anterior.
- **R&D**: cohorte = trimestre de inicio del estudio. Trackeas % de hitos completados a los X meses → ves si los estudios nuevos avanzan más rápido o más lento.
- **E-commerce**: cohorte = mes de primera compra. Mides LTV acumulado, frecuencia de recompra, churn → ves si la calidad de cliente nuevo se está deteriorando.
- **Residencies**: cohorte = mes de check-in. Mides duración media de estancia, upsells, NPS → detectas si la experiencia está mejorando o empeorando con cada generación.

**Recomendación**: en vez de la matriz clásica (que confunde), mostrar UNA métrica por cohorte: "% activo a los 90 días por mes de adquisición" en formato barras. Un solo número por cohorte, comparable de un vistazo.

---

## 4. Quick wins — orden de implementación

1. **Componente reutilizable de "InsightCard"** que sustituya todos los `Detalle 1/2/3` (1 cambio → impacto en todas las cuentas).
2. **Calendario interactivo** (componente único compartido).
3. **Mini dashboards expandibles** (componente expandable estándar — un solo desarrollo, aplicar en todos lados).
4. **Paleta categórica** definida en design system → aplicar a leads, orígenes, estados.
5. **Layout 2x2** en Holding (cambio CSS rápido).
6. **Drill-downs** en cotizaciones, protocolos, estudios, propuestas, vendors (modal + ruta detalle).
7. **Filtrado contextual de Finanzas por subcuenta** (lógica de scope).
8. **Reducir 5 → 4** mini dashboards en Forecast de R&D.
9. **Sección Personal completa** (pagos, horas, productividad) — replicar en las 4 cuentas.
10. **Cohortes simplificadas** a una métrica visual única.

---

## 5. Resumen ejecutivo

- **Patrón ganador a estandarizar**: mini dashboards expandibles + insights reales + colores categóricos diferenciados + banners accionables. Deben estar en todo.
- **Deuda técnica principal**: placeholders (`Detalle 1/2/3`), no-interactividad (calendarios, mini dashboards, items de pipeline), y filtrado incorrecto en Finanzas.
- **Quick wins más rentables**: 1 → 2 → 3 (componentes reutilizables que limpian deuda en todas las cuentas a la vez).
