import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, FileButton, Group, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck, IconPhotoUp, IconTrash } from '@tabler/icons-react'

import { useQueryClient } from '@tanstack/react-query'

import AgencyLogo from '../../../components/AgencyLogo.jsx'
import ConfirmAction from '../../../components/ConfirmAction.jsx'
import { queryKeys } from '../../../queries/keys.js'
import { ApiError } from '../../../services/api.js'
import {
  AGENCY_ICON_ACCEPT,
  removeAgencyIcon,
  uploadAgencyIcon,
  validateAgencyIcon,
} from '../../../services/agencies.js'
import { PHOTO_LIMITS, formatFileSize } from '../../../services/properties.js'

const LOGO_SIZE = 128

/** Traduce los errores del backend a un mensaje para quien eligió el archivo. */
function uploadErrorMessage(error) {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado al subir el logo.'
  // 413 "Payload Too Large": Spring corta el pedido por el tamaño antes de llegar al controller.
  if (error.status === 413) {
    return `El archivo supera el máximo de ${formatFileSize(PHOTO_LIMITS.maxFileSize)}.`
  }
  // 400: vacío, extensión no permitida o un archivo que no es una imagen de verdad.
  if (error.status === 400) {
    return 'El servidor rechazó el archivo: tiene que ser una imagen JPG, PNG o WEBP.'
  }
  return error.message
}

/**
 * El logo de la agencia, dentro de su edición. Va aparte del formulario: el
 * logo se guarda en el momento, con su propio endpoint, sin esperar a
 * "Guardar cambios" (que manda JSON y no puede llevar archivos).
 *
 * `agency` es el `AgencyResponse` de la caché. Después de subir o quitar se
 * actualiza esa caché, así este componente recibe el `iconUrl` nuevo.
 */
export default function AgencyLogoCard({ agency }) {
  const queryClient = useQueryClient()
  // Qué se está haciendo: 'idle', 'uploading' o 'removing'.
  const [busy, setBusy] = useState('idle')
  // Aviso debajo del logo: { color, message } o null.
  const [notice, setNotice] = useState(null)
  // Dirección local (blob:) del archivo elegido, para verlo mientras sube.
  const [preview, setPreview] = useState(null)

  const abortRef = useRef(null)
  // FileButton vacía su <input> con esta función: así se puede volver a elegir
  // el mismo archivo (el navegador no avisa un "cambio" si es el mismo).
  const resetFileRef = useRef(null)

  // `URL.createObjectURL` reserva memoria para el archivo hasta que se libera
  // con `revokeObjectURL`. La limpieza del efecto corre cuando `preview`
  // cambia (otra imagen o null) y al salir de la pantalla: nunca queda colgada.
  useEffect(() => {
    if (!preview) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // Al salir de la pantalla se cancela el pedido en curso.
  useEffect(() => () => abortRef.current?.abort(), [])

  /** Lo que cambia con el logo nuevo: esta agencia, los listados y el encabezado. */
  const refreshCaches = (updatedAgency) => {
    // El PUT ya devolvió la agencia actualizada: se escribe directo en la caché
    // y la pantalla no espera otro GET.
    if (updatedAgency) queryClient.setQueryData(queryKeys.agencies.detail(agency.id), updatedAgency)
    queryClient.invalidateQueries({ queryKey: queryKeys.agencies.all })
    // `agencyIconUrl` del usuario logueado: el encabezado del panel lo lee de acá.
    queryClient.invalidateQueries({ queryKey: queryKeys.users.me() })
  }

  /** Cada pedido nuevo cancela el anterior y arma su propio AbortController. */
  const startRequest = () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    return controller
  }

  const handleFile = async (file) => {
    resetFileRef.current?.()
    if (!file) return

    // Misma validación que el backend: un archivo que va a rebotar no viaja.
    const problem = validateAgencyIcon(file)
    if (problem) {
      setNotice({ color: 'danger', message: problem })
      return
    }

    const controller = startRequest()
    setNotice(null)
    setPreview(URL.createObjectURL(file))
    setBusy('uploading')

    try {
      const updated = await uploadAgencyIcon(agency.id, file, { signal: controller.signal })
      refreshCaches(updated)
      setNotice({ color: 'success', message: 'Logo actualizado.' })
    } catch (error) {
      if (controller.signal.aborted) return
      setNotice({ color: 'danger', message: uploadErrorMessage(error) })
    } finally {
      // Con o sin éxito se suelta la vista local: queda el logo del backend
      // (el nuevo si salió bien, el anterior si falló).
      if (!controller.signal.aborted) {
        setPreview(null)
        setBusy('idle')
      }
    }
  }

  const handleRemove = async () => {
    const controller = startRequest()
    setNotice(null)
    setBusy('removing')

    try {
      await removeAgencyIcon(agency.id, { signal: controller.signal })
      // El DELETE responde 204 sin cuerpo: la agencia en caché se pisa a mano.
      refreshCaches({ ...agency, iconUrl: null })
      setNotice({ color: 'success', message: 'Logo quitado.' })
    } catch (error) {
      if (controller.signal.aborted) return
      setNotice({ color: 'danger', message: error instanceof ApiError ? error.message : 'No se pudo quitar el logo.' })
    } finally {
      if (!controller.signal.aborted) setBusy('idle')
    }
  }

  const working = busy !== 'idle'
  const hasLogo = Boolean(agency.iconUrl)

  return (
    <Card withBorder radius="lg" padding="xl">
      <Title order={2} size="h4" mb={4}>
        Logo
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Se guarda apenas lo elegís, sin esperar a &laquo;Guardar cambios&raquo;. Aparece en el encabezado del panel.
      </Text>

      <Group gap="lg" align="center" wrap="nowrap">
        {/* `preview` primero: mientras sube se ve el archivo elegido. */}
        <AgencyLogo src={preview ?? agency.iconUrl} name={agency.publicName} size={LOGO_SIZE} radius="lg" />

        <Stack gap="xs" style={{ minWidth: 0 }}>
          <Group gap="xs">
            {/* FileButton dibuja un <input type="file"> oculto y le pasa el
                clic al botón que devuelve la función. `accept` filtra lo que
                ofrece el selector de archivos, pero no reemplaza la validación. */}
            <FileButton onChange={handleFile} accept={AGENCY_ICON_ACCEPT} resetRef={resetFileRef} disabled={working}>
              {(props) => (
                <Button {...props} leftSection={<IconPhotoUp size={18} />} loading={busy === 'uploading'} disabled={working}>
                  {hasLogo ? 'Cambiar logo' : 'Subir logo'}
                </Button>
              )}
            </FileButton>

            {hasLogo && (
              <ConfirmAction label="¿Quitar el logo?" onConfirm={handleRemove} disabled={working}>
                {(trigger) => (
                  <Button
                    {...trigger}
                    variant="subtle"
                    color="danger"
                    leftSection={<IconTrash size={18} />}
                    loading={busy === 'removing'}
                  >
                    Quitar logo
                  </Button>
                )}
              </ConfirmAction>
            )}
          </Group>

          <Text size="xs" c="dimmed">
            JPG, PNG o WEBP de hasta {formatFileSize(PHOTO_LIMITS.maxFileSize)}. Conviene una imagen cuadrada de
            256 a 512 px; un PNG con fondo transparente queda mejor.
          </Text>
        </Stack>
      </Group>

      {notice && (
        <Alert
          mt="md"
          color={notice.color}
          icon={notice.color === 'success' ? <IconCircleCheck /> : <IconAlertTriangle />}
          withCloseButton
          onClose={() => setNotice(null)}
        >
          {notice.message}
        </Alert>
      )}
    </Card>
  )
}
