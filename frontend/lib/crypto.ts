/**
 * Cifração client-side com AES-GCM-256.
 *
 * A chave é derivada via PBKDF2 a partir da assinatura da carteira sobre
 * a mensagem fixa "medblock-key-v1". Como a assinatura ECDSA é determinística
 * (RFC 6979), a mesma carteira sempre gera a mesma chave, sem armazenar nada.
 *
 * Nota de segurança: doutores e terceiros não podem descriptografar sem a
 * chave do paciente. Em produção, utilize Lit Protocol ou ECIES para
 * compartilhamento de chaves com partes autorizadas.
 */

export interface EncryptedPayload {
  encrypted: true
  iv: number[]
  ct: number[]
}

/** Verifica se um objeto IPFS é um payload cifrado. */
export function isEncrypted(data: unknown): data is EncryptedPayload {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as EncryptedPayload).encrypted === true
  )
}

/**
 * Deriva uma CryptoKey AES-GCM-256 a partir de uma assinatura de carteira.
 * @param signature resultado de `signMessage({ message: "medblock-key-v1" })`
 */
export async function deriveKey(signature: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(signature),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("medblock-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/** Cifra um objeto JSON e retorna um EncryptedPayload. */
export async function encryptJSON(data: object, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  )
  return { encrypted: true, iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) }
}

/** Decifra um EncryptedPayload e retorna o objeto original. */
export async function decryptJSON<T = unknown>(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    new Uint8Array(payload.ct)
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
