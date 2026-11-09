# Continuação — TizenTubeCobalt L1 / Cobalt 27.lts.11

Este prompt está atualizado em 2026-11-09. Copie-o em uma nova conversa no Codex Windows.

---

**CONTINUAÇÃO DE DESENVOLVIMENTO — TizenTubeCobalt L1**

Continue o projeto https://github.com/HeliumMarcos/TizenTubeCobalt, branch `upgrade/cobalt-27-lts-11`, PR #2 em rascunho. Leia `AGENTS.md` e `docs/CODEX_PROGRESS.md`. Antes de sincronizar, verifique `git status --short --branch`, HEAD, remotes e alterações locais não commitadas; **não descarte nada**. Não confundir com o projeto DownloadRush.

**Estado confirmado no GitHub:** árvore oficial **Cobalt 27.lts.11 integrada** como snapshot no commit `4f973b2c226a8f8f2556bb3ee49099cfe43cf690` (upstream tag `27.lts.11`, commit `4aa03b3d7678dbce63da14b5e5459defd5ea6abf`). `cobalt/version.h` já declara 27.lts.11. Foram preservados ExoPlayer/Media3, JNI/Starboard e recursos próprios do TizenTube, como diagnósticos de codec e APIs adicionais. Os 3 conflitos foram resolvidos. Os workflows `.github/workflows` do fork foram mantidos porque GITHUB_TOKEN não podia alterá-los. Não refazer a migração nem reaplicar o antigo patch HDR.

**Limite do que foi verificado:** workflow de integração teve `success`, e os principais arquivos foram inspecionados no GitHub. **Não houve compilação Java, C++, JNI ou APK**, nem testes do aplicativo modificado no hardware. Checks de PR pós-integração apareceram como `action_required` e exigem investigação/execução, não são testes aprovados.

**Objetivo agora:** preparar e executar uma compilação real para **Android ARMv7** (`android-arm`/`armeabi-v7a`) usando GN/Ninja/gclient e o alvo `//cobalt/android:cobalt_apk`. Verificar se há Linux/runner habilitado; não tentar tratar este projeto como Gradle puro. Investigar possíveis erros de dependências Media3/ExoPlayer, JNI, assinatura e código nativo. Manter `main` e a PR em draft sem merge nem release. Não criar APK final sem autorização explícita.

**Hardware de teste:** TCL C7K com saída eARC para LG S95TR. Diagnósticos do Android/Nuvio confirmaram suporte anunciado VP9/AV1 HDR 4K60, reprodução Dolby Vision 3840×1608/60 e E-AC-3 5.1 no Nuvio. Isso não comprova Cobalt 27.lts.11 funcional nem passthrough original. Posteriormente testar seleção real de faixas 4K/HDR/5.1, fallback PCM, estabilidade e controle remoto.

Evite análises e operações repetitivas; use testes proporcionais, cite evidência real, preserve as personalizações e atualize `docs/CODEX_PROGRESS.md` após marcos. Não faça commit/push/merge/release sem autorização da tarefa atual. Relate implementado, arquivos, testes, pendências e próximo passo.

---
