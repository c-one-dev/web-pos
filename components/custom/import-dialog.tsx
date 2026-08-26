"use client"
import React, { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  CheckCircleIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  downloadImportTemplate,
  parseImportFile,
  type ImportRow,
} from "@/lib/import-file"

export type ImportColumn = {
  /** Header text expected in the file, lower-cased. */
  key: string
  required?: boolean
  hint?: string
  example?: string
}

export type RowResult = { ok: true } | { ok: false; error: string }

type Props = {
  title: string
  description: string
  columns: ImportColumn[]
  /**
   * Validates and imports ONE row. Returning an error rather than throwing
   * keeps a bad row from stopping the rest of the file.
   */
  importRow: (row: ImportRow, index: number) => Promise<RowResult>
  /** Runs once after an import that created at least one record. */
  onFinished?: () => void
  children?: React.ReactNode
}

type Outcome = { index: number; error: string }

export default function ImportDialog({
  title,
  description,
  columns,
  importRow,
  onFinished,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState("")
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failures, setFailures] = useState<Outcome[]>([])
  const [succeeded, setSucceeded] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setRows([])
    setFileName("")
    setFailures([])
    setSucceeded(null)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ""
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed = await parseImportFile(file)
      if (!parsed.length) {
        toast.error("That file has no data rows.")
        return
      }
      // Surface a missing column now rather than as N identical row errors.
      const headers = Object.keys(parsed[0])
      const missing = columns
        .filter((column) => column.required && !headers.includes(column.key))
        .map((column) => column.key)
      if (missing.length) {
        toast.error(`Missing required column(s): ${missing.join(", ")}`)
        return
      }
      setRows(parsed)
      setFileName(file.name)
      setFailures([])
      setSucceeded(null)
    } catch (error: any) {
      toast.error(error.message ?? "Could not read that file.")
    }
  }

  const run = async () => {
    setRunning(true)
    setProgress(0)
    const problems: Outcome[] = []
    let done = 0

    // Sequential on purpose. These call the same validated mutations the UI
    // uses, and firing hundreds at once would both hammer the server and make
    // the failure list non-deterministic.
    for (let index = 0; index < rows.length; index++) {
      try {
        const result = await importRow(rows[index], index)
        if (!result.ok) problems.push({ index, error: result.error })
      } catch (error: any) {
        problems.push({
          index,
          error:
            error?.graphQLErrors?.[0]?.message ??
            error?.message ??
            "Unknown error",
        })
      }
      done++
      setProgress(done)
    }

    setFailures(problems)
    setSucceeded(rows.length - problems.length)
    setRunning(false)
    if (rows.length - problems.length > 0) onFinished?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't let a half-finished run be dismissed by accident.
        if (running) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" className="gap-1.5">
            <UploadSimpleIcon /> Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-5 p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Expected shape, stated before the file picker rather than after
              a failed import. */}
          <div className="rounded-md border p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Expected columns</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadImportTemplate(title, columns)}
              >
                <DownloadSimpleIcon /> Download template
              </Button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {columns.map((column) => (
                <li key={column.key}>
                  <span className="font-mono">{column.key}</span>
                  {column.required ? (
                    <span className="text-destructive"> *</span>
                  ) : (
                    <span className="text-muted-foreground"> (optional)</span>
                  )}
                  {column.hint && <span> — {column.hint}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv"
              disabled={running}
              onChange={(event) => onFile(event.target.files?.[0])}
              className={cn(
                "block w-full cursor-pointer rounded-md border p-2.5 text-sm",
                "file:mr-3 file:cursor-pointer file:rounded-md file:border-0",
                "file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
              )}
            />
            {fileName && !running && succeeded === null && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span>{" "}
                — {rows.length} row{rows.length === 1 ? "" : "s"} ready.
              </p>
            )}
          </div>

          {running && (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Spinner className="size-5 text-primary" />
              <p className="text-sm">
                Importing {progress} of {rows.length}…
              </p>
            </div>
          )}

          {succeeded !== null && (
            <div className="flex flex-col gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border p-3",
                  failures.length
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-primary/30 bg-primary/5"
                )}
              >
                {failures.length ? (
                  <WarningCircleIcon
                    size={20}
                    className="shrink-0 text-destructive"
                  />
                ) : (
                  <CheckCircleIcon
                    size={20}
                    className="shrink-0 text-primary"
                  />
                )}
                <p className="text-sm">
                  <span className="font-semibold">{succeeded}</span> imported
                  {failures.length > 0 && (
                    <>
                      ,{" "}
                      <span className="font-semibold text-destructive">
                        {failures.length}
                      </span>{" "}
                      skipped
                    </>
                  )}
                  .
                </p>
              </div>

              {/*
                Rows that failed are listed with their spreadsheet row number
                (+2: one for the header, one because sheets are 1-indexed) so
                they can be found and fixed rather than hunted for.
              */}
              {failures.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {failures.map((failure) => (
                    <div
                      key={failure.index}
                      className="border-b p-2.5 text-sm last:border-b-0"
                    >
                      <span className="font-medium">
                        Row {failure.index + 2}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {failure.error}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-base sm:w-auto"
            disabled={running}
            onClick={() => {
              setOpen(false)
              reset()
            }}
          >
            {succeeded === null ? "Cancel" : "Close"}
          </Button>
          {succeeded === null && (
            <Button
              type="button"
              size="lg"
              className="w-full text-base sm:w-auto"
              disabled={!rows.length || running}
              loading={running}
              onClick={run}
            >
              Import {rows.length || ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
