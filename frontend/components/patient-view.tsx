"use client"

import { useState, useEffect, useCallback } from "react"
import {
  UserPlus,
  ShieldCheck,
  Trash2,
  Loader2,
  FileText,
  AlertCircle,
  RefreshCw,
  Pencil,
  X,
  Save,
  HeartPulse,
  Lock,
  Unlock,
} from "lucide-react"
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSignMessage,
} from "wagmi"
import { type Address, isAddress, parseAbiItem } from "viem"
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract"
import { fetchFromIPFS, uploadToIPFS, type Prontuario } from "@/lib/ipfs"
import { deriveKey } from "@/lib/crypto"
import { ProntuarioDisplay } from "@/components/prontuario-display"

const ACESSO_CONCEDIDO_EVENT = parseAbiItem(
  "event AcessoConcedido(address indexed paciente, address indexed medico)"
)
const ACESSO_REVOGADO_EVENT = parseAbiItem(
  "event AcessoRevogado(address indexed paciente, address indexed medico)"
)

function shortAddr(addr: string) {
  if (addr.length <= 13) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function PatientView() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // Doctor management
  const [doctorInput, setDoctorInput] = useState("")
  const [inputError, setInputError] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<Address[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [doctorsError, setDoctorsError] = useState<string | null>(null)

  // Prontuário viewer
  const [prontuario, setProntuario] = useState<Prontuario | null>(null)
  const [loadingProntuario, setLoadingProntuario] = useState(false)
  const [prontuarioError, setProntuarioError] = useState<string | null>(null)
  const [isEncryptedContent, setIsEncryptedContent] = useState(false)

  // Cifração: chave derivada da assinatura da carteira
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)
  const [derivingKey, setDerivingKey] = useState(false)
  const { signMessageAsync } = useSignMessage()

  async function unlockProntuario() {
    if (!address) return
    setDerivingKey(true)
    setProntuarioError(null)
    try {
      const sig = await signMessageAsync({ message: "medblock-key-v1" })
      const key = await deriveKey(sig)
      setEncryptionKey(key)
      // Re-fetch with key
      if (publicClient) {
        const cid = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getProntuario",
          args: [address],
          account: address,
        }) as string
        if (cid) {
          const data = await fetchFromIPFS(cid, key)
          setProntuario(data)
          setIsEncryptedContent(false)
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message !== "User rejected the request.") {
        setProntuarioError(e instanceof Error ? e.message : "Erro ao decifrar")
      }
    } finally {
      setDerivingKey(false)
    }
  }

  // Patient editing
  const [editingSection, setEditingSection] = useState<"contato" | "criticas" | null>(null)
  const [draftContato, setDraftContato] = useState("")
  const [draftCriticas, setDraftCriticas] = useState<{
    alergias: string
    condicoesCronicas: string
    medicamentosContinuos: string
  }>({ alergias: "", condicoesCronicas: "", medicamentosContinuos: "" })
  const [savingSection, setSavingSection] = useState(false)
  const [saveSectionError, setSaveSectionError] = useState<string | null>(null)

  // Write: setProntuarioHash (for patient edits)
  const {
    writeContract: writeSetHash,
    data: setHashTx,
  } = useWriteContract()
  const { isSuccess: hashSaved } = useWaitForTransactionReceipt({ hash: setHashTx })

  // Write: conceder acesso
  const {
    writeContract: writeConceder,
    data: concederTx,
    isPending: isSubmittingConceder,
  } = useWriteContract()
  const { isSuccess: concederConfirmed } = useWaitForTransactionReceipt({
    hash: concederTx,
  })

  // Write: revogar acesso
  const { writeContract: writeRevogar, data: revogarTx } = useWriteContract()
  const { isSuccess: revogarConfirmed } = useWaitForTransactionReceipt({
    hash: revogarTx,
  })

  // Bloco de deploy do contrato — limita o getLogs para não estourar o limite do RPC.
  // Atualize NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK no .env.local com o bloco real do deploy.
  const DEPLOY_BLOCK = BigInt(
    process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? "0"
  )

  const loadDoctors = useCallback(async () => {
    if (!address || !publicClient) return
    setLoadingDoctors(true)
    setDoctorsError(null)
    try {
      const [grantedLogs, revokedLogs] = await Promise.all([
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: ACESSO_CONCEDIDO_EVENT,
          fromBlock: DEPLOY_BLOCK,
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: ACESSO_REVOGADO_EVENT,
          fromBlock: DEPLOY_BLOCK,
          toBlock: "latest",
        }),
      ])

      // Filtra client-side pelos eventos do paciente conectado
      const myAddress = address.toLowerCase()

      const revokedSet = new Set(
        revokedLogs
          .filter((log) => log.args?.paciente != null && log.args?.medico != null)
          .filter((log) => (log.args.paciente as Address).toLowerCase() === myAddress)
          .map((log) => (log.args.medico as Address).toLowerCase())
      )
      const authorized = new Map<string, Address>()
      for (const log of grantedLogs) {
        if (!log.args?.paciente || !log.args?.medico) continue
        if ((log.args.paciente as Address).toLowerCase() !== myAddress) continue
        const medico = log.args.medico as Address
        if (!revokedSet.has(medico.toLowerCase())) {
          authorized.set(medico.toLowerCase(), medico)
        }
      }
      setDoctors([...authorized.values()])
    } catch (e) {
      console.error("loadDoctors:", e)
      setDoctorsError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar médicos da blockchain. Verifique a conexão."
      )
    } finally {
      setLoadingDoctors(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    loadDoctors()
  }, [loadDoctors])

  useEffect(() => {
    if (concederConfirmed) loadDoctors()
  }, [concederConfirmed, loadDoctors])

  useEffect(() => {
    if (revogarConfirmed) loadDoctors()
  }, [revogarConfirmed, loadDoctors])

  const loadProntuario = useCallback(async () => {
    if (!address || !publicClient) return
    setLoadingProntuario(true)
    setProntuarioError(null)
    try {
      const cid = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getProntuario",
        args: [address],
        account: address,
      }) as string
      if (!cid) {
        setProntuario(null)
        return
      }
      const data = await fetchFromIPFS(cid, encryptionKey ?? undefined)
      setProntuario(data)
      setIsEncryptedContent(false)
    } catch (e) {
      if (e instanceof Error && e.message === "ENCRYPTED") {
        setIsEncryptedContent(true)
        return
      }
      console.error("loadProntuario:", e)
      setProntuarioError(
        e instanceof Error ? e.message : "Erro ao carregar prontuário."
      )
    } finally {
      setLoadingProntuario(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    loadProntuario()
  }, [loadProntuario])

  async function handleSaveSection(updated: Prontuario) {
    if (!address) return
    setSavingSection(true)
    setSaveSectionError(null)
    try {
      // Derive key on first save if not yet available
      let key = encryptionKey
      if (!key) {
        const sig = await signMessageAsync({ message: "medblock-key-v1" })
        key = await deriveKey(sig)
        setEncryptionKey(key)
      }
      const newCid = await uploadToIPFS(updated, { name: address, encryptionKey: key })
      writeSetHash({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "setProntuarioHash",
        args: [newCid],
      })
      setProntuario(updated)
      setEditingSection(null)
    } catch (e) {
      setSaveSectionError(e instanceof Error ? e.message : "Erro ao salvar")
    } finally {
      setSavingSection(false)
    }
  }

  function authorizeDoctor() {
    const trimmed = doctorInput.trim()
    if (!trimmed) return
    if (!isAddress(trimmed)) {
      setInputError("Endereço Ethereum inválido")
      return
    }
    setInputError(null)
    writeConceder({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "concederAcesso",
      args: [trimmed as Address],
    })
    setDoctorInput("")
  }

  function revoke(doctorAddr: Address) {
    writeRevogar({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "revogarAcesso",
      args: [doctorAddr],
    })
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Conecte sua carteira para acessar a área do paciente.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Prontuário viewer */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-card-foreground">
                Meu Prontuário
              </h3>
              <p className="text-sm text-muted-foreground">
                Dados clínicos registrados na blockchain
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadProntuario}
            disabled={loadingProntuario}
            title="Atualizar"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loadingProntuario ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingProntuario ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando prontuário da blockchain...
          </div>
        ) : prontuarioError ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{prontuarioError}</p>
          </div>
        ) : isEncryptedContent ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-4 rounded-xl bg-muted/40 px-6 py-10 text-center">
            <Lock className="size-8 text-muted-foreground/60" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Prontuário cifrado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Os dados estão protegidos com AES-GCM-256. Assine com sua carteira para decifrar.
              </p>
            </div>
            <button
              type="button"
              onClick={unlockProntuario}
              disabled={derivingKey}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {derivingKey ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unlock className="size-4" />
              )}
              {derivingKey ? "Aguardando assinatura..." : "Decifrar Prontuário"}
            </button>
          </div>
        ) : prontuario ? (
          <div className="flex flex-col gap-4">
            {/* Dados do paciente — somente leitura */}
            <ProntuarioDisplay data={prontuario} exclude={["contato", "criticas"]} />

            {/* Contato de emergência — editável */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-card-foreground flex-1">Contato de Emergência</span>
                {editingSection !== "contato" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftContato(prontuario.paciente.contatoEmergencia)
                      setEditingSection("contato")
                      setSaveSectionError(null)
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-3" /> Editar
                  </button>
                )}
              </div>
              {editingSection === "contato" ? (
                <div className="flex flex-col gap-3">
                  <input
                    value={draftContato}
                    onChange={(e) => setDraftContato(e.target.value)}
                    placeholder="Nome (Relação) - (XX) XXXXX-XXXX"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
                  {saveSectionError && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="size-3.5 shrink-0" />{saveSectionError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingSection}
                      onClick={() => handleSaveSection({
                        ...prontuario,
                        paciente: { ...prontuario.paciente, contatoEmergencia: draftContato },
                      })}
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
                <p className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-card-foreground">
                  {prontuario.paciente.contatoEmergencia || '-'}
                </p>
              )}
            </div>

            {/* Informações Críticas — editáveis */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <HeartPulse className="size-4 text-destructive" />
                <span className="flex-1 text-sm font-semibold text-card-foreground">Informações Críticas</span>
                {editingSection !== "criticas" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftCriticas({
                        alergias: prontuario.informacoesCriticas.alergias.join("\n"),
                        condicoesCronicas: prontuario.informacoesCriticas.condicoesCronicas.join("\n"),
                        medicamentosContinuos: prontuario.informacoesCriticas.medicamentosContinuos.join("\n"),
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
              {editingSection === "criticas" ? (
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
                        onChange={(e) => setDraftCriticas({ ...draftCriticas, [key]: e.target.value })}
                        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                      />
                    </div>
                  ))}
                  {saveSectionError && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="size-3.5 shrink-0" />{saveSectionError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingSection}
                      onClick={() => {
                        const parse = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean)
                        handleSaveSection({
                          ...prontuario,
                          informacoesCriticas: {
                            alergias: parse(draftCriticas.alergias),
                            condicoesCronicas: parse(draftCriticas.condicoesCronicas),
                            medicamentosContinuos: parse(draftCriticas.medicamentosContinuos),
                          },
                        })
                      }}
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
                    ["Alergias", prontuario.informacoesCriticas.alergias],
                    ["Condições Crônicas", prontuario.informacoesCriticas.condicoesCronicas],
                    ["Medicamentos Contínuos", prontuario.informacoesCriticas.medicamentosContinuos],
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
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum prontuário registrado ainda. Um médico autorizado deve criar o primeiro registro.
            </p>
          </div>
        )}
      </section>

      {/* Authorize + list */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-5" />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-card-foreground">
                Autorizar Médico
              </h3>
              <p className="text-sm text-muted-foreground">
                Conceda acesso ao prontuário por carteira
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={doctorInput}
              onChange={(e) => {
                setDoctorInput(e.target.value)
                setInputError(null)
              }}
              onKeyDown={(e) => e.key === "Enter" && authorizeDoctor()}
              placeholder="0x... carteira do médico"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
            <button
              type="button"
              onClick={authorizeDoctor}
              disabled={isSubmittingConceder}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmittingConceder ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Autorizar Médico
            </button>
          </div>
          {inputError && (
            <p className="mt-1.5 text-xs text-destructive">{inputError}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading mb-4 text-base font-semibold text-card-foreground">
            Médicos Autorizados
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {doctors.length}
            </span>
          </h3>

          {loadingDoctors ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando da blockchain...
            </div>
          ) : doctorsError ? (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {doctorsError}
            </p>
          ) : doctors.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum médico autorizado no momento.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {doctors.map((doctorAddr) => (
                <li
                  key={doctorAddr}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {doctorAddr.slice(2, 4).toUpperCase()}
                    </span>
                    <p className="font-mono text-sm text-card-foreground">
                      {shortAddr(doctorAddr)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(doctorAddr)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Revogar Acesso
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
