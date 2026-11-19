# 🚀 TubeRush — TCL C7K 4K60 HDR & Low-Latency Edition

<p align="center">
    <img width="600px" src=".github/assets/TizenTube Cobalt Banner.png">
    <br>
</p>

Fork customizado do [TizenTubeCobalt](https://github.com/reisxd/TizenTubeCobalt) (base **Google Cobalt `27.lts.10` `qa`**, Starboard 18), otimizado para TVs Android/Google TV com SoC **MediaTek MT5896 / Pentonic 700** (como a **TCL C7K**) entregarem **4K (`2160p60 HDR10`)**, seleção multi-codec e **baixa latência em lives** sem travamentos.

---

## ✨ Melhorias implementadas no TubeRush (`v2.0.5`)

### 1. 📦 Identidade própria e convivência lado a lado
- **App principal:** **TubeRush** (`io.gh.heliummarcos.tizentube.cobalt`)
- **App experimental:** **TubeRush Exp** (`io.gh.heliummarcos.tizentube.exp_l1`)
- Ícone, banner e splash oficiais do YouTube TV, convivendo sem conflito com o TizenTube original.
- **Updater próprio:** checagem de atualizações apontando diretamente para `HeliumMarcos/TubeRush` (`releases/latest`), compatível com tags `vX.Y.Z-c7k-l1`.

### 2. 🎛️ Menu de Qualidade Multi-Codec & Seleção Visual Inteligente (`effectiveBitrate`)
- **Codecs simultâneos:** exibe na mesma lista faixas reais descobertas de **AV1**, **VP9** e **AVC/H.264** para cada resolução (`2160p`, `1440p`, `1080p`, etc.) em layout limpo de duas linhas (resolução/HDR/FPS + codec/Mbps/status).
- **Marcação imediata (`✓`):** acompanha corretamente a faixa/codec ativa mesmo ao trocar de qualidade durante a reprodução.
- **Hierarquia automática por qualidade visual real:**
  1. Maior resolução (`height`)
  2. Maior taxa de quadros (`fps`)
  3. Faixa dinâmica (`HDR` quando suportado e preferido vs `SDR`, sem misturar HDR e SDR na comparação de bitrate)
  4. Desempate final por **`effectiveBitrate = bps × multiplicador`** (usando `averageBitrate` com fallback para `bitrate` em lives):
     - **VOD:** `AV1 × 1.70`, `VP9/HEVC × 1.35`, `AVC × 1.00`
     - **Live:** `AV1 × 1.50`, `VP9/HEVC × 1.25`, `AVC × 1.00`

### 3. 🔓 Desbloqueio 4K60 HDR, SABR e Fallback VP9 autenticado
- **Limites reais de hardware:** filtro por `averageBitrate` (padrão **AV1 ≤ 100 Mbps**, **demais ≤ 150 Mbps**, teto de pico sintético protegido) + clamp seguro apenas em probes sintéticos de `isTypeSupported` / `decodingInfo` (`35M–250M → 35M`), mantendo `CP.BITRATE` (`2E9`) e `maxBitrateBps` intactos.
- **Fallback VP9 autenticado (`WEB` / `TVHTML5_SIMPLY`):** quando a sessão TV não traz VP9 em `2160p`/`1440p`/`1080p`, busca metadados suplementares autenticados com PO token sem interromper a reprodução atual, habilitando a troca manual no menu.
- **Suporte completo a Lives:** fallback para `bitrate` quando `averageBitrate` está ausente e normalização de perfis `vp9.2`.

### 4. ⚡ Otimizações Nativas do Cobalt (Etapa 2) + Baixa Latência em Lives (Etapa 1)
- **Flags nativas (`JavaSwitches` & `MediaCodecBridge`):**
  - `EnableQUIC` ativo (remove `--disable-quic`)
  - `DisableLowEndDeviceMode` ativo (remove `--enable-low-end-device-mode`)
  - `ForceGpuMemAvailableMb = 256` MB e `V8MaxOldSpaceSize = 768` MB
  - `CobaltDynamicMojoPipeSizing` ampliado (`media_size = 2 MB`, `subresource_size = 512 KB`) + `CobaltBypassResourceLoadScheduler`
  - `MediaFormat.KEY_LOW_LATENCY = 1` em `MediaCodecBridge.configureVideo` quando suportado pelo decoder (`c2.mtk.av1.decoder`, `c2.mtk.vp9.decoder`, `c2.mtk.avc.decoder`)
- **Camada Web/Live (`TubeRush Exp`):** flags `Proxima` / Ultra-Low Latency (`html5_enable_proxima`, `html5_sabr_force_proxima`, etc.), pré-aquecimento de `yt-player-bandwidth` e `<link rel="preconnect">`, além de Auto-Catch-Up adaptativo com salto à borda em atraso severo.

---

## 🛠️ Recursos originais preservados

- 🛑 **Ad Blocker**
- ❗ **SponsorBlock**
- ⏭️ **Controle de velocidade**
- 🔺 **[DeArrow](https://dearrow.ajay.app/)**

---

## ⬇️ Download (Releases Oficiais)

- 👉 **[TubeRush `v2.0.5-c7k-l1` — Releases](https://github.com/HeliumMarcos/TubeRush/releases/latest)**

> 💡 **Arquitetura:** `armeabi-v7a` (`qa`), validado na **TCL C7K (Android 14 / MT5896)** em `2160p60 HDR10` e lives `1440p60` com baixa latência.

## ❓ Como instalar

1. Baixe `TizenTube-L1-arm.apk` na página de [Releases](https://github.com/HeliumMarcos/TubeRush/releases).
2. Instale na TV via gerenciador de arquivos ou ADB (`adb install -r TizenTube-L1-arm.apk`).
3. Abra o app **TubeRush**.

---

## 🙏 Créditos e Estrutura do Repositório

- **Branch `main`:** código principal do **TubeRush** (`u.js`, `cobalt/`, `starboard/`, `scripts/`, `docs/`, `.github/` e `README.md`).
- **Branch `exp/low-latency`:** experimentos de baixa latência em lives (`TubeRush Exp`).
- **Branch `cobalt-full`:** árvore completa do monorepo Chromium/Cobalt para compilações C++ nativas.
- Projeto base: [reisxd/TizenTubeCobalt](https://github.com/reisxd/TizenTubeCobalt) e [TizenTube](https://github.com/reisxd/TizenTube)
- Motor: [Google Cobalt (`27.lts.10`)](https://cobalt.dev)
