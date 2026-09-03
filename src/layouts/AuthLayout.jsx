import { Paper, Title } from '@mantine/core'
import classes from './AuthLayout.module.css'

export default function AuthLayout({ title, children }) {
  return (
    <div className={classes.wrapper}>
      <Paper className={classes.form} radius={0}>
        <Title order={2} className={classes.title}>
          {title}
        </Title>
        {children}
      </Paper>
    </div>
  )
}
