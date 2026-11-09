# AGENTS.md — TizenTubeCobalt L1

Instruções para agentes de programação e Codex neste repositório. Preserve instruções específicas em subdiretórios e as existentes em `.github/instructions/`; não presuma que todas as ferramentas ali mencionadas estejam disponíveis.

## Projeto
- Repositório: `HeliumMarcos/TizenTubeCobalt`. Branch de migração: `upgrade/cobalt-27-lts-11`; PR #2 em rascunho.
- Fork Android TV de Cobalt/Chromium, com C++/Java e ferramentas Python/YAML. O motor é compilado via **GN/Ninja**, não por um simples `gradlew assembleRelease`.
- Alvo da TCL C7K: `android-arm`, ABI `armeabi-v7a`, alvo `//cobalt/android:cobalt_apk`, configuração `.github/config/android-arm.json`; não trocar por ARM64 sem decisão explícita.
- A migração **27.lts.10 → 27.lts.11 está incompleta**. Confirmar `cobalt/version.h`, media/JNI/Starboard/ExoPlayer e resultado do build antes de declarar concluída.
- Leia `docs/CODEX_PROGRESS.md` para estado e próximo passo; valide contra o Git atual.

## Contexto e investigação eficiente
1. Comece por `git status --short --branch`, `git remote -v` e diffs pertinentes; preserve alterações locais não commitadas.
2. Investigue somente arquivos/símbolos relacionados à tarefa; use buscas restritas, não varra indiscriminadamente a enorme árvore Chromium.
3. Reutilize verificações e diagnósticos válidos. Não repita investigações, builds e consultas GitHub Actions sem motivo novo.
4. Exiba apenas trechos pertinentes dos logs/diffs e respostas concisas; evite transcrever arquivos extensos.
5. Quando uma ferramenta indicada por outro agente estiver indisponível, escolha equivalente disponível em vez de inventar comandos.

## Planejamento e implementação
- Tarefas pequenas: implemente diretamente; complexas: divida em etapas pequenas com verificações proporcionais, sem excesso de planejamento.
- Preserve APIs, ABI, JNI, alterações próprias do fork, assinatura, ID de pacote e interface compatível com controle remoto.
- Evite dependências, refatorações e alterações fora de escopo; corrige causas, não apenas sintomas.
- Use subagentes e paralelismo apenas para trabalhos independentes e com benefício demonstrável.
- Diferencie suporte de codec anunciado, faixa disponível, decoder usado e HDR/áudio efetivamente reproduzido.
- Não force AC-3/E-AC-3/JOC passthrough apenas pelo MIME: confira a rota HDMI/eARC e ofereça fallback seguro quando necessário.

## Testes e CI
- Escolha o teste mínimo confiável: integridade para docs; teste específico para código simples; integração/compilação para mudanças JNI, mídia ou nativas.
- Não reutilize teste anterior depois de alteração que possa invalidá-lo; não omita verificações críticas.
- Documente explicitamente testes executados, aprovados, falhos e **não executados**. Nunca declare APK funcional sem compilação e teste reais.
- `.github/workflows/l1-android-source-check.yml` é preflight estático, **não** compila Java/C++/APK.
- `.github/workflows/l1-cobalt-27-lts-11-audit.yml` apenas compara upstream; não integra o motor.
- O CI principal pode depender de runner `self-hosted/chrobalt-linux-runner`; verifique disponibilidade no fork. Evite polling contínuo, reexecução sem correção e builds duplicados.
- Não publique APK final/release sem autorização explícita. Não altere pacote, assinatura, permissões de segurança ou distribuição sem autorização.

## Segurança e Git
- Não fazer commit, push, merge, release nem operação destrutiva sem autorização explícita da tarefa corrente.
- Não exibir/salvar tokens, credenciais, IPs privados, dados de conta ou logs pessoais em documentos versionados.
- Nunca inventar resultados de testes nem esconder falhas.
- `AGENTS.md` orienta o comportamento do Codex, mas **não muda** limites de cota/contexto, modelo, velocidade ou esforço de raciocínio.
- Não inventar opções de `config.toml`; confirmar suporte oficial na versão instalada e pedir autorização antes de alterar configurações globais.

## Persistência e troca de conversa
- Atualize `docs/CODEX_PROGRESS.md` em marcos relevantes, mudanças técnicas, bugs, resultados e preparação de handoff; não reescreva a cada alteração trivial.
- Quando o histórico ficar excessivo ou ocorrer reprocessamento repetido, sugira nova conversa sem inventar percentuais de tokens. Não interromper operação crítica.
- Ao receber **PREPARAR NOVA CONVERSA**: confira estado Git/HEAD, mudanças locais (se acessíveis), decisões, testes, pendências; atualize progresso e entregue prompt completo, informando o que não pôde conferir. Não fazer build completo só para preparar troca, nem commit/push automático.
- `docs/CODEX_NEXT_CHAT.md` contém um prompt de continuidade; mantenha-o coerente com o estado real.

## Formato breve de entrega
**Implementado:** alterações e objetivo. **Arquivos:** caminhos. **Testes:** evidência/limites. **Pendências:** riscos. **Próximo passo:** tarefa específica.
