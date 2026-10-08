/**
 * API del CRM. Todo gira alrededor del lead (`CrmProperty`): una persona
 * interesada en una propiedad, con un agente asignado. Ofertas, historial y
 * alertas cuelgan del lead en la URL.
 *
 * Replica los `Crm*Request` / `Crm*Response`, `OfferRequest` / `OfferResponse`
 * y los enums `CrmStage`, `CrmEventType` y `OfferStatus` del backend.
 */
import { del, get, pageQuery, post, put } from './api.js'
import { formatPrice } from './properties.js'

export const LEADS_ENDPOINT = '/api/crm_properties'

// Lista de opciones -> diccionario { NEW: 'Nuevo', ... } para traducir códigos.
// Cada enum se expone de las dos formas: _OPTIONS para los Select y _LABEL
// para pintar tablas (ver properties.js).
const toLabelMap = (options) => Object.fromEntries(options.map((o) => [o.value, o.label]))

/** Refleja `CrmStage`, en el orden en que avanza un lead. */
export const CRM_STAGE_OPTIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'VISIT', label: 'Visita' },
  { value: 'NEGOTIATION', label: 'Negociación' },
  { value: 'WON', label: 'Ganado' },
  { value: 'LOST', label: 'Perdido' },
]

export const CRM_STAGE_LABEL = toLabelMap(CRM_STAGE_OPTIONS)

export const CRM_STAGE_COLOR = {
  NEW: 'blue',
  CONTACTED: 'cyan',
  VISIT: 'grape',
  NEGOTIATION: 'orange',
  WON: 'teal',
  LOST: 'gray',
}

/** Etapas en las que el lead ya no avanza. */
export const CLOSED_STAGES = ['WON', 'LOST']

/** Refleja `CrmEventType`. */
export const CRM_EVENT_OPTIONS = [
  { value: 'NOTE', label: 'Nota' },
  { value: 'CALL', label: 'Llamada' },
  { value: 'VISIT', label: 'Visita' },
  { value: 'OFFER', label: 'Oferta' },
  { value: 'STAGE_CHANGE', label: 'Cambio de etapa' },
]

export const CRM_EVENT_LABEL = toLabelMap(CRM_EVENT_OPTIONS)

/** Los que se cargan a mano: oferta y cambio de etapa los registra la pantalla. */
export const MANUAL_EVENT_OPTIONS = CRM_EVENT_OPTIONS.filter((o) => ['NOTE', 'CALL', 'VISIT'].includes(o.value))

/** Refleja `OfferStatus`. */
export const OFFER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'ACCEPTED', label: 'Aceptada' },
  { value: 'REJECTED', label: 'Rechazada' },
]

export const OFFER_STATUS_LABEL = toLabelMap(OFFER_STATUS_OPTIONS)

export const OFFER_STATUS_COLOR = { PENDING: 'yellow', ACCEPTED: 'teal', REJECTED: 'red' }

/** `@Positive` y `@Digits(integer = 13, fraction = 2)` del `OfferRequest`. */
export const OFFER_LIMITS = { amount: { min: 0.01, max: 9999999999999.99, decimals: 2 } }

// ------------------------------------------------------------------ Leads

/** Valores del formulario -> `CrmPropertyRequest`. Los Select entregan strings. */
export const toLeadRequest = (values) => ({
  propertyId: Number(values.propertyId),
  peopleId: Number(values.peopleId),
  userId: Number(values.userId),
  stage: values.stage,
})

/** Un lead del response -> request, para un `PUT` que cambia solo un campo. */
export const leadToRequest = (lead, changes = {}) => ({
  propertyId: lead.propertyId,
  peopleId: lead.peopleId,
  userId: lead.userId,
  stage: lead.stage,
  ...changes,
})

/** GET -> `Page<CrmPropertyResponse>`. Filtro: `userId` (los leads de un agente). */
export const listLeads = (params, options) => get(`${LEADS_ENDPOINT}?${pageQuery(params)}`, options)

export const findLead = (id, options) => get(`${LEADS_ENDPOINT}/${id}`, options)

/** POST -> 201. 404 si la propiedad, la persona o el agente no existen o están de baja. */
export const createLead = (request, options) => post(LEADS_ENDPOINT, request, options)

/** No hay DELETE: un lead que no avanza pasa a `LOST`. */
export const updateLead = (id, request, options) => put(`${LEADS_ENDPOINT}/${id}`, request, options)

// -------------------------------------------- Ofertas, historial y alertas

// Ofertas, historial y alertas "cuelgan" del lead en la dirección:
// /api/crm_properties/7/offers. Esta función arma ese prefijo una sola vez.
const nested = (leadId, resource) => `${LEADS_ENDPOINT}/${leadId}/${resource}`

/** GET -> array sin paginar, las más nuevas primero. */
export const listOffers = (leadId, options) => get(nested(leadId, 'offers'), options)
export const createOffer = (leadId, request, options) => post(nested(leadId, 'offers'), request, options)
export const updateOffer = (leadId, offerId, request, options) =>
  put(`${nested(leadId, 'offers')}/${offerId}`, request, options)
/** Borrado físico, para una oferta cargada por error. Una rechazada pasa a `REJECTED`. */
export const deleteOffer = (leadId, offerId, options) => del(`${nested(leadId, 'offers')}/${offerId}`, options)

export const offerToRequest = (offer, changes = {}) => ({
  amount: offer.amount,
  currency: offer.currency,
  status: offer.status,
  ...changes,
})

/** GET -> la línea de tiempo, lo más nuevo primero. Un evento no se edita ni se borra. */
export const listHistory = (leadId, options) => get(nested(leadId, 'history'), options)

/** `{ userId, type, comments }`: `userId` es el agente que registra el evento. */
export const createHistoryEvent = (leadId, request, options) =>
  post(nested(leadId, 'history'), request, options)

/** GET -> la fecha más próxima primero. */
export const listAlerts = (leadId, options) => get(nested(leadId, 'alerts'), options)
export const createAlert = (leadId, request, options) => post(nested(leadId, 'alerts'), request, options)
export const updateAlert = (leadId, alertId, request, options) =>
  put(`${nested(leadId, 'alerts')}/${alertId}`, request, options)
export const deleteAlert = (leadId, alertId, options) => del(`${nested(leadId, 'alerts')}/${alertId}`, options)

export const alertToRequest = (alert, changes = {}) => ({
  userId: alert.userId,
  message: alert.message,
  alertDate: alert.alertDate,
  isRead: alert.isRead,
  ...changes,
})

// --------------------------------------------------------------- Flujos
//
// El backend tiene endpoints sueltos (actualizar lead, crear evento, crear
// oferta). Estas funciones los combinan en una acción de negocio completa,
// siguiendo los casos de uso del README del backend. Los pedidos van uno
// después del otro con `await`: el segundo solo se hace si el primero salió bien.

/**
 * Cambia la etapa y deja el evento `STAGE_CHANGE` en el historial, como pide
 * el caso de uso del backend. El evento lo firma el agente del lead: todavía no
 * hay login para saber quién está operando.
 */
export async function changeLeadStage(lead, stage, options) {
  const updated = await updateLead(lead.id, leadToRequest(lead, { stage }), options)
  await createHistoryEvent(
    lead.id,
    {
      userId: lead.userId,
      type: 'STAGE_CHANGE',
      // Queda en el historial como "Contactado → Negociación".
      comments: `${CRM_STAGE_LABEL[lead.stage] ?? lead.stage} → ${CRM_STAGE_LABEL[stage] ?? stage}`,
    },
    options,
  )
  return updated
}

/** Etapas anteriores a la negociación: una oferta nueva las adelanta. */
const BEFORE_NEGOTIATION = ['NEW', 'CONTACTED', 'VISIT']

/**
 * Carga una oferta, su evento `OFFER` y adelanta el lead a `NEGOTIATION` si
 * todavía no llegó. Devuelve la oferta y el lead como quedaron.
 */
export async function registerOffer(lead, request, options) {
  const offer = await createOffer(lead.id, request, options)
  await createHistoryEvent(
    lead.id,
    { userId: lead.userId, type: 'OFFER', comments: `Oferta de ${formatPrice(offer)}` },
    options,
  )
  // Si el lead ya estaba en negociación (o más adelante), no se toca la etapa.
  const updatedLead = BEFORE_NEGOTIATION.includes(lead.stage)
    ? await changeLeadStage(lead, 'NEGOTIATION', options)
    : lead
  // Devuelve las dos cosas en un objeto: la pantalla usa el lead actualizado.
  return { offer, lead: updatedLead }
}

/** Acepta la oferta y da el lead por ganado. */
export async function acceptOffer(lead, offer, options) {
  const updatedOffer = await updateOffer(lead.id, offer.id, offerToRequest(offer, { status: 'ACCEPTED' }), options)
  const updatedLead = lead.stage === 'WON' ? lead : await changeLeadStage(lead, 'WON', options)
  return { offer: updatedOffer, lead: updatedLead }
}

/** Rechazar no borra: la oferta queda en el historial como `REJECTED`. */
export const rejectOffer = (lead, offer, options) =>
  updateOffer(lead.id, offer.id, offerToRequest(offer, { status: 'REJECTED' }), options)
