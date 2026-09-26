import { ButtonLink } from '../components/ui/Button'
import { Section } from '../components/ui/Section'

export function NotFoundPage() {
  return (
    <Section bare level={1} eyebrow="Page not found" title="There's nothing at this address">
      <ButtonLink to="/portfolio" variant="tertiary" arrow>
        Go to your portfolio
      </ButtonLink>
    </Section>
  )
}
