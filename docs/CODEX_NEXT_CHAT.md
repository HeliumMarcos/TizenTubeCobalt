# Continuação no Codex Windows — TizenTubeCobalt L1

Copie a seção abaixo para uma nova conversa. Este registro foi preparado em 2026-11-09 a partir da branch remota; **revalide HEAD e estado local**.

---

**CONTINUAÇÃO DE DESENVOLVIMENTO — TizenTubeCobalt L1 / TCL C7K**

Continue o repositório https://github.com/HeliumMarcos/TizenTubeCobalt na branch `upgrade/cobalt-27-lts-11` (PR #2 em rascunho). Não confunda com o projeto DownloadRush.

Primeiro leia `AGENTS.md`, `docs/CODEX_PROGRESS.md`, `docs/l1-cobalt-27-lts-11-diff-triage.md` e, quando pertinente, `docs/l1-media3-exoplayer-findings.md`. Verifique `git status --short --branch`, `git remote -v`, HEAD remoto e diffs locais antes de sincronizar; **não descarte alterações não commitadas**. Não refaça auditorias que ainda forem válidas.

**Estado técnico:** o motor ainda declara Cobalt `27.lts.10`; atualização para `27.lts.11` incompleta. O build é GN/Ninja/gclient. Destino Android TV TCL C7K requer `android-arm`/`armeabi-v7a`, alvo `//cobalt/android:cobalt_apk`; não presumir ARM64. `l1-android-source-check.yml` é preflight estático, não compilação; o workflow principal pode depender de runner self-hosted.

**Mudança enviada ao GitHub:** no commit `caeb02d22cbfcb9ee4127b0669021bc1f0c8f882`, `MediaCodecBridge.ColorInfo` foi integrado ao `MediaCodecUtil.getHdrStaticInfo(...)` do fork com base no upstream 27.lts.11, removendo a implementação duplicada dos metadados HDR. Validado por inspeção de fontes, **não compilado**. As regras e o registro de progresso foram adicionados em `AGENTS.md` e `docs/CODEX_PROGRESS.md`. A aplicação do patch de HDR via `git apply` **não é necessária** se esse commit já estiver no checkout.

**Diagnósticos da TV:** decodificadores MediaTek VP9 Profile 2 HDR, AV1 Main10 HDR, HEVC HDR e Dolby Vision declaram suporte 4K/60. Teste Nuvio demonstrou Dolby Vision 3840×1608/60 e Dolby Digital Plus 5.1 na rota eARC conectada à LG S95TR. Não há prova de passthrough original nem de funcionamento do Cobalt modificado.

**Próxima tarefa concreta:** conferir as diferenças oficiais 27.lts.10→27.lts.11 de `MediaCodecBridge.java` que ainda não foram portadas e interfaces JNI/nativas relacionadas. Investigar `MediaCodecBridgeBuilder.java`, `AudioOutputManager.java` e integração ExoPlayer/Media3, aplicando mudanças coerentes e testes proporcionais. Preparar um caminho **real** de build `android-arm` e somente declarar APK funcional após build e teste de instalação/reprodução.

**Limites:** preservar alterações do fork e checkout local; não alterar assinatura/package ID; não fazer commit, push, merge nem release sem nova autorização explícita; não publicar APK final sem autorização. Não inventar validações. Atualizar `docs/CODEX_PROGRESS.md` após marcos relevantes.

Ao concluir, informe: **implementado, arquivos, testes comprovados, pendências e próximo passo**.

---
