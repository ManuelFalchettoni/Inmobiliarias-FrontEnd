import { useState } from 'react'
import {
  ActionIcon,
  Alert,
  AspectRatio,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Overlay,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  IconAlertTriangle,
  IconCloudUpload,
  IconPhoto,
  IconPhotoX,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'

import {
  PHOTO_ACCEPT,
  PHOTO_LIMITS,
  formatFileSize,
  validatePhotoFile,
} from '../../../services/properties.js'

/** Mensajes de react-dropzone traducidos; el resto cae en el texto original. */
const DROPZONE_ERRORS = {
  'file-invalid-type': 'Formato no admitido. Use JPG, PNG o WEBP.',
  'file-too-large': `Supera los ${formatFileSize(PHOTO_LIMITS.maxFileSize)}.`,
  'too-many-files': 'Demasiados archivos a la vez.',
}

const QUEUE_BADGE = {
  pending: { color: 'gray', label: 'Pendiente' },
  uploading: { color: 'blue', label: 'Subiendo' },
  error: { color: 'red', label: 'Error' },
}

function Tile({ src, alt, children }) {
  return (
    <Card withBorder radius="md" padding={0} pos="relative" style={{ overflow: 'hidden' }}>
      <AspectRatio ratio={4 / 3}>
        <Image src={src} alt={alt} fit="cover" bg="gray.1" />
      </AspectRatio>
      {children}
    </Card>
  )
}

function StoredPhotoTile({ photo, isCover, onDelete, disabled }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(photo)
      // Si salió bien el tile se desmonta: no hay estado que limpiar.
    } catch (cause) {
      setError(cause?.message ?? 'No se pudo eliminar la foto.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <Tile src={photo.url} alt={photo.photoName ?? `Foto ${photo.position + 1}`}>
      {deleting && (
        <Overlay color="#fff" backgroundOpacity={0.6} center>
          <Loader size="sm" />
        </Overlay>
      )}
      <Group pos="absolute" top={6} left={6} right={6} justify="space-between">
        {isCover ? <Badge size="sm">Portada</Badge> : <span />}
        <Popover opened={confirming} onChange={setConfirming} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <ActionIcon
              variant="white"
              color="red"
              size="sm"
              aria-label="Eliminar foto"
              disabled={disabled || deleting}
              onClick={() => setConfirming((open) => !open)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="sm" mb="xs">
              ¿Eliminar esta foto? No se puede deshacer.
            </Text>
            <Group gap="xs" justify="flex-end">
              <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <Button size="xs" color="red" onClick={handleDelete}>
                Eliminar
              </Button>
            </Group>
          </Popover.Dropdown>
        </Popover>
      </Group>
      <Text size="xs" c={error ? 'red' : 'dimmed'} px="xs" py={6} truncate>
        {error ?? photo.photoName ?? 'Foto'}
      </Text>
    </Tile>
  )
}

function QueuedPhotoTile({ item, onRemove, disabled }) {
  const badge = QUEUE_BADGE[item.status]

  return (
    <Tile src={item.preview} alt={item.file.name}>
      {item.status === 'uploading' && (
        <Overlay color="#fff" backgroundOpacity={0.5} center>
          <Loader size="sm" />
        </Overlay>
      )}
      <Group pos="absolute" top={6} left={6} right={6} justify="space-between">
        <Tooltip label={item.error} disabled={!item.error} multiline w={220} withArrow>
          <Badge size="sm" color={badge.color} variant="filled">
            {badge.label}
          </Badge>
        </Tooltip>
        <ActionIcon
          variant="white"
          color="gray"
          size="sm"
          aria-label={`Quitar ${item.file.name}`}
          disabled={disabled || item.status === 'uploading'}
          onClick={() => onRemove(item.key)}
        >
          <IconX size={14} />
        </ActionIcon>
      </Group>
      <Text size="xs" c={item.error ? 'red' : 'dimmed'} px="xs" py={6} truncate title={item.error ?? item.file.name}>
        {item.error ?? `${item.file.name} · ${formatFileSize(item.file.size)}`}
      </Text>
    </Tile>
  )
}

/**
 * Fotos de la propiedad: las que ya están en el backend y las que esperan
 * subirse. Las pendientes solo viven en memoria hasta que el formulario tiene
 * un id de propiedad al cual asociarlas.
 */
export default function PropertyPhotos({
  photos,
  queue,
  onAdd,
  onRemoveQueued,
  onDeletePhoto,
  onUploadNow,
  busy,
}) {
  const [rejections, setRejections] = useState([])

  const used = photos.length + queue.length
  const remaining = Math.max(0, PHOTO_LIMITS.maxPhotos - used)
  const pendingCount = queue.filter((item) => item.status !== 'uploading').length

  /**
   * Aceptados y rechazados llegan juntos: con `onDrop` + `onReject` por
   * separado, el segundo en ejecutarse pisaba el aviso del primero.
   */
  const handleDropAny = (files, fileRejections) => {
    const accepted = []
    const rejected = fileRejections.map(({ file, errors }) => ({
      name: file.name,
      error: DROPZONE_ERRORS[errors[0]?.code] ?? errors[0]?.message ?? 'Archivo rechazado.',
    }))

    for (const file of files) {
      const error = validatePhotoFile(file)
      if (error) rejected.push({ name: file.name, error })
      else if (accepted.length < remaining) accepted.push(file)
      else rejected.push({ name: file.name, error: `Se alcanzó el máximo de ${PHOTO_LIMITS.maxPhotos} fotos.` })
    }

    setRejections(rejected)
    if (accepted.length > 0) onAdd(accepted)
  }

  return (
    <Stack gap="md">
      <Dropzone
        onDrop={() => {}}
        onDropAny={handleDropAny}
        accept={PHOTO_ACCEPT}
        maxSize={PHOTO_LIMITS.maxFileSize}
        disabled={remaining === 0 || busy}
        radius="md"
      >
        <Group justify="center" gap="lg" mih={120} style={{ pointerEvents: 'none' }} wrap="nowrap">
          <Dropzone.Accept>
            <IconUpload size={44} color="var(--mantine-color-blue-6)" stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconPhotoX size={44} color="var(--mantine-color-red-6)" stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto size={44} color="var(--mantine-color-dimmed)" stroke={1.5} />
          </Dropzone.Idle>
          <div>
            <Text fw={500}>
              {remaining === 0
                ? `Llegó al máximo de ${PHOTO_LIMITS.maxPhotos} fotos`
                : 'Arrastre las fotos o haga clic para elegirlas'}
            </Text>
            <Text size="sm" c="dimmed">
              JPG, PNG o WEBP de hasta {formatFileSize(PHOTO_LIMITS.maxFileSize)}. Quedan {remaining} de{' '}
              {PHOTO_LIMITS.maxPhotos}. La primera es la portada.
            </Text>
          </div>
        </Group>
      </Dropzone>

      {rejections.length > 0 && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle />}
          title={rejections.length === 1 ? 'Un archivo no se agregó' : `${rejections.length} archivos no se agregaron`}
          withCloseButton
          onClose={() => setRejections([])}
        >
          <Stack gap={2}>
            {rejections.map((rejection, index) => (
              <Text key={`${rejection.name}-${index}`} size="sm">
                <b>{rejection.name}</b>: {rejection.error}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {used === 0 ? (
        <Group gap="sm" c="dimmed">
          <ThemeIcon variant="light" color="gray" radius="xl">
            <IconPhoto size={16} />
          </ThemeIcon>
          <Text size="sm">Todavía no hay fotos. Se pueden agregar ahora o más adelante.</Text>
        </Group>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
          {photos.map((photo, index) => (
            <StoredPhotoTile
              key={photo.id}
              photo={photo}
              isCover={index === 0}
              onDelete={onDeletePhoto}
              disabled={busy}
            />
          ))}
          {queue.map((item) => (
            <QueuedPhotoTile key={item.key} item={item} onRemove={onRemoveQueued} disabled={busy} />
          ))}
        </SimpleGrid>
      )}

      {onUploadNow && pendingCount > 0 && (
        <Box>
          <Button
            variant="light"
            leftSection={<IconCloudUpload size={18} />}
            onClick={onUploadNow}
            loading={busy}
          >
            Subir {pendingCount === 1 ? 'la foto pendiente' : `las ${pendingCount} fotos pendientes`}
          </Button>
        </Box>
      )}
    </Stack>
  )
}
