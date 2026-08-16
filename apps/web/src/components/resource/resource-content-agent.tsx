import { useEffect, useMemo, useState } from "react"
import { FloppyDiskIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  apiFetch,
  type AiModelOption,
  type AgentContent,
  type Resource,
} from "@/lib/api"
import { ResourcePageHeader } from "./resource-page-header"

export function ResourceContentAgent({ resource }: { resource: Resource }) {
  const zero = useZero()
  const [agent, agentState] = useQuery(queries.agents.byID({ id: resource.id }))
  const [models, setModels] = useState<AiModelOption[]>([])
  const content = useMemo<AgentContent | null>(
    () =>
      agent
        ? {
            agent: {
              id: agent.id,
              model: agent.model ?? "openrouter/free",
              persona: agent.persona ?? null,
              systemPrompt: agent.systemPrompt ?? null,
              createdAt: agent.createdAt ?? 0,
              updatedAt: agent.updatedAt ?? 0,
            },
            models,
          }
        : null,
    [agent, models]
  )
  const [model, setModel] = useState("")
  const [persona, setPersona] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const next = await apiFetch<AiModelOption[]>("/ai/models", {
          signal: controller.signal,
        })
        setModels(next)
        setError(null)
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load agent"
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [resource.id])

  useEffect(() => {
    if (!agent) return
    // Zero is an external live store; refresh the local editor draft when its row changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModel(agent.model ?? "openrouter/free")
    setPersona(agent.persona ?? "")
    setSystemPrompt(agent.systemPrompt ?? "")
  }, [agent])

  const hasChanges = useMemo(() => {
    if (!content) return false
    return (
      model !== content.agent.model ||
      persona.trim() !== (content.agent.persona ?? "") ||
      systemPrompt.trim() !== (content.agent.systemPrompt ?? "")
    )
  }, [content, model, persona, systemPrompt])

  async function save() {
    if (!content) return
    setIsSaving(true)
    setError(null)
    try {
      const result = zero.mutate(
        mutators.agents.update({
          id: resource.id,
          model,
          persona: persona.trim() || null,
          systemPrompt: systemPrompt.trim() || null,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save agent"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const queryError =
    agentState.type === "error" ? agentState.error.message : null

  if (!content && !error && !queryError) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      </div>
    )
  }

  const selectedModel = content?.models.find((item) => item.id === model)

  return (
    <div className="space-y-6">
      <ResourcePageHeader resource={resource} />

      {(error || queryError) && (
        <p className="text-sm text-destructive" role="alert">
          {error || queryError}
        </p>
      )}

      {content && (
        <section className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-medium">
                Agent configuration
              </h2>
              <p className="text-sm text-muted-foreground">
                Reuse this identity and instruction set from any AI chat.
              </p>
            </div>
            {selectedModel && (
              <Badge
                variant={selectedModel.available ? "secondary" : "outline"}
              >
                {selectedModel.available
                  ? "OpenRouter ready"
                  : "OpenRouter key required"}
              </Badge>
            )}
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="agent-model">Model</Label>
              <Select
                value={model}
                onValueChange={(value) => setModel(String(value))}
              >
                <SelectTrigger id="agent-model" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {content.models.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex min-w-0 flex-col">
                        <span>
                          {item.label} · {item.tier}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.pricing}
                          {!item.available ? " · key required" : ""}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModel && (
                <p className="text-xs text-muted-foreground">
                  {selectedModel.provider} · {selectedModel.pricing}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-persona">Persona</Label>
              <Textarea
                id="agent-persona"
                value={persona}
                rows={5}
                placeholder="Who is this agent? Describe its voice, expertise, and behavior."
                onChange={(event) => setPersona(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A reusable identity layered before the system instructions.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-system-prompt">System prompt</Label>
              <Textarea
                id="agent-system-prompt"
                value={systemPrompt}
                rows={10}
                className="font-mono text-sm"
                placeholder="Give the model its rules, goals, boundaries, and response format."
                onChange={(event) => setSystemPrompt(event.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!hasChanges || isSaving}
                onClick={() => void save()}
              >
                <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
                {isSaving ? "Saving…" : "Save agent"}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
