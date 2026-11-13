# AGENTS.md — TubeRush

## Princípios de trabalho

Este repositório é o **TubeRush**, aplicativo alternativo para Google TV / Android TV baseado em **TizenTubeCobalt/Cobalt**. O branch **main** é a base do aplicativo; o branch **upgrade/cobalt-27-lts-11** deve permanecer isolado até teste e aprovação. Não usar nomes antigos da marca como identidade do fork, mas manter créditos, licenças e referências a projetos upstream.

**Leia antes de programar:**
- `docs/TUBERUSH_PLANO_MESTRE.md`: incidentes, prioridades, cinco vídeos de referência e definição de pronto.
- `docs/TUBERUSH_ORGANIZACAO_RAIZ.md`: requisitos e riscos para reduzir a raiz a sete entradas.
- `docs/l1-playback-architecture.md`: pipeline Cobalt/Starboard/Android.
- `docs/l1-media-capabilities.md`: decisões anteriores de descoberta e passthrough.
- `docs/l1-cobalt-upgrade-assessment.md`: upgrade futuro isolado.

## Escopo técnico

- **Cobalt 27 LTS** e **Starboard**, não presumir ExoPlayer, Media3 ou FFmpeg. **Nesta branch de migração**, as fontes ficam dentro de `app/` e os builds ainda não foram revalidados.
- Código principal de catálogo, menus e troca de faixa: `app/cobalt/renderer/l1_media_ui_script.h`.
- Android MediaCodec: `app/cobalt/android/apk/app/src/main/java/dev/cobalt/media/`.
- Integração/renderização: `app/cobalt/renderer/cobalt_content_renderer_client.cc`.
- Automação: `.github/workflows/`.

## Segurança das alterações

1. Inspecionar o código real no HEAD antes de propor ou fazer diffs. Nenhum comentário ou promessa de release comprova funcionamento.
2. Preservar o **DD+ 5.1 já confirmado** na TCL C7K + LG S95TR. Troca DD+ ↔ DD, seleção de codec, HLS de alto bitrate e atualização integrada precisam de **testes funcionais**, não só compile check.
3. Separar "formato encontrado", "formato compatível", "faixa solicitada" e "formato realmente reproduzido".
4. Não forçar `isPlayable` ou capacidades 4K HDR/5.1/IAMF sem evidência; não inventar acesso HLS a partir de ITAG.
5. Codec preferido Any/AV1/VP9/AVC **não pode esconder** representações alternativas do menu.
6. Preservar idiomas, codec, DRC e identidade completa da faixa; não deduplicar apenas pelo nome.
7. Esta branch contém a mudança estrutural para sete entradas; antes de mesclar, ajustar e testar `.gitmodules`, `DEPS`/gclient, GN, workflows e compilação real. Não mesclar no `main` sem testes.
8. Não commitar segredos, tokens, cookies, endereços de stream assinados ou logs privados.
9. Não forçar push, reescrever história ou mesclar a branch de upgrade por conveniência.
10. Criar commits/PRs pequenos por incidente; atualizar testes e o plano com status real.
11. Nunca declarar "compilou" sem job concluído e logs, nem "funciona na TV" sem validação na TV.
12. Para releases: preservar package ID, versionCode monotônico, certificado de assinatura, versões, integridade, arquitetura do APK e instalação sem perda de dados.

## Validação mínima

- Catalogar e trocar qualidade sem perder outras resoluções, AV1/VP9/AVC, HDR/SDR e FPS.
- Global 2160p em vídeo sem 4K: fallback compatível sem travamento.
- Vídeos **MNsbPClRgyg**, **nK2WNlhKRZk**, **ujgysGodH1I**, **CrW2wrMcCzQ** e **hCixBMdgGxI**: usar a matriz R1–R5 do plano mestre.
- DD+ / DD 5.1: validar codec na saída LG S95TR após seleção e seek.
- HLS VP9 4K60 115,68 Mbps: somente anunciar como **reprodução validada** após confirmar no Cobalt; metadado yt-dlp não basta.
- A atualização do aplicativo deve usar **https://github.com/HeliumMarcos/TubeRush/releases**, nunca as releases do projeto original.

## Eficiência do agente

- Evitar ler toda a árvore Chromium quando a alteração é localizada: identificar arquivos e chamadas pertinentes.
- Evitar recompilar Cobalt a cada modificação de documento; executar validações adequadas ao tipo de mudança.
- Não consumir cota consultando GitHub Actions repetidamente quando o job ainda estiver em fila; obter status em etapas justificadas.
- Quando a conversa ficar longa, fornecer resumo de decisões, HEAD, mudanças, testes e pendências e sugerir continuação com contexto curto.
