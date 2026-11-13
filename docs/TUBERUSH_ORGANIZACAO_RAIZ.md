# TubeRush — Organização segura da raiz do repositório

**Status em 13/11/2026:** a **migração estrutural para sete entradas foi criada e verificada** na branch `refactor/seven-entry-root`. O checkout dos submódulos e o adaptador temporário do Cobalt também passaram no [GitHub Actions #43374563065](https://github.com/HeliumMarcos/TubeRush/actions/runs/43374563065). **O `main` ainda está na estrutura original.** O build APK completo e a reprodução na TV ainda não foram validados. A associação de fork continua.

## Padrão solicitado

O padrão que os repositórios HeliumVideoTools, YTMusicRush, SyncMasterPro e DownloadRush adotam é:

```text
.github/
app/
docs/
.gitmodules
.gitignore
AGENTS.md
README.md
```

**Total: sete entradas na raiz.** O TubeRush herdou aproximadamente 96 entradas de primeiro nível do Chromium/Cobalt. O número de linhas mostrado pelo GitHub é uma consequência direta dos arquivos e diretórios versionados na raiz; o README, o `.gitignore` ou uma configuração da página do GitHub **não conseguem ocultar essas entradas**.

## Riscos e adequações pendentes depois de mover para app/

A estrutura atual contém `.gn`, `BUILD.gn`, `DEPS`, `.gitmodules`, `third_party/`, `cobalt/`, `starboard/`, `media/`, `build/`, `base/`, `components/`, `v8/` e diversas dependências com caminhos relativos ou convencionados por depot_tools, GN, gclient, submódulos e scripts CI. Mover tudo para `app/` pode romper:

- Localização da raiz do checkout e configuração `gclient`/`DEPS`.
- Resolução de caminhos do GN e scripts de build Android/Cobalt.
- Checagem de submódulos por `.gitmodules` e o controle de revisões de dependências.
- Workflows de GitHub Actions, gatilhos `paths:`, cache, upload de APK e versão de release.
- Documentação e links que hoje usam `cobalt/`, `starboard/` e `third_party/` a partir da raiz.
- Sincronização com upstream e aplicação futura de correções da branch `upgrade/cobalt-27-lts-11`.

**Correções já implementadas na branch:** raiz com sete entradas; 340 submódulos remapeados para `app/` e `docs/website` mantido na raiz; configuração original em `app/.gitmodules` preservada para o checkout do motor. Os atributos originais estão em `app/.gitattributes`, liberando a entrada de raiz para `.gitmodules`. O workflow de compilação foi adaptado para criar um commit **local e temporário** que recompõe `app/` como raiz GN/DEPS e reinsere `docs/`. O Actions aprovou checkout, inspeção do Git tree e teste sintético do adaptador. **Ainda falta sincronizar dependências reais e gerar um APK**; não mesclar até o build e a validação de reprodução serem comprovados.

## Fases: estrutura preparada; build e compatibilidade pendentes

1. **Baseline e preservação:** marcar commit de referência, registrar SHA-256 do APK, versão e assinatura, além dos resultados na TCL C7K + LG S95TR. Não fazer force-push nem remover o branch de upgrade.
2. **Criar branch de migração temporária**, sem alterar o `main` enquanto a compilação não passar. A reorganização final deve preservar apenas `main` e `upgrade/cobalt-27-lts-11` se essa for a política desejada; excluir o branch temporário depois do merge validado.
3. **Mover a árvore completa do Chromium/Cobalt para `app/`**, mantendo a estrutura *interna* relativa do motor. Separar de lá somente os arquivos de apresentação e colaboração do projeto: `.github/`, `docs/`, `README.md`, `AGENTS.md`, `.gitmodules`, `.gitignore`. Evitar duplicações de diretórios de origem. Preservar licenças e notices.
4. **Adaptar ferramentas e scripts** ao novo root do motor: encontrar todos os `DEPS`, invocações `gclient`, `gn`, `ninja`, `autoninja`, ferramentas Python e caminhos relativos; revisar se alguma dependência requer checkout com nome `src`, em vez de `app`.
5. **Ajustar submódulos e dependências**: mapeamento de paths, `.gitmodules`, hooks, subprocessos e acessos ao git root; preservar URL e revisão de cada dependência.
6. **Ajustar CI**: artefatos, gatilhos, cache e diretório de trabalho nos workflows; documentação de compilação para quem clonar do zero; não publicar build não testado.
7. **Testar checkout limpo** em ambiente de CI, sincronização de dependências, configuração GN, compilação completa APK ARMv7, assinaturas, tamanho, metadados e execução do aplicativo.
8. **Validar os cinco vídeos da matriz** definida no `docs/TUBERUSH_PLANO_MESTRE.md`: 4K HDR, DD+ ↔ DD, idiomas, fallback e HLS de bitrate elevado, quando suportado.
9. **Merge somente depois de testes verdes** e revisão de diffs; evitar misturar alterações do motor com simples movimento de diretórios. Confirmar no GitHub exatamente as sete entradas solicitadas.
10. **Plano de rollback:** reverter o PR de reorganização de forma linear, sem apagar história ou releases anteriores, se houver regressão.

## Critérios de aceite específicos para a raiz

- [x] Exatamente sete entradas e seus nomes conforme o padrão acima **na branch de migração**.
- [x] `app/` contém as 91 entradas originais movidas **sem alteração dos SHAs dos objetos Git**. Revisão de checkout/submódulos ainda pendente.
- [x] Checkout limpo do GitHub Actions e verificação sintética do adaptador funcionam.
- [ ] Sincronização real do `DEPS`/gclient e geração de código GN funcionam.
- [ ] Configuração e compilação geram APK Android armv7.
- [ ] App abre na TCL C7K e preserva DD+ 5.1 comprovadamente funcional.
- [ ] Os menus, pinning de qualidade, logs e atualização pelos Releases seguem funcionando conforme seus próprios critérios de validação.
- [x] Branch do upgrade Cobalt permanece independente; `main` não perde histórico.
- [ ] A página inicial oferece banner, download, documentação e histórico de novidades de maneira clara.

> **Execução atual:** branch `refactor/seven-entry-root`, [Actions #43374563065](https://github.com/HeliumMarcos/TubeRush/actions/runs/43374563065) com checkout e teste sintético aprovados; `main` preservado. A compilação Android e o teste real da TCL C7K continuam pendentes. A desvinculação do fork é uma tarefa separada: não apagar nem recriar o repositório, pois isso pode perder Releases, Issues, histórico e configurações.
