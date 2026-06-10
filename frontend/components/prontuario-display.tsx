import { User, HeartPulse, CalendarDays } from "lucide-react"
import type { Prontuario } from "@/lib/ipfs"

/**
 * exclude: sections to hide (useful when the parent renders them as editable fields)
 */
export function ProntuarioDisplay({
  data,
  exclude = [],
}: {
  data: Prontuario
  exclude?: ("contato" | "criticas" | "historico")[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Patient info */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <User className="size-4 text-primary" />
          Dados do Paciente
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          <Field label="Nome Completo" value={data.paciente.nomeCompleto} />
          <Field label="Data de Nascimento" value={data.paciente.dataNascimento} />
          <Field label="Tipo Sanguíneo" value={data.paciente.tipoSanguineo} />
          {!exclude.includes("contato") && (
            <Field label="Contato de Emergência" value={data.paciente.contatoEmergencia} />
          )}
        </dl>
      </div>

      {/* Critical info */}
      {!exclude.includes("criticas") && (
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <HeartPulse className="size-4 text-destructive" />
          Informações Críticas
        </div>
        <dl className="grid gap-2 sm:grid-cols-3">
          <ListField label="Alergias" items={data.informacoesCriticas.alergias} />
          <ListField label="Condições Crônicas" items={data.informacoesCriticas.condicoesCronicas} />
          <ListField label="Medicamentos Contínuos" items={data.informacoesCriticas.medicamentosContinuos} />
        </dl>
      </div>
      )}

      {/* Consultation history */}
      {!exclude.includes("historico") && (
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <CalendarDays className="size-4 text-primary" />
          Histórico de Consultas
          <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {data.historicoConsultas.length}
          </span>
        </div>
        {data.historicoConsultas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {[...data.historicoConsultas].reverse().map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold text-primary">{c.data}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.medico.length > 20
                      ? `${c.medico.slice(0, 8)}...${c.medico.slice(-6)}`
                      : c.medico}
                  </span>
                </div>
                <p className="text-xs text-card-foreground">
                  <span className="font-medium">Diagnóstico: </span>
                  {c.diagnostico}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-card-foreground">Prescrição: </span>
                  {c.prescricao}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
      )}
    </div>
  )
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-card-foreground">{value}</dd>
    </div>
  )
}

export function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      {items.length === 0 ? (
        <dd className="text-sm text-muted-foreground">—</dd>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item} className="text-sm font-medium text-card-foreground">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
