"use client"

import { useState } from "react"
import {
  Search,
  TriangleAlert,
  FileText,
  ShieldAlert,
  Activity,
  Stethoscope,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Pill,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Save,
  User,
  HeartPulse,
  CalendarDays,
  Lock,
} from "lucide-react"
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi"
import { type Address, isAddress } from "viem"
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract"
import { fetchFromIPFS, uploadToIPFS, type Prontuario, type Consulta } from "@/lib/ipfs"

type AccessMode = "normal" | "emergency"

interface RecordResult {
  mode: AccessMode
  patient: Address
  data: Prontuario
}

export function DoctorView() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [patientAddr, setPatientAddr] = useState("")
  const [patientAddrError, setPatientAddrError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [result, setResult] = useState<RecordResult | null>(null)
  const [isEncryptedContent, setIsEncryptedContent] = useState(false)

  // Add consultation form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDiagnostico, setNewDiagnostico] = useState("")
  const [newPrescricao, setNewPrescricao] = useState("")
  const [updatingRecord, setUpdatingRecord] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Section editing
  const [editingSection, setEditingSection] = useState<"paciente" | "criticas" | null>(null)
  const [draftPaciente, setDraftPaciente] = useState<Prontuario["paciente"] | null>(null)
  const [draftCriticas, setDraftCriticas] = useState<{
    alergias: string
    condicoesCronicas: string
    medicamentosContinuos: string
  } | null>(null)
  const [savingSection, setSavingSection] = useState(false)
  const [saveSectionError, setSaveSectionError] = useState<string | null>(null)

  const { writeContract: writeEmergency } = useWriteContract()
  const {
    writeContract: writeUpdate,
    data: updateTx,
    isPending: isSubmittingUpdate,
  } = useWriteContract()
  const { isLoading: isConfirmingUpdate, isSuccess: updateConfirmed } =
    useWaitForTransactionReceipt({ hash: updateTx })

  async function fetchNormal() {
    const addr = patientAddr.trim()
    if (!addr || !address || !publicClient) return
    if (!isAddress(addr)) {
      setPatientAddrError("Endereço Ethereum inválido")
      return
    }
    setPatientAddrError(null)
    setLoading(true)
    setFetchError(null)
    setResult(null)
    setShowAddForm(false)
    try {
      const cid = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getProntuario",
        args: [addr as Address],
        account: address,
      })
      if (!cid) throw new Error("Prontuário não encontrado para este paciente.")
      const record = await fetchFromIPFS(cid as string)
      setResult({ mode: "normal", patient: addr as Address, data: record })
    } catch (e) {
      if (e instanceof Error && e.message === "ENCRYPTED") {
        setIsEncryptedContent(true)
        return
      }
      setFetchError(
        e instanceof Error ? e.message : "Erro ao buscar prontuário"
      )
    } finally {
      setLoading(false)
    }
  }

  async function fetchEmergency() {
    const addr = patientAddr.trim()
    if (!addr || !address || !publicClient) return
    if (!isAddress(addr)) {
      setPatientAddrError("Endereço Ethereum inválido")
      return
    }
    setPatientAddrError(null)
    setLoading(true)
    setFetchError(null)
    setResult(null)
    setIsEncryptedContent(false)
    setShowAddForm(false)
    try {
      // Simulate to get the return value (CID) without spending gas
      const { result: cid } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "acessoEmergencia",
        args: [addr as Address],
        account: address,
      })
      if (!cid) throw new Error("Prontuário não encontrado para este paciente.")
      const record = await fetchFromIPFS(cid as string)
      setResult({ mode: "emergency", patient: addr as Address, data: record })

      // Fire the actual transaction to emit the immutable audit log
      writeEmergency({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "acessoEmergencia",
        args: [addr as Address],
      })
    } catch (e) {
      if (e instanceof Error && e.message === "ENCRYPTED") {
        setIsEncryptedContent(true)
        return
      }
      setFetchError(
        e instanceof Error
          ? e.message
          : "Erro ao acessar prontuário em emergência"
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveSection(updated: Prontuario) {
    if (!result || !address) return
    setSavingSection(true)
    setSaveSectionError(null)
    try {
      const newCid = await uploadToIPFS(updated)
      writeUpdate({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "atualizarProntuarioPorMedico",
        args: [result.patient, newCid],
      })
      setResult({ ...result, data: updated })
      setEditingSection(null)
    } catch (e) {
      setSaveSectionError(
        e instanceof Error ? e.message : "Erro ao salvar alterações"
      )
    } finally {
      setSavingSection(false)
    }
  }

  async function handleAddConsulta() {
    if (!result || !address) return
    setUpdatingRecord(true)
    setUpdateError(null)
    try {
      const novaConsulta: Consulta = {
        data: new Date().toISOString().slice(0, 10),
        medico: address,
        diagnostico: newDiagnostico,
        prescricao: newPrescricao,
      }
      const updatedRecord: Prontuario = {
        ...result.data,
        historicoConsultas: [
          ...result.data.historicoConsultas,
          novaConsulta,
        ],
      }
      const newCid = await uploadToIPFS(updatedRecord)
      writeUpdate({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "atualizarProntuarioPorMedico",
        args: [result.patient, newCid],
      })
      // Optimistic update
      setResult({ ...result, data: updatedRecord })
      setNewDiagnostico("")
      setNewPrescricao("")
      setShowAddForm(false)
    } catch (e) {
      setUpdateError(
        e instanceof Error ? e.message : "Erro ao atualizar prontuário"
      )
    } finally {
      setUpdatingRecord(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Conecte sua carteira para acessar a área do médico.
        </p>
      </div>
    )
  }

  const isUpdatePending = updatingRecord || isSubmittingUpdate || isConfirmingUpdate

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Search panel */}
      <section className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Stethoscope className="size-5" />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-card-foreground">
                Buscar Prontuário
              </h3>
              <p className="text-sm text-muted-foreground">
                Informe a carteira do paciente
              </p>
            </div>
          </div>

          <input
            value={patientAddr}
            onChange={(e) => {
              setPatientAddr(e.target.value)
              setPatientAddrError(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && fetchNormal()}
            placeholder="0x... carteira do paciente"
            className="mb-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
          {patientAddrError && (
            <p className="mb-2 text-xs text-destructive">{patientAddrError}</p>
          )}

          <button
            type="button"
            onClick={fetchNormal}
            disabled={loading}
            className="mb-4 mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Buscar Prontuário (Acesso Normal)
          </button>

          <div className="relative my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              ou em emergência
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={fetchEmergency}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-sm font-bold text-white shadow-lg shadow-destructive/30 ring-2 ring-destructive/20 transition-all hover:bg-destructive/90 hover:shadow-destructive/40 disabled:opacity-60"
          >
            <ShieldAlert className="size-5" />
            Acesso de Emergência (Break the Glass)
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Use somente em situações críticas. A ação fica registrada.
          </p>
        </div>
      </section>

      {/* Results */}
      <section className="lg:col-span-3">
        <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
            <FileText className="size-5 text-primary" />
            Resultado
          </h3>

          {fetchError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{fetchError}</p>
            </div>
          )}

          {!result && !fetchError && !isEncryptedContent ? (
            <div className="flex h-[calc(100%-3rem)] min-h-48 flex-col items-center justify-center gap-3 rounded-xl bg-muted/40 px-6 text-center">
              <Activity className="size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Busque um prontuário para visualizar os dados clínicos do
                paciente.
              </p>
            </div>
          ) : null}

          {isEncryptedContent && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
              <Lock className="size-8 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Prontuário cifrado (AES-GCM-256)</p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                  O paciente protegeu este prontuário com uma chave derivada da sua carteira.
                  Para acesso médico com decifração, é necessário um protocolo de compartilhamento
                  de chaves (ex.: Lit Protocol).
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              {result.mode === "emergency" && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <p className="text-sm font-medium leading-relaxed text-destructive">
                    ATENÇÃO: Este acesso sem autorização foi registrado
                    permanentemente na Blockchain e será auditado pelo comitê de
                    ética médica.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Paciente</span>
                <span className="font-mono text-sm text-card-foreground">
                  {result.patient.length > 16
                    ? `${result.patient.slice(0, 8)}...${result.patient.slice(-6)}`
                    : result.patient}
                </span>
              </div>

              {/* Dados do Paciente — editable */}
              {result.mode === "normal" && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <User className="size-4 text-primary" />
                    <span className="flex-1 text-sm font-semibold text-card-foreground">Dados do Paciente</span>
                    {editingSection !== "paciente" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftPaciente({ ...result.data.paciente })
                          setEditingSection("paciente")
                          setSaveSectionError(null)
                        }}
                        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Pencil className="size-3" /> Editar
                      </button>
                    )}
                  </div>

                  {editingSection === "paciente" && draftPaciente ? (
                    <div className="flex flex-col gap-3">
                      {([
                        ["Nome Completo", "nomeCompleto"],
                        ["Data de Nascimento", "dataNascimento"],
                        ["Tipo Sanguíneo", "tipoSanguineo"],
                        ["Contato de Emergência", "contatoEmergencia"],
                      ] as [string, keyof Prontuario["paciente"]][]).map(([label, key]) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                          </label>
                          <input
                            value={draftPaciente[key]}
                            onChange={(e) =>
                              setDraftPaciente({ ...draftPaciente, [key]: e.target.value })
                            }
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                          />
                        </div>
                      ))}
                      {saveSectionError && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertCircle className="size-3.5 shrink-0" />
                          {saveSectionError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveSection({
                              ...result.data,
                              paciente: draftPaciente,
                            })
                          }}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {savingSection ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSection(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["Nome Completo", result.data.paciente.nomeCompleto],
                        ["Data de Nascimento", result.data.paciente.dataNascimento],
                        ["Tipo Sanguíneo", result.data.paciente.tipoSanguineo],
                        ["Contato de Emergência", result.data.paciente.contatoEmergencia],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border bg-background px-3 py-2.5">
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                          <dd className="mt-0.5 text-sm font-medium text-card-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}

              {/* Informações Críticas — editable */}
              {result.mode === "normal" && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <HeartPulse className="size-4 text-destructive" />
                    <span className="flex-1 text-sm font-semibold text-card-foreground">Informações Críticas</span>
                    {editingSection !== "criticas" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftCriticas({
                            alergias: result.data.informacoesCriticas.alergias.join("\n"),
                            condicoesCronicas: result.data.informacoesCriticas.condicoesCronicas.join("\n"),
                            medicamentosContinuos: result.data.informacoesCriticas.medicamentosContinuos.join("\n"),
                          })
                          setEditingSection("criticas")
                          setSaveSectionError(null)
                        }}
                        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Pencil className="size-3" /> Editar
                      </button>
                    )}
                  </div>

                  {editingSection === "criticas" && draftCriticas ? (
                    <div className="flex flex-col gap-3">
                      {([
                        ["Alergias", "alergias"],
                        ["Condições Crônicas", "condicoesCronicas"],
                        ["Medicamentos Contínuos", "medicamentosContinuos"],
                      ] as [string, keyof typeof draftCriticas][]).map(([label, key]) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {label} <span className="normal-case font-normal">(um por linha)</span>
                          </label>
                          <textarea
                            rows={3}
                            value={draftCriticas[key]}
                            onChange={(e) =>
                              setDraftCriticas({ ...draftCriticas, [key]: e.target.value })
                            }
                            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                          />
                        </div>
                      ))}
                      {saveSectionError && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertCircle className="size-3.5 shrink-0" />
                          {saveSectionError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const parse = (s: string) =>
                              s.split("\n").map((l) => l.trim()).filter(Boolean)
                            handleSaveSection({
                              ...result.data,
                              informacoesCriticas: {
                                alergias: parse(draftCriticas.alergias),
                                condicoesCronicas: parse(draftCriticas.condicoesCronicas),
                                medicamentosContinuos: parse(draftCriticas.medicamentosContinuos),
                              },
                            })
                          }}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {savingSection ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSection(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <dl className="grid gap-2 sm:grid-cols-3">
                      {([
                        ["Alergias", result.data.informacoesCriticas.alergias],
                        ["Condições Crônicas", result.data.informacoesCriticas.condicoesCronicas],
                        ["Medicamentos Contínuos", result.data.informacoesCriticas.medicamentosContinuos],
                      ] as [string, string[]][]).map(([label, items]) => (
                        <div key={label} className="rounded-lg border border-border bg-background px-3 py-2.5">
                          <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                          {items.length === 0 ? (
                            <dd className="text-sm text-muted-foreground">—</dd>
                          ) : (
                            <ul className="flex flex-col gap-0.5">
                              {items.map((item) => (
                                <li key={item} className="text-sm font-medium text-card-foreground">{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}

              {/* Histórico de Consultas — read-only */}
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  Histórico de Consultas
                  <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {result.data.historicoConsultas.length}
                  </span>
                </div>
                {result.data.historicoConsultas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {[...result.data.historicoConsultas].reverse().map((c, i) => (
                      <li key={i} className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-xs font-semibold text-primary">{c.data}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.medico.length > 20 ? `${c.medico.slice(0, 8)}...${c.medico.slice(-6)}` : c.medico}
                          </span>
                        </div>
                        <p className="text-xs text-card-foreground">
                          <span className="font-medium">Diagnóstico: </span>{c.diagnostico}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-card-foreground">Prescrição: </span>{c.prescricao}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Add consultation (normal access only) */}
              {result.mode === "normal" && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm((v) => !v)}
                    className="flex w-full items-center gap-2 text-sm font-semibold text-card-foreground"
                  >
                    <Pill className="size-4 text-primary" />
                    Adicionar Consulta
                    {showAddForm ? (
                      <ChevronUp className="ml-auto size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </button>

                  {showAddForm && (
                    <div className="mt-4 flex flex-col gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Diagnóstico
                        </label>
                        <textarea
                          rows={2}
                          value={newDiagnostico}
                          onChange={(e) => setNewDiagnostico(e.target.value)}
                          placeholder="Descreva o diagnóstico..."
                          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Prescrição
                        </label>
                        <textarea
                          rows={2}
                          value={newPrescricao}
                          onChange={(e) => setNewPrescricao(e.target.value)}
                          placeholder="Medicamentos e orientações..."
                          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
                        />
                      </div>

                      {updateError && (
                        <p className="flex items-center gap-1.5 text-sm text-destructive">
                          <AlertCircle className="size-4 shrink-0" />
                          {updateError}
                        </p>
                      )}

                      {updateConfirmed && (
                        <p className="flex items-center gap-1.5 text-sm text-green-600">
                          <CheckCircle2 className="size-4 shrink-0" />
                          Prontuário atualizado na blockchain!
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleAddConsulta}
                        disabled={
                          !newDiagnostico.trim() ||
                          !newPrescricao.trim() ||
                          isUpdatePending
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUpdatePending ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            {updatingRecord
                              ? "Enviando para IPFS..."
                              : isSubmittingUpdate
                                ? "Aguardando assinatura..."
                                : "Confirmando..."}
                          </>
                        ) : (
                          <>
                            <PlusCircle className="size-4" />
                            Salvar Consulta na Blockchain
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
