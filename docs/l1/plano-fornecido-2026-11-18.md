# PLANO COMPLETO DE IMPLEMENTAÇÃO — TizenTubeCobalt L1

**Base verificada:** fork `HeliumMarcos/TizenTubeCobalt`, `main` em `66905c930023c9055dcb12c2571dcb7aa7cb0928` (17/11/2026); branches `cobalt-full`, `exp/low-latency`, `exp6`, `exp7`, `l1c3`, `l1c4`. **Fonte funcional:** seleção realizada pelo usuário em `TubeRush_Auditoria_Revisada_5_Videos_2026.xlsm`, consolidada a partir dos cinco TXT de 13/11/2026. **Sem alteração de código nem testes executados na TCL C7K nesta auditoria.**

## 1. Decisões inegociáveis

1. **Bitrate:** AV1 até **40 Mbps** e VP9/H.264/HEVC/outros até **100 Mbps** como *padrões*. O valor de elegibilidade é a taxa **representativa identificada** na resposta ou manifesto (`averageBitrate`, `AVERAGE-BANDWIDTH`, ou taxa típica explicitamente calculada/registrada) e **não o bitrate de pico**. Não multiplicar limite por 3,5; não falsificar metadados.
2. **Metadados preservados:** `bitrate`, `averageBitrate`, `itag`, MIME, HDR, FPS e dados do transporte permanecem originais. Campos sintéticos derivados devem ficar em um registro auxiliar, com procedência.
3. **Catálogo:** reconhecer e apresentar **42 opções-alvo da planilha** quando existirem na sessão; não gerar opções fictícias a partir de um TXT antigo. 30 são representações referenciadas como HLS; 12 como AV1 HTTPS/DASH. As 42 opções são cenário de aceitação, não garantia de disponibilidade simultânea.
4. **Uma única tela:** abrir diretamente o menu Qualidade definitivo, sem mostrar um menu simples que é logo trocado. Se a versão enriquecida não puder ser apresentada sem atraso/erro, mostrar o menu nativo de forma estável — nunca os dois sucessivamente.
5. **Troca:** durante reprodução, trocar sem reiniciar vídeo, sempre que engine/transporte e decoder permitirem. Para mudanças de codec/container que exijam novo MSE/MediaCodec, garantir reconexão na mesma posição, áudio preservado, transição visivelmente informada e rollback, sem prometer troca imperceptível universal.
6. **Áudio:** em idioma compatível com a escolha do usuário, **E-AC-3/DD+ multicanal > AC-3/DD multicanal > demais**; fallback de formatos compatíveis sem forçar PCM indevido e sem confundir áudio multicanal com Atmos.
7. **Fallback automático de vídeo:** 2160p AV1 HDR elegível → 2160p VP9 HDR elegível se AV1 2160p não existir, exceder limite ou falhar; considerar VP9 SDR/AVC 2160p quando compatíveis, depois 1440p e 1080p. Preservar opção manual e indicador de por que houve a troca.
8. **Proteção do equipamento:** uma opção acima do limite deve ser **visível, porém indisponível por padrão**. A exceção escolhida pelo usuário só é permitida após alteração explícita do valor, diagnóstico e indicação de maior risco. O valor anunciado não garante estabilidade do decoder.
9. **Meta de estabilidade:** zero regressões reproduzíveis nos testes aprovados, detecção honesta de indisponibilidade, rollback sempre operacional. **Não é possível prometer 100% de reprodução** frente a mudanças do YouTube, PO Token, DRM, CDN ou firmware sem medir a TV.

## 2. Descobertas concretas da auditoria do código

| Local | Situação encontrada | Ação necessária |
|---|---|---|
| `u.js` da `main` | Padrões atuais `maxAv1BitrateMbps: "100"`, `maxOtherBitrateMbps: "150"`; defaults internos iguais | Restaurar **40/100** em **todos** os pontos; migração cuidadosa do armazenamento local |
| `u.js` / `isBitrateOk` | Prioriza `averageBitrate`; consulta `bitrate`; permite tolerância de pico `max(cap*3.5, 160 Mbps)` | Remover requisito de pico; usar **uma única taxa de elegibilidade identificada** com procedência/estado desconhecido |
| `u.js` / `validVideos` | Filtra o array `streamingData.adaptiveFormats`; fallback inclui `!isAv1Mime(m) || isBitrateOk(f)` e um último caso pega o menor bitrate sem impor compatibilidade | Nunca liberar faixa bloqueada por fallback; separar catálogo total, elegibilidade e formatos publicados ao player |
| `u.js` / `__ttShouldHideAv1` | Anuncia AV1 como não suportado quando prefere VP9 ou limite <=35 Mbps | Remover ocultação global; usar fallback **por faixa/resolução**, não fingir que o decoder não suporta o codec |
| `u.js` / `decodingInfo` | Retorna `supported/smooth/powerEfficient: true` artificialmente quando o original responde `supported` | Respeitar `smooth`, `powerEfficient` reais; se houver exceção para teto anunciado, documentar separadamente e validar |
| `u.js` / qualidade preferida | `getAvailableQualityData()` + `setPlaybackQualityRange(t,t)` trabalha por classificação de qualidade/resolução | Insuficiente para escolher exato ITAG/codec/HDR/bitrate; implementar **controlador de representação/transportes** |
| `u.js` / atualizador | Busca releases em `reisxd/TizenTubeCobalt` | Corrigir para `HeliumMarcos/TizenTubeCobalt`, validar identificador APK, arquitetura, assinatura e semver |
| `scripts/build_u_js.py` | Dependência de `C:\Users\...\userScript.js` e substituições textuais em bundle minificado | Gerador modular/determinístico, fontes versionadas, testes de build e hash |
| `scripts/repack_qa_apk.py` | Reempacota APK oficial e troca URLs dentro de `libchrobalt.so` | Não incorpora automaticamente alterações Java/C++; distinguir explicitamente build nativo de repack e produzir SBOM/hash |
| `MediaCodecUtil.java` | Devolve `Integer.MAX_VALUE` como teto em vez da faixa real | Manter faixa original para diagnóstico; se necessário flexibilizar no seletor, **sem falsificar capacidade física** |
| `media_capabilities_cache.cc` | Deixa passar bitrate fora da faixa informada e apenas registra warning | Condicionar à regra operacional configurada, resolução/FPS/perfil/hardware, com proteção e logs |
| Actions | 14 execuções recentes do autoroll herdado falharam; sem workflow próprio comprovadamente verde | Isolar/ajustar workflows herdados; implantar CI L1 para lint, testes e pacote |
| `exp7` / `l1c4` | Tentativa experimental de recuperação VP9 por sessão autenticada, `serverAbrStreamingUrl`, interceptações `fetch` e XHR | Não mesclar automaticamente; auditoria de autenticação, sessão, token, expiração, segurança, licença e regressões |
| `exp/low-latency` | Muda flags de Proxima/ULL, `JSON.parse`, `Response.prototype.json` e playbackRate | **Fora do escopo da release de qualidade** até passar em suíte separada de lives |

## 3. Arquitetura proposta

```text
YouTube / InnerTube (sessão atual, sem serviços externos)
            │
            ▼
[1] Transport Discovery: SABR / HLS / HTTPS-DASH disponíveis
            │
            ▼
[2] FormatRegistry (metadados imutáveis + evidência de origem)
    ├─ representação exata (itag + codec/profile + HDR + FPS + resolução)
    ├─ rota(s) autorizada(s), status, cliente e vencimento
    ├─ audioTrackId / idioma / canal / DRC
    └─ referência dos 42 testes, quando for um dos vídeos da matriz
            │
            ▼
[3] Capability & Policy Engine (TV + limites 40/100 + áudio)
    ├─ LISTED: metadado encontrado
    ├─ READY: rota validada para seleção
    ├─ BLOCKED_CAP: taxa representativa acima do teto
    ├─ BLOCKED_CODEC/HDR/FPS: decoder não suporta
    ├─ NEEDS_AUTH/EXPIRED: proteção/sessão
    └─ UNKNOWN: dados insuficientes (não prometer acesso)
            │
            ├───────────────► [4] Quality Menu (um único render, foco único)
            │
            ▼
[5] Playback Controller + ABR/SABR adapter (preferencial)
    ├─ HLS adapter quando existir rota e capacidade real
    ├─ HTTPS/DASH adapter quando sessão fornecer URL válida
    ├─ áudio selecionável + troca e sincronização A/V
    └─ fallback/rollback transacional e telemetria
            │
            ▼
[6] MediaSource/Cobalt/Android MediaCodec + passthrough de áudio
```

### 3.1 Formato de dado interno

```ts
interface QualityCandidate {
  videoId: string;
  itag: string;           // não é identificador globalmente único da mídia
  representationId?: string; // se o protocolo fornecer ID mais específico
  width: number;
  height: number;
  fps: number;
  codec: 'av1'|'vp9'|'avc'|'hevc'|'other';
  codecString: string;
  hdr: 'SDR'|'HDR10'|'HLG'|'unknown';
  bitDepth?: number;
  identifiedBitrateBps?: number;
  bitrateSource?: 'averageBitrate'|'HLS-AVERAGE-BANDWIDTH'|'observed-average'|'yt-dlp-reference';
  advertisedPeakBps?: number; // somente diagnóstico, nunca veto por pico
  originClient?: string;
  route: 'sabr'|'hls'|'https'|'dash'|'unknown';
  eligibility: 'READY'|'DISCOVERED'|'BLOCKED_CAP'|'BLOCKED_CODEC'|'NEEDS_AUTH'|'EXPIRED'|'UNKNOWN';
  reason?: string;
}
```

A `yt-dlp-reference` é material de teste e **não autoriza automaticamente reprodução nem alimenta a seleção em produção**: o menu operacional exige evidência da sessão atual.

## 4. SABR: prioridade, limites e plano de pesquisa

**O que foi confirmado:** SABR usa a URL `serverAbrStreamingUrl`, `VideoPlaybackAbrRequest` em protobuf, respostas UMP e itags/representações na negociação. O servidor pode selecionar/responder com alternativas conforme buffer e dispositivo. A documentação de `@luanrt/googlevideo` oferece interfaces de streaming e seleção de faixas; `sabr-rs` implementa o ciclo InnerTube → SABR → UMP. **Isso confirma viabilidade técnica de uma camada SABR, não que os 42 ITAGs HLS estejam presentes no mesmo SABR.** A documentação de `@luanrt/googlevideo` descreve, concretamente, `SabrPlaybackOptions.videoFormat` e `audioFormat` aceitando **um ID numérico de formato**, um objeto `SabrFormat` ou uma função seletora; também expõe `StreamStartResult.selectedFormats`. Isso justifica um **protótipo de escolha exata por ITAG com conferência do formato recebido**, mas não significa que a API interna do Cobalt instalado aceite esses parâmetros automaticamente, nem que a representação HLS exista no catálogo SABR. Implementar adapter só após teste de compatibilidade, performance e licenças.

Referências técnicas:
- https://github.com/yt-dlp/yt-dlp/wiki/Po-Token-Guide
- https://jsr.io/@luanrt/googlevideo/doc/sabr-stream
- https://github.com/mthwJsmith/sabr-rs
- https://github.com/hoonseokkim/youtube-webplayer
- https://developers.google.com/youtube/cobalt/docs/reference/starboard/modules/media

**Investigar antes de alterar o player:**

1. Capturar, no dispositivo real, somente metadados não sensíveis da sessão TV HTML5/Cobalt: lista de `adaptiveFormats`, tipo de transporte, `serverAbrStreamingUrl` *presente/ausente* (não salvar URL assinada), ITAGs, perfis, HDR, bitrate, `audioTrack` e motivos de erro.
2. Para cada um dos 42 itens, observar se SABR recebe **o mesmo ITAG** ou representação tecnicamente equivalente; registrar seleção efetiva de áudio e vídeo.
3. Confirmar se a API interna de qualidade consegue escolher ITAG exato ou apenas a *classe* de qualidade (`hd2160`, `hd1440` etc.). O `setPlaybackQualityRange()` atual escolhe classe, não ITAG exato.
4. Testar transição dentro do mesmo codec e entre codecs. Não fazer `SourceBuffer.changeType` sem confirmação explícita de suporte e de continuação correta do buffer; quando indisponível, trocar pipeline mantendo posição, idioma, legendas e velocidade.
5. Validar integridade e tempos de segmentos, init/media, PTS/DTS, seeks, SABR redirect, response policy, 403/410, stall e fim de vídeo.
6. Preservar SABR nativo do Cobalt como caminho principal. Não trocar todo o engine por experimento sem medição de estabilidade.

**Status inicial das 42:** 12 AV1 com referência HTTPS/DASH; 30 VP9/H.264 escolhidas na planilha com ITAG HLS; nenhuma das 42 foi comprovada nesta auditoria como selecionável **exatamente por SABR** em tempo real. Exibir equivalentes SABR somente com indicação verdadeira de representação.

### 4.1 Quando não existir representação SABR

- **A — Mesmo ITAG por HLS válido:** leitura/validação do manifesto, DRM, codec, CORS/origem, segmentação e áudio; usar um HLS adapter apenas se Cobalt suportar o pipeline e o transporte for permitido. Checar `EXT-X-STREAM-INF`, `CODECS`, `FRAME-RATE`, `VIDEO-RANGE`, `AVERAGE-BANDWIDTH` e áudio associado. HLS não é automaticamente reproduzível porque apareceu em `yt-dlp -F`.
- **B — HTTPS/DASH da sessão:** tentar a alternativa autorizada, respeitando expiração, endereços assinados, init/media e range; em DASH do yt-dlp a rota pode representar segmentos do mesmo URL HTTPS, não um segundo formato independente.
- **C — Equivalente seguro:** mesma resolução/FPS/HDR/codec, mas ITAG diferente (ex.: VP9 HDR por SABR correspondente à qualidade HLS), com identificação correta de codec e taxa efetivamente reproduzidos.
- **D — Nenhuma rota:** manter opção no painel de diagnóstico como detectada no relatório, **não** simulá-la como opção selecionável do player. Informar `rota indisponível` e mostrar alternativas reais.

**PO Token:** necessário conforme cliente/escopo (GVS, player e/ou legenda). `MISSING POT` num teste do yt-dlp não invalida todas as variantes do mesmo ITAG; ausência do aviso também não prova autorização. Preferir o fluxo de autenticação legítimo do player. Não registrar tokens, cookies nem URLs assinadas; não cachear credenciais fora da sessão; falhas autenticadas não devem gerar loop de reload. A implementação experimental `exp7/l1c4` requer revisão particular antes da integração.

## 5. Política exata de bitrate (valor identificado; não pico)

```ts
function representativeBitrate(meta): number | null {
  if (positive(meta.averageBitrate)) return meta.averageBitrate;
  if (positive(meta.hlsAverageBandwidth)) return meta.hlsAverageBandwidth;
  if (positive(meta.observedAverageBitrate)) return meta.observedAverageBitrate;
  // meta.bitrate e HLS BANDWIDTH podem ser teto/estimativa, não média.
  // Não confundir com taxa típica sem verificar a origem.
  return null;
}
function eligibility(meta, config, hw): Status {
  if (!hw.supportsResolutionFpsProfileHdr(meta)) return 'BLOCKED_CODEC';
  const bitrate = representativeBitrate(meta);
  if (bitrate == null) return 'UNKNOWN';
  const cap = meta.codec === 'av1' ? config.av1Mbps * 1e6 : config.otherMbps * 1e6;
  if (bitrate > cap) return 'BLOCKED_CAP';
  return 'DISCOVERED'; // READY só após rota válida e confirmação operacional
}
```

**Sem taxa média identificável:** mostrar `bitrate desconhecido` e optar por faixa segura comprovada, sem usar o pico como se fosse média e sem presumir que uma taxa omitida é zero. Os valores estáticos do TubeRush servem para asserções dos testes do dia da captura, não para confiar em um manifesto futuro.

**Migração das preferências:** corrigir defaults em todas as camadas, mas não sobrescrever silenciosamente escolhas explícitas anteriores. Para instalações existentes com `100/150` já salvos, oferecer migração/aviso e ação `Restaurar limites recomendados C7K (40/100)`; para novos perfis adotar 40/100. Caso deseje 40/100 obrigatório para todos, a migração deve ser aprovada explicitamente e testada.

**Exceção da planilha:** `MNsbPClRgyg` ITAG `628-hls` = **115,679 Mbps**; o item deve existir na referência/menu, mas fica `BLOCKED_CAP (100 Mbps)` por padrão, ainda que AV1/VP9 2160p HDR elegíveis estejam disponíveis.

## 6. Seleção automática de vídeo e fallback AV1 → VP9

1. Construir candidatos identificados na sessão, sem eliminar opções só por preferência de codec.
2. Classificar com capacidade real de hardware, bitrate típico e transporte autorizado.
3. Excluir `BLOCKED_*`, `EXPIRED` e `UNKNOWN` da seleção automática (não necessariamente da exibição no menu).
4. Escolher **maior resolução viável (limite 2160p)**; dentro da mesma resolução, favorecer HDR utilizável, FPS original adequado e qualidade de vídeo; considerar codec preferido AV1 se suportado e estável.
5. Se **AV1 2160p não está pronto** (ausente, acima de 40 Mbps, codec/DRM incompatível, buffer/decode fail), testar **VP9 2160p** conforme teto de 100 Mbps; preferir VP9 HDR10 quando houver suporte, senão VP9 SDR.
6. Se não há 2160p reproduzível, repetir em 1440p e 1080p, sem mentir sobre bitrate e sem afrouxar o teto para escapar de erros.
7. Falhas de rede curtas: tentar outra rota segura da mesma representação antes de reduzir resolução. Não fazer trocas em cascata se a plataforma não suporta trocas entre MIME; usar cooldown/histerese.
8. Preferências explícitas de codec e HDR podem atuar dentro da política operacional, mas não ocultam as demais opções no menu; ao mudar manualmente, respeitar a escolha até erro persistente/indisponibilidade.
9. Logs de decisão: `selected`, `considered`, `rejected`, `fallbackFrom`, `fallbackTo`, `reason`, tudo sem informações sensíveis.

Exemplos importantes de aceitação:

| Cenário | Esperado |
|---|---|
| AV1 2160p 28 Mbps, VP9 2160p 30 Mbps | AV1 2160p elegível se HDR/perfil/decoder e rota confirmados |
| AV1 2160p 45 Mbps, VP9 2160p 31 Mbps | VP9 2160p, `fallback=AV1_CAP` |
| AV1 só 1440p, VP9 2160p elegível | VP9 2160p e AV1 1440p continua **visível** |
| 2160p VP9 115,679 Mbps, AV1 2160p 27,97 Mbps | AV1 2160p; VP9 628 visível mas bloqueado |
| Apenas AV1 1080p, VP9 1080p, sem 4K | Maior opção elegível entre 1080p; não anunciar 4K |
| Erro de token/expiração em 2160p | Uma tentativa controlada de reautorização; depois fallback de rota/qualidade, sem loop |

## 7. Troca de qualidade durante reprodução

**Necessidade técnica:** `getAvailableQualityData()`/`setPlaybackQualityRange()` atuais controlam resolução/classificação; não garantem escolha entre ITAG 642 VP9 HDR e 701 AV1 HDR. Exigir prova de ITAG real reproduzido por estatísticas/decoder antes de marcar teste como concluído.

Fluxo transacional:

```text
Abrir menu → escolher opção READY → validar sessão/rota/decoder
→ preservar tempo, idioma, legendas, volume, velocidade e estado pause/play
→ solicitar mudança de representação por engine/SABR
→ aguardar init segment + primeiro frame + áudio sincronizado
→ confirmar ITAG/codecs/hdr reais → liberar UI e registrar êxito
→ (se timeout/erro) reverter ao último formato bom e mostrar motivo
```

**Casos a testar:** mudança 1080p↔1440p↔2160p, SDR↔HDR, VP9↔AV1, 30↔60fps quando o mesmo vídeo suportar, VOD, seek durante troca, pause/resume, vídeo seguinte, autoplay, troca de áudio simultânea e erro de rede. Priorizar hardware e evitar manter dois decoders 4K ativos sem necessidade. Em mudanças de container/codec podem ocorrer alguns frames de rebuffer; o critério é **não reiniciar vídeo, não perder posição, nem entrar em loop**.

## 8. Menu Qualidade — correção do defeito já documentado

- **Problema:** menu simples é mostrado primeiro; instantes depois, uma versão enriquecida o substitui. Os vídeos e capturas fornecidos pelo usuário confirmam duas apresentações.
- **Raiz provável a investigar:** personalização aplicada após o popup original ser montado/visível, por patch tardio de renderer/DOM. Não afirmar causa sem instrumentar evento e stack do menu.
- **Preferência:** interceptar a ação antes da montagem, construir **um único menu** com dados já normalizados; inscrever no sistema de foco/DPAD e preservar seleção.
- **Plano B:** menu nativo único se não houver API/gancho estável para construção antecipada.
- **Informação por opção:** 2160p/1440p/1080p, FPS, SDR/HDR10, codec, bitrate identificado com unidade, modo auto/manual, estado de acesso e razão; linhas desabilitadas não ativáveis por Enter.
- **Foco:** posição do cursor, botão voltar, scroll, DPAD repetido, abertura durante pausa/troca, leituras de acessibilidade e fontes legíveis a distância.
- **Critério de aprovação:** **zero trocas de menu** em 100 aberturas/fechamentos e zero foco perdido no controle remoto. Não criar popup secundário para enriquecer o primeiro.

## 9. Áudio: DD+ → DD → demais, sem perder idioma/canais

**Detectado nos arquivos:** os vídeos `nK2WNlhKRZk` e `ujgysGodH1I` têm ITAG **328 E-AC-3 5.1** (~384 kbps) e **380 AC-3 5.1** (~384 kbps), além de estéreo Opus/AAC. O título “Dolby Atmos” não comprova Atmos nos bytes de áudio. Outras faixas e idiomas têm origem variável; `hCixBMdgGxI` tem múltiplos idiomas e DRC.

Política recomendada:

1. Respeitar idioma selecionado pelo usuário primeiro; não trocar português para inglês apenas para ganhar DD+. Disponibilizar escolha explícita para priorizar surround em outro idioma.
2. Dentro do idioma/faixa compatível: **E-AC-3 5.1/7.1 > AC-3 5.1 > demais multicanal suportados > Opus estéreo de maior qualidade > AAC estéreo**. Se houver DD+ apenas 2.0 versus outra trilha 5.1, a prioridade de *surround* requer critério separado e opção configurável; jamais presumir que qualquer DD+ supera qualquer 5.1.
3. DDP/AC3 só `READY` com `MediaCodec/AudioTrack` e passthrough real compatíveis. Para TCL C7K + soundbar LG S95TR, confirmar no receptor a indicação DD+ e que traseiros reproduzem discretamente.
4. Atributos dos áudios no registro: `itag`, codec, 2/6/8 canais, layout quando exposto, idioma, original/dublado, `audioTrackId`, DRC e bitrate. Mostrar rótulos `DD+ · 5.1 · 384 kbps`, `DD · 5.1 · 384 kbps`, `Opus · 2.0`.
5. Troca de áudio durante reprodução preserva vídeo e tempo; se SABR permite selecionar o áudio separadamente, fazer essa troca no mesmo stream; senão usar recuperação com sincronização explícita. Nunca anexar tracks de diferentes vídeos/sessões indevidamente.
6. Se E-AC-3 falhar: **AC-3 → multicanal alternativo → Opus/AAC**, registrar motivo e evitar PCM indevido. Em falha de saída digital, permitir PCM como **último recurso consciente**, sem afirmar surround quando downmixou.
7. Testes com 328/380 no mesmo vídeo, dois idiomas, faixas com DRC, 5.1→2.0→5.1, resume após seek, alternância entre episódios, 30 minutos contínuos.

## 10. Segurança, autenticação e robustez

- Revisar o uso experimental de `SAPISIDHASH`, cookies e `serverAbrStreamingUrl` em `exp7`/`l1c4`. Não inserir credenciais em logs, analytics, breadcrumbs nem relatórios de erro; manter escopo de origem e tempo de vida da sessão.
- `fetch`, `XMLHttpRequest`, `JSON.parse` e `Response.prototype.json` devem ser instrumentados somente em endpoints/objetos alvo; não instalar patches globais que alterem toda a aplicação sem rollback.
- Validar URLs/hosts, redirects, expiração, MIME, limites de resposta, 401/403/429, timeouts, concorrência, cancelamento e dispose do usuário ao trocar de vídeo.
- Evitar loop de reload provocado por recuperação VP9 autenticada; limite de tentativas por vídeo/sessão e cooldown exponencial.
- Não enviar senhas/cookies/tokens para serviços terceiros. Se depender de PO Token não suportado, exibir indisponibilidade e seguir para alternativa autorizada.
- Compatibilidade DRM/premium/país deve ser respeitada; não reproduzir conteúdo ao qual a sessão não tenha acesso.
- Manter SBOM/atribuições de componentes terceiros; auditar licença ao incorporar biblioteca SABR ou HLS.

## 11. Build, estrutura, CI, atualizações

**Sem alterar as sete entradas da raiz `main`:** organizar módulos e fixtures **dentro de `scripts/l1/`** e documentos dentro de `docs/l1/`. O Cobalt completo permanece em `cobalt-full` ou é convertido em submódulo/pipeline nativo documentado, com commits pinados.

Estrutura sugerida:

```text
scripts/l1/src/
  format-registry.js          # rastreamento imutável por vídeo
  bitrate-policy.js          # limites 40/100, origem e estados
  sabr-observer.js           # metadados e seleção do SABR
  transport-fallback.js      # HLS / HTTPS-DASH opt-in
  quality-controller.js      # transações, seek, rollback
  audio-controller.js        # DD+ / DD / Opus / AAC, idiomas e canais
  quality-menu.js            # único menu, DPAD/foco
  diagnostics.js             # logs censurados e métricas
scripts/l1/tests/
  fixtures/selected-42.json
  tests-bitrate.js
  tests-sabr.js
  tests-switch.js
  tests-audio.js
  tests-menu.js
scripts/l1/build.js           # output u.js determinístico
scripts/l1/release.py         # build/apk/hash/assinatura
```

- Trocar o script que depende de caminho local por build determinístico; testes da fonte antes de minificar; JS  com versão e SHA incluídos no início do bundle.
- Repack de APK não representa build do código nativo: quando existir alteração Java/C++, compilar de fonte e conferir hash de biblioteca. Até lá, não dizer que as mudanças nativas entraram no APK.
- Assinatura estável de release; preservar mesma chave/ID para updates, usar debug só para QA.
- Fixar URLs CDN por **tag/SHA de release** para instalações estáveis, com canal experimental separado. Atualizador da própria branch L1 com validação de pacote/arquitetura/assinatura.
- Separar workflows antigos de autoroll (atualmente falhos) dos novos `lint/test/build/release` próprios; não exigir que runs de autoroll herdados representem estado do L1.
- Criar `CHANGELOG`, versão de configuração e rollback do `u.js`/APK.

## 12. Testes e critérios de aceite

| ID | Cenário | Critério |
|---|---|---|
| T01 | 42 opções da planilha | **42/42** identificadas no inventário de testes a partir dos relatórios; sem itens adicionados ou omitidos; disponibilidade ao vivo verificada individualmente |
| T02 | Limite médio de AV1 | Valores de referência <=40 elegíveis se houver rota; >40 bloqueados; sem veto por pico |
| T03 | Limite dos demais | <=100 elegíveis se houver rota; `MNsbPClRgyg:628` 115,679 bloqueado por padrão |
| T04 | SABR | Listar exatos e equivalentes separadamente; **não declarar sucesso sem confirmar representação recebida** |
| T05 | Troca por qualidade | Sem reset de tempo/captions/idioma; rollback quando erro; sem loops |
| T06 | Troca entre codecs | Confirmar formato real e `SourceBuffer/decoder` compatível; reconfiguração controlada se necessário |
| T07 | Fallback AV1→VP9 | Falta/bloqueio de AV1 2160p usa VP9 2160p se READY, mantendo AV1 1440p no catálogo |
| T08 | Menu qualidade | 100 aberturas sem piscar/recriar, 100 DPAD/back sem perder foco |
| T09 | Áudio surround | E-AC-3 328 > AC-3 380 na mesma língua e com passthrough real, sem falhas traseiras |
| T10 | Idiomas e DRC | Manter idioma original/selecionado, exibir múltiplas faixas e alternar |
| T11 | Erros de GVS/POT | 401/403/expired → fallback/indisponível, sem retry infinito |
| T12 | Streams | VOD, lives, seek, pause, 1.0× e 1.25×, autoplay, desligar e retomar app |
| T13 | Performance TCL C7K | 4K60 HDR sustentado sem travamento/crash; contadores de dropped frames, rebuffer e tempo de troca |
| T14 | Empacotamento | APK assinado com mesma chave, metadados de versão e hash do JS e `.so`; instalação limpa e update |
| T15 | CI e regressão | Todos os testes de formato/política/menu/áudio e geração de pacote verdes antes de marcar release estável |

**Medições reais:** ADB logcat + mediacodec (sem credenciais), `video.getVideoPlaybackQuality()` quando disponível, `getStatsForNerds()`, métricas de buffering, bitrate efetivo, indicação DD+ na soundbar, gráficos por vídeo. Uma taxa de quadros perdidos baixa e estabilidade durante 30–60 min para 4K60 são necessárias, mas a rede/CDN poderá variar. Registrar ambiente (TV firmware, versão Android, versão L1, JS SHA, rede, data do teste) para reproduzir.

## 13. Etapas de implantação e saída de cada fase

| Fase | Entrega concreta | Dependência / portão de liberação |
|---|---|---|
| **0 — Baseline** | Arquivar APK, SHA do `u.js`, preferências, logs seguros, 42 fixtures e status das 14 Actions | Nenhuma alteração antes de ter rollback |
| **1 — Políticas** | 40/100 em todas as camadas, taxa representativa, estado das opções, fallback corrigido | T02/T03/T07 passam em testes sintéticos |
| **2 — Descoberta SABR** | Instrumentar 5 vídeos, catálogo completo e relatório exato/equivalente/ausente | Evidências de sessão real; sem logs de segredo |
| **3 — Menu único** | Menu sem flash, bitrate/codec/HDR/foco corretos | T08 + screenshots/vídeo da TCL |
| **4 — Troca de vídeo** | ITAG exato quando engine permitir, alternativas equivalentes, rollback | T04/T05/T06 em todos os trajetos suportados |
| **5 — Áudio** | Priorização DD+/DD, idioma, seleção durante playback, fallback PCM | T09/T10 + LG S95TR |
| **6 — Rotas secundárias** | HLS e HTTPS/DASH somente para casos faltantes, sem quebrar SABR | T11/T12 + A/V sincronizados e DRM respeitado |
| **7 — Qualidade de engenharia** | Builder modular, unit/integration tests, CI próprio, assinatura/atualizador, documentação | T14/T15, release candidate sem regressões |
| **8 — Release controlada** | QA ARMv7a → testes de uso prolongado → tag fixa de stable → changelog | Backout e suporte a atualização seguros |
| **9 — Isolados** | Low-latency, Proxima e recuperação autenticada experimental | Somente quando núcleo de qualidade estiver estabilizado |

Não misturar todas as fases em um commit gigantesco. Sempre testar uma mudança com 42 fixtures e os 5 vídeos reais antes de avançar. Novas funções não entram em `main` apenas por passarem testes de sintaxe.

## 14. Registro dos problemas anteriores (backlog)

- **P0**: nenhum fallback pode ignorar o limite de bitrate ou suporte real.
- **P0**: nenhuma camada deve omitir AV1 4K ou VP9 4K existentes por consulta incompleta ou preferência de codec.
- **P0**: não declarar rota SABR encontrada com base apenas no TXT do TubeRush ou em HLS.
- **P0**: separar fonte, JS executado, APK instalado e código nativo real.
- **P1**: eliminar flicker/troca de menus.
- **P1**: áudio DD+ 5.1/AC-3 5.1 e troca durante execução.
- **P1**: preservar `smooth`/`powerEfficient`, codec HDR/FPS e medições reais.
- **P1**: corrigir atualização do fork, pin de CDN, keystore de release e CI.
- **P1**: evitar JSON.parse/fetch/XHR globais e respostas de capacidade inventadas.
- **P1**: revisar código minimizado/gerador e testar build reproduzível.
- **P2**: melhorar bitrate/codec/canais em estatísticas do player, não apenas menus.
- **P2**: avaliação futura de Proxima/ULL e auto-catch-up em lives.
- **P2**: documentação, licenças, identidade do app e regressões de configuração.

## 15. Ponto de chegada verdadeiro

- **Reconhecer todas as 42 opções escolhidas** nos arquivos de referência e apresentar todas as **que a sessão realmente forneça**.
- **Selecionar e trocar durante reprodução as opções autorizadas e compatíveis**; quando uma rota/ITAG não for selecionável, fornecer equivalente verdadeiro ou indicar o motivo.
- **40/100 Mbps como padrão seguro por bitrate representativo**, mantendo a opção fora do teto visível e bloqueada por padrão.
- **AV1 2160p ausente/bloqueado → VP9 2160p**, sem perder 4K desnecessariamente.
- **Áudio E-AC-3 5.1 primeiro, AC-3 5.1 depois**, condicionados à língua e saída de áudio reais.
- **Um só menu** sem flash/foco perdido; pacote e CDN versionados; telemetria e regressão automatizadas.

**Limites honestos:** impossível validar aqui, apenas com repositório/relatórios, quais dos 30 ITAGs HLS podem ser invocados *exatamente* pelo SABR na sessão atual; não há evidência de que 42/42 sejam reproduzíveis simultaneamente ou que qualquer implementação de terceiros consiga garanti-los. O plano estabelece como provar essa disponibilidade e como oferecer rotas secundárias sem quebrar o aplicativo.

## ANEXO A — Matriz exata de 42 formatos escolhidos

### CrW2wrMcCzQ — 10 opções

| ITAG | Resolução/FPS | Codec | HDR | Mbps de referência | Rota identificada | Estado default pelo bitrate |
|---|---|---|---|---:|---|---|
| 628 | 2160p60 | VP9 | SDR | 30.208 | HLS | Elegível pelo bitrate (rota pendente) |
| 642 | 2160p60 | VP9 | HDR10 | 32.306 | HLS | Elegível pelo bitrate (rota pendente) |
| 701 | 2160p60 | AV1 | HDR10 | 27.918 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 623 | 1440p60 | VP9 | SDR | 14.941 | HLS | Elegível pelo bitrate (rota pendente) |
| 639 | 1440p60 | VP9 | HDR10 | 18.146 | HLS | Elegível pelo bitrate (rota pendente) |
| 700 | 1440p60 | AV1 | HDR10 | 13.986 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 312 | 1080p60 | H.264 | SDR | 7.953 | HLS | Elegível pelo bitrate (rota pendente) |
| 617 | 1080p60 | VP9 | SDR | 18.625 | HLS | Elegível pelo bitrate (rota pendente) |
| 636 | 1080p60 | VP9 | HDR10 | 7.443 | HLS | Elegível pelo bitrate (rota pendente) |
| 699 | 1080p60 | AV1 | HDR10 | 5.770 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |

### MNsbPClRgyg — 10 opções

| ITAG | Resolução/FPS | Codec | HDR | Mbps de referência | Rota identificada | Estado default pelo bitrate |
|---|---|---|---|---:|---|---|
| 628 | 2160p60 | VP9 | SDR | 115.679 | HLS | BLOQUEADO (>100 Mbps) |
| 642 | 2160p60 | VP9 | HDR10 | 30.713 | HLS | Elegível pelo bitrate (rota pendente) |
| 701 | 2160p60 | AV1 | HDR10 | 27.970 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 623 | 1440p60 | VP9 | SDR | 23.398 | HLS | Elegível pelo bitrate (rota pendente) |
| 639 | 1440p60 | VP9 | HDR10 | 17.741 | HLS | Elegível pelo bitrate (rota pendente) |
| 700 | 1440p60 | AV1 | HDR10 | 12.816 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 312 | 1080p60 | H.264 | SDR | 7.687 | HLS | Elegível pelo bitrate (rota pendente) |
| 617 | 1080p60 | VP9 | SDR | 6.377 | HLS | Elegível pelo bitrate (rota pendente) |
| 636 | 1080p60 | VP9 | HDR10 | 7.443 | HLS | Elegível pelo bitrate (rota pendente) |
| 699 | 1080p60 | AV1 | HDR10 | 5.846 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |

### hCixBMdgGxI — 3 opções

| ITAG | Resolução/FPS | Codec | HDR | Mbps de referência | Rota identificada | Estado default pelo bitrate |
|---|---|---|---|---:|---|---|
| 270 | 1080p30 | H.264 | SDR | 4.704 | HLS | Elegível pelo bitrate (rota pendente) |
| 399 | 1080p30 | AV1 | SDR | 1.475 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 616 | 1080p30 | VP9 | SDR | 5.457 | HLS | Elegível pelo bitrate (rota pendente) |

### nK2WNlhKRZk — 9 opções

| ITAG | Resolução/FPS | Codec | HDR | Mbps de referência | Rota identificada | Estado default pelo bitrate |
|---|---|---|---|---:|---|---|
| 625 | 2160p30 | VP9 | SDR | 18.910 | HLS | Elegível pelo bitrate (rota pendente) |
| 642 | 2160p30 | VP9 | HDR10 | 25.137 | HLS | Elegível pelo bitrate (rota pendente) |
| 701 | 2160p30 | AV1 | HDR10 | 22.079 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 620 | 1440p30 | VP9 | SDR | 9.435 | HLS | Elegível pelo bitrate (rota pendente) |
| 639 | 1440p30 | VP9 | HDR10 | 11.726 | HLS | Elegível pelo bitrate (rota pendente) |
| 270 | 1080p30 | H.264 | SDR | 4.684 | HLS | Elegível pelo bitrate (rota pendente) |
| 614 | 1080p30 | VP9 | SDR | 3.216 | HLS | Elegível pelo bitrate (rota pendente) |
| 636 | 1080p30 | VP9 | HDR10 | 4.501 | HLS | Elegível pelo bitrate (rota pendente) |
| 699 | 1080p30 | AV1 | HDR10 | 3.503 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |

### ujgysGodH1I — 10 opções

| ITAG | Resolução/FPS | Codec | HDR | Mbps de referência | Rota identificada | Estado default pelo bitrate |
|---|---|---|---|---:|---|---|
| 625 | 2160p30 | VP9 | SDR | 24.130 | HLS | Elegível pelo bitrate (rota pendente) |
| 642 | 2160p30 | VP9 | HDR10 | 25.682 | HLS | Elegível pelo bitrate (rota pendente) |
| 701 | 2160p30 | AV1 | HDR10 | 24.106 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 620 | 1440p30 | VP9 | SDR | 20.547 | HLS | Elegível pelo bitrate (rota pendente) |
| 639 | 1440p30 | VP9 | HDR10 | 12.483 | HLS | Elegível pelo bitrate (rota pendente) |
| 700 | 1440p30 | AV1 | HDR10 | 9.785 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |
| 270 | 1080p30 | H.264 | SDR | 5.746 | HLS | Elegível pelo bitrate (rota pendente) |
| 614 | 1080p30 | VP9 | SDR | 6.503 | HLS | Elegível pelo bitrate (rota pendente) |
| 636 | 1080p30 | VP9 | HDR10 | 4.564 | HLS | Elegível pelo bitrate (rota pendente) |
| 699 | 1080p30 | AV1 | HDR10 | 3.864 | HTTPS/DASH | Elegível pelo bitrate (rota pendente) |


**Fixture automatizado:** `TESTES_42_FORMATOS_TizenTubeCobalt_L1.json`. Não contém URL de mídia assinada nem tokens; referências TubeRush não substituem detecção em tempo real.
