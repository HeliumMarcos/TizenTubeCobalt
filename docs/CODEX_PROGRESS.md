# CODEX_PROGRESS — TizenTubeCobalt L1

Atualizado em **2026-11-09** após integração no GitHub. Base: branch remota `upgrade/cobalt-27-lts-11`; o checkout local do Codex Windows não foi inspecionado.

## Projeto e objetivo
- Repositório: https://github.com/HeliumMarcos/TizenTubeCobalt
- Branch: `upgrade/cobalt-27-lts-11`; [PR #2](https://github.com/HeliumMarcos/TizenTubeCobalt/pull/2), ainda em **draft**, não mesclada à `main`.
- Alvo: TCL C7K Google TV, ABI Android `armeabi-v7a` (`android-arm`), soundbar LG S95TR por HDMI eARC.
- Objetivo: motor Cobalt 27.lts.11, 4K60 VP9/AV1 HDR quando disponibilizado pelo serviço, áudio compatível e fallback seguro. Distinguir recurso de hardware, trilha oferecida, decodificação, passthrough real e reprodução funcional.

## Estado do Cobalt 27.lts.11 — código-fonte integrado
- **Commit de integração:** `4f973b2c226a8f8f2556bb3ee49099cfe43cf690`.
- **Origem oficial:** tag `youtube/cobalt:27.lts.11`, commit `4aa03b3d7678dbce63da14b5e5459defd5ea6abf`; base `27.lts.10` em `de12c750ec0ee767d986f5c3aee7c2b1aa743795`.
- Foi aplicado **snapshot completo do código-fonte via merge de três vias e commit com um único ancestral** no fork. A árvore de código resultante contém as alterações oficiais, exceto que `.github/workflows/` preserva as versões do fork (GITHUB_TOKEN não podia alterar esses arquivos). Os 166 commits originais não foram reimportados individualmente.
- Três conflitos resolvidos com validações de integridade: `cobalt/android/apk/app/src/main/java/dev/cobalt/coat/BaseStarboardBridge.java`, `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecUtil.java`, `starboard/android/shared/base_starboard_bridge.cc`.
- `cobalt/version.h` declara **`27.lts.11`**. Confirmada presença de `ExoPlayerBridge.java`, `ExoPlayerManager.java` e `starboard/android/shared/exoplayer/exoplayer_bridge.cc`, além de `MediaCodecBridge.ColorInfo` com `MediaCodecUtil.getHdrStaticInfo(...)`.
- Preservados os diagnósticos `L1 video support:` e `L1 audio decode support:`, e os métodos do fork `InstallAppFromURL` juntamente com o novo `OnPrimaryMainFrameNavigationStarted`.
- O workflow de integração [#42657896044](https://github.com/HeliumMarcos/TizenTubeCobalt/actions/runs/42657896044) concluiu com **success**. A primeira tentativa encontrou HTTP 408 no push de todo o histórico; outra foi recusada por falta da permissão `workflows`. Esses problemas foram superados com o snapshot de um ancestral e preservação de workflows.

## Tentativa de compilação ARMv7 pelo GitHub Actions — 2026-11-09
- Foi criado `.github/workflows/l1-android-armv7-build.yml` no commit `cb0e9ad2b45357097788d067a0827b4b9ad2716a`. Workflow: [execução #42662415043](https://github.com/HeliumMarcos/TizenTubeCobalt/actions/runs/42662415043).
- **`source-readiness`: SUCCESS** no runner `ubuntu-latest`: configurações `android-arm`, `target_cpu=arm`, alvo `//cobalt/android:cobalt_apk`, versão, Media3 e ExoPlayer Java/C++ presentes. Isso é um teste de configuração; não compila código.
- **`build-apk-armv7`: QUEUED** na última inspeção, aguardando runner Linux x64 self-hosted. O job exige no mínimo 140 GiB livres e 16 GiB RAM (recomendado 200+ GiB e 32 GiB), pré-requisitos do Chromium/Cobalt e conectividade com GitHub e Google depot_tools.
- Fluxo real quando runner disponível: checkout do fork no caminho `cobalt/src`, configurar `gclient`/Android, sincronizar dependências, `gn.py -p android-arm -c devel --no-rbe`, `autoninja -j 4 -C out/android-arm_devel cobalt/android:cobalt_apk`, validar presença de biblioteca `armeabi-v7a` no APK e publicar como artefato temporário de testes, **sem release**.
- **Não há APK e não há build Java/C++/JNI concluídos.** Não tratar `queued` como compilação. A conexão ADB local com a TCL C7K não é acessível por um runner GitHub na nuvem.
- Para destravar: conectar/ligar um runner Linux x64 self-hosted no repositório, com armazenamento suficiente, ou usar um serviço de build Linux equivalente. Confirmar logs, resolver erros de toolchain/dependências, depois instalar/testar APK na TV.
- Workflows e deploys não devem receber credenciais de produção; o APK de diagnóstico só será anexado como artefato do job se passar na verificação da ABI.

## Build e validação — pendentes
- Compilação é por **GN/Ninja, gclient** (C++/Java), não por Gradle puro; alvo `//cobalt/android:cobalt_apk` da configuração `.github/config/android-arm.json` (`android-arm`).
- Os workflows `.github/workflows/l1-android-source-check.yml` e `l1-cobalt-27-lts-11-audit.yml` são verificações estáticas/auditoria, não builds. Após o commit de integração os respectivos runs apareceram como `action_required`; **não alegar testes aprovados pós-merge** sem verificar e executar de fato.
- O pipeline principal usa por padrão runners `self-hosted/chrobalt-linux-runner`; disponibilidade de runner e toolchain Android do fork ainda não confirmadas.
- **Ainda não houve compilação Java/C++, APK ARMv7, instalação nem testes do Cobalt modificado na TCL C7K.** Não há release nova validada e a PR permanece em rascunho.
- Pode ser necessário revisar seletivamente a atualização de `.github/workflows` do upstream usando uma identidade com permissão adequada, sem perder o CI do fork.

## Dados reais da TCL C7K (Android/Nuvio, não Cobalt)
- `media-player.txt`: decodificadores MediaTek anunciam VP9 Profile 2 HDR, AV1 Main10 HDR/HDR10+, HEVC Main10 HDR e Dolby Vision, capacidade 4K/60.
- `logcat-full.txt`: Nuvio utilizou `c2.mtk.dvhe.st.decoder` para Dolby Vision 3840×1608/60; áudio E-AC-3 5.1 a 48 kHz, sem Atmos identificado nesse vídeo.
- `display.txt`: tela física 3840×2160/60 Hz e camada lógica de interface 1920×1080; isso não limita vídeos a 1080p.
- `audio.txt`: `hdmi_earc` conectado e LG S95TR reconhecida; bitstream Dolby original por passthrough **não foi confirmado**.

## Próximas tarefas
1. Verificar por que os checks de PR estão `action_required`, aprovar/acionar quando apropriado e registrar resultados; não confundir com compilação.
2. Estabelecer build Android `android-arm` GN/Ninja/gclient em ambiente Linux/runner com recursos adequados, usando configuração existente e sem alterar ABI, assinatura ou identificador do pacote.
3. Validar compilação Java, C++ e JNI do código 27.lts.11, dependências Media3 e execução do APK, corrigindo erros por causa real.
4. Após autorização específica para APK final, testar no hardware TCL C7K VP9/AV1 2160p60, HDR, seleção real de faixas, AC-3/E-AC-3 via eARC com fallback PCM, foco e controle remoto.
5. Manter a PR draft até build e regressão verificáveis; atualizar o progresso ao concluir marcos. Não realizar merge em `main`, release nem operações destrutivas sem autorização.

## Arquivos de referência
- `AGENTS.md`, `docs/CODEX_NEXT_CHAT.md`, `docs/l1-cobalt-27-lts-11-diff-triage.md`, `docs/l1-media3-exoplayer-findings.md`.
- `tools/l1-resolve-cobalt-27-lts-11-conflicts.py`, `.github/workflows/l1-cobalt-27-lts-11-integrate.yml`.
- O estado remoto **não** garante que o clone local do Codex Windows esteja sincronizado; verificar `git status --short --branch` antes de atualizar.
