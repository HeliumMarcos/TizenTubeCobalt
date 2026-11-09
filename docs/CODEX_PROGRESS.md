# CODEX_PROGRESS — TizenTubeCobalt L1

Atualizado: **2026-11-09**. Fonte: GitHub remoto na branch `upgrade/cobalt-27-lts-11` e diagnósticos ADB enviados na conversa. **Não** confirma o estado do checkout local no Codex Windows.

## Projeto / objetivo
- Repositório: https://github.com/HeliumMarcos/TizenTubeCobalt
- Branch: `upgrade/cobalt-27-lts-11`; PR #2 (draft): https://github.com/HeliumMarcos/TizenTubeCobalt/pull/2
- Alvo: TCL C7K, Android `armeabi-v7a`/`android-arm`, soundbar LG S95TR via HDMI eARC.
- Objetivo: migrar Cobalt de `27.lts.10` para `27.lts.11`, preservar a personalização e depois obter APK ARMv7 comprovadamente compilado/testado, com VP9/AV1 4K60 HDR e áudio compatível.

## Arquitetura e compilação
- Cobalt/Chromium (C++/Java), build GN/Ninja e `gclient`; não presumir Gradle puro.
- Config Android: `.github/config/android-arm.json` com `android-arm` e `//cobalt/android:cobalt_apk`.
- `cobalt/version.h` ainda reportava `27.lts.10` na última inspeção. A migração do motor **continua incompleta**, independentemente dos ports abaixo.
- `.github/workflows/main.yaml` usa por padrão runners `self-hosted`/`chrobalt-linux-runner`, possivelmente indisponíveis. `.github/workflows/android_27.lts.yaml` possui gatilhos próprios da branch `27.lts`.
- `.github/workflows/l1-android-source-check.yml`: inspeção estática de código/configuração, **não** compilação. `.github/workflows/l1-cobalt-27-lts-11-audit.yml`: comparação com upstream, **não** atualização de motor.

## Código e documentos implementados no GitHub
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecUtil.java`: diagnósticos de codec/perfis de vídeo e áudio, suporte declarado HDR/2160p60, tratamento de erros de fabricantes; método `getHdrStaticInfo(...)` parcialmente portado do upstream.
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecBridge.java`: **commit caeb02d22cbfcb9ee4127b0669021bc1f0c8f882** porta a classe `ColorInfo` do upstream Cobalt 27.lts.11, delegando o empacotamento HDR à função `MediaCodecUtil.getHdrStaticInfo(...)`; remove o trecho duplicado e import `ByteOrder`. A assinatura JNI do construtor foi preservada. Verificação da fonte efetuada; **compilação Java/nativa não executada**.
- `AGENTS.md`: instruções para eficiência e continuidade no Codex, sem alterar limites da conta ou configurações globais.
- `docs/CODEX_PROGRESS.md` e `docs/CODEX_NEXT_CHAT.md`: documentação de estado e prompt para retomada.
- `tools/l1-collect-android-diagnostics.ps1`: coleta de diagnósticos PowerShell 5.1/ADB; usuário ajustou script para tolerar ausência do serviço `media.codec`, concluiu coleta local. Não houve teste automatizado do script no CI.
- Inspeções específicas: `docs/l1-cobalt-27-lts-11-diff-triage.md` e `docs/l1-media3-exoplayer-findings.md`; preservar documentação original.

## Evidência técnica da TCL C7K
- `media-player.txt`: decodificadores MediaTek VP9 Profile 2 HDR, AV1 Main10 HDR10/HDR10+, HEVC Main10 HDR e Dolby Vision; suporte **declarado** a 3840×2160/60.
- `logcat-full.txt`: Nuvio usando `c2.mtk.dvhe.st.decoder` (Dolby Vision), fluxo 3840×1608 a 60 fps; áudio Dolby Digital Plus 5.1, 48 kHz, sem Atmos detectado.
- `display.txt`: tela física 3840×2160 (60 Hz declarados no Android); interface lógica com 1920×1080. Isso não equivale a limitação de reprodução a 1080p.
- `audio.txt`: `hdmi_earc` conectado, soundbar LG S95TR reconhecida; **não comprovado** passthrough do bitstream original à soundbar.
- São testes de Nuvio/Android, **não** validação de APK Cobalt modificado.

## Pendências / riscos
1. Port 27.lts.11 ainda parcial: conferir diferenças de `MediaCodecBridge.java`, `MediaCodecBridgeBuilder.java`, `AudioOutputManager.java`, JNI/Starboard e componentes Media3/ExoPlayer; não trocar apenas macro da versão.
2. O ExoPlayerManager oficial pode forçar passthrough AC-3/E-AC-3/JOC; conferir suporte da saída ativa e definir fallback PCM quando indisponível.
3. Opções de 4K HDR/5.1 dependem de faixas efetivamente entregues pelo serviço, além de hardware/seleção/decodificação.
4. Não há compilação Java/C++, APK ARMv7 nem teste deste port na TCL C7K. Não há nova release validada.
5. Disponibilidade de runner e configuração executável do build Android não estão comprovadas para o fork.
6. O estado local do Codex Windows e eventuais mudanças não commitadas **não pôde ser inspecionado remotamente**.
7. O diagnóstico da execução coletou informações úteis, mas ainda não gera prova isolada de passthrough Dolby para a LG S95TR.

## Próximo passo exato
1. Em checkout **TizenTubeCobalt** (não DownloadRush), conferir `git status --short --branch`, `git remote -v`, HEAD e mudanças locais antes de sincronizar. Ler `AGENTS.md` e este documento; não descartar trabalho local.
2. Inspecionar diferenças oficiais de `MediaCodecBridge.java` além de `ColorInfo`, conferir JNI e integrações nativas; portar mudanças de maneira coerente, com testes específicos.
3. Traçar caminho real e executável de build `android-arm` com GN/Ninja/gclient e identificar runners/recursos disponíveis, antes de afirmar que o APK está pronto.
4. Apenas com autorização específica, compilar/instalar e validar TCL C7K: VP9/AV1 HDR 2160p60, ativação de HDR, seleção de faixas, Dolby Digital Plus 5.1 e fallback seguro.

## Validação e regras
- Commit HDR: port comparado com o arquivo oficial 27.lts.11, método `MediaCodecUtil.getHdrStaticInfo` existente e assinatura construtor conferida; inspeção textual bem-sucedida.
- Testes Java/C++/APK na branch atual: **não executados**; não prometer compatibilidade até compilação real.
- `AGENTS.md` orienta a implementação, **não** muda modelo, cotas ou opções globais Codex.
- Não realizar novos commits, push, merge, releases ou operações destrutivas sem autorização explícita na tarefa seguinte.
