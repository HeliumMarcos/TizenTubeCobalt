# Descoberta na sessão TV — 2026-11-18

Coleta do cliente TV no E1 devel com candidata main injetada somente em u.js. Configuração salva preservada: AV1 100 Mbps, demais 150 Mbps. Uma resposta por vídeo não demonstra ausência em outros clientes ou sessões.

| Vídeo | Faixas vídeo | Faixas áudio | DD+ / DD 6 canais |
| --- | ---: | ---: | --- |
| MNsbPClRgyg | 10 | 4 | Não exposto nesta resposta |
| CrW2wrMcCzQ | 10 | 4 | Não exposto nesta resposta |
| hCixBMdgGxI | 18 | 12 | Não exposto nesta resposta |
| nK2WNlhKRZk | 9 | 15 | 328, 380 |
| ujgysGodH1I | 30 | 11 | 328, 380 |

Todos os cinco anunciaram transporte SABR; nenhum anunciou manifesto HLS/DASH. Isso não exclui rotas oferecidas por outro cliente autorizado. Contagens de áudio incluem idiomas/faixas distintas com o mesmo itag.

## Comparação com as 42 referências

“Mesmo identificador e classe” exige itag, altura, FPS, HDR e família do codec. “Classe equivalente” exige altura, FPS, HDR e família, com outro itag. Nenhuma categoria comprova o mesmo perfil técnico, bytes, transporte ou reprodução: a coleta não preservou perfil completo do vídeo e as referências incluem HLS.

| Vídeo | Referências | Mesmo identificador e classe | Classe equivalente | Não exposta nesta resposta |
| --- | ---: | ---: | ---: | ---: |
| MNsbPClRgyg | 10 | 2 | 1 | 7 |
| CrW2wrMcCzQ | 10 | 2 | 1 | 7 |
| hCixBMdgGxI | 3 | 1 | 2 | 0 |
| nK2WNlhKRZk | 9 | 2 | 1 | 6 |
| ujgysGodH1I | 10 | 3 | 7 | 0 |

## Limites da evidência e bloqueios

- DD+ itag 328 e DD itag 380 de seis canais foram expostos em nK2WNlhKRZk e ujgysGodH1I. O player informou ec-3 (328) em amostra inicial; saída 5.1/eARC na LG S95TR não foi confirmada.
- Não transformar referência ausente em opção selecionável; consultar outra rota autorizada e verificar capacidade separadamente.
- Após a coleta, o E1 devel encerrou com SIGABRT no player_worker: media_codec_video_decoder.cc:815, video_fps_ > 0 (0 vs. 0). O estimador local pode arredondar intervalos grandes entre timestamps para zero. Os timestamps que causaram o evento não foram capturados; a causa de origem ainda não está demonstrada.
- Falha anterior SourceBuffer perto de 250 s e dropped frames continuam pendentes. Metadados e testes de menu não aprovam estabilidade prolongada.
