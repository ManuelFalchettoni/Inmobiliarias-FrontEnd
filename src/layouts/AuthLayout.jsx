import { Title } from '@mantine/core'
import { IconMapPinFilled } from '@tabler/icons-react'

import Wordmark from '../components/Wordmark.jsx'
// CSS Modules: las clases del .module.css llegan como un objeto
// (`classes.wrapper`), con nombres únicos generados por Vite, así no chocan con
// clases de otros archivos.
import classes from './AuthLayout.module.css'

/**
 * Marco de las pantallas de login y registro: el formulario a la izquierda y,
 * a la derecha, un plano cuadriculado con un pin, el mismo dibujo del mapa de
 * la ficha (se oculta en celular, ver el CSS).
 * `children` es lo que cada pantalla pone adentro: su propio formulario.
 */
export default function AuthLayout({ title, children }) {
  return (
    <div className={classes.wrapper}>
      <main className={classes.side}>
        <div className={classes.form}>
          <div className={classes.brand}>
            <Wordmark size={36} />
          </div>
          <Title order={1} className={classes.title}>
            {title}
          </Title>
          {children}
        </div>
      </main>

      {/* Solo decorativo: los lectores de pantalla lo saltean. */}
      <div className={classes.plan} aria-hidden>
        <span className={classes.pinDot} />
        <IconMapPinFilled className={classes.pin} size={56} />
        <p className={classes.tagline}>Propiedades, interesados y contratos en un solo lugar.</p>
      </div>
    </div>
  )
}
