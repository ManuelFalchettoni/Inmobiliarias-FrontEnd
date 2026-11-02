import { Link } from 'react-router-dom'
import { ActionIcon, Badge, Button, Tooltip } from '@mantine/core'
import { IconArrowBackUp, IconPencil } from '@tabler/icons-react'

import {
  OPERATION_TYPE_LABEL,
  PROPERTY_CONDITION_COLOR,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_TYPE_LABEL,
  formatAmount,
  formatPropertyPlace,
  sortPhotos,
  sortPrices,
} from '../../../services/properties.js'
import classes from './PropertyCards.module.css'

/**
 * Una propiedad del listado como una ficha chica: la portada, la dirección, el
 * rótulo con ambientes, superficie y año, y el precio en el bloque oscuro.
 * Toda la tarjeta abre la ficha (el link de la dirección se estira por encima,
 * ver `.addressLink` en el CSS); el lápiz queda por arriba. Archivar se hace
 * desde la edición, para que no se archive una propiedad de un clic al pasar.
 *
 * Una archivada es de solo lectura: el backend no la trae por id, así que se
 * pinta con lo que vino en el listado y lo único que se puede hacer es restaurarla.
 */
function PropertyCard({ property, busy, onRestore }) {
  const cover = sortPhotos(property.photos)[0]?.url
  const prices = sortPrices(property.prices)
  const active = property.active !== false
  const type = PROPERTY_TYPE_LABEL[property.type] ?? property.type

  const facts = [
    { label: 'Ambientes', value: property.rooms },
    { label: 'Superficie', value: property.size, unit: 'm²' },
    { label: 'Año', value: property.year ?? '—' },
  ]

  return (
    <li className={classes.card} data-archived={!active || undefined} aria-busy={busy || undefined}>
      <div className={classes.photo}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className={classes.noPhoto}>{type}</span>}
        <Badge className={classes.condition} variant="white" color={PROPERTY_CONDITION_COLOR[property.condition]}>
          {PROPERTY_CONDITION_LABEL[property.condition] ?? property.condition}
        </Badge>
        {active ? (
          <div className={classes.actions}>
            <Tooltip label="Editar" withArrow>
              <ActionIcon
                component={Link}
                to={`/dashboard/propiedades/${property.id}/editar`}
                variant="white"
                color="dark"
                aria-label={`Editar ${property.address}`}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        ) : (
          <span className={classes.stamp}>Archivada</span>
        )}
      </div>

      <div className={classes.body}>
        <p className={classes.kind}>{type}</p>
        <h3 className={classes.address}>
          {active ? (
            <Link to={`/propiedades/${property.id}`} className={classes.addressLink}>
              {property.address}
            </Link>
          ) : (
            property.address
          )}
        </h3>
        <p className={classes.place}>{formatPropertyPlace(property)}</p>

        <dl className={classes.facts}>
          {facts.map((fact) => (
            <div key={fact.label} className={classes.fact}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.value}
                {fact.unit && <span className={classes.unit}>{fact.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={classes.prices}>
        {prices.length > 0 ? (
          prices.map((price) => (
            <p key={price.id} className={classes.price}>
              <span className={classes.operation}>
                {OPERATION_TYPE_LABEL[price.operationType] ?? price.operationType}
              </span>
              <span className={classes.amount}>
                <span className={classes.currency}>{price.currency}</span>
                {formatAmount(price.amount)}
              </span>
            </p>
          ))
        ) : (
          <p className={classes.operation}>Sin precio</p>
        )}

        {!active && (
          <div className={classes.restore}>
            <span>Para editarla, restaurala.</span>
            <Button
              size="compact-sm"
              leftSection={<IconArrowBackUp size={16} />}
              loading={busy}
              onClick={() => onRestore(property)}
              aria-label={`Restaurar ${property.address}`}
            >
              Restaurar
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * El listado en fichas: una grilla que se acomoda sola al ancho disponible.
 * `busyId` es la propiedad que se está restaurando.
 */
export default function PropertyCards({ properties, busyId, onRestore }) {
  return (
    <ul className={classes.grid}>
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          busy={busyId === property.id}
          onRestore={onRestore}
        />
      ))}
    </ul>
  )
}
