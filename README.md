# MedBlock

Plataforma descentralizada de gestão de prontuários médicos com controle de acesso on-chain e auditoria imutável via blockchain.

---

### Contrato Deployado

- **Rede:** Ethereum Sepolia  
- **Endereco:** `0xae34fd3ee1a7ed91e6af4b91cf606cd6bc2fd000`  
- **Etherscan:** https://sepolia.etherscan.io/address/0xae34fd3ee1a7ed91e6af4b91cf606cd6bc2fd000

### Evidência de Funcionamento

Vídeo: [YouTube](https://youtu.be/3VGjacrBkR4)

---

## O Problema Real

No Brasil, prontuarios medicos sao mantidos em sistemas proprietarios e isolados, sem interoperabilidade entre hospitais, clinicas e postos de saude. Esse silo de dados representa um risco direto de vida em situacoes de emergencia.

Quando um paciente chega inconsciente a uma pronto-socorro, o medico de plantao nao tem acesso ao historico clinico: alergias, medicamentos continuos, condicoes cronicas e cirurgias anteriores. Decisoes criticas sao tomadas sem informacao. Reacoes alergicas a medicamentos, interacoes medicamentosas fatais e erros de dosagem resultam de uma falha estrutural de dados, nao de negligencia medica.

O problema é de governança e confiança: quem controla o acesso ao dado? Sistemas centralizados exigem que o paciente confie em uma unica entidade, que pode falhar, ser invadida ou simplesmente estar indisponivel no momento critico.

---

## O Diferencial Web3: Protocolo Break the Glass

### O dilema

Privacidade e acesso de emergencia sao, em teoria, objetivos opostos. Restringir acesso protege o paciente, liberar acesso salva vidas. Os sistemas tradicionais resolvem isso de forma binaria: ou o medico tem acesso ou nao tem.

### A solucao

O MedBlock resolve esse dilema com o **Protocolo Break the Glass**, inspirado no mecanismo fisico de alarmes de incendio em que voce quebra o vidro apenas em situacoes reais de emergencia, sabendo que o ato ficara registrado.

Qualquer medico pode chamar a funcao `acessoEmergencia()` do contrato inteligente para obter o prontuario de um paciente sem autorizacao previa. Nao ha como bloquear esse acesso, e isso e intencional: em emergencias, bloquear o medico pode custar uma vida.

A contrapartida e a blockchain.

A cada acionamento do protocolo, o contrato emite o evento `LogAcessoEmergencia` com o endereco do medico, o endereco do paciente e o timestamp exato, gravados de forma imutavel na rede Ethereum. Nenhuma entidade pode apagar, alterar ou negar esse registro. Ele existe para sempre, verificavel publicamente por qualquer pessoa, sem depender de sistemas centralizados.

Esse log é a ancora juridica. O Conselho Regional de Medicina pode consultar os eventos on-chain e, se o acesso de emergencia for considerado indevido, utilizar essa evidencia eletronica inviolavel como base para processo administrativo e eventual cassacao da licenca do médico.

### Fluxo normal (com autorização)

```
Paciente conecta carteira --> concede acesso ao medico (on-chain)
Medico autenticado        --> le e atualiza prontuario via IPFS
Paciente                  --> pode revogar acesso a qualquer momento
```

### Fluxo de emergencia (Break the Glass)

```
Medico de plantao         --> chama acessoEmergencia(pacienteAddress)
Contrato                  --> emite LogAcessoEmergencia (imutavel)
Blockchain                --> registra medico + paciente + timestamp
CRM / Auditoria           --> consulta event logs publicamente para revisar o acesso
```

---

## Arquitetura

```
/contracts
    ProntuarioAcesso.sol       Contrato principal: controle de acesso, prontuarios, Break the Glass

/frontend
    app/                       Next.js App Router (React 19)
    components/
        patient-view.tsx       Interface do paciente: visualizar, editar, autorizar medicos
        doctor-view.tsx        Interface do medico: ler prontuario, registrar consultas
        prontuario-display.tsx Componente compartilhado de exibicao de prontuario
        providers.tsx          WagmiProvider + TanStack Query
    lib/
        contract.ts            ABI e endereco do contrato
        wagmi.ts               Configuracao da rede Sepolia
        ipfs.ts                Upload e leitura via Pinata + gateway publico
        crypto.ts              Cifracao AES-GCM-256 com chave derivada da carteira

/scripts                       Scripts de deploy Hardhat
/test                          Testes do contrato
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Contrato inteligente | Solidity 0.8, Hardhat |
| Rede | Ethereum Sepolia (testnet) |
| Frontend | Next.js 16, React 19, TypeScript |
| Conexao Web3 | wagmi v2, viem v2 |
| Armazenamento descentralizado | IPFS via Pinata |
| Cifracao client-side | Web Crypto API (AES-GCM-256, PBKDF2) |
| Estilizacao | Tailwind CSS v4, shadcn/ui |


---

## Cifracao dos Dados

Os dados do prontuario sao cifrados no proprio navegador do paciente antes de serem enviados ao IPFS, usando AES-GCM-256. A chave de cifracao nunca e transmitida: ela e derivada deterministicamente via PBKDF2 a partir de uma assinatura criptografica da carteira do paciente sobre a mensagem fixa `"medblock-key-v1"`.

Como a assinatura ECDSA e deterministica (RFC 6979), a mesma carteira sempre gera a mesma chave, sem armazenar nada em servidor.

Medicos com acesso autorizado on-chain visualizam os dados em tela durante a sessao, mas o arquivo no IPFS permanece cifrado e ilegivel para terceiros sem a assinatura do paciente.

---

## Declaracao de Uso de Inteligencia Artificial (Regra 12)

Este projeto utilizou ferramentas de inteligencia artificial como apoio ao desenvolvimento, em conformidade com a Regra 12 do regulamento do HackWeb RESTIC 29.

- **v0 by Vercel:** prototipagem inicial da interface, geracao de componentes React e estrutura visual do frontend.
- **Claude (Anthropic) / GitHub Copilot:** auxilio na implementacao da integracao com wagmi/viem, logica de cifracao AES-GCM no cliente, correcao de erros de TypeScript e refinamento do contrato Solidity.

Todo o codigo foi revisado, adaptado e validado pelos membros da equipe. A logica de negocio, a arquitetura e as decisoes de design sao de autoria propria.

---

## Execucao Local

### Pre-requisitos

- Node.js >= 20.9.0
- pnpm (ou npm)
- MetaMask ou outra carteira compativel com EIP-1193
- Conta na Pinata (https://pinata.cloud) para obter JWT

### 1. Clonar o repositorio

```bash
git clone <url-do-repositorio>
cd MedBlock
```

### 2. Configurar variaveis de ambiente

Crie o arquivo `frontend/.env.local`:

```env
NEXT_PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK=11023523
NEXT_PUBLIC_PINATA_JWT=seu_jwt_do_pinata_aqui
```

### 3. Instalar dependencias do frontend

```bash
cd frontend
npm install
```

### 4. Iniciar em modo desenvolvimento

```bash
npm run dev
```

Acesse http://localhost:3000.

### 5. Compilar contratos (opcional)

```bash
cd ..
npm install
```

---

## Equipe

| Nome | GitHub |
|---|---|
| Samuel Gomes de Souza | [SamuelGSouza](https://github.com/samuelgsouza) |
| Willian Gomes de Souza | [williang280](https://github.com/williang280)|
