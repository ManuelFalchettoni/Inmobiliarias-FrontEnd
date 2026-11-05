import { Badge, Tooltip } from '@mantine/core'
import { IconMail, IconMailCheck, IconMailFast, IconMailOff } from '@tabler/icons-react'

import { ALERT_EMAIL_STATE, alertEmailStatus } from '../services/crm.js'

const LOOK = {
  [ALERT_EMAIL_STATE.SCHEDULED]: { icon: IconMail, color: 'gray' },
  [ALERT_EMAIL_STATE.PENDING]: { icon: IconMailFast, color: 'blue' },
  [ALERT_EMAIL_STATE.SENT]: { icon: IconMailCheck, color: 'teal' },
  [ALERT_EMAIL_STATE.MISSED]: { icon: IconMailOff, color: 'yellow' },
}

/**
 * En qué quedó el mail de recordatorio de una alerta. No dibuja nada cuando no
 * hay un estado que mostrar (ver `alertEmailStatus`). `now` viene de `useNow`.
 */
export default function AlertEmailBadge({ alert, now }) {
  const status = alertEmailStatus(alert, now)
  if (!status) return null

  const { icon: Icon, color } = LOOK[status.state]
  return (
    <Tooltip label={status.detail} multiline maw={280} withArrow>
      <Badge size="xs" variant="light" color={color} tt="none" leftSection={<Icon size={12} />}>
        {status.label}
      </Badge>
    </Tooltip>
  )
}
