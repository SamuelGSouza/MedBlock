// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ProntuarioAcesso
 * @notice Gerencia o controle de acesso a prontuários médicos armazenados no IPFS.
 *
 * Protocolo "Break the Glass":
 * -----------------------------------------------
 * Em situações de emergência médica, um profissional pode acessar o prontuário
 * de um paciente sem autorização prévia via `acessoEmergencia()`. Este acesso
 * "força" a barreira de controle de acesso, como quebrar o vidro de um alarme,
 * e é registrado de forma imutável na blockchain pelo evento `LogAcessoEmergencia`.
 * O registro garante rastreabilidade completa para fins de auditoria jurídica
 */
contract ProntuarioAcesso {

    // -------------------------------------------------------------------------
    // Estado
    // -------------------------------------------------------------------------

    /// @dev Mapeia o endereço do paciente ao hash IPFS do seu prontuário.
    mapping(address => string) private prontuarios;

    /// @dev permissoes[paciente][medico] == true indica acesso autorizado.
    mapping(address => mapping(address => bool)) private permissoes;

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------

    event ProntuarioAtualizado(address indexed paciente, string ipfsHash);
    event AcessoConcedido(address indexed paciente, address indexed medico);
    event AcessoRevogado(address indexed paciente, address indexed medico);

    /**
     * @notice Emitido sempre que o protocolo "Break the Glass" é acionado.
     * @dev Este evento é a âncora jurídica do acesso de emergência: gravado de
     *      forma imutável na blockchain, ele comprova quem acessou (medico),
     *      qual prontuário foi consultado (paciente) e o momento exato (timestamp).
     *      Auditores, conselhos de medicina e tribunais podem verificar o log
     *      a qualquer momento sem depender de terceiros ou de sistemas centralizados.
     */
    event LogAcessoEmergencia(
        address indexed medico,
        address indexed paciente,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Funções do paciente
    // -------------------------------------------------------------------------

    /**
     * @notice Salva ou atualiza o hash IPFS do prontuário do chamador.
     * @param _ipfsHash Hash CID do arquivo armazenado no IPFS.
     */
    function setProntuarioHash(string memory _ipfsHash) public {
        require(bytes(_ipfsHash).length > 0, "Hash nao pode ser vazio");
        prontuarios[msg.sender] = _ipfsHash;
        emit ProntuarioAtualizado(msg.sender, _ipfsHash);
    }

    /**
     * @notice Concede permissão de leitura ao médico indicado.
     * @param _medico Endereço do médico que receberá acesso.
     */
    function concederAcesso(address _medico) public {
        require(_medico != address(0), "Endereco invalido");
        require(_medico != msg.sender, "Paciente nao pode conceder acesso a si mesmo");
        permissoes[msg.sender][_medico] = true;
        emit AcessoConcedido(msg.sender, _medico);
    }

    /**
     * @notice Revoga a permissão de leitura do médico indicado.
     * @param _medico Endereço do médico que perderá o acesso.
     */
    function revogarAcesso(address _medico) public {
        require(_medico != address(0), "Endereco invalido");
        permissoes[msg.sender][_medico] = false;
        emit AcessoRevogado(msg.sender, _medico);
    }

    /**
     * @notice Permite que um médico autorizado atualize o hash IPFS do prontuário.
     * @dev Apenas médicos com permissão (permissoes[paciente][msg.sender] == true) podem chamar.
     *      Útil para que o médico registre o prontuário atualizado após uma consulta.
     * @param _paciente Endereço do paciente cujo prontuário será atualizado.
     * @param _ipfsHash Novo hash CID do arquivo atualizado no IPFS.
     */
    function atualizarProntuarioPorMedico(address _paciente, string memory _ipfsHash) public {
        require(permissoes[_paciente][msg.sender], "Acesso negado: sem permissao");
        require(bytes(_ipfsHash).length > 0, "Hash nao pode ser vazio");
        prontuarios[_paciente] = _ipfsHash;
        emit ProntuarioAtualizado(_paciente, _ipfsHash);
    }

    // -------------------------------------------------------------------------
    // Funções de leitura
    // -------------------------------------------------------------------------

    /**
     * @notice Retorna o hash IPFS do prontuário do paciente.
     * @dev Apenas o próprio paciente ou um médico com permissão podem chamar.
     * @param _paciente Endereço do paciente cujo prontuário será lido.
     * @return Hash IPFS do prontuário.
     */
    function getProntuario(address _paciente) public view returns (string memory) {
        require(
            msg.sender == _paciente || permissoes[_paciente][msg.sender],
            "Acesso negado: sem permissao"
        );
        return prontuarios[_paciente];
    }

    /**
     * @notice Acesso de emergência ao prontuário, protocolo "Break the Glass".
     * @dev A ausência de restrição de acesso é INTENCIONAL: em emergências,
     *      bloquear o médico pode custar vidas. A contrapartida é a emissão
     *      obrigatória do evento `LogAcessoEmergencia`, que registra o acesso
     *      de forma imutável e pública na blockchain para auditoria jurídica.
     * @param _paciente Endereço do paciente cujo prontuário será acessado.
     * @return Hash IPFS do prontuário do paciente.
     */
    function acessoEmergencia(address _paciente) public returns (string memory) {
        require(_paciente != address(0), "Endereco do paciente invalido");

        // Registro imutável de auditoria, obrigatório pelo protocolo "Break the Glass".
        // O evento garante que o acesso não autorizado fique gravado para sempre,
        // permitindo revisão posterior por autoridades competentes.
        emit LogAcessoEmergencia(msg.sender, _paciente, block.timestamp);

        return prontuarios[_paciente];
    }
}
