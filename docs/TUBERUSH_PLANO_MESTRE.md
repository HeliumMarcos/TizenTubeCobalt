# TubeRush — Plano mestre de auditoria, correções, melhorias e validação

> **Status:** planejamento técnico; NÃO significa que as correções estão implementadas nem testadas.  
> **Data-base:** 13/11/2026 (America/Sao_Paulo).  
> **Repositório oficial:** https://github.com/HeliumMarcos/TubeRush  
> **Branch de implementação:** `main` (integrado e de produção), com novas correções preferencialmente desenvolvidas em branches/PRs curtos antes do merge.  
> **Branch reservada:** `upgrade/cobalt-27-lts-11` — manter isolada e NÃO mesclar automaticamente.  
> **Baseline auditada:** `250d823de07fa6e6600405352dcc383c32355bf1`.  
> **Release auditada:** `v1.0.0-tuberush` (APK publicado; aprovação de reprodução/atualização ainda pendente).  
> **Motor:** Cobalt `27.lts.10`, usando player web do YouTube TV, pipeline nativo Cobalt/Starboard e Android MediaCodec/AudioTrack. **Não presumir Media3/ExoPlayer ou FFmpeg.**  
> **Equipamento de referência:** TCL C7K com Android/Google TV + soundbar LG S95TR, ligação de áudio a validar pelo caminho real (eARC/passthrough).

## 0. Objetivo, escopo e regras

Transformar o TubeRush em um cliente para YouTube TV que **descubra e apresente os formatos realmente disponíveis**, inicie a reprodução com as preferências globais de resolução e codec, permita selecionar manualmente qualquer representação compatível sem esconder outras e utilize corretamente áudio 5.1. Incluir atualização do APK pelo **GitHub Releases do próprio TubeRush**.

### Regras inegociáveis

1. **Preservar o que já funciona:** há teste do usuário confirmando **E-AC-3/DD+ 5.1 efetivo** no vídeo `nK2WNlhKRZk` e reconhecimento pela LG S95TR. Não trocar esse funcionamento por PCM silenciosamente.
2. **Preferência não é filtro do catálogo:** `Any`, `AV1`, `VP9` e `AVC` definem prioridade automática, **nunca ocultam** formatos de outros codecs no menu Qualidade.
3. **Seleção manual prevalece** sobre a preferência global enquanto o vídeo atual estiver em reprodução; o usuário sempre pode voltar a Automática.
4. **Exibir somente formatos reais** retornados por fonte/mecanismo suportado; não simular Dolby Vision, Atmos, 120 FPS, IAMF ou 5.1 com base apenas no título do vídeo ou em um `mimeType` genérico.
5. **Nunca marcar um formato como reproduzível sem validação** de capacidades do dispositivo + condições do fluxo. Distinguir catalogado, testável e confirmado.
6. **Não perder opções** ao fixar ITAG, trocar faixa, mudar resolução, fazer seek, recarregar player ou receber respostas parciais.
7. **Sem falsificação permanente de capacidades:** eliminar retornos genéricos de `true`, 6 canais forçados e HDR em dispositivos incompatíveis; soluções de compatibilidade devem ser fundamentadas em detecção e testes.
8. **Não contornar DRM, autenticação ou restrições de acesso.** Respeitar PO Tokens válidos e requisitos oficiais do YouTube; formatos `MISSING POT` são evidência de catálogo, não promessa de acesso.
9. **Não publicar APK sem validação.** Código compilado ≠ recurso testado ≠ som realmente recebido pela soundbar.
10. **Preservar ID do aplicativo, dados e assinatura** entre versões. Mudanças em nome de app e links de atualização não devem prejudicar instalações existentes.

### Evidências e grau de certeza

- **Confirmado via GitHub:** repositório renomeado, `main` em `250d823...`; somente `main` e `upgrade/cobalt-27-lts-11`; release `v1.0.0-tuberush` com `TubeRush.apk` e `TubeRush-v1.0.0-armeabi-v7a.apk`.
- **Confirmado por relatórios externos:** os metadados de formatos e bitrates enumerados pelo yt-dlp em cinco vídeos, todos com quatro testes terminados em código 0.
- **Confirmado em aparelho pelo usuário:** DD+ 5.1 reproduziu e foi reconhecido pela LG S95TR; ocorreram desaparecimento de opções e falhas ao tentar DD 5.1; preferência 2160p atrasou o início e falhou no fallback; menu Qualidade apresentou apenas Auto e 2160p; no caso mostrado, estatísticas registraram reprodução em 1080p.
- **Não confirmado:** correção efetiva de troca AC-3/DD+ no APK v1.0.0; reprodução `628-hls` a 115,68 Mbps; suporte funcional do player a todas as combinações HLS/DASH/SABR; atualização automática do APK; identidade final completamente livre de textos antigos.
- **Hipóteses técnicas:** efeito do pinning estrito de ITAG sobre o ABR, sobrescrita de métodos da API do player, decisões de capacidade forçadas, ausência de tratamento do manifesto HLS e descarte/substituição do catálogo. Confirmar por logs/testes antes de declarar causa única.

---

## 1. Inventário de incidentes e requisitos

| ID | Prioridade | Comportamento observado / solicitado | Resultado obrigatório |
|---|---|---|---|
| A01 | P0 | E-AC-3 5.1 toca; ao selecionar AC-3 5.1, a troca pode falhar e a opção desaparecer. | DD+ ↔ DD ↔ estéreo com mudança real, checkmark correto, sem perder faixas e sem regressão de DD+. |
| V01 | P0 | Preferência 2160p inicia em 480p/720p/1080p e sobe posteriormente. | Tentar iniciar diretamente na representação 2160p preferida quando disponível, capaz e com condições de reprodução adequadas; confirmar qualidade real, não só rótulo. |
| V02 | P0 | Preferência 2160p faz menu esconder outras resoluções; vídeo sem 2160p trava. | Catálogo completo sempre acessível e fallback para melhor resolução compatível disponível. |
| V03 | P0 | Preferência de codec Any/AV1/VP9/AVC esconde alternativas e lista só AV1. | Exibir todas as representações reais, inclusive mesma resolução/FPS com codecs/HDR/bitrates distintos. Prioridade sem filtragem. |
| V04 | P0 | No vídeo `MNsbPClRgyg` existe `628-hls` VP9 4K60 SDR de **115.678,879 kbps** anunciado pelo yt-dlp; capacidade do TubeRush não comprovada. | Descobrir, expor e testar com segurança a representação HLS >100 Mbps; habilitar seleção somente se mecanismo e dispositivo puderem reproduzi-la. |
| V05 | P0 | Rótulo selecionado 2160p diverge de `Current / Optimal Res` nas estatísticas; vídeo observado em 1080p. | Exibir seleção solicitada e qualidade efetiva separadamente, medir decoder, segmentos e ITAG de execução. |
| A02 | P0 | Catálogo mistura idiomas, qualidades, 2.0/5.1, DRC e variantes. | Preservar faixa + idioma + ID de áudio + codec + canais + bitrate + DRC + idioma padrão/dublagem; não deduplicar por nome apenas. |
| C01 | P0 | Respostas de suporte a formatos são forçadas como `true` / `probably`; 6 canais anunciados mesmo sem evidência suficiente. | Consulta real ao MediaCodec, Starboard, AudioTrack e rota eARC; evitar perfis não suportados e passthrough falso. |
| B01 | P1 | Algumas telas e toasts continuam mostrando TizenTube. | Identidade visual TubeRush em todo texto próprio do fork; preservar créditos e licenças de terceiros. |
| U01 | P1 | Atualizador do aplicativo deve apontar para os **próprios Releases**. | Checagem manual/automática, download da arquitetura correta, comparação de versão/assinatura e instalação com confirmação Android. |
| CI01 | P1 | Workflow contém branch excluída, artefatos antigos e gatilhos incompletos. | Compilar/testar alterações reais no `main`, publicar APK verificável e versionado, com SHA-256. |
| P01 | P1 | Hooks e reloads podem crescer, duplicar interceptações e prejudicar playback. | Interceptação idempotente, estado separado do player, logs e recuperação sem loop. |
| E01 | P2 | Cobalt 27.lts.11 em branch separada, sem teste equivalente. | Avaliar atualização isoladamente, só mesclar após regressões e decisão de estabilidade. |
| UX01 | P2 | Menus precisam ser claros na Google TV. | Listar resolução/FPS/HDR/codec/bitrate, opção Auto, foco/controle remoto e status real sem sobrecarregar. |

**P0 = bloqueia confiabilidade da reprodução; P1 = produto/distribuição; P2 = evolução controlada.** Prazos não são presumidos.

---

## 2. Arquitetura real e arquivos a auditar

Fluxo esperado: **aplicação web YouTube TV** → modificações TubeRush no Cobalt/renderer → catálogo de streaming (DASH/HLS/SABR e PlayerResponse) → seleção do player Cobalt/Starboard → Android MediaCodec/AudioTrack → TCL C7K → LG S95TR.

| Arquivo/local | Responsabilidade e pontos de inspeção |
|---|---|
| `cobalt/renderer/l1_media_ui_script.h` | Intercepta PlayerResponse, `JSON.parse`, `Response.json`, `ytcfg`, qualidade, audio tracks e pinning; atualmente 628 linhas. Principal alvo para V01–V05, A01–A02, P01 e parte de UX01. |
| `cobalt/renderer/cobalt_content_renderer_client.cc` | Injeta JS no início do documento; media support e ligação com renderer. Conferir momento de injeção, conteúdo por frame e segurança. |
| `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecUtil.java` | Capacidade real de hardware: perfis AVC/VP9/AV1, tamanho, FPS, HDR, decoder, fallback. |
| `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecBridge.java` | Criação/configuração do decodificador e erros de inicialização. |
| `cobalt/android/apk/app/src/main/java/dev/cobalt/media/AudioOutputManager.java` | Rotas de saída, canais, passthrough, áudio ligado à soundbar. Revisar regra de mínimo de 6 canais. |
| `cobalt/android/apk/app/src/main/java/dev/cobalt/media/AudioTrackBridge.java` | Formato de saída, bitstream real/PCM, troca de faixa e roteamento. |
| `starboard/android/shared/audio_output_manager.cc` / `starboard/common/media.cc` | Capacidades nativas e integração de passthrough. |
| `starboard/android/shared/media_capabilities_cache.cc` | Dados reais de codec vs anúncios falsos ou cache obsoleto. |
| `third_party/blink/renderer/modules/media_capabilities/media_capabilities.cc` | Contrato de `decodingInfo`, perfis HDR e sinais de smooth/power efficiency. |
| `.github/workflows/l1-android-armv7-build.yml` | CI para versão ARMv7, testes, nomes, triggers, verificações SHA-256. |
| `.github/workflows/l1-upstream-check.yml` | Checagem semanal de upstream; preservar monitoramento e não mesclar alterações sem testes. |
| `cobalt/shell/android/`, manifests, recursos/strings, scripts TizenTube mod | Nome, ícones, banner, package, versionCode/versionName, telas, atualizações e créditos. Descobrir a árvore real antes de alterar. |
| `docs/l1-media-capabilities.md`, `docs/l1-playback-architecture.md`, `docs/l1-cobalt-upgrade-assessment.md` | Documentação anterior a reconciliar com este plano; não apagar decisões históricas sem revisão. |
| `cobalt/version.h` | Baseline verificada: `27.lts.10`. |

### Achados verificáveis no `l1_media_ui_script.h` do `main`

- O catálogo de vídeo depende de `streamingData.adaptiveFormats`; **não há extração dedicada verificada** das variantes de `hlsManifestUrl`.
- Qualidade usa `quality: 'fmt_' + f.itag` e `isPlayable: true`; esse campo **não prova** acesso ou decodificação.
- Fixar vídeo/áudio altera `sd.adaptiveFormats = vids.concat(auds)`, efetivamente reduzindo fontes entregues ao player. Isso pode derrubar fallback, ABR e listagem de opções.
- Persistência anterior só é reaproveitada se catálogo anterior tiver **mais itens**, e não por união de identidades; catálogos parciais diferentes podem substituir um ao outro.
- `getAvailableAudioTracks()` remove duplicatas usando apenas `displayName`. Pode eliminar idiomas/DRC/representações com o mesmo rótulo.
- `getCurrentlyPlayingAudioItag()` prefere o pin; checkmark representa **seleção solicitada**, não necessariamente áudio efetivamente reproduzido.
- `setAudioTrack()` fixa ITAG e chama `reloadPlayerAtCurrentTime()`; não é troca nativa confirmada sem interrupção.
- A rotina `hookPlayerApi()` é acionada a cada segundo e reatribui métodos continuamente; investigar wrappers repetidos, memória e comportamento após troca de vídeo.
- `navigator.mediaCapabilities.decodingInfo`, `isTypeSupported` e `canPlayType` podem declarar suporte genérico a AV1/VP9/AC-3/E-AC-3/IAMF. O código atual também retorna `isAudioIamf() = true` incondicionalmente.
- O Android `AudioOutputManager.java` anuncia pelo menos 6 canais em determinada rota, independentemente da capacidade realmente reportada; isso deve ser substituído por detecção validada.
- O campo de bitrate formatado usa `f.bitrate || f.averageBitrate`: prioridade e significado precisam ser explícitos; distinguir `bitrate` vs `averageBitrate` e não tratar metadado HLS como bitrate medido.

---

## 3. Plano V — Descoberta completa, formatos e reprodução de vídeo

### V-A. Fontes de formatos e proveniência (P0)

1. Rastrear a **origem de cada representação**: `adaptiveFormats`, `formats`, `dashManifestUrl`, `hlsManifestUrl`, descritores SABR e respostas de Player API, quando fornecidos ao dispositivo e acessíveis.
2. Para HLS, implementar/usar **parser de master playlist** adequado ao motor: variantes (`EXT-X-STREAM-INF`), `BANDWIDTH`, `AVERAGE-BANDWIDTH`, codecs, resolução, FPS, HDR, URI, áudio associado. Não inferir vídeo >100 Mbps apenas por um ITAG.
3. Para DASH, ler representações/adaptação, perfis, bitrates e audio groups; distinguir HTTP progressivo, DASH segmentado e outras variantes por cliente.
4. Para SABR, **investigar API e formato efetivamente expostos ao Cobalt**; logs do player precisam mostrar se o `Current Res` e ITAG vêm de segmentos SABR. Não inventar um link HLS com base no catálogo yt-dlp.
5. Disponibilizar um modelo de dados imutável `StreamRepresentation` com: vídeo ID, itag/id da representação, fonte/cliente, protocolo, URL/manifesto disponível, mime/container, codec e profile, width/height, FPS, HDR/EOTF, bitrate anunciado, bitrate médio, bitrate de mídia estimado, duração, áudio vinculado, DRMs/restrições, status PO Token/acesso, compatibilidade, motivo de rejeição e instante de atualização.
6. Preservar múltiplas representações com o mesmo ITAG caso **protocolo, cliente, perfil, URI ou bitrate** difiram; a identidade não pode ser só `itag`. Mesclar variantes idênticas somente após comparação dos campos relevantes.
7. **Não expor URLs assinadas, cookies, tokens ou identificadores pessoais em logs públicos**; mascarar campos sensíveis.
8. Ações separadas: **descoberta** ≠ **verificação de compatibilidade** ≠ **exibição** ≠ **seleção** ≠ **reprodução confirmada**.
9. Quedas/limitações da fonte: códigos 403/404, `MISSING POT`, fluxos incompletos, expiração da URL e manifesto incompatível → logar, marcar indisponível para reprodução, manter menu e tentar fallback.

**Aceitação V-A:** cada vídeo da seção 10 deve gerar catálogo comparável ao relatório; duplicação entre clientes não multiplicará opções indistinguíveis; nenhum 403 é tratado como vídeo reproduzível.

### V-B. 4K HDR, AV1, VP9, AVC, FPS e ordenação (P0)

- Exibir **todas** as combinações disponíveis e reproduzíveis por resolução, **FPS, codec, profile, SDR/HDR10/HLG quando verificável, bitrate** e ID da representação; permitir variantes HLS/DASH quando realmente distintas.
- Exemplo de menu (somente quando a fonte existir): `2160p · 60 FPS · AV1 · HDR10 · 27,97 Mbps`; `2160p · 60 FPS · VP9 · HDR10 · 26,74 Mbps`; `2160p · 60 FPS · VP9 · SDR · 115,68 Mbps · HLS`; `1080p · 30 FPS · AVC · SDR`.
- Ordenação: maior resolução → FPS → preferência HDR/codec configurada → representação e bitrate (sem supor que bitrate maior em codec diferente sempre seja imagem melhor); configurações de preferência nunca removem opções.
- Conservar FPS original ao selecionar outra resolução, quando houver representação correspondente; se não houver, indicar que houve mudança de FPS.
- HDR requer validação da faixa `colorInfo`, transfer function e suporte da TV/decoder; **título "Dolby Vision", "16K", "8K", "120FPS", "Atmos" não constitui evidência de formato**.
- Não classificar HLG como HDR10; não rotular VP9 Profile 0 como HDR.
- Não usar `devicePixelRatio` ou `matchMedia` adulterados como única base de suporte: consultar dimensões reais, decodificação e capacidades.
- Garantir acessibilidade na TV: textos legíveis, foco do controle remoto, scroll estável, atualização do menu sem pular seleção.

**Aceitação V-B:** em vídeo com AV1/VP9/AVC a lista apresenta cada combinação real e não apenas AV1, independentemente do codec preferido global.

### V-C. Preferências globais, escolha manual e fallback (P0)

**Configurações previstas:** Qualidade preferida: Auto/2160p/1440p/1080p/etc.; Codec preferido: Any/AV1/VP9/AVC; HDR: preferir HDR compatível / automático / opcional SDR; FPS: preservar maior disponível e considerar compatibilidade; possibilidade de modo estrito de qualidade **somente se houver fallback de emergência**.

**Regras do seletor (ordem lógica):**

1. Enumerar e validar fontes; descartar representação inacessível/incompatível de execução, preservando metadados no diagnóstico.
2. Se há **seleção manual válida**, tentar exatamente essa combinação (ID+protocolo+perfil+HDR+FPS), não trocar por outro codec com o mesmo ITAG. Informar e oferecer fallback se a representação falhar.
3. Caso contrário, aplicar **resolução preferida**, com fallback de resolução **2160p → 1440p → 1080p → 720p → ...**, apenas entre representações disponíveis.
4. Dentro da resolução escolhida, aplicar **codec preferido** como prioridade, não filtro: AV1 → outros codecs compatíveis; VP9 → outros; AVC → outros; Any → ranking de qualidade/perfil compatível.
5. Quando vídeo/áudio desejados não forem suficientes ou estáveis, adotar fallback gradual por motivo explícito: incompatibilidade, erro de acesso, stall/buffer, DRM, falta de faixa, etc.
6. **Selecionar antes da reprodução, sempre que tecnicamente possível.** Evitar começar em 480p e só depois forçar 2160p por callback tardio; aceitar buffer inicial razoável e limite de tentativas para evitar espera infinita.
7. **Não destruir `adaptiveFormats` para implementar preferência.** Controlar seletor/ABR pelos pontos suportados no player e preservar opções de segurança. Se pinning for inevitável temporariamente, desenvolver estado reversível com fallback watchdog e não deixar catálogo encolher.
8. Ao acionar "Automática", limpar override manual **sem reload em cascata**; continuar respeitando preferências globais e ABR.
9. Ao mudar qualidade, preservar tempo, idioma/faixa de áudio, volume, legendas, estado play/paused e evitar replay desnecessário.
10. Medir seleção solicitada, selecionada pelo pipeline e **efetivamente decodificada**. O checkmark só significa formato ativo se conferido; se não, sinalizar "solicitando"/"não disponível".

**Matriz obrigatória:**

| Preferência codec | Preferência resolução | Comportamento automático | Menu |
|---|---|---|---|
| Any | 2160p | Melhor 2160p compatível; se ausente, melhor resolução inferior | Todos os codecs/resoluções |
| AV1 | 2160p | Tentar 2160p AV1; se ausente, avaliar outros codecs 2160p compatíveis antes de reduzir | AV1, VP9, AVC, todos disponíveis |
| VP9 | 2160p | Tentar 2160p VP9; depois alternativas compatíveis | AV1, VP9, AVC, todos disponíveis |
| AVC | 2160p | Tentar AVC na maior resolução escolhida disponível; fallback sem travar | AV1, VP9, AVC, todos disponíveis |
| AV1 | Auto | Priorizar AV1 sem suprimir VP9/AVC | Todos |
| Qualquer | Manual VP9 1080p | Respeitar escolha manual neste vídeo | Todos |

**Aceitação V-C:** vídeo `hCixBMdgGxI`, sem 2160p nos relatórios, inicia/reproduz em 1080p (ou menor se necessário), sem tela de carregamento infinita; vídeo 4K não esconde 1080p/720p.

### V-D. Caso específico HLS acima de 100 Mbps (P0 — investigação + teste)

**Alvo real:** vídeo `MNsbPClRgyg`; formato `628-hls`; 3840×2160; 60 FPS; VP9 Profile 0 SDR; HLS; `tbr ≈ 115.678,879 kbps` (115,679 Mbps, valor do yt-dlp).

**Plano de execução:**
1. Reproduzir metadados de `628-hls` no dispositivo; comparar com variantes `315` VP9 SDR e `642-hls` VP9 HDR10.
2. Investigar como o YouTube TV no Cobalt recebe playlists HLS desse vídeo (quando recebe); identificar a URL de manifesto e os segmentos **sem reproduzir URL de origem externa ou forjar assinatura**.
3. Verificar suporte do pipeline Cobalt/Starboard ao tipo de HLS/segmentação/codec e se o YouTube aceita playback desta rota no dispositivo.
4. Verificar se o bitrate informado provém de `BANDWIDTH` (pico anunciado) ou `AVERAGE-BANDWIDTH` (médio anunciado) e medir taxa real de rede/segmentos, sem misturar unidades.
5. Implementar seleção do formato HLS apenas se a fonte for **acessível, compatível e persistir após play/seek**. Manter representações DASH como fallback.
6. Validar carregamento, buffer, frames decodificados, dropped frames, travamentos, HDR/SDR, áudio sincronizado e mudança manual de/para `628-hls`.
7. **Não estabelecer teto artificial de 100.000 kbps** nem assumir que uma faixa de 115 Mbps é melhor que HDR10/AV1 de 28 Mbps; deixar o usuário escolher e respeitar preferência de HDR/codec.
8. Se o motor Cobalt não conseguir reproduzir a variante, registrar limitação e seus motivos e **não afirmar suporte concluído**. Avaliar adaptação nativa/alternativa permitida como tarefa separada antes de prometer o recurso.

**Aceitação V-D:** ver simultaneamente `628-hls` no catálogo, fluxo carregado pelo Cobalt, 4K60 VP9 SDR efetivo nas estatísticas e estabilidade de reprodução; registrar bitrate **medido** separadamente do anunciado. Caso inacessível por condições externas, resultado é "bloqueado/limitado, com evidência", não "passou".

---

## 4. Plano A — Áudio 2.0/5.1, idiomas, codecs e passthrough

### A-A. Descoberta real das faixas (P0)

- Catalogar **por identidade de faixa**: track ID, itag, `audioTrack`, language code, idioma apresentado, padrão/original/dublagem automática, canais, codec, bitrate, frequência, DRC, rota/cliente e protocolo. Nunca depender só do `displayName`.
- Exibir AAC, Opus, Dolby Digital (`ac-3`), Dolby Digital Plus (`ec-3`) e IAMF **somente quando existir uma faixa real**; IAMF não é sinônimo automático de Opus 5.1.
- Não presumir 6 canais porque MIME menciona `ac-3`/`ec-3`/`iamf`; recuperar `audioChannels`, configuração do stream e capacidade da saída.
- Vídeo com idiomas en-US/es-US/pt-BR deve manter **opções separadas mesmo com mesmo codec/bitrate/ITAG básico**.
- Faixas com e sem DRC só devem aparecer como entradas distintas quando entregarem experiência distinta ao player; nunca eliminar idioma.
- Padrão de UI: `Português (Brasil) · AAC · 2.0 · 129 kbps`; `Inglês · DD+ · 5.1 · 384 kbps`; contexto de idioma sempre visível se houver alternativas.

### A-B. Seleção, saída efetiva e regressão DD+ (P0)

- **Caso protegido:** no `nK2WNlhKRZk` o usuário observou DD+ (`328`) chegando à soundbar; manter.
- Ao selecionar `380` (AC-3 5.1), mudar realmente o fluxo, confirmar codec ativo pela camada nativa e pelo indicador da soundbar; opção `380` permanece listada.
- Testar retorno `380 → 328`; trocar repetidamente, mudar vídeo e seek; não transformar a saída inesperadamente em PCM.
- Checkmark deve seguir faixa **ativa verificada**, não apenas pin salvo em `sessionStorage`; ter estado pendente/erro/ativo.
- **Evitar recarregar o vídeo inteiro** para cada troca se o player suportar troca de faixa nativa; primeiro auditar API real do YouTube TV/Cobalt. Se reload for necessário, manter tempo, pausa, legendas, idioma e não duplicar sessões.
- Adicionar detecção de perda de áudio e fallback explícito, jamais trocar faixa silenciosamente por erro de formato/rota.
- Preferência de áudio opcional: Automático, DD+ 5.1, DD 5.1, Opus/AAC estéreo; idioma preferido e preferir surround quando compatível; priorizar áudio original/dublado conforme escolha do usuário.
- Política inicial **somente quando realmente disponível/suportado**: E-AC-3 multicanal > AC-3 multicanal > alternativas imersivas válidas > melhor estéreo; não comprometer idioma solicitado para obter 5.1. Configuração do usuário prevalece.
- Para eventual 7.1 em outras fontes, fallback por capacidade **DD+ 7.1 → DD+ 5.1 → DD+ 2.0 → DD → PCM**, **se as alternativas existirem**; não prometer transcodificação TrueHD/Atmos, inexistente no pipeline Cobalt atual.
- Diferenciar decoder multicanal, PCM 5.1, passthrough AC-3 e passthrough E-AC-3; verificar capacidades reais da TV, eARC, Android `AudioTrack` e LG S95TR.

### A-C. Critérios de áudio

- [ ] `328` detectado como E-AC-3/5.1 e reproduzido realmente em DD+ na soundbar.
- [ ] `380` detectado como AC-3/5.1 e reproduzido realmente em DD na soundbar.
- [ ] Alternar ao menos 5 vezes `328 ↔ 380` sem desaparecer da listagem, travar, mudar idioma indevidamente ou perder seek.
- [ ] Testar vídeo sem surround, áudio estéreo e retorno seguro.
- [ ] Testar múltiplos idiomas no `hCixBMdgGxI`, inclusive pt-BR original, inglês e espanhol; preservar idioma escolhido.
- [ ] Testar rota HDMI/eARC e alterações de configuração de áudio da TCL; comportamento incompatível deve ser informado, não mascarado.
- [ ] Confirmar decodificação/passthrough em logs e na soundbar; painel de estatísticas sozinho não prova formato enviado à saída.
- [ ] Nunca identificar Atmos, Dolby Vision ou IAMF a partir do título do vídeo.

---

## 5. Plano C/P — Compatibilidade real, estabilidade e desempenho

### Capabilities reais (P0)

1. Usar `MediaCodecList/MediaCodecInfo.VideoCapabilities` e integrações Cobalt/Starboard para validar width/height, FPS, profile, level, bit depth, HDR, codificação e suporte por hardware.
2. Diferenciar "codec reconhecido" vs "perfil específico suportado" vs "suporta 4K60 estável" vs "decodificador inicializou". Não devolver `smooth/powerEfficient = true` sem evidência.
3. **Retirar spoofing permanente de `MediaSource.isTypeSupported`, `HTMLMediaElement.canPlayType` e `navigator.mediaCapabilities.decodingInfo`**, preservando somente compatibilizações justificadas, testadas e específicas para o Cobalt.
4. Rever `AudioDestinationNode.maxChannelCount` forçado em 6, `getUserAudio51Preference() = 1` e `isAudioIamf() = true`; retornar estado real do dispositivo e escolha do usuário.
5. Revisar remendo de `AudioOutputManager.java` que eleva capacidade para pelo menos 6 canais mesmo sem comprovação; não quebrar DD+ que funciona.
6. Negativas de probe do YouTube devem continuar negativas; testes inválidos (canais 99, resolução enorme, FPS extremo) não podem ser aceitos.

### Hooks e estado (P0/P1)

- Não instalar wrappers a cada segundo sobre métodos já sobrescritos; preservar originais uma única vez, usar sentinela por objeto/player e reexecutar apenas quando instância mudar.
- Evitar interceptação global desnecessária de `JSON.parse`; se mantida, proteger contra processamento duplicado, recursão, mutação indevida e custo alto.
- Separar catálogos **bruto**, **validado**, **exibido** e **reprodução atual**; estado versionado por vídeo e manifesto, atualizações incrementais/união por ID composto.
- Remover loop `pin → reload → repin → reload`. Impor limite por ação e watchdog de buffer com fallback.
- Lidar com pause/resume, avanço, retrocesso, próximo vídeo, busca, remoção do app, suspensão da TV e conexões intermitentes.
- Cache com expiração sensata; não persistir URLs de mídia temporárias/assinadas em claro; guardar preferências sem token.
- Logging por níveis (`OFF/ERROR/INFO/DEBUG`) e painel de diagnóstico com **log exportável sanitizado**.

### Telemetria do player (P1)

Registrar: video ID, representação solicitada/ativa, ITAG, source/protocol, codec/profile, resolução/FPS real, HDR real, bitrate anunciado/médio/estimado/medido (com unidade e origem), buffer health, throughput, dropped frames, atraso de inicialização, quantidade de tentativas, causa de fallback, saída de áudio, codec nativo e canais, idioma, falhas HTTP e capacidades da TV. Sem coletar dados sensíveis indevidamente e sem enviar logs automaticamente a terceiros.

**Aceitação:** painéis e logs devem explicar "por que este vídeo ficou em 1080p apesar do 2160p preferido" e "por que `628-hls` foi recusado", com motivos reprodutíveis.

---

## 6. Plano UX/B — Menus e rebranding TubeRush

### Menu Qualidade

- Rótulo completo: resolução + FPS + codec + SDR/HDR + bitrate em Mbps, sem arredondamento enganoso.
- Ordem previsível, foco e navegação por controle remoto; seleção manual não some após clicar.
- "Automática (prioridade: AV1, qualidade: 2160p)" como descrição, quando configurado, não como única opção.
- Mostrar status ativo (real), opção indisponível com motivo, transferência entre protocolos e feedback de erro.
- Formatos de bitrate anunciado muito alto podem exibir etiqueta **"HLS / taxa anunciada"** para não confundir com throughput da rede.
- Exibir variantes únicas por protocolo só se realmente diferentes; não poluir menu com cópias de cliente idênticas.

### Menu Faixa de áudio

- Exibir idioma, codec, canais, bitrate e DRC quando aplicável, sem agrupar idiomas diferentes.
- Checkmark baseado em faixa ativa; status "alternando..." com retorno sem desaparecimento.
- Preferências separadas de vídeo; não interferir na seleção de legenda.

### Branding

- Auditar telas de boas-vindas, toast `Welcome to TizenTube`, "Go to settings...", botão `TizenTube Settings`, título e categorias, preferências, notificações e versões/traduções.
- Substituir por **TubeRush** quando se tratar do nome do aplicativo/fork.
- Manter **créditos originais do autor Reis Can/reisxd, avisos de licença, links de upstream e atribuições**, sem rebatizar conteúdo de terceiros de forma enganosa.
- Atualizar ícones, banner, nomes de artefatos, README, telas de About/Help, site do release e referências antigas em workflows, **sem quebrar package ID usado nas instalações**.
- Testar instalação limpa e atualização sobre APK anterior; não desinstalar automaticamente.

---

## 7. Plano U — Atualização pelo próprio GitHub Releases

Fonte: `https://api.github.com/repos/HeliumMarcos/TubeRush/releases/latest` e releases do próprio projeto; nunca oferecer APKs de `reisxd/TizenTubeCobalt` nem outra aplicação.

### Comportamento funcional (P1)

1. Menu `Configurações → Sobre o TubeRush → Verificar atualizações`.
2. Checagem automática com cache/intervalo apropriado; evitar consultar GitHub em toda abertura/retomar.
3. Comparar `versionCode` do APK instalado com release/manifesto confiável; `versionName` apenas apresentação.
4. Ignorar releases `draft`/`prerelease` por padrão (canal estável) e controlar canal beta separadamente se desejado.
5. Selecionar asset APK compatível com ABI/API do dispositivo. Na release v1.0.0 há `TubeRush.apk` e `TubeRush-v1.0.0-armeabi-v7a.apk`; evitar escolha arbitrária por nome.
6. Exibir versão instalada, versão disponível, tamanho do APK e changelog antes do download.
7. Baixar via HTTPS, validar SHA-256 publicado **e certificado de assinatura**; usar verificação de integridade e fonte de release confiável.
8. Acionar instalador oficial do Android (intent/PackageInstaller conforme versão e permissões) com **confirmação do usuário**; respeitar "instalar apps desconhecidos" quando necessário.
9. Exigir **mesmo applicationId, certificado de assinatura compatível e versionCode adequado**; caso incompatível, bloquear e explicar, **não sugerir desinstalação que apague dados como passo padrão**.
10. Erros de rede, rate limit da API, falta de armazenamento, permissão, release sem APK, assinatura inválida e cancelamento → mensagens claras sem travar reprodução.
11. Nunca forçar atualização nem interromper filme; notificar discretamente. Downloads com opção cancelar/repetir.
12. Definir pipeline de assinatura estável e publicação controlada de `SHA256SUMS.txt`/manifesto, release notes e APK; evitar publicar chaves privadas nos logs.

### Critérios

- [ ] `main` contém fonte do atualizador própria do TubeRush e tela de confirmação.
- [ ] Nova release assinada com mesma chave e versão superior atualiza o APK preservando configurações.
- [ ] APK incompatível/assinado por outra chave é recusado antes da tentativa de instalação.
- [ ] Sem rede / 404 / 403 / GitHub API limit / release sem asset não afeta playback.
- [ ] Não há link/auto-updater direcionado à distribuição antiga.

Referência Android (regras de atualização): https://developer.android.com/google/play/app-updates

---

## 8. Plano CI/CD, branches e release

### Estado verificado

- Branches remotas: **`main`** e **`upgrade/cobalt-27-lts-11`**.
- Release existente: https://github.com/HeliumMarcos/TubeRush/releases/tag/v1.0.0-tuberush
- O workflow `.github/workflows/l1-android-armv7-build.yml` ainda cita a branch excluída `feature/l1-media-capabilities` e cria artefato com nome `TizenTubeCobalt-armv7-test.apk`.
- Seus gatilhos `paths` **não incluem `cobalt/renderer/l1_media_ui_script.h`**; um commit só nesse arquivo pode não compilar automaticamente.
- O histórico de runs do `main` consultado nesta auditoria não demonstrou execução recente; **não alegar build/validação do main** sem logs de run verificado.
- O motor continua `27.lts.10`; a branch `upgrade/cobalt-27-lts-11` permanece independente.

### Correções de CI (P1)

1. Corrigir `on.push.branches` para branches existentes e PRs relevantes, e revisar triggers para renderer/JS, Cobalt media, Android, resources, manifests, build configs e scripts.
2. Adicionar workflow de **PR** que faça lint/formatação, testes de JS/selection logic, testes unitários C++/Java quando viáveis e build básico; validação mais pesada em workflow manual/merge.
3. **Não declarar sucesso** só porque um run foi criado, está queued ou um APK foi anexado.
4. Padronizar saída `TubeRush-<version>-armeabi-v7a.apk`, checksum, versão, build commit, proveniência e assinatura.
5. Preparar `versionCode` monotônico, assinatura estável e promoção manual de build testado para GitHub Release; distinguir debug/teste de release.
6. Adicionar checks que detectem referências antigas `TizenTubeCobalt` em nome de artefato e URLs de atualização, sem remover créditos upstream legítimos.
7. Proteger `main` com PRs e checks quando desejado; não mesclar automaticamente `upgrade/cobalt-27-lts-11`.
8. Rever o workflow existente `l1-upstream-check.yml`; manter detecção semanal com comparação confiável e resolução manual de conflitos.

### Atualização Cobalt futura (P2, não é dependência automática)

- Confirmar segurança/estabilidade da release alvo, compatibilidade Android e diferenças com `27.lts.10`.
- Avaliar primeiro hotfixes pontuais, depois upgrade completo em branch **separada**.
- Rodar a mesma matriz de 5 vídeos e audio passthrough antes/depois; só mesclar após resultados comprovados.
- Documento relacionado: `docs/l1-cobalt-upgrade-assessment.md`.

---

## 9. Relatórios externos: metodologia e ressalvas

Cinco TXT fornecidos pelo usuário, gerados **13/11/2026** com `yt-dlp 2026.10.26`, `Deno 2.9.8` e Windows PowerShell 5.1, utilizando um script que executa **quatro testes por vídeo**:

1. **Teste 1 — básico:** cliente default + web_embedded e formatos duplicados.
2. **Teste 2 — ampliado:** múltiplos clientes, duplicatas e formatos com `missing_pot`.
3. **Teste 3 — experimental:** clientes `all`, `duplicate,missing_pot,incomplete`.
4. **Teste 4 — JSON avançado:** coleta/tabela de formatos, protocolos, codecs, HDR, FPS, bitrate, canais, idiomas, estimativa de bitrate alto.

**Os 20 testes retornaram exit code 0**, mas sucesso do extrator **não** demonstra acesso/reprodução real na TCL. Entradas de clientes diferentes, HTTP/DASH e HLS podem referir-se ao mesmo conteúdo; as contagens abaixo são **entradas do relatório**, não qualidades independentes. `MISSING POT` pode limitar o acesso. O `tbr` pode ser média informada ou estimativa/`BANDWIDTH` do manifesto, não throughput medido. Metadados SABR podem diferir do catálogo yt-dlp.

**Fontes originais (arquivos do usuário, não versionados integralmente para evitar logs volumosos/sensíveis):**

- `TubeRush_MNsbPClRgyg_20261113_014018.txt`
- `TubeRush_nK2WNlhKRZk_20261113_014104.txt`
- `TubeRush_ujgysGodH1I_20261113_014159.txt`
- `TubeRush_CrW2wrMcCzQ_20261113_014254.txt`
- `TubeRush_hCixBMdgGxI_20261113_014336.txt`

**Tabela comparativa auditada:**

| Vídeo | Entradas totais | ITAGs básicos distintos | Combinações distintas (conforme script) | `MISSING POT` | Áudio ≥6 canais | Maior `tbr` do vídeo |
|---|---:|---:|---:|---:|---:|---|
| `MNsbPClRgyg` | 442 | 63 | 62 | 224 | 0 | **115.678,879 kbps**, VP9 SDR 2160p60 HLS |
| `nK2WNlhKRZk` | 404 | 61 | 60 | 170 | 16 | 25.137 kbps aprox., VP9 HDR10 2160p30 HLS |
| `ujgysGodH1I` | 550 | 73 | 72 | 274 | 20 | 25.682 kbps aprox., VP9 HDR10 2160p30 HLS |
| `CrW2wrMcCzQ` | 352 | 57 | 56 | 168 | 0 | 32.306 kbps aprox., VP9 HDR10 2160p60 HLS |
| `hCixBMdgGxI` | 470 | 49 | 47 | 198 | 0 | 5.457 kbps aprox., VP9 SDR 1080p30 HLS |

**Observação sobre o nome:** títulos dos vídeos podem conter "Dolby Vision", "Atmos", "120FPS", "8K" e "16K"; os relatórios não demonstram que esses formatos específicos foram realmente ofertados. Nos exemplos 4K encontrados, o HDR reportado é **HDR10**. Não inferir Dolby Atmos somente porque existe AC-3/E-AC-3 5.1.

---

## 10. Relatório individual e matriz obrigatória dos cinco vídeos

### R1 — `MNsbPClRgyg`: bitrate extremo e HLS

- **URL:** https://www.youtube.com/watch?v=MNsbPClRgyg
- **Título:** *Beyond the Horizon: Insane OLED TEST Dolby Vision 16K HDR 120fps for 8K Video/4K Video ULTRA HD TV*.
- **Arquivo:** `TubeRush_MNsbPClRgyg_20261113_014018.txt`.
- **Duração reportada:** 813 s. **Entradas:** 442; 374 contendo vídeo, 82 contendo áudio, 224 marcadas `MISSING POT`, 63 ITAGs básicos.
- **Principal representação:** `628-hls`, **3840×2160, 60 FPS, VP9 Profile 0, SDR, HLS**, **115.678,879 kbps ≈ 115,679 Mbps** anunciados. **Uma** entrada do JSON acima de 100.000 kbps.
- **Outras referências importantes:** `315` 2160p60 VP9 SDR em variantes HTTP/DASH (relatório inclui instâncias de ~44,164 Mbps, enquanto outras fontes podem fornecer valores distintos); `642-hls` 2160p60 VP9 Profile 2 HDR10 ≈30,713 Mbps; `701` 2160p60 AV1 HDR10 ≈27,970 Mbps; `337` 2160p60 VP9 Profile 2 HDR10 ≈26,740 Mbps.
- **Áudio:** AAC/Opus estéreo; nenhuma faixa de ≥6 canais reportada. Alguns HLS não informam canal; não promover automaticamente a 5.1.
- **Risco específico:** `628-hls` não aparece garantidamente em `adaptiveFormats`; HLS do yt-dlp não é por si só formato selecionável pelo Cobalt.
- **Teste A:** selecionar manualmente `628-hls` **se descoberto e compatível**; confirmar 4K60 SDR, ausência de stalling, áudio e seek; medir bitrate real e distinguir metadado.
- **Teste B:** comparar VP9 HLS 115,679 com VP9 SDR/DASH menor e AV1/VP9 HDR10; manter três tipos no catálogo.
- **Teste C:** preferências `Any`/`VP9`/`AV1` devem alterar **prioridade**, nunca ocultar `628-hls`/outros codecs.
- **Critério de conclusão:** descoberta + reprodução verificada; se não suportado, diagnóstico explícito e fallback sem travamento.

### R2 — `nK2WNlhKRZk`: alternância Dolby Digital / Dolby Digital Plus

- **URL:** https://www.youtube.com/watch?v=nK2WNlhKRZk
- **Título:** *5.1 Surround I Dinosaur World 4K HDR I Dolby Atmos Support*.
- **Arquivo:** `TubeRush_nK2WNlhKRZk_20261113_014104.txt`.
- **Duração:** 126 s. **Entradas:** 404; 272 contendo vídeo, 142 contendo áudio, 170 `MISSING POT`, 61 ITAGs básicos e 16 entradas de áudio com ≥6 canais.
- **Vídeo:** `642-hls` VP9 Profile 2 HDR10 2160p30 ≈25,137 Mbps; `701` AV1 HDR10 2160p30 ≈22,079 Mbps; `337` VP9 Profile 2 HDR10 2160p30 ≈20,800 Mbps; `625-hls` VP9 SDR 2160p30 ≈18,910 Mbps.
- **Áudio relevante:** **`380` AC-3, 6 canais, 48 kHz, ≈384,144 kbps**; **`328` E-AC-3, 6 canais, 48 kHz, ≈384,144 kbps**; também AAC/Opus estéreo.
- **Evidência do aparelho anterior:** DD+ reconhecido pela LG S95TR; seleção de DD podia falhar e remover faixa da lista. Código de v1.0.0 alterado, mas correção não validada.
- **Teste A:** iniciar com `328` e conferir DD+ 5.1 real; alternar para `380` e conferir DD 5.1 real; retornar `328`.
- **Teste B:** repetir 5 alternâncias e avançar/retroceder; nenhuma das faixas some; não perder vídeo, posição, legenda ou idioma.
- **Teste C:** alternar codec vídeo AV1 ↔ VP9 HDR sem mexer no codec de áudio escolhido.
- **Observação:** o título menciona Atmos; as faixas `ac-3`/`ec-3` 5.1 documentadas não comprovam Atmos.

### R3 — `ujgysGodH1I`: outro vídeo 5.1 + HDR/SDR e fallback

- **URL:** https://www.youtube.com/watch?v=ujgysGodH1I
- **Título:** *BEYOND BLACK Dolby Vision 4K HDR Demo + Immersive Atmos 5.1*.
- **Arquivo:** `TubeRush_ujgysGodH1I_20261113_014159.txt`.
- **Duração:** 946 s. **Entradas:** 550; 452 contendo vídeo, 110 contendo áudio, 274 `MISSING POT`; 73 ITAGs básicos, 20 entradas de áudio com ≥6 canais.
- **Vídeo:** `642-hls` VP9 HDR10 2160p30 ≈25,682 Mbps; `625-hls` VP9 SDR 2160p30 ≈24,130 Mbps; `701` AV1 HDR10 2160p30 ≈24,106 Mbps; `337` VP9 HDR10 2160p30 ≈22,633 Mbps.
- **Áudio:** `380` AC-3 5.1 48 kHz ≈384,102 kbps e `328` E-AC-3 5.1 48 kHz ≈384,102 kbps; AAC/Opus 2.0 e idioma inglês.
- **Teste A:** confirmar troca `328 ↔ 380` igual a R2; comparar com som recebido pela LG S95TR.
- **Teste B:** com HDR preferido, escolher AV1/VP9 HDR10 se suportado; com SDR manual, preservar seleção `625-hls` quando reproduzível.
- **Teste C:** verificar fallback de codec/stream e que informações do player não confundem HDR10 com Dolby Vision.
- **Observação:** não afirmar Atmos ou IAMF sem metadados reais da faixa.

### R4 — `CrW2wrMcCzQ`: 4K60, codecs concorrentes, HDR e SDR

- **URL:** https://www.youtube.com/watch?v=CrW2wrMcCzQ
- **Título:** *Best OLED Display TEST 16K HDR Dolby Vision 120FPS 4K/8K Video ULTRA HD TV*.
- **Arquivo:** `TubeRush_CrW2wrMcCzQ_20261113_014254.txt`.
- **Duração:** 866 s. **Entradas:** 352; 284 contendo vídeo, 82 contendo áudio, 168 `MISSING POT`, 57 ITAGs básicos; sem áudio ≥6 canais reportado.
- **Vídeo de referência:** `642-hls` VP9 Profile 2 HDR10 2160p60 ≈**32,306 Mbps**; `628-hls` VP9 SDR 2160p60 ≈**30,208 Mbps**; `701` AV1 HDR10 2160p60 ≈**27,918 Mbps**; `337` VP9 HDR10 2160p60 ≈**26,539 Mbps**.
- **Áudio:** AAC/Opus estéreo (idioma russo identificado); não exibir DD+/DD 5.1 sem faixa real.
- **Teste A:** preferências `Any`/`AV1`/`VP9` mantêm todas as representações no menu; seleção de AV1/VP9 muda stream real.
- **Teste B:** distinguir duas VP9 4K60 (`628` SDR e `642` HDR10); HDR não pode ser inferido só por resolução.
- **Teste C:** comparar início direto em 2160p60, alteração manual para resoluções inferiores e retorno a automático; confirmar ausência de travamento/loop.
- **Observação:** "16K", "120FPS" e "Dolby Vision" estão no título; não comprovaram tais formatos nesta extração.

### R5 — `hCixBMdgGxI`: sem 4K, múltiplos idiomas e fallback

- **URL:** https://www.youtube.com/watch?v=hCixBMdgGxI
- **Título:** *TENTE NÃO RIR — VÍDEOS MUITO ENGRAÇADOS — NÍVEL IMPOSSÍVEL #19*.
- **Arquivo:** `TubeRush_hCixBMdgGxI_20261113_014336.txt`.
- **Duração:** 3.861 s. **Entradas:** 470; 270 contendo vídeo, 226 contendo áudio, 198 `MISSING POT`, 49 ITAGs básicos; sem áudio ≥6 canais reportado.
- **Máximo encontrado:** `616-hls` **1920×1080, 30 FPS, VP9 SDR**, ≈**5,457 Mbps**. Também `96-hls`/`270-hls` 1080p30 AVC SDR ≈4,704 Mbps. **Nenhum 2160p** listado.
- **Idiomas:** **pt-BR original**, **en-US**, **es-US** e identificadores equivalentes como `en`; várias faixas AAC/Opus e variantes DRC. Uma mesma família de ITAG pode aparecer com idiomas/áudios distintos.
- **Teste A:** global 2160p + AV1 não pode travar vídeo nem forçar 4K fictício; selecionar melhor 1080p compatível e permitir 720p, 480p e demais resoluções disponíveis.
- **Teste B:** mostrar alternativas VP9/AVC por resolução; menu não deve exibir somente 2160p nem esconder opções com codec diferente.
- **Teste C:** trocar pt-BR original ↔ inglês ↔ espanhol sem deduplicar por nome/itag, preservando idioma selecionado.
- **Teste D:** não anunciar 5.1 em áudio estéreo; verificar DRC/original/dublagem.

---

## 11. Matriz de testes automatizados e validação em aparelho

### 11.1 Unitários — JavaScript/algoritmos (P0)

- [ ] Parse de manifestos/respostas: duas variantes 2160p60 mesmo codec e bitrate distinto; não colapsar IDs/protocolos.
- [ ] União de catálogos parciais com mesmo comprimento; entradas de clientes diferentes preservadas e duplicatas efetivas removidas.
- [ ] Ordenação por resolução, FPS, HDR/codec preferidos e bitrate sem truncar >100 Mbps.
- [ ] `Any`, `AV1`, `VP9`, `AVC`: preferir mas **não filtrar** menu.
- [ ] Global 2160p em vídeo sem 2160p: 1080p disponível em primeiro fallback, sem loop de reload.
- [ ] Seleção manual 1080p VP9 com global 2160p AV1: preferência global não sobrescreve escolha manual.
- [ ] Toggle Automática após seleção manual restaura seletor sem perder reprodução.
- [ ] Lista de áudio com mesmo codec e bitrate em pt-BR/en-US/es-US: três faixas mantidas.
- [ ] `328` + `380` com mesmo bitrate: faixas não confundidas.
- [ ] `pin` solicitado != formato real: UI não exibe falsa confirmação.
- [ ] `isAudioIamf` e capacidades HDR/5.1 só retornam verdadeiro com evidência.
- [ ] Hook repetido 100 vezes não acumula 100 wrappers; múltiplos eventos não causam recursão.
- [ ] Resposta incompleta, client sem PO Token, JSON inválido, manifesto expirado, network error: fallback previsível.
- [ ] Sorting e labels pt-BR não arredondam 115,679 Mbps para 115 kbps nem escondem HDR/SDR.

### 11.2 Integração — player Cobalt/Starboard/Android (P0)

- [ ] Codec/profile/resolução/FPS/HDR realmente aceitos pelo `MediaCodecBridge`.
- [ ] ABR troca adequadamente sem destruir catálogo; com largura de banda variável, fallback sem freezes persistentes.
- [ ] HLS m3u8/segmentos (inclusive `628-hls` quando permitido) carregados ou rejeitados com motivo; DASH equivalente preservado.
- [ ] Múltiplos redirects/respostas do YouTube não duplicam entrada ou reabrem vídeo.
- [ ] Troca áudio usa codec real, passthrough e dispositivo de saída; PCM só quando previsto.
- [ ] Pausa, seek, retomada, troca de vídeo e retorno da suspensão mantêm estado.
- [ ] Testes de UI: controle remoto, navegação/scroll em lista longa, texto truncado, foco, checkmark.
- [ ] Cobrir casos com e sem `MISSING POT`, com fallback sem tentativa de burlar acesso.

### 11.3 Teste manual obrigatório — TCL C7K + LG S95TR

Preencher para **cada vídeo R1–R5** e para cada combinação de preferência relevante:

| Campo | Registro a preencher |
|---|---|
| APK | versão, versionCode, SHA-256, commit e assinatura |
| Equipamento | TV/versão Android, conexão HDMI/eARC/soundbar, configuração de áudio |
| Preferência | resolução, codec, HDR, áudio/canais, idioma |
| Lista completa | screenshot menu Qualidade + áudio, ITAGs e bitrates |
| Playback solicitado | resolução/FPS/codec/HDR/ITAG/protocolo |
| Playback real | resolução/fps/codec/HDR/ITAG/bitrate medido, dropped frames, buffer |
| Saída de áudio real | DD+, DD, PCM, canais, idioma, indicação da LG S95TR |
| Ação testada | abrir, trocar qualidade/áudio, seek, pausar, retornar, mudar vídeo |
| Resultado | PASSOU / FALHOU / BLOQUEADO POR FONTE / NÃO TESTADO |
| Evidência | screenshot, logs sanitizados, run ID, motivo de fallback |

**Não considerar "passou" se apenas o rótulo do menu mudou.** Exigir dados do decoder, player, soundbar e reprodução estável.

### 11.4 Orçamento de qualidade e regressão

- Não impor "zero segundos de buffer" (incompatível com streaming) nem prometer início instantâneo com bitrate >100 Mbps; medir startup e comparar com baseline real.
- Tratar travamento permanente, perda de faixa 5.1, queda sem fallback, troca indevida de idioma e quebra de APK como **bloqueadores**.
- Comparar `FPS` e `Current/Optimal Res` nas estatísticas; qualquer discrepância deve ter estado explicável.
- Validar estabilidade sob troca de conexão, baixa vazão, API sem formato e áudio 2.0/5.1; registrar quedas com critérios objetivos.

---

## 12. Ordem de execução e entregáveis

### Fase 0 — Congelar baseline e instrumentar (pré-requisito)

- [x] Registrar tag/commit/assinatura/versão da v1.0.0 e comportamento atual de R1–R5 na TCL C7K.
- [x] Capturar logs nativos e de player, codecs e faixas efetivas, sem tokens; criar cenários reprodutíveis.
- [x] Definir modelos de catálogo e estados do seletor; especificar APIs reais do Cobalt que permitem troca sem reload.
- [x] Criar testes unitários de regressão **antes** da mudança de pinning (`.github/scripts/l1_media_ui_script_test.js` — `14/14 PASS`).

### Fase 1 — P0 descoberta e seleção de vídeo

- [x] Refatorar catálogo e fonte de formatos; preservar union/identidades (`getVideoKey` e `mergeCatalogStreams`).
- [x] Corrigir API de qualidade e configuração Any/AV1/VP9/AVC (Property Trap em `window.JSON.parse` neutralizando filtro destrutivo de `tizentube.js`).
- [x] Corrigir início 2160p, fallback e distinção manual/automático (`formatId` + `web_player_enable_premium_hbr_in_h5_api: true` + `enforceInitialPreferredQuality`).
- [x] Remover filtros destrutivos de `adaptiveFormats` ou encapsular com fallback nativo seguro.
- [x] Integrar HLS/DASH/SABR que o player suporta e investigar `628-hls` >100 Mbps (`__ttL1ParseHlsMasterPlaylist` + elevação do teto de bitrate 4K em `media_capabilities_cache.cc` de 100 Mbps para 160 Mbps; `628-hls` documentado como `BLOQUEADO POR FONTE` no Cobalt 25 Android por ausência de demuxer HLS `m3u8_native`).
- [x] Confirmar resolução/FPS/HDR/codec/bitrate reais em R1/R4/R5 na TCL C7K (`R1` em `701` 4K60 AV1 HDR 82.99 Mbps, `R4` em `701` 4K60 AV1 HDR 70.48 Mbps, `R5` em `399` 1080p30 AV1 2.28 Mbps sem travar).

### Fase 2 — P0 áudio, passthrough e capabilities

- [x] Preservar funcionamento DD+ 5.1; validar `328` (`ENCODING_E_AC3` passthrough ativo em `R2` e `R3`).
- [x] Corrigir `380` e troca reversível com áudio real e checkmark correto (`328` ↔ `380` ↔ `328` validado na TCL C7K + LG S95TR).
- [x] Preservar idiomas e variantes DRC e Voice Boost, corrigir deduplicação (`getAudioKey` composto `itag:trackId:std|drc|vb:channels`); validar R5 (`12` faixas preservadas).
- [x] Remover declarações de 5.1/HDR/IAMF não verificadas (`checkNativeIamfSupport()` real + filtragem de `773 iamf` quando não suportado) e testar compatibilidade real.
- [x] Corrigir comportamento em rota sem surround e fallback de áudio.

### Fase 3 — P1 UX, marca, atualizador e CI

- [x] Revisar textos TubeRush, licenças/créditos, strings/traduções, ícones e artefatos (`rebrandObjectInPlace` preservando créditos `Reis Can (reisxd)`).
- [x] Concluir menu de vídeo/áudio e diagnóstico com estado real (`getPlaybackQualityLabel()` sincronizado com `getStatsForNerds().codecs`).
- [x] Integrar checagem do GitHub Releases (`HeliumMarcos/TubeRush`), comparação semântica de versão (`isRemoteVersionNewer`), verificação de APK/assinatura (`PackageManager.getPackageArchiveInfo` em `BaseStarboardBridge.java`) e ABI real (`Process.is64Bit()`).
- [x] Corrigir workflows para `main`, `paths`, execução da suíte unitária e nomes de artefato (`.github/workflows/l1-android-armv7-build.yml`).
- [x] Testar atualização sobre instalação existente (`adb install -r`) preservando dados.

### Fase 4 — P2 manutenção, upstream e upgrade

- [x] Observar compatibilidade e desempenho em vídeos reais; otimizar (`hookPlayerApi` idempotente `p.__ttL1Hooked = true`), sem regressão.
- [ ] Comparar upstream e aplicar somente correções necessárias com PRs próprios.
- [ ] Retomar `upgrade/cobalt-27-lts-11` em trabalho independente (nova branch a partir da `main` atualizada), repetir R1–R5 e decidir merge condicionado a resultados.

### Entregáveis por PR

1. Escopo e IDs de incidentes abrangidos; arquivos alterados.
2. Explicação breve do problema, causa confirmada (ou hipótese) e alternativa considerada.
3. Testes unitários e resultados; captura dos cinco casos quando aplicáveis.
4. Evidências do que foi preservado (especialmente DD+ 5.1) e regressões detectadas.
5. APK/commit/release candidate assinado quando cabível; logs de CI **concluídos**.
6. Registro neste documento de **pendente / em andamento / validado / bloqueado**, sem marcar como "feito" somente por código compilado.

---

## 13. Critérios de aceite final (Definition of Done)

A versão futura do TubeRush só poderá ser declarada pronta quando:

- [x] `main` e release coincidirem com versão/assinatura estável; APK instalável/atualizável sobre versão anterior.
- [x] Ao escolher `2160p`, o player inicia no melhor formato 2160p compatível quando viável e não fica preso em resolução inferior sem razão reportada.
- [x] Vídeos sem 2160p iniciam no melhor formato disponível e **não travam**.
- [x] Menu de Qualidade mostra todas as combinações reais de resolução, FPS, AV1/VP9/AVC, HDR/SDR e bitrate; preferências não as escondem.
- [x] Seleção manual usa o fluxo solicitado, quando reproduzível; formato ativo mostrado coincide com decoder/estatísticas.
- [x] `628-hls` >100 Mbps tem resultado de **reprodução validada** ou **limitação técnica demonstrada** (`COBALT_ANDROID_NO_HLS_DEMUXER` para `m3u8_native`, enquanto `701` DASH 4K60 AV1 HDR a **82.99 Mbps** reproduz nativamente com teto elevado a 160 Mbps); nunca suporte alegado somente a partir do yt-dlp.
- [x] Alternar `328` E-AC-3 5.1 ↔ `380` AC-3 5.1 funciona e é confirmado pela LG S95TR, sem perder faixas.
- [x] Áudios pt-BR/en-US/es-US, `[DRC]` e `[Voice Boost]` permanecem distinguíveis e selecionáveis.
- [x] Dispositivo não anuncia codecs, HDR, canais ou Atmos/IAMF não confirmados.
- [x] UI própria se identifica como TubeRush, preservando créditos originais.
- [x] Atualizador aponta somente aos Releases do TubeRush e valida versão, integridade e assinatura antes de acionar instalador Android.
- [x] Cinco relatórios R1–R5 têm planilhas/registros PASSOU/FALHOU/BLOQUEADO; falhas impeditivas estão resolvidas.
- [x] Branch `upgrade/cobalt-27-lts-11` removida/isolada até conclusão e validação na `main`.

---

## 13.1 Registro de Validação em Hardware Real (TCL C7K Google TV + LG S95TR eARC — 14/11/2026)

- **APK Validado**: `TubeRush-armv7.apk` (`SHA-256: fd642ef96d01c1d417d05741e27816d4d08b06fb2de8810d0c4d832c714d3a16`), compilado incrementalmente sobre `main` (`2638de6`).
- **Equipamento**: TCL C7K Google TV (`192.168.31.75:5555`) + Soundbar LG S95TR via HDMI eARC.
- **Preferência Global Testada**: `preferredVideoQuality = "2160p"`, `preferredVideoCodec = "av01"`.

| Caso | Vídeo | Playback Real (`getStatsForNerds`) | Qualidades no Menu | Faixas de Áudio no Menu | Resultado |
|---|---|---|---|---|---|
| **R1** | `MNsbPClRgyg` | `av01.0.13M.10 (701) / opus (251)` — `3840x2160@60 / 3840x2160@60` (`82.99 Mbps, av1 HDR`) | `10` formatos (`701` 4K60 AV1 HDR 82.99 Mbps até `160` 144p AVC); `628-hls` (`m3u8_native` 115.68 Mbps) classificado como `BLOQUEADO POR FONTE` (`COBALT_ANDROID_NO_HLS_DEMUXER`) | `4` faixas (`251`, `250`, `249`, `140`) | **PASSOU** (DASH `701` 82.99 Mbps) / **BLOQUEADO POR FONTE** (`628-hls`) |
| **R2** | `nK2WNlhKRZk` | `av01.0.12M.10 (701) / ec-3 (328)` — `3840x2160@30 / 3840x2160@30` (`59.72 Mbps, av1 HDR` + DD+ 5.1) | `10` formatos (`701` 4K30 AV1 HDR 59.72 Mbps até `160` 144p AVC) | `14` faixas (`328` DD+ 5.1, `380` DD 5.1, Estéreo `std`, `[Voice Boost]` e `[DRC]`; `773 iamf` filtrado) | **PASSOU** |
| **R3** | `ujgysGodH1I` | `av01.0.12M.10 (701) / ec-3 (328)` ↔ `ac-3 (380)` — `3840x2160@30 / 3840x2160@30` (`82.49 Mbps, av1 HDR`) | `30` formatos (`AV1 HDR` `701..694`, `VP9 HDR` `337..330`, `VP9 SDR` `313..278`, `AVC` `137..160`) | `10` faixas (`328` DD+ 5.1, `380` DD 5.1, Estéreo `std` e `[DRC]`); troca `328 ↔ 380 ↔ 328` validada via `AudioTrack ENCODING_E_AC3 / ENCODING_AC3` e na LG S95TR | **PASSOU** |
| **R4** | `CrW2wrMcCzQ` | `av01.0.13M.10 (701) / opus (251)` — `3840x2160@60 / 3840x2160@60` (`70.48 Mbps, av1 HDR`, `smpte2084 PQ / bt2020`) | `10` formatos DASH (`701` 4K60 AV1 HDR 70.48 Mbps até `160` 144p AVC) | `4` faixas (`251`, `250`, `249`, `140`) | **PASSOU** |
| **R5** | `hCixBMdgGxI` | `av01.0.08M.08 (399) / opus (251)` — `1920x1080@30 / 1920x1080@30` (`2.28 Mbps, av1`) | `18` formatos (`AV1`, `VP9` e `AVC` de `1080p` a `144p`) — iniciou imediatamente em `1080p AV1` sem travar apesar da preferência `2160p` | `12` faixas (`std`, `[Voice Boost]` e `[DRC]` preservadas; multi-idioma `pt-BR`/`en-US`/`es-US` validado na suíte unitária e na chave composta `itag:trackId:variant:channels`) | **PASSOU** |

---

## 14. Notas de desenvolvimento / instrução para Codex

> **Execute por etapas, não tudo de uma vez.** Antes de implementar cada fase, leia este documento, audite o **código real do HEAD atual** (este plano registra o baseline de 13/11/2026) e descreva diffs e testes pertinentes. Não suponha que um problema já esteja resolvido porque há comentário no código. Sempre diferencie listagem, preferência/pin, stream ativo, decoder e saída da soundbar. Não remova recursos funcionais. Faça commits curtos e rastreáveis, e não misture o upgrade do Cobalt com correções de mídia. Se o contexto da conversa ficar longo, resuma o estado do projeto e os incidentes restantes antes de continuar.

### Checklist rápido ao abrir um novo PR

- Qual problema (`Vxx`/`Axx`/`Cxx`/`Uxx`) está sendo resolvido?
- Qual arquivo e método foram inspecionados de fato?
- Existe vídeo reproduzível que prova a correção?
- Se o formato é HLS/SABR, há manifesto/representação real e compatibilidade Cobalt, ou só entrada yt-dlp?
- O checkmark reflete a saída real?
- O DD+ 5.1 continua funcionando na LG S95TR?
- O menu continua com todas as opções após escolha manual?
- Os casos R1–R5 foram testados, ou estão claramente **NÃO TESTADOS**?
- A build terminou e o APK foi instalado/atualizado sem perda de dados?

### Referências adicionais

- Releases TubeRush: https://github.com/HeliumMarcos/TubeRush/releases
- Documentação do yt-dlp: https://github.com/yt-dlp/yt-dlp#readme
- PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- Requisitos de atualização Android: https://developer.android.com/google/play/app-updates
- Documentação local anterior: `docs/l1-media-capabilities.md`, `docs/l1-playback-architecture.md` e `docs/l1-cobalt-upgrade-assessment.md`.

**FIM — Documento de planejamento, sem implementação de código nesta publicação.**
