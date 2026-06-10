import { type Address } from "viem"

export const CONTRACT_ADDRESS =
  "0xae34fd3ee1a7ed91e6af4b91cf606cd6bc2fd000" as Address

export const CONTRACT_ABI = [
  {
    name: "setProntuarioHash",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_ipfsHash", type: "string" }],
    outputs: [],
  },
  {
    name: "concederAcesso",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_medico", type: "address" }],
    outputs: [],
  },
  {
    name: "revogarAcesso",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_medico", type: "address" }],
    outputs: [],
  },
  {
    name: "getProntuario",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_paciente", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "acessoEmergencia",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_paciente", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  /**
   * atualizarProntuarioPorMedico — requer contrato redeployado com a nova versão
   * do ProntuarioAcesso.sol que inclui esta função.
   */
  {
    name: "atualizarProntuarioPorMedico",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_paciente", type: "address" },
      { name: "_ipfsHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "AcessoConcedido",
    type: "event",
    inputs: [
      { name: "paciente", type: "address", indexed: true },
      { name: "medico", type: "address", indexed: true },
    ],
  },
  {
    name: "AcessoRevogado",
    type: "event",
    inputs: [
      { name: "paciente", type: "address", indexed: true },
      { name: "medico", type: "address", indexed: true },
    ],
  },
  {
    name: "ProntuarioAtualizado",
    type: "event",
    inputs: [
      { name: "paciente", type: "address", indexed: true },
      { name: "ipfsHash", type: "string" },
    ],
  },
  {
    name: "LogAcessoEmergencia",
    type: "event",
    inputs: [
      { name: "medico", type: "address", indexed: true },
      { name: "paciente", type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const
