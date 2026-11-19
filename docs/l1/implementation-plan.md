# Plano de execução L1 — qualidade, SABR e áudio

Base: plano e matriz fornecidos pelo usuário em 2026-11-18.
A URL compartilhada retornou timeout/HTTP503, mas a conversa Encontrar limitador
bitrate foi localizada e lida pelo histórico ChatGPT via list_threads/read_thread
(id6afb42dd-cb54-83e9-9d3d-1d9d1ed4256f,5turnos,sem páginas adicionais).
Texto colado e plano completo foram lidos. Não tratar observações históricas de
main como estado comprovado do checkout atual exp/low-latency.

## Direção aceita
- Novos perfis 40/100 Mbps; preservar escolhas explícitas (sessão atual100/150).
- Taxa representativa com procedência; pico não aprova nem reprova por si só.
- Catálogo completo separado de política, capacidade e rota; 42 fixtures não
  autorizam nem demonstram disponibilidade em sessão. 41/42 passam só bitrate.
- Menu Limpo aprovado continua: duas linhas, resolução/HDR/fps e codec/Mbps/
  status curto. Sem explicações extras ou barras. Um único popup enriquecido,
  fallback nativo estável quando indisponível.
- SABR nativo primeiro; escolha exata/equivalente/ausente comprovada, nunca
  presumir itag HLS selecionável por SABR. Trocas transacionais e rollback.
- Áudio no mesmo idioma, DD+ multicanal > DD multicanal > alternativas compatíveis;
  passthrough/5.1/Atmos exigem prova real, inclusive receptor.
- Proxima/ULL/lives aguardam; variante main exclui Stage1.

## Execução por entregas verificáveis
- [x] Baseline local de fontes/gerado com hashes, receitas/APKs anteriores mantidos.
- [x] Importar plano e fixture42 com procedência, sem credenciais.
- [x] Política modular em scripts/l1/src/bitrate-policy.js:40/100, UNKNOWN sem
  média confiável, não falsificar capacidade; RED/GREEN e42 referências.
- [ ] Registro por vídeo imutável com origem, catálogo sem rotas privadas no
  relatório e estados DISCOVERED/READY/BLOCKED/UNKNOWN/EXPIRED/NEEDS_AUTH.
- [x] Conectar política ao catálogo/fallback/gerador; preservar configuração;
  remover clamp MIME/bitrate e smooth/powerEfficient artificiais.
- [x] Capturar metadados seguros de5vídeos e comparar identificador/classe equivalente/não exposta;
  perfil técnico completo e disponibilidade por outras rotas ainda pendentes.
- [ ] Resolver falha nativa SourceBuffer ~250s e perdas, rollback de seleção e
  preservação tempo/pausa; testes de transição e classe versus itag real.
- [ ] Descoberta/seleção áudio, suporte/canais/idioma e prova naLG S95TR.
- [ ] Rotas HLS/HTTPS/DASH com catálogo real e expiração, somente casos faltantes.
- [ ] Fontes upstream versionadas, geração determinística/hashes, updater próprio,
  CI L1 sem autoroll herdado, licença/SBOM; native/repack claramente separados.
- [ ] Revisão e QA ARMv7,30–60min, regressões e100aberturas/DPAD; sem promover
  candidato com falha conhecida. Nova publicação/release precisa escopo explícito.

Baseline: work/recovery/quality-baseline-2026-11-18 no workspace Codex, hashes no
manifest. Nenhum build nativo/release é implícito na importação deste plano.


## Retomada e menu — 2026-11-18

Usuário religou a TV e autorizou fechar/abrir apps preservando dados. A skin com
observer mostrou quadro provisório na TV; foi substituída pela alternativa nativa
estável aceita: duas linhas finais no mesmo dispatch, sem CSS/decoração posterior.
47 unitários,301 checks DOM;100 aberturas programáticas na TV (2.245 quadros sem
lista provisória) e100 comandos ADB DPAD com foco dentro do menu. Trajeto completo
pelas configurações e estabilidade prolongada continuam distintos dessas provas.
Descoberta registrada em session-discovery-2026-11-18.md. DD+/DD seis canais em
dois vídeos; saída real na soundbar não comprovada. Após coleta houve novo crash
nativo video_fps_=0; falha SourceBuffer anterior também segue aberta.
