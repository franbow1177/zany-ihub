import { useEffect, useMemo, useState } from "react"
import { AiUserIcon, FloppyDiskIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
  type AgentContent,
  type AgentDetails,
  type Resource,
} from "@/lib/api"

export function ResourceContentAgent({ resource }: { resource: Resource }) {
  const [content, setContent] = useState<AgentContent | null>(null)
  const [model, setModel] = useState("")
  const [persona, setPersona] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const next = await apiFetch<AgentContent>(
          `/resources/${resource.id}/agent`,
          { signal: controller.signal }
        )
        setContent(next)
        setModel(next.agent.model)
        setPersona(next.agent.persona ?? "")
        setSystemPrompt(next.agent.systemPrompt ?? "")
        setError(null)
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return
        setError(
          loadError instanceof Error ? loadError.message : "Could not load agent"
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [resource.id])

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
      const agent = await apiFetch<AgentDetails>(
        `/resources/${resource.id}/agent`,
        {
          method: "PATCH",
          body: JSON.stringify({
            model,
            persona: persona.trim() || null,
            systemPrompt: systemPrompt.trim() || null,
          }),
        }
      )
      setContent((current) => (current ? { ...current, agent } : current))
      setPersona(agent.persona ?? "")
      setSystemPrompt(agent.systemPrompt ?? "")
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save agent"
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!content && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      </div>
    )
  }

  const selectedModel = content?.models.find((item) => item.id === model)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-1 text-sm text-muted-foreground">Agent</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <HugeiconsIcon icon={AiUserIcon} strokeWidth={1.8} />
          {resource.name}
        </h1>
        {resource.description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {resource.description}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {content && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Agent configuration</CardTitle>
                <CardDescription>
                  Reuse this identity and instruction set from any AI chat.
                </CardDescription>
              </div>
              {selectedModel && (
                <Badge
                  variant={selectedModel.available ? "secondary" : "outline"}
                >
                  {selectedModel.available ? "OpenRouter ready" : "OpenRouter key required"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="agent-model">Model</Label>
              <Select value={model} onValueChange={(value) => setModel(String(value))}>
                <SelectTrigger id="agent-model" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {content.models.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex min-w-0 flex-col">
                        <span>{item.label} · {item.tier}</span>
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
              <Button disabled={!hasChanges || isSaving} onClick={() => void save()}>
                <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
                {isSaving ? "Saving…" : "Save agent"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
