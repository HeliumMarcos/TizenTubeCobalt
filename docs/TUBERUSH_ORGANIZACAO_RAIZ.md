# TubeRush — Organização segura da raiz do repositório

**Status em 13/11/2026:** estrutura de sete entradas **ainda não implementada**. O README e a identidade visual do TubeRush já estão modernizados. Este documento descreve o trabalho necessário para reorganizar o *código* sem quebrar a compilação.

## Padrão solicitado

O padrão que os repositórios HeliumVideoTools, YTMusicRush, SyncMasterPro e DownloadRush adotam é:

```text
.github/
app/
docs/
.gitattributes
.gitignore
AGENTS.md
README.md
```

**Total: sete entradas na raiz.** O TubeRush herdou aproximadamente 96 entradas de primeiro nível do Chromium/Cobalt. O número de linhas mostrado pelo GitHub é uma consequência direta dos arquivos e diretórios versionados na raiz; o README, o `.gitignore` ou uma configuração da página do GitHub **não conseguem ocultar essas entradas**.

## Por que não mover tudo imediatamente para app/

A estrutura atual contém `.gn`, `BUILD.gn`, `DEPS`, `.gitmodules`, `third_party/`, `cobalt/`, `starboard/`, `media/`, `build/`, `base/`, `components/`, `v8/` e diversas dependências com caminhos relativos ou convencionados por depot_tools, GN, gclient, submódulos e scripts CI. Mover tudo para `app/` pode romper:

- Localização da raiz do checkout e configuração `gclient`/`DEPS`.
- Resolução de caminhos do GN e scripts de build Android/Cobalt.
- Checagem de submódulos por `.gitmodules` e o controle de revisões de dependências.
- Workflows de GitHub Actions, gatilhos `paths:`, cache, upload de APK e versão de release.
- Documentação e links que hoje usam `cobalt/`, `starboard/` e `third_party/` a partir da raiz.
- Sincronização com upstream e aplicação futura de correções da branch `upgrade/cobalt-27-lts-11`.

**Não executar uma mudança destrutiva apenas para cumprir a estética**, sem prova de compilação, testes de reprodução e rollback. Uma árvore de sete entradas, sozinha, não garante que o projeto continue utilizável.

## Plano de migração (trabalho futuro)

1. **Baseline e preservação:** marcar commit de referência, registrar SHA-256 do APK, versão e assinatura, além dos resultados na TCL C7K + LG S95TR. Não fazer force-push nem remover o branch de upgrade.
2. **Criar branch de migração temporária**, sem alterar o `main` enquanto a compilação não passar. A reorganização final deve preservar apenas `main` e `upgrade/cobalt-27-lts-11` se essa for a política desejada; excluir o branch temporário depois do merge validado.
3. **Mover a árvore completa do Chromium/Cobalt para `app/`**, mantendo a estrutura *interna* relativa do motor. Separar de lá somente os arquivos de apresentação e colaboração do projeto: `.github/`, `docs/`, `README.md`, `AGENTS.md`, `.gitattributes`, `.gitignore`. Evitar duplicações de diretórios de origem. Preservar licenças e notices.
4. **Adaptar ferramentas e scripts** ao novo root do motor: encontrar todos os `DEPS`, invocações `gclient`, `gn`, `ninja`, `autoninja`, ferramentas Python e caminhos relativos; revisar se alguma dependência requer checkout com nome `src`, em vez de `app`.
5. **Ajustar submódulos e dependências**: mapeamento de paths, `.gitmodules`, hooks, subprocessos e acessos ao git root; preservar URL e revisão de cada dependência.
6. **Ajustar CI**: artefatos, gatilhos, cache e diretório de trabalho nos workflows; documentação de compilação para quem clonar do zero; não publicar build não testado.
7. **Testar checkout limpo** em ambiente de CI, sincronização de dependências, configuração GN, compilação completa APK ARMv7, assinaturas, tamanho, metadados e execução do aplicativo.
8. **Validar os cinco vídeos da matriz** definida no `docs/TUBERUSH_PLANO_MESTRE.md`: 4K HDR, DD+ ↔ DD, idiomas, fallback e HLS de bitrate elevado, quando suportado.
9. **Merge somente depois de testes verdes** e revisão de diffs; evitar misturar alterações do motor com simples movimento de diretórios. Confirmar no GitHub exatamente as sete entradas solicitadas.
10. **Plano de rollback:** reverter o PR de reorganização de forma linear, sem apagar história ou releases anteriores, se houver regressão.

## Critérios de aceite específicos para a raiz

- [ ] Exatamente sete entradas e seus nomes conforme o padrão acima.
- [ ] `app/` contém código Cobalt/Chromium com todas as dependências rastreadas e licenças válidas.
- [ ] Checkout limpo e sincronização de dependências funcionam.
- [ ] Configuração e compilação geram APK Android armv7.
- [ ] App abre na TCL C7K e preserva DD+ 5.1 comprovadamente funcional.
- [ ] Os menus, pinning de qualidade, logs e atualização pelos Releases seguem funcionando conforme seus próprios critérios de validação.
- [ ] Branch do upgrade Cobalt permanece independente; `main` não perde histórico.
- [ ] A página inicial oferece banner, download, documentação e histórico de novidades de maneira clara.

> **Execução atual:** somente modernização de `README.md` e identidade gráfica. Não mover a árvore Chromium/Cobalt para `app/` sem aprovação dos testes.
