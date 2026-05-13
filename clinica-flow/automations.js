/**
 * RETO HEALTH · CLÍNICA · Automations module
 * ------------------------------------------------------------
 * Backend mock del flujo de 6 pasos + seguimiento 12 semanas.
 *
 * Cada función:
 *   - Tiene signature estable lista para wirear backend real
 *   - Devuelve un mock structured response (Promise)
 *   - Emite eventos vía AutomationBus (suscribibles)
 *   - Comentarios `// INTEGRATION:` marcan dónde conectar al sistema externo
 *
 * State store: localStorage bajo la key `reto.clinica.state`
 * Logs: localStorage bajo `reto.clinica.log` (últimas 200 entries)
 *
 * Uso desde el dashboard:
 *   import { Automations } from './automations.js';
 *   await Automations.createLead({nombre:'Carla', email:'...', origen:'IG'});
 *
 * Uso standalone (testing):
 *   <script type="module" src="./automations.js"></script>
 *   window.Automations.runWeeklyTest('client_001', 3);
 */

// ============================================================
// EVENT BUS · permite encadenar automatizaciones
// ============================================================
class AutomationBus {
  constructor(){ this.handlers = {}; }
  on(event, fn){ (this.handlers[event] = this.handlers[event] || []).push(fn); return this; }
  emit(event, payload){
    Log.write({ts: Date.now(), event, payload});
    (this.handlers[event] || []).forEach(fn => { try { fn(payload); } catch(e){ console.error(e); } });
  }
}
export const Bus = new AutomationBus();

// ============================================================
// STATE STORE · localStorage backed · lista para sustituir por DB
// ============================================================
const STATE_KEY = 'reto.clinica.state';
const LOG_KEY   = 'reto.clinica.log';

function loadState(){
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || initialState(); }
  catch(e) { return initialState(); }
}
function saveState(s){ localStorage.setItem(STATE_KEY, JSON.stringify(s)); }
function initialState(){
  return {
    leads: {},        // {id: {nombre, email, origen, fechaEntrada, status}}
    clientes: {},     // {id: {leadId, nombre, email, edad, fechaInicio, semanaActual, programaActivo}}
    pagos: {},        // {id: {clienteId, concepto, importe, fecha, status, stripeId?}}
    facturas: {},     // {id: {clienteId, pagoId, importe, fecha, url}}
    documentos: {},   // {id: {clienteId, tipo, firmado, fecha, docusignEnvelopeId?}}
    citas: {},        // {id: {clienteId, fechaHora, tipo, calComLink?, googleEventId?, estado}}
    tests: {},        // {id: {clienteId, tipo, semana?, respuestas, analisisAI, fecha}}
    resultados: {},   // {id: {clienteId, estudio, archivos, fechaSubida, notificado}}
    grabaciones: {},  // {id: {clienteId, citaId, url, fecha}}
    pedidos: {},      // {id: {clienteId, productos[], refillId?, estado, tracking?}}
    upsell: {},       // {id: {clienteId, productosOfertados[], aceptados[], fecha}}
    automacionLog: {} // {id: {automacion, status, fechaEjecucion, error?}}
  };
}

const Log = {
  read(){ try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch(e) { return []; } },
  write(entry){
    const log = this.read();
    log.unshift(entry);
    if (log.length > 200) log.length = 200;
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }
};

const State = {
  get(){ return loadState(); },
  set(updater){ const s = loadState(); const ns = typeof updater === 'function' ? updater(s) : {...s, ...updater}; saveState(ns); return ns; },
  upsert(collection, id, data){
    const s = loadState();
    s[collection] = s[collection] || {};
    s[collection][id] = {...(s[collection][id] || {}), ...data};
    saveState(s);
    return s[collection][id];
  }
};

function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function now(){ return new Date().toISOString(); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// AUTOMATIONS · 1:1 con el roadmap del PDF
// ============================================================
export const Automations = {

  // ========== ENTRADA · Paso 1 ==========

  /**
   * createLead — captura de datos en CRM al primer contacto
   * INTEGRATION: GHL · POST /contacts (con tag "Clínica · Lead")
   *              Slack notif: #clinica-leads
   */
  async createLead({ nombre, email, telefono, origen, mensaje }){
    const id = uid('lead');
    const lead = { id, nombre, email, telefono, origen, mensaje, fechaEntrada: now(), status: 'nuevo' };
    State.upsert('leads', id, lead);
    Bus.emit('lead.created', lead);
    // Encadena: envío automático del email de bienvenida
    await this.sendWelcomeEmail(lead);
    return { ok: true, lead };
  },

  /**
   * sendWelcomeEmail — respuesta automática por email con info del servicio
   * INTEGRATION: SendGrid · POST /v3/mail/send (template d-xxx · vars{nombre, origen})
   *              GHL · POST /conversations (registrar email enviado)
   */
  async sendWelcomeEmail(lead){
    await sleep(80);
    const id = uid('email');
    Log.write({ts: Date.now(), event: 'email.welcome.sent', to: lead.email, template: 'welcome'});
    Bus.emit('email.welcome.sent', { id, to: lead.email });
    return { ok: true, id, template: 'welcome.html', to: lead.email };
  },

  // ========== PASO 2 · CORE (PRIORIDAD #1) ==========

  /**
   * sendDocsForSignature — envío de documentos para firma digital
   * INTEGRATION: DocuSign · POST /v2.1/accounts/{accountId}/envelopes
   *              (template_id, signers:[{email, name}])
   */
  async sendDocsForSignature(leadId, docTypes = ['consentimiento_informado', 'condiciones_servicio']){
    const lead = State.get().leads[leadId];
    if (!lead) throw new Error('Lead not found');
    const id = uid('doc');
    State.upsert('documentos', id, { id, leadId, tipos: docTypes, fecha: now(), firmado: false, docusignEnvelopeId: null });
    Bus.emit('docs.sent_for_signature', { id, leadId, types: docTypes });
    return { ok: true, id, signatureUrl: `https://docusign.example.com/sign/${id}` };
  },

  /**
   * createPaymentLink — generación de link de pago al instante
   * INTEGRATION: Stripe · POST /v1/payment_links (price_data, currency:eur, line_items)
   *              Email auto al cliente con el link
   */
  async createPaymentLink({ leadId, concepto, importe }){
    const lead = State.get().leads[leadId];
    if (!lead) throw new Error('Lead not found');
    const id = uid('pay');
    const link = `https://buy.stripe.com/test_${id}`;
    State.upsert('pagos', id, { id, leadId, concepto, importe, fecha: now(), status: 'pending', stripeLink: link });
    Bus.emit('payment.link_created', { id, leadId, link, importe });
    return { ok: true, id, link, importe };
  },

  /**
   * onPaymentConfirmed — webhook Stripe · pago confirmado
   * INTEGRATION: Stripe webhook · event 'checkout.session.completed'
   *              Encadena: factura + reserva cita + test protocolo
   */
  async onPaymentConfirmed(paymentId){
    const pago = State.get().pagos[paymentId];
    if (!pago) throw new Error('Payment not found');
    State.upsert('pagos', paymentId, { status: 'paid', fechaPago: now() });
    Bus.emit('payment.confirmed', { id: paymentId, leadId: pago.leadId });
    // Encadena
    const factura = await this.generateInvoice(pago);
    const reserva = await this.sendBookingLink(pago.leadId);
    const test = await this.sendProtocolTest(pago.leadId);
    return { ok: true, pago, factura, reserva, test };
  },

  /**
   * generateInvoice — generación y envío automático de factura al confirmar pago
   * INTEGRATION: QuickBooks · POST /v3/company/{companyId}/invoice
   *              Email auto · adjuntar PDF
   */
  async generateInvoice(pago){
    const id = uid('inv');
    const numero = `F-2026-${String(Object.keys(State.get().facturas).length + 200).padStart(4,'0')}`;
    const url = `./factura-template.html?id=${id}`;
    State.upsert('facturas', id, { id, numero, pagoId: pago.id, leadId: pago.leadId, importe: pago.importe, fecha: now(), url });
    Bus.emit('invoice.generated', { id, numero, leadId: pago.leadId, url });
    return { ok: true, id, numero, url };
  },

  /**
   * sendProtocolTest — envío del TEST de protocolo (plantilla con lógica condicional)
   * INTEGRATION: Gemini/Perplexity API · llamada inicial para personalizar branching
   *              Email con link único al test (con token)
   */
  async sendProtocolTest(leadId){
    const id = uid('test');
    const token = uid('tok').replace('tok_','');
    const url = `./test-protocolo.html?lead=${leadId}&token=${token}`;
    State.upsert('tests', id, { id, leadId, tipo: 'protocolo_inicial', fecha: now(), url, completado: false });
    Bus.emit('test.protocolo.sent', { id, leadId, url });
    return { ok: true, id, url };
  },

  /**
   * submitProtocolTest — captura de respuestas del TEST
   * INTEGRATION: Backend nuestro · analiza respuestas con Gemini+Perplexity
   *              Genera resumen automatizado guardado en CRM
   */
  async submitProtocolTest(testId, respuestas){
    const test = State.get().tests[testId];
    if (!test) throw new Error('Test not found');
    State.upsert('tests', testId, { respuestas, completado: true, fechaCompletado: now() });
    // INTEGRATION: análisis AI
    const analisisAI = await this._analyzeTestWithAI(respuestas, 'protocolo_inicial');
    State.upsert('tests', testId, { analisisAI });
    Bus.emit('test.protocolo.completed', { id: testId, leadId: test.leadId, analisisAI });
    return { ok: true, analisisAI };
  },

  // ========== PASO 3 · Reserva cita ==========

  /**
   * sendBookingLink — envío automático del link de reserva tras pago
   * INTEGRATION: Cal.com · evento "Estudio inicial · 90 min" (link con prefilled email)
   *              GHL: registrar interacción
   */
  async sendBookingLink(leadId){
    const id = uid('book');
    const url = `https://cal.com/reto-health/estudio-inicial?email=${encodeURIComponent(State.get().leads[leadId]?.email || '')}`;
    State.upsert('citas', id, { id, leadId, fechaHora: null, calComLink: url, estado: 'link_enviado', tipo: 'estudio_inicial' });
    Bus.emit('booking.link_sent', { id, leadId, url });
    return { ok: true, id, url };
  },

  /**
   * onBookingConfirmed — webhook Cal.com · cita agendada
   * INTEGRATION: Cal.com webhook · event 'BOOKING_CREATED'
   *              Confirmación auto al responsable + recordatorio programado
   */
  async onBookingConfirmed(bookingId, fechaHora){
    const cita = State.get().citas[bookingId];
    if (!cita) throw new Error('Booking not found');
    State.upsert('citas', bookingId, { fechaHora, estado: 'confirmada' });
    Bus.emit('booking.confirmed', { id: bookingId, leadId: cita.leadId, fechaHora });
    // Programa recordatorio · 2 d antes
    this._scheduleReminder(bookingId, fechaHora);
    return { ok: true };
  },

  /**
   * sendReminder · 2 d antes con instrucciones preestudio
   * INTEGRATION: SendGrid (email) + Twilio (SMS) + WhatsApp Business API
   */
  async sendReminder(bookingId){
    const cita = State.get().citas[bookingId];
    if (!cita) return;
    Bus.emit('reminder.sent', { bookingId, leadId: cita.leadId, channel: 'email+sms' });
    return { ok: true, sent: ['email', 'sms'] };
  },

  // ========== PASO 4 · Día de estudio (✋ MANUAL hoy · prioridad automatizar) ==========

  /**
   * uploadStudyResults — subida de resultados al perfil del cliente
   * INTEGRATION (futuro): equipos médicos vía HL7/FHIR o subida manual + OCR
   *                       Actual: upload manual desde el portal interno
   */
  async uploadStudyResults(citaId, archivos /* [{nombre, tipo, url, valoresExtraidos?}] */){
    const cita = State.get().citas[citaId];
    if (!cita) throw new Error('Cita not found');
    const id = uid('res');
    State.upsert('resultados', id, { id, citaId, leadId: cita.leadId, archivos, fechaSubida: now(), notificado: false });
    Bus.emit('results.uploaded', { id, leadId: cita.leadId });
    // Encadena: notificación automática
    await this.notifyResultsReady(id);
    return { ok: true, id };
  },

  /**
   * notifyResultsReady — notificación automática "tus resultados están listos"
   * INTEGRATION: SendGrid (email) + WhatsApp Business
   */
  async notifyResultsReady(resultId){
    const res = State.get().resultados[resultId];
    State.upsert('resultados', resultId, { notificado: true, fechaNotificacion: now() });
    Bus.emit('results.notification_sent', { resultId, leadId: res.leadId });
    return { ok: true };
  },

  // ========== PASO 5 · Resultados online ==========

  /**
   * scheduleResultsCall — convocatoria automática de cita con link videollamada (1h, +2 sem)
   * INTEGRATION: Cal.com (videocall event) + Zoom/Whereby auto
   */
  async scheduleResultsCall(resultId){
    const res = State.get().resultados[resultId];
    if (!res) throw new Error('Result not found');
    const id = uid('call');
    const videoLink = `https://whereby.com/reto-health/${id}`;
    State.upsert('citas', id, { id, leadId: res.leadId, tipo: 'resultados_online', fechaHora: null, videoLink, estado: 'link_enviado' });
    Bus.emit('results_call.scheduled', { id, leadId: res.leadId, videoLink });
    return { ok: true, id, videoLink };
  },

  /**
   * saveCallRecording — grabación guardada automáticamente en perfil del cliente
   * INTEGRATION: Whereby/Zoom webhook · 'recording.completed' → guardar URL en S3 propio
   */
  async saveCallRecording(callId, recordingUrl){
    const cita = State.get().citas[callId];
    const id = uid('rec');
    State.upsert('grabaciones', id, { id, citaId: callId, leadId: cita.leadId, url: recordingUrl, fecha: now() });
    Bus.emit('recording.saved', { id, leadId: cita.leadId });
    return { ok: true, id };
  },

  // ========== DECISIÓN ==========

  /**
   * evaluatorAgent — Agente Evaluador AI con 3 skills
   * Tras la cita de resultados, genera los 3 planes en paralelo a partir del estudio + TEST.
   * INTEGRATION: Gemini (medical reasoning) + Perplexity (clinical evidence) + nuestro RAG con catálogo
   *              Cada skill es un prompt independiente · resultados se combinan y se entregan al médico para aprobación final
   */
  async evaluatorAgent(leadId /* o clienteId */, estudio /* {sangre, hsic, composicion, hrv, ...} */){
    await sleep(200);
    // SKILL 1 · Plan Médico (protocolos + dosificación)
    const planMedico = {
      tipo: 'medico',
      nombre: 'Antiinflamatorio · BPC-157',
      duracion: '12 semanas',
      pauta: 'BPC-157 250 μg subcutáneo · diario · mañanas en ayunas',
      complementos: ['NAD+ IV 2 ses', 'Vit D 5000 UI/d', 'Omega-3 EPA/DHA 2g/d'],
      razon: 'PCR elevada (2.4) + omega-6/3 ratio alto · respuesta inflamatoria sistémica leve · BPC-157 cross-ref evidencia para reducción de marcadores en 8-12 sem.'
    };
    // SKILL 2 · Plan Nutricional
    const planNutricional = {
      tipo: 'nutricional',
      nombre: 'Mediterráneo antiinflamatorio',
      macros: '40% grasas (mono+omega-3) · 30% proteínas (1.6g/kg) · 30% CH complejos',
      timing: 'Ventana 11–19h · 8h ayuno · café antes',
      foods_in: ['Pescado azul 3×/sem', 'AOVE crudo', 'Hojas verdes 2 raciones/d', 'Frutos rojos diario'],
      foods_out: ['Aceites vegetales refinados', 'Ultraprocesados', 'Alcohol durante sem 1-8'],
      razon: 'Macro ajustado a su composición corporal (% grasa elevado) · omega-3 prioridad para reducir ratio · ventana de comida coordina con dosificación BPC.'
    };
    // SKILL 3 · Plan Ejercicio
    const planEjercicio = {
      tipo: 'ejercicio',
      nombre: 'Movilidad + Z2 + fuerza ligera',
      semanal: '3× movilidad/yoga (30 min) · 2× zona 2 cardio (45 min) · 2× fuerza ligera (45 min)',
      sesiones_no_hiit: 'Sin HIIT en sem 1-6 · permite recuperación inflamatoria · re-evaluar en sem 6 con marcadores',
      monitor: 'HRV diaria (Oura/Whoop) · si HRV cae > 15 % de baseline → sustituir Z2 por movilidad',
      razon: 'HRV baseline bajo (38ms) + cortisol matutino alto · evitar carga aeróbica alta hasta restaurar variabilidad cardíaca.'
    };
    Bus.emit('evaluator.plans_generated', { leadId, planMedico, planNutricional, planEjercicio });
    return { ok: true, planMedico, planNutricional, planEjercicio };
  },

  /**
   * acceptProtocol — Rama B · cliente acepta los 3 planes (médico + nutricional + ejercicio)
   * Encadena: cobro + factura + REFILL (solo plan médico) + activación de los 3 planes en perfil cliente
   */
  async acceptProtocol(leadId, protocolo /* {nombre, precio, productos[], duracionSem, planMedico, planNutricional, planEjercicio} */){
    // 1. Cobro instantáneo
    const pago = await this.createPaymentLink({ leadId, concepto: `Protocolo ${protocolo.nombre}`, importe: protocolo.precio });
    Bus.emit('protocol.accepted', { leadId, protocolo });
    // 2. Activar cliente · crear registro cliente desde lead
    const clienteId = uid('cli');
    State.upsert('clientes', clienteId, {
      id: clienteId, leadId, nombre: State.get().leads[leadId]?.nombre,
      fechaInicio: now(), semanaActual: 0, protocoloActivo: protocolo, programaActivo: true
    });
    // 3. Pedido REFILL
    const pedido = await this.orderRefill(clienteId, protocolo.productos);
    return { ok: true, pago, clienteId, pedido };
  },

  /**
   * declineProtocol — Rama A · no continúa · test automático de motivos
   */
  async declineProtocol(leadId){
    const id = uid('test');
    const url = `./test-motivos.html?lead=${leadId}`;
    State.upsert('tests', id, { id, leadId, tipo: 'motivos_no_continua', fecha: now(), url, completado: false });
    Bus.emit('protocol.declined', { leadId, testUrl: url });
    return { ok: true, testUrl: url };
  },

  /**
   * orderRefill — pedido automático del protocolo vía API farmacéutica REFILL
   * INTEGRATION: REFILL API · POST /orders (clienteData, items[], shippingAddress)
   *              Notif automática a farmacéutica vía email + dashboard
   */
  async orderRefill(clienteId, productos){
    const id = uid('ord');
    const refillId = `RFL-${Date.now()}`;
    State.upsert('pedidos', id, { id, clienteId, productos, refillId, fecha: now(), estado: 'enviado_a_farma', tracking: null });
    Bus.emit('refill.order_placed', { id, clienteId, refillId, productos });
    return { ok: true, id, refillId };
  },

  /**
   * shipmentTracking — notificación automática de envío con tracking
   * INTEGRATION: REFILL webhook · 'shipment.dispatched' con trackingNumber
   *              SendGrid + WhatsApp · template "tu pedido va en camino"
   */
  async shipmentTracking(pedidoId, trackingNumber, carrier){
    const ped = State.get().pedidos[pedidoId];
    State.upsert('pedidos', pedidoId, { tracking: { number: trackingNumber, carrier }, estado: 'en_camino' });
    Bus.emit('shipment.tracking_sent', { pedidoId, clienteId: ped.clienteId, trackingNumber });
    return { ok: true };
  },

  // ========== INICIO TRATAMIENTO + PORTAL ==========

  /**
   * activateClientPortal — bienvenida + acceso al perfil cliente
   * INTEGRATION: Auth (nuestro backend) · genera magic link + invitación
   */
  async activateClientPortal(clienteId){
    const cli = State.get().clientes[clienteId];
    const magicLink = `./portal-cliente.html?id=${clienteId}`;
    Bus.emit('portal.activated', { clienteId, magicLink });
    return { ok: true, magicLink };
  },

  // ========== SEGUIMIENTO SEMANAL · 1-12 ==========

  /**
   * runWeeklyTest — test automático semanal (sem 1-12)
   * INTEGRATION: Cron job · cada lunes 09:00 envía test a clientes activos en su semana actual
   *              Gemini+Perplexity analizan respuestas
   */
  async runWeeklyTest(clienteId, semana){
    const id = uid('wkt');
    const url = `./test-semanal.html?cli=${clienteId}&sem=${semana}`;
    State.upsert('tests', id, { id, clienteId, tipo: 'semanal', semana, fecha: now(), url, completado: false });
    Bus.emit('weekly_test.sent', { id, clienteId, semana, url });
    return { ok: true, id, url };
  },

  /**
   * submitWeeklyTest — captura respuestas + análisis AI + oferta upselling
   */
  async submitWeeklyTest(testId, respuestas){
    const test = State.get().tests[testId];
    State.upsert('tests', testId, { respuestas, completado: true, fechaCompletado: now() });
    const analisisAI = await this._analyzeTestWithAI(respuestas, 'semanal');
    State.upsert('tests', testId, { analisisAI });
    // Genera oferta de upselling según análisis
    const upsell = await this.offerUpsell(test.clienteId, analisisAI.recomendaciones || []);
    Bus.emit('weekly_test.completed', { testId, clienteId: test.clienteId, analisisAI });
    return { ok: true, analisisAI, upsell };
  },

  /**
   * offerUpsell — oferta de upselling basada en resultados
   * Productos: Club Privado · Libro · Tec · Consultoría · Nutrición · Entrenamiento
   * INTEGRATION: Email + portal · cada producto tiene link de pago directo
   */
  async offerUpsell(clienteId, productos){
    const id = uid('ups');
    State.upsert('upsell', id, { id, clienteId, productosOfertados: productos, aceptados: [], fecha: now() });
    Bus.emit('upsell.offered', { id, clienteId, productos });
    return { ok: true, id, productos };
  },

  /**
   * acceptUpsell — cliente acepta · cobro automático + factura
   * INTEGRATION: Stripe (cobro) + QuickBooks (factura)
   */
  async acceptUpsell(upsellId, productoIds){
    const ups = State.get().upsell[upsellId];
    const productos = (ups.productosOfertados || []).filter(p => productoIds.includes(p.id));
    const totalImporte = productos.reduce((a,p) => a + (p.precio || 0), 0);
    State.upsert('upsell', upsellId, { aceptados: productos, fechaAceptado: now() });
    const pago = await this.createPaymentLink({ leadId: ups.clienteId, concepto: `Upselling · ${productos.map(p=>p.nombre).join(' + ')}`, importe: totalImporte });
    Bus.emit('upsell.accepted', { upsellId, clienteId: ups.clienteId, productos, pago });
    return { ok: true, pago, productos };
  },

  // ========== SEMANA 12 · DECISIÓN RENOVACIÓN ==========

  /**
   * week12Continue — cliente continúa · cobro anual/mensual + reserva nuevo estudio
   * INTEGRATION: Stripe Subscriptions (recurring) + Cal.com (nuevo estudio)
   */
  async week12Continue(clienteId, plan /* 'mensual' | 'anual' */){
    const cli = State.get().clientes[clienteId];
    const importe = plan === 'anual' ? 4480 : 480;
    const pago = await this.createPaymentLink({ leadId: clienteId, concepto: `Renovación ${plan}`, importe });
    State.upsert('clientes', clienteId, { renovacionPlan: plan, fechaRenovacion: now() });
    const reserva = await this.bookNewStudy(clienteId);
    Bus.emit('week12.continued', { clienteId, plan, pago, reserva });
    return { ok: true, pago, reserva };
  },

  /**
   * week12Decline — cliente no continúa · test de motivos + dato a CRM
   */
  async week12Decline(clienteId){
    const id = uid('test');
    const url = `./test-motivos.html?cli=${clienteId}&contexto=sem12`;
    State.upsert('tests', id, { id, clienteId, tipo: 'motivos_sem12', fecha: now(), url, completado: false });
    State.upsert('clientes', clienteId, { programaActivo: false, fechaSalida: now() });
    Bus.emit('week12.declined', { clienteId, testUrl: url });
    return { ok: true, testUrl: url };
  },

  /**
   * bookNewStudy — reserva nuevo estudio (año 2 timeline)
   */
  async bookNewStudy(clienteId){
    const id = uid('book');
    const url = `https://cal.com/reto-health/estudio-anual?email=${encodeURIComponent(State.get().clientes[clienteId]?.email || '')}`;
    State.upsert('citas', id, { id, clienteId, tipo: 'estudio_anual', calComLink: url, estado: 'link_enviado' });
    return { ok: true, id, url };
  },

  // ========== HELPERS internos ==========

  /**
   * Mock del análisis AI (Gemini + Perplexity).
   * INTEGRATION REAL: llamar Gemini API con prompt estructurado + Perplexity para evidencia
   */
  async _analyzeTestWithAI(respuestas, tipo){
    await sleep(120);
    const recomendacionesPorTipo = {
      protocolo_inicial: [
        { id:'p_bpc',  nombre:'BPC-157 protocolo · 12 sem', precio:1480, prioridad:'alta', razon:'Marcadores inflamatorios elevados + dolor articular reportado' },
        { id:'p_nad',  nombre:'NAD+ IV · 6 sesiones',       precio:1620, prioridad:'media', razon:'Energía baja + sueño no reparador' }
      ],
      semanal: [
        { id:'u_club', nombre:'Club Privado mensual',  precio:48,  prioridad:'media', razon:'Engagement alto · alto fit con comunidad' },
        { id:'u_nut',  nombre:'Plan nutricional + coach', precio:148, prioridad:'alta', razon:'Test indica brecha en adherencia dietética' }
      ],
      motivos_no_continua: [],
      motivos_sem12: []
    };
    return {
      resumen: `Análisis automático (Gemini + Perplexity) sobre ${Object.keys(respuestas || {}).length} respuestas. Tipo: ${tipo}.`,
      recomendaciones: recomendacionesPorTipo[tipo] || [],
      scoreEngagement: Math.round(60 + Math.random() * 30),
      bandersRoja: tipo === 'semanal' && Math.random() < 0.2 ? ['Engagement bajo última semana'] : []
    };
  },

  /**
   * Programa un recordatorio para X días antes (mock con setTimeout).
   * INTEGRATION REAL: cron job en backend que mira citas con fecha ≤ ahora+2d
   */
  _scheduleReminder(bookingId, fechaHora){
    const cita = State.get().citas[bookingId];
    if (!cita) return;
    const reminderTime = new Date(fechaHora).getTime() - 2 * 24 * 60 * 60 * 1000;
    const delay = Math.max(0, reminderTime - Date.now());
    setTimeout(() => this.sendReminder(bookingId), Math.min(delay, 2147483000)); // cap setTimeout limit
  }
};

// ============================================================
// Endpoints documentation · para wirear webhooks externos
// ============================================================
export const WEBHOOKS = {
  stripe: {
    'checkout.session.completed': '→ Automations.onPaymentConfirmed(session.metadata.paymentId)',
    'invoice.payment_succeeded':  '→ Automations.onPaymentConfirmed (recurring)',
    'customer.subscription.deleted': '→ Bus.emit("subscription.cancelled", ...)'
  },
  calcom: {
    'BOOKING_CREATED':   '→ Automations.onBookingConfirmed(payload.uid, payload.startTime)',
    'BOOKING_CANCELLED': '→ Bus.emit("booking.cancelled", ...)',
    'BOOKING_RESCHEDULED': '→ Automations.onBookingConfirmed(payload.uid, payload.startTime)'
  },
  docusign: {
    'envelope-completed': '→ Bus.emit("docs.signed", { envelopeId, leadId })'
  },
  whereby: {
    'recording.completed': '→ Automations.saveCallRecording(meetingId, recordingUrl)'
  },
  refill_api: {
    'shipment.dispatched': '→ Automations.shipmentTracking(orderId, trackingNumber, carrier)',
    'order.delivered':     '→ Bus.emit("shipment.delivered", { orderId })'
  },
  whatsapp_business: {
    'message.received': '→ Bus.emit("whatsapp.message", { from, text })  // chatbot · fase posterior'
  }
};

// Expose globally para testing desde consola
if (typeof window !== 'undefined') {
  window.Automations = Automations;
  window.AutomationBus = Bus;
  window.AutomationState = State;
  window.AutomationLog = Log;
  window.AutomationWebhooks = WEBHOOKS;
}
