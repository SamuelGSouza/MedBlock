import { encryptJSON, decryptJSON, isEncrypted, type EncryptedPayload } from "@/lib/crypto"

const GATEWAY = "https://emerald-academic-giraffe-36.mypinata.cloud/ipfs"

export interface Consulta {
  data: string
  medico: string
  diagnostico: string
  prescricao: string
}

export interface Prontuario {
  paciente: {
    nomeCompleto: string
    dataNascimento: string
    tipoSanguineo: string
    contatoEmergencia: string
  }
  informacoesCriticas: {
    alergias: string[]
    condicoesCronicas: string[]
    medicamentosContinuos: string[]
  }
  historicoConsultas: Consulta[]
}

export async function fetchFromIPFS(
  cid: string,
  encryptionKey?: CryptoKey
): Promise<Prontuario> {
  const res = await fetch(`${GATEWAY}/${cid}`)
  if (!res.ok) throw new Error(`Erro ao buscar arquivo IPFS: ${res.status}`)
  const raw = await res.json()
  if (isEncrypted(raw)) {
    if (!encryptionKey) throw new Error("ENCRYPTED")
    return decryptJSON<Prontuario>(raw as EncryptedPayload, encryptionKey)
  }
  return raw as Prontuario
}

/**
 * Faz upload de um JSON estruturado (Prontuario) para o IPFS via Pinata.
 * Requer a variável de ambiente NEXT_PUBLIC_PINATA_JWT.
 * @param options.name       nome do arquivo no Pinata (sugerido: endereço da carteira)
 * @param options.encryptionKey  se fornecida, o JSON é cifrado com AES-GCM antes do upload
 */
export async function uploadToIPFS(
  data: Prontuario,
  options?: { name?: string; encryptionKey?: CryptoKey }
): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT
  if (!jwt) throw new Error("NEXT_PUBLIC_PINATA_JWT não configurado no .env.local")

  const content: object = options?.encryptionKey
    ? await encryptJSON(data, options.encryptionKey)
    : data

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: content,
      ...(options?.name ? { pinataMetadata: { name: options.name } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Erro no upload IPFS: ${res.status}`)
  const json: { IpfsHash: string } = await res.json()
  return json.IpfsHash
}

/**
 * Faz upload de um arquivo binário (PDF, imagem, etc.) para o IPFS via Pinata.
 * Requer a variável de ambiente NEXT_PUBLIC_PINATA_JWT.
 */
export async function uploadFileToIPFS(file: File): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT
  if (!jwt) throw new Error("NEXT_PUBLIC_PINATA_JWT não configurado no .env.local")
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Erro no upload IPFS: ${res.status}`)
  const json: { IpfsHash: string } = await res.json()
  return json.IpfsHash
}
