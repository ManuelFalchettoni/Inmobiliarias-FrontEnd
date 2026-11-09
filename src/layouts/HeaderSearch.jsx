import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Combobox, Loader, Text, TextInput, useCombobox } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../queries/keys.js'
import { searchPeople } from '../services/people.js'
import { formatPropertyPlace, searchProperties } from '../services/properties.js'

/** Desde cuántas letras se busca: con una sola coincide casi todo. */
const MIN_CHARS = 2
/** Resultados por grupo; el resto se ve en el listado con el filtro puesto. */
const RESULTS = 5

/**
 * Buscador del encabezado. Con lo que se tipea busca a la vez personas por
 * nombre (`/api/people/search?name=`) y propiedades por dirección y por ciudad
 * (`/api/properties/search?address=` y `?city=`, dos pedidos: el backend junta
 * los filtros con AND). Todos son parciales y sin acentos. Cada resultado lleva
 * a su ficha, y "Ver todas" al listado con el filtro puesto.
 *
 * Es un Combobox de Mantine: se navega con las flechas y se elige con Enter.
 * Cuando llegan los resultados queda marcado el primero, así Enter lo abre.
 */
export default function HeaderSearch(props) {
  const navigate = useNavigate()
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [text, setText] = useState('')
  // Se pide 300 ms después de la última tecla, no una vez por letra.
  const [term] = useDebouncedValue(text.trim(), 300)
  const enabled = term.length >= MIN_CHARS

  const peopleParams = { page: 0, size: RESULTS, name: term }
  const people = useQuery({
    queryKey: queryKeys.people.list(peopleParams),
    queryFn: ({ signal }) => searchPeople(peopleParams, { signal }),
    enabled,
  })
  const addressParams = { page: 0, size: RESULTS, address: term }
  const byAddress = useQuery({
    queryKey: queryKeys.properties.list(addressParams),
    queryFn: ({ signal }) => searchProperties(addressParams, { signal }),
    enabled,
  })
  const propertyParams = { page: 0, size: RESULTS, city: term }
  const properties = useQuery({
    queryKey: queryKeys.properties.list(propertyParams),
    queryFn: ({ signal }) => searchProperties(propertyParams, { signal }),
    enabled,
  })

  const typing = text.trim() !== term
  const loading = enabled && (typing || people.isFetching || byAddress.isFetching || properties.isFetching)
  const foundPeople = people.data?.content ?? []
  const foundByAddress = byAddress.data?.content ?? []
  // Una propiedad que ya salió por dirección no se repite en la de ciudad.
  const foundProperties = (properties.data?.content ?? []).filter(
    (property) => !foundByAddress.some((other) => other.id === property.id),
  )

  // Al llegar resultados nuevos se marca el primero: Enter lo abre sin tener
  // que bajar con las flechas.
  useEffect(() => {
    combobox.selectFirstOption()
    // `combobox` es un objeto nuevo en cada render: alcanza con los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.data, byAddress.data, properties.data])

  // Cada opción lleva en el value adónde ir: "person:3", "property:7", "people-all"...
  const go = (value) => {
    const [kind, id] = value.split(':')
    const q = encodeURIComponent(term)
    const paths = {
      person: `/dashboard/personas/${id}/editar`,
      property: `/dashboard/propiedades/${id}/editar`,
      'people-all': `/dashboard/personas?name=${q}`,
      'address-all': `/dashboard/propiedades?address=${q}`,
      'properties-all': `/dashboard/propiedades?city=${q}`,
    }
    navigate(paths[kind])
    setText('')
    combobox.closeDropdown()
  }

  const groupLabel = (label, page) =>
    page && page.totalElements > 0 ? `${label} (${page.totalElements})` : label

  return (
    <Combobox store={combobox} onOptionSubmit={go}>
      <Combobox.Target>
        <TextInput
          {...props}
          type="search"
          aria-label="Buscar en el panel"
          placeholder="Buscar personas, calles o ciudades..."
          leftSection={<IconSearch size={16} />}
          rightSection={loading ? <Loader size={14} /> : null}
          radius="md"
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value)
            combobox.openDropdown()
            combobox.resetSelectedOption()
          }}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>

      <Combobox.Dropdown hidden={text.trim().length < MIN_CHARS}>
        <Combobox.Options>
          {!enabled || typing ? (
            <Combobox.Empty>Buscando...</Combobox.Empty>
          ) : people.isError && properties.isError ? (
            <Combobox.Empty>No se pudo buscar: {people.error.message}</Combobox.Empty>
          ) : (
            <>
              <Combobox.Group label={groupLabel('Personas', people.data)}>
                {foundPeople.map((person) => (
                  <Combobox.Option key={person.id} value={`person:${person.id}`}>
                    <Text size="sm">{person.name}</Text>
                    <Text size="xs" c="dimmed">
                      {[person.phone, person.email].filter(Boolean).join(' · ')}
                    </Text>
                  </Combobox.Option>
                ))}
                {people.isSuccess && foundPeople.length === 0 && (
                  <Text size="xs" c="dimmed" px="sm" py={4}>
                    Ninguna persona se llama así.
                  </Text>
                )}
                {people.data?.totalElements > RESULTS && (
                  <Combobox.Option value="people-all">
                    <Text size="sm" c="var(--mantine-primary-color-filled)">
                      Ver las {people.data.totalElements} personas
                    </Text>
                  </Combobox.Option>
                )}
              </Combobox.Group>

              <Combobox.Group label={groupLabel('Propiedades en esa dirección', byAddress.data)}>
                {foundByAddress.map((property) => (
                  <Combobox.Option key={property.id} value={`property:${property.id}`}>
                    <Text size="sm">{property.address}</Text>
                    <Text size="xs" c="dimmed">
                      {formatPropertyPlace(property)}
                    </Text>
                  </Combobox.Option>
                ))}
                {byAddress.isSuccess && foundByAddress.length === 0 && (
                  <Text size="xs" c="dimmed" px="sm" py={4}>
                    Ninguna dirección coincide.
                  </Text>
                )}
                {byAddress.data?.totalElements > RESULTS && (
                  <Combobox.Option value="address-all">
                    <Text size="sm" c="var(--mantine-primary-color-filled)">
                      Ver las {byAddress.data.totalElements} propiedades
                    </Text>
                  </Combobox.Option>
                )}
              </Combobox.Group>

              <Combobox.Group label={groupLabel('Propiedades en esa ciudad', properties.data)}>
                {foundProperties.map((property) => (
                  <Combobox.Option key={property.id} value={`property:${property.id}`}>
                    <Text size="sm">{property.address}</Text>
                    <Text size="xs" c="dimmed">
                      {formatPropertyPlace(property)}
                    </Text>
                  </Combobox.Option>
                ))}
                {properties.isSuccess && foundProperties.length === 0 && (
                  <Text size="xs" c="dimmed" px="sm" py={4}>
                    Ninguna propiedad en una ciudad con ese nombre.
                  </Text>
                )}
                {properties.data?.totalElements > RESULTS && (
                  <Combobox.Option value="properties-all">
                    <Text size="sm" c="var(--mantine-primary-color-filled)">
                      Ver las {properties.data.totalElements} propiedades
                    </Text>
                  </Combobox.Option>
                )}
              </Combobox.Group>
            </>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
