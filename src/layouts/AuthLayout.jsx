import { Paper, Title } from '@mantine/core'
// CSS Modules: las clases del .module.css llegan como un objeto
// (`classes.wrapper`), con nombres únicos generados por Vite, así no chocan con
// clases de otros archivos.
import classes from './AuthLayout.module.css'

/**
 * Marco de las pantallas de login y registro: el formulario a la izquierda y
 * una imagen a la derecha (que se oculta en celular, ver el CSS).
 * `children` es lo que cada pantalla pone adentro: su propio formulario.
 */
export default function AuthLayout({ title, children }) {
  return (
    <div className={classes.wrapper}>
      <Paper className={classes.form} radius={0}>
        <Title order={2} className={classes.title}>
          {title}
        </Title>
        {children}
      </Paper>
      <div className={classes.image} />
    </div>
  )
}
