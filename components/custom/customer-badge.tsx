import { Badge } from "@/components/ui/badge"
import { PersonSimpleWalkIcon } from "@phosphor-icons/react"

const WALK_IN = "Walk-in"

function CustomerBadge({
  name,
}: Readonly<{
  name: string
}>) {
  if (name === WALK_IN)
    return (
      <Badge variant="outline" className="gap-1">
        <PersonSimpleWalkIcon data-icon="inline-start" />
        {WALK_IN}
      </Badge>
    )

  return <span className="font-medium">{name}</span>
}

export { CustomerBadge }
