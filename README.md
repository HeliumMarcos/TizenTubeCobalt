# 💠 TizenTube Cobalt L1 — TCL C7K 4K60 HDR Edition

<p align="center">
    <img width="600px" src=".github/assets/TizenTube Cobalt Banner.png">
    <br>
</p>

Fork customizado do [TizenTubeCobalt](https://github.com/reisxd/TizenTubeCobalt) (base **Google Cobalt `27.lts.10` `qa`**, Starboard 18), otimizado especificamente para TVs Android/Google TV com SoC **MediaTek MT5896 / Pentonic 700** (como a **TCL C7K**) reproduzirem **4K (`2160p60 HDR`)** sem travamentos, sem erros SABR e sem substituir o aplicativo original.

---

## 🚀 Melhorias implementadas neste fork (`main`)

### 1. 📦 Instalação autônoma (convive com o app original)
- **Package ID independente:** `io.gh.heliummarcos.tizentube.cobalt`
- **Nome no sistema:** **TizenTube L1**
- Pode ser instalado lado a lado com o `io.gh.reisxd.tizentube.cobalt` original sem sobrescrever configurações nem dados.

### 2. 🔓 Desbloqueio de `2160p60 HDR` (AV1 & VP9) abaixo dos limites reais da TCL C7K
O Android/MediaCodec na TCL C7K informa limites conservadores que faziam vídeos 4K (`itag 701` AV1 / `337` VP9) sumirem ou caírem para `1080p`/`1440p`:
- **Filtro inteligente por `averageBitrate` no `u.js`:** mantém faixas dentro da capacidade real do hardware (**AV1 ≤ 40 Mbps**, **VP9 ≤ 100 Mbps**, demais ≤ 45 Mbps), garantindo reprodução fluida via `c2.mtk.av1.decoder` e `c2.mtk.vp9.decoder`.
- **Correção do erro `sabr.no_video_selected` ("Algo deu errado"):** preserva o `bitrate` original no `playerResponse` enviado ao cliente para que o servidor SABR receba o `maxBitrateBps` correto (ex.: picos de ~70,5 Mbps em streams `2160p60 HDR` com média de ~28 Mbps), enquanto ajusta o parâmetro `; bitrate=` apenas em `MediaSource.isTypeSupported` e `navigator.mediaCapabilities.decodingInfo` na faixa de stream (`35 Mbps < n <= 150 Mbps` → `35 Mbps`), sem quebrar o probe `CP.BITRATE` (`2E9`).
- **Ajustes nativos no código-fonte Cobalt/Starboard:** ampliação do teto de verificação em `starboard/android/shared/media_capabilities_cache.cc` e `MediaCodecUtil.java`.

### 3. 🎛️ Menu de resoluções completo, áudio e botões do player preservados
- Todas as resoluções continuam disponíveis no menu (`Automática`, `2160p60 HDR`, `1440p60 HDR`, `1080p60 HDR`, `720p`, `480p`, `360p`, `240p`, `144p`).
- Qualidade preferida padrão configurada para **`2160p`** (iniciando vídeos 4K diretamente em `2160p` e vídeos `1080p` na maior resolução disponível, ainda ajustável nas configurações do TizenTube).
- Todas as faixas de áudio originais (`opus`, `ec-3`, `aac`) e todos os botões do player (Velocidade, Mini Player, Legendas, Anterior/Próximo, etc.) preservados.

### 4. ⚡ Performance oficial de produção (`qa` build)
- APK oficial construído sobre a base **`qa`** (`v2.0.3`, `armeabi-v7a`, `libchrobalt.so` de 60,8 MB sem overhead de debug `-devel`), mantendo navegação rápida na tela inicial e menus.

---

## ✨ Recursos originais do TizenTube incluídos

- 🛑 **Ad Blocker**: assista sem anúncios.
- ❗ **SponsorBlock**: pula automaticamente trechos patrocinados.
- ⏭️ **Controle de velocidade**: ajuste fino de velocidade de reprodução.
- 🔺 **[DeArrow](https://dearrow.ajay.app/)**: remove títulos e miniaturas clickbait.

---

## ⬇️ Download (Releases Oficiais)

Baixe o APK oficial da última release publicada a partir da branch `main`:

- 👉 **[TizenTube L1 `v2.0.3-c7k-l1` — Releases](https://github.com/HeliumMarcos/TizenTubeCobalt/releases/latest)**

> 💡 **Arquitetura do APK atual:** `armeabi-v7a` (`qa`), validado na **TCL C7K (Android 14 / MT5896)** com `2160p60 HDR10` em hardware (`c2.mtk.av1.decoder`).

## ❓ Como instalar

1. Baixe `TizenTube-L1-qa-armeabi-v7a.apk` na página de [Releases](https://github.com/HeliumMarcos/TizenTubeCobalt/releases).
2. Instale na TV via gerenciador de arquivos ou ADB (`adb install -r TizenTube-L1-qa-armeabi-v7a.apk`).
3. Abra o app **TizenTube L1** — ele conviverá normalmente ao lado do TizenTube original.

---

## 🙏 Créditos

- Projeto base: [reisxd/TizenTubeCobalt](https://github.com/reisxd/TizenTubeCobalt) e [TizenTube](https://github.com/reisxd/TizenTube)
- Motor: [Google Cobalt (`27.lts.10`)](https://cobalt.dev)
