import { useEffect, useRef, useState } from "react"
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import type {
  BinaryFiles,
  DataURL,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types"
import type { FileId } from "@excalidraw/excalidraw/element/types"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useTheme } from "@/components/theme-provider"
import {
  apiFetch,
  whiteboardAssetUrl,
  type Resource,
  type WhiteboardScene,
} from "@/lib/api"

type PendingSave = {
  scene: WhiteboardScene
  files: BinaryFiles
  signature: string
}

function blobToDataUrl(blob: Blob) {
  return new Promise<DataURL>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => resolve(reader.result as DataURL))
    reader.addEventListener("error", () => reject(reader.error))
    reader.readAsDataURL(blob)
  })
}

export function ResourceContentWhiteboard({
  resource,
}: {
  resource: Resource
}) {
  const { theme } = useTheme()
  const zero = useZero()
  const [whiteboard, whiteboardState] = useQuery(
    queries.whiteboards.byID({ id: resource.id })
  )
  const [initialData, setInitialData] =
    useState<ExcalidrawInitialDataState | null>(null)
  const [status, setStatus] = useState<
    "loading" | "saved" | "saving" | "error"
  >("loading")
  const [error, setError] = useState<string | null>(null)
  const revisionRef = useRef(0)
  const uploadedAssetIdsRef = useRef(new Set<string>())
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<PendingSave | null>(null)
  const saveQueueRef = useRef(Promise.resolve())
  const lastObservedSceneRef = useRef<string | null>(null)
  const lastSavedSceneRef = useRef<string | null>(null)

  useEffect(() => {
    if (!whiteboard || initialData) return
    const currentWhiteboard = whiteboard
    const controller = new AbortController()

    async function load() {
      try {
        const entries = await Promise.all(
          currentWhiteboard.assets.map(async (asset) => {
            const response = await fetch(
              whiteboardAssetUrl(resource.id, asset.id),
              { credentials: "include", signal: controller.signal }
            )
            if (!response.ok) throw new Error("Could not load a board image")
            const dataURL = await blobToDataUrl(await response.blob())
            return [
              asset.id,
              {
                id: asset.id as FileId,
                mimeType: asset.mimeType as BinaryFiles[string]["mimeType"],
                dataURL,
                created: asset.createdAt ?? Date.now(),
                lastRetrieved: Date.now(),
              },
            ] as const
          })
        )

        const scene = (currentWhiteboard.scene ?? {
          elements: [],
          appState: {},
        }) as WhiteboardScene
        revisionRef.current = currentWhiteboard.revision ?? 0
        const initialSignature = JSON.stringify(scene)
        lastObservedSceneRef.current = initialSignature
        lastSavedSceneRef.current = initialSignature
        uploadedAssetIdsRef.current = new Set(
          currentWhiteboard.assets.map((asset) => asset.id)
        )
        setInitialData({
          elements: scene.elements as ExcalidrawInitialDataState["elements"],
          appState: scene.appState as ExcalidrawInitialDataState["appState"],
          files: Object.fromEntries(entries) as BinaryFiles,
          scrollToContent: true,
        })
        setStatus("saved")
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load whiteboard"
        )
        setStatus("error")
      }
    }

    void load()
    return () => controller.abort()
  }, [initialData, resource.id, whiteboard])

  async function uploadNewAssets(files: BinaryFiles) {
    await Promise.all(
      Object.values(files).map(async (file) => {
        if (uploadedAssetIdsRef.current.has(file.id)) return

        const blob = await (await fetch(file.dataURL)).blob()
        const form = new FormData()
        form.append("file", blob, file.id)
        await apiFetch(
          `/resources/${resource.id}/whiteboard/assets/${file.id}`,
          { method: "POST", body: form }
        )
        uploadedAssetIdsRef.current.add(file.id)
      })
    )
  }

  async function persist(payload: PendingSave) {
    setStatus("saving")
    setError(null)
    try {
      await uploadNewAssets(payload.files)
      const expectedRevision = revisionRef.current
      const result = zero.mutate(
        mutators.whiteboards.update({
          id: resource.id,
          expectedRevision,
          scene: payload.scene,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      revisionRef.current = expectedRevision + 1
      lastSavedSceneRef.current = payload.signature
      if (
        lastObservedSceneRef.current === payload.signature &&
        pendingRef.current === null
      ) {
        setStatus("saved")
      }
    } catch (saveError) {
      if (lastObservedSceneRef.current === payload.signature) {
        lastObservedSceneRef.current = lastSavedSceneRef.current
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save whiteboard"
      )
      setStatus("error")
    }
  }

  function queuePendingSave() {
    timerRef.current = null
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    saveQueueRef.current = saveQueueRef.current.then(() => persist(pending))
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    []
  )

  const queryError =
    whiteboardState.type === "error" ? whiteboardState.error.message : null

  if (!initialData && status === "loading" && !queryError) {
    return <Skeleton className="h-[70vh] min-h-[34rem] w-full rounded-xl" />
  }

  if (!initialData) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {error ?? queryError ?? "Could not load whiteboard"}
        </CardContent>
      </Card>
    )
  }

  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Whiteboard</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.name}
          </h1>
        </div>
        <Badge variant={status === "error" ? "destructive" : "outline"}>
          {status === "saving"
            ? "Saving…"
            : status === "error"
              ? "Save failed"
              : "Saved"}
        </Badge>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card className="h-[70vh] min-h-[34rem] overflow-hidden py-0">
        <CardContent className="h-full p-0">
          <Excalidraw
            initialData={initialData}
            theme={resolvedTheme}
            name={resource.name}
            onChange={(elements, appState, files) => {
              const serializedText = serializeAsJSON(
                elements,
                appState,
                {},
                "database"
              )
              if (serializedText === lastObservedSceneRef.current) return

              const serialized = JSON.parse(serializedText) as WhiteboardScene
              lastObservedSceneRef.current = serializedText
              pendingRef.current = {
                scene: {
                  elements: serialized.elements,
                  appState: serialized.appState,
                },
                files,
                signature: serializedText,
              }
              setStatus("saving")
              if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current)
              }
              timerRef.current = window.setTimeout(queuePendingSave, 600)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
