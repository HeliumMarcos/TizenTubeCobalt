import os
import argparse
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description="Build the main or experimental userscript")
parser.add_argument("--source", type=Path, default=repo_root.parent / "userScript.js")
parser.add_argument("--output", type=Path, default=repo_root / "u.js")
parser.add_argument("--variant", choices=("main", "experimental"), required=True,
                    help="Explicitly select the variant to keep experimental live code out of main")
args = parser.parse_args()

header = """// TizenTube Cobalt L1 - honest per-format capability and bitrate policy
(function() {
    if (window.__ttL1Patched) return;
    window.__ttL1Patched = true;
    // Do not hide AV1 globally; clamp synthetic VBR peak probes (35M..250M) and normalize vp9.2 alias.
    window.__ttShouldHideAv1 = function() { return false; };
    function normalizeMime(mime) {
        if (typeof mime !== 'string') return mime;
        return mime.replace(/\\bvp9\\.2\\b/gi, 'vp09.02.51.10.01.09.16.09.00');
    }
    function clampPeakMime(mime) {
        if (typeof mime !== 'string') return mime;
        return normalizeMime(mime).replace(/;\\s*bitrate=(\\d+)/gi, function(match, p1) {
            var n = parseInt(p1, 10);
            return (n > 35000000 && n <= 250000000) ? '; bitrate=35000000' : match;
        });
    }
    if (window.MediaSource && typeof MediaSource.isTypeSupported === 'function') {
        var origIsTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);
        MediaSource.isTypeSupported = function(mime) {
            return origIsTypeSupported(clampPeakMime(mime));
        };
        if (MediaSource.prototype && typeof MediaSource.prototype.addSourceBuffer === 'function') {
            var origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
            MediaSource.prototype.addSourceBuffer = function(mime) {
                return origAddSourceBuffer.call(this, normalizeMime(mime));
            };
        }
    }
    if (window.SourceBuffer && SourceBuffer.prototype && typeof SourceBuffer.prototype.changeType === 'function') {
        var origChangeType = SourceBuffer.prototype.changeType;
        SourceBuffer.prototype.changeType = function(mime) {
            return origChangeType.call(this, normalizeMime(mime));
        };
    }
    if (window.navigator && navigator.mediaCapabilities && typeof navigator.mediaCapabilities.decodingInfo === 'function') {
        var origDecodingInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
        navigator.mediaCapabilities.decodingInfo = function(cfg) {
            var q = cfg;
            if (cfg && cfg.video && typeof cfg.video === 'object') {
                var ct = typeof cfg.video.contentType === 'string' ? clampPeakMime(cfg.video.contentType) : cfg.video.contentType;
                var br = typeof cfg.video.bitrate === 'number' && cfg.video.bitrate > 35000000 && cfg.video.bitrate <= 250000000 ? 35000000 : cfg.video.bitrate;
                if (ct !== cfg.video.contentType || br !== cfg.video.bitrate) {
                    q = Object.assign({}, cfg, {video: Object.assign({}, cfg.video, {contentType: ct, bitrate: br})});
                }
            }
            return origDecodingInfo(q);
        };
    }
})();
"""

user_script_path = args.source
with open(user_script_path, "r", encoding="utf-8") as f:
    code = f.read()

target_str = 'null!=e&&null!==(i=e.streamingData)&&void 0!==i&&i.adaptiveFormats&&"any"!==Ma("preferredVideoCodec")){var S=Ma("preferredVideoCodec");e.streamingData.adaptiveFormats.find(e=>e.mimeType.includes(S))&&(e.streamingData.adaptiveFormats=e.streamingData.adaptiveFormats.filter(e=>!!e.mimeType.startsWith("audio/")||e.mimeType.includes(S)))}'

replacement_str = 'null!=e&&e.streamingData&&Array.isArray(e.streamingData.adaptiveFormats)){try{if(window.__ttVp9Fallback)window.__ttVp9Fallback.apply(e);if(window.__ttQualityController)window.__ttQualityController.apply(e)}catch(err){console.warn("[TizenTube Quality] Format filtering failed")}}'
assert code.count(target_str) == 1, "codec hook must match exactly once"
code = code.replace(target_str, replacement_str, 1)
quality_action_target = 'function ho(e,t){switch(e){'
assert code.count(quality_action_target) == 1, "custom action dispatcher must match once"
code = code.replace(quality_action_target, quality_action_target + 'case"TT_QUALITY_SELECT":if(window.__ttQualityController)window.__ttQualityController.select(t.videoId,t.id);break;', 1)

code = code.replace('preferredVideoQuality:"auto"', 'preferredVideoQuality:"2160p",maxAv1BitrateMbps:"40",maxOtherBitrateMbps:"100"', 1)

codec_menu_target = 'options:["any","vp9","av01","avc1"].map(e=>({name:"any"===e?ga("settings.options.videoPlayer.options.codecAny"):e.toUpperCase(),key:"preferredVideoCodec",value:e}))}'
codec_menu_replacement = codec_menu_target + ',{name:"Limite máximo de bitrate (AV1)",icon:"VIDEO_QUALITY",value:null,menuId:"tt-max-av1-bitrate",menuHeader:{title:"Limite máximo de bitrate (AV1)",subtitle:"Define o teto para AV1 (padrão: 40 Mbps)"},options:["20","30","40","60","100","unlimited"].map(e=>({name:"unlimited"===e?"Sem limite":`${e} Mbps`+("40"===e?" (Padrão)":""),key:"maxAv1BitrateMbps",value:e}))},{name:"Limite máximo de bitrate (VP9/AVC/HEVC)",icon:"VIDEO_QUALITY",value:null,menuId:"tt-max-other-bitrate",menuHeader:{title:"Limite máximo de bitrate (VP9/AVC/HEVC)",subtitle:"Define o teto para VP9, H.264/AVC, H.265/HEVC e outros (padrão: 100 Mbps)"},options:["45","60","80","100","120","150","unlimited"].map(e=>({name:"unlimited"===e?"Sem limite":`${e} Mbps`+("100"===e?" (Padrão)":""),key:"maxOtherBitrateMbps",value:e}))}'
assert codec_menu_target in code, "codec_menu_target not found in userScript.js"
code = code.replace(codec_menu_target, codec_menu_replacement, 1)

ia_target = 'function Ia(e,t){console.info("Setting key",e,"to",t),za[e]=t,window.localStorage[Ba]=JSON.stringify(za),Ra.dispatchEvent(new CustomEvent("configChange",{detail:{key:e,value:t}}))}'
ia_replacement = 'function Ia(e,t){var prevHide=window.__ttShouldHideAv1&&window.__ttShouldHideAv1();console.info("Setting key",e,"to",t),za[e]=t,window.localStorage[Ba]=JSON.stringify(za),Ra.dispatchEvent(new CustomEvent("configChange",{detail:{key:e,value:t}}));if(("maxAv1BitrateMbps"===e||"preferredVideoCodec"===e)&&window.__ttShouldHideAv1&&window.__ttShouldHideAv1()!==prevHide)setTimeout(function(){location.reload()},300)}'
assert ia_target in code, "ia_target not found in userScript.js"
code = code.replace(ia_target, ia_replacement, 1)

or_reset_target = 'null==a||!a.isPlaying||p(Dr,this)||s||(l(Er,this,Or).call(this),m(Dr,this,!0))'
or_reset_replacement = 'null==a||!a.isPlaying?m(Dr,this,!1):p(Dr,this)||s||(l(Er,this,Or).call(this),m(Dr,this,!0))'
assert code.count(or_reset_target) == 1, "or_reset_target must match once"
code = code.replace(or_reset_target, or_reset_replacement, 1)

or_fn_target = 'function Or(){var e=Ma(wr);'
or_fn_replacement = 'function Or(){if(window.__ttQualityController&&window.__ttQualityController.getSelection&&window.__ttQualityController.getSelection()){window.__ttQualityController.applySelectedQuality();return}var e=Ma(wr);'
assert code.count(or_fn_target) == 1, "or_fn_target must match once"
code = code.replace(or_fn_target, or_fn_replacement, 1)

updater_target = 'https://api.github.com/repos/reisxd/TizenTubeCobalt/releases/latest'
updater_replacement = 'https://api.github.com/repos/HeliumMarcos/TubeRush/releases/latest'
assert code.count(updater_target) == 1, "updater_target must match once"
code = code.replace(updater_target, updater_replacement, 1)

tag_target = 'r=n.tag_name.replace("v","")'
tag_replacement = 'r=n.tag_name.replace(/^v/,"").split("-")[0]'
assert code.count(tag_target) == 1, "tag_target must match once"
code = code.replace(tag_target, tag_replacement, 1)

social_target = 'options:[{name:"GitHub",link:"https://github.com/reisxd/TizenTube"},{name:"YouTube",link:"https://www.youtube.com/@tizenbrew"},{name:"Discord",link:"https://discord.gg/m2P7v8Y2qR"},{name:`Telegram (${ga("settings.options.socialMedia.announcements")})`,link:"https://t.me/tizentubecobaltofficial"},{name:`Telegram (${ga("settings.options.socialMedia.group")})`,link:"https://t.me/tizentubeofficial"},{name:ga("settings.options.socialMedia.website"),link:"https://tizentube.6513006.xyz"},{name:"Buy Me A Coffee",link:"https://www.buymeacoffee.com/reisxd"},{name:ga("settings.options.socialMedia.githubSponsors"),link:"https://github.com/sponsors/reisxd"}]'
social_replacement = 'options:[{name:"GitHub",link:"https://github.com/HeliumMarcos"},{name:"Telegram",link:"https://t.me/HeliumMarcos"},{name:"Buy Me A Coffee",link:"https://buymeacoffee.com/heliumzyzzy"}]'
assert code.count(social_target) == 1, "social_target not found"
code = code.replace(social_target, social_replacement, 1)

code = code.replace('https://github.com/reisxd/TizenTube', 'https://github.com/HeliumMarcos/TubeRush')
code = code.replace('https://www.buymeacoffee.com/reisxd', 'https://buymeacoffee.com/heliumzyzzy')
code = code.replace('Reis Can', 'Helium Marcos')
code = code.replace('TizenTube', 'TubeRush').replace('reisxd', 'L1')
code = code.replace('TubeRush Cobalt', 'TubeRush')

lng_target = 'ma.init({lng:va,fallbackLng:"en",resources:Ea,debug:!1,interpolation:{escapeValue:!1}})'
lng_replacement = 'va=("pt"===va?"pt-BR":va),ma.init({lng:va,fallbackLng:"en",resources:Ea,debug:!1,interpolation:{escapeValue:!1}})'
assert code.count(lng_target) == 1, "lng_target not found"
code = code.replace(lng_target, lng_replacement, 1)

ptbr_start = code.find('"pt-BR":{translation:')
ptbr_end = code.find('},ru:{translation:', ptbr_start)
assert ptbr_start > 0 and ptbr_end > ptbr_start, "pt-BR block not found"
ptbr_full = (
    '"pt-BR":{translation:{__contributors:["yufumo","Helium Marcos"],'
    'settings:{options:{'
    'socialMedia:{title:"Redes Sociais",qrCodeScanMessage:"Você pode acessar a página {{name}} lendo o QR Code abaixo.",announcements:"Anúncios",group:"Grupo",website:"Site",githubSponsors:"Patrocinadores no GitHub"},'
    'adBlock:"Bloqueador de Anúncios",'
    'sponsorblock:{title:"Configurações do SponsorBlock",options:{enableSB:"Ativar SponsorBlock",manualSkip:"Pular Segmentos do SponsorBlock Manualmente",segments:"Segmentos",categories:{sponsor:"Pular Segmentos Patrocinados",intro:"Pular Segmentos de Introdução",outro:"Pular Segmentos de Encerramento",interaction:"Pular Lembretes de Interação",selfpromo:"Pular Autopromoção",preview:"Pular Pré-visualização/Resumo",filler:"Pular Assuntos Paralelos/Piadas",music_offtopic:"Pular Segmentos Não Musicais",highlights:"Ativar Destaques"},showSBToasts:"Mostrar Avisos do SponsorBlock"}},'
    'dearrow:{title:"Configurações do DeArrow",options:{enableDA:"Ativar DeArrow",enableDAThumbnails:"Ativar Miniaturas do DeArrow"}},'
    'misc:{title:"Configurações Diversas",options:{endScreenCards:"Ocultar Cards no Final do Vídeo",youThereRenderer:"Ativar Aviso de \'Você ainda está assistindo?\'",paidPromoOverlay:"Ativar Sobreposição de \'Contém promoção paga\'",whosWatching:{title:"Menu \'Quem está assistindo?\'",options:{enableWW:"Ativar Menu \'Quem está assistindo?\'",permaEnableWW:"Ativar Menu \'Quem está assistindo?\' Permanentemente",enableWWOnExit:"Ativar Menu \'Quem está assistindo?\' ao Sair do App"}},fixUI:"Corrigir Interface",hqThumbnails:"Ativar Miniaturas de Alta Qualidade",longPress:"Ativar Ações de Toque Longo",shorts:"Ativar Shorts",videoPreviews:"Ativar Pré-visualizações de Vídeo",ttWelcomeMsg:"Mostrar Mensagem de Boas-vindas do TubeRush",guestSignInReminder:"Mostrar Lembrete de Login para Convidados",reloadHomeOnStartup:"Recarregar a Página Inicial na Inicialização"}},'
    'subtitles:{title:"Configurações das Legendas",options:{showLocalSubtitle:"Mostrar Legendas Locais",showHiddenSubtitles:"Mostrar Legendas Ocultas",persistCaptionStyle:"Lembrar Estilo das Legendas"}},'
    'videoPlayer:{title:"Configurações do Reprodutor de Vídeo",subtitle:"Personalizar recursos do reprodutor de vídeo",options:{patching:{title:"Corrigir Interface do Reprodutor de Vídeo",options:{enableVPUIPatching:"Ativar Correção da Interface do Reprodutor de Vídeo",previousNextBtns:"Ativar Botões de Avançar/Retroceder",showSuperThxBtn:"Mostrar Botão de Valeu Demais",showSpeedCtrlBtn:"Mostrar Botão de Controle de Velocidade",showAIAskBtn:"Mostrar Botão Perguntar",addMPBtn:"Mostrar Botão Mini Player",swapMPWithPIP:"Trocar Botão Mini Player por PiP"}},preferredVideoQuality:{title:"Qualidade de Vídeo Preferida",subtitle:"Escolha a qualidade de vídeo preferida ou a mais próxima disponível ao iniciar a reprodução"},speedSettings:{title:"Intervalos do Ajuste de Velocidade",subtitle:"Defina os incrementos de velocidade para ajustar a velocidade de reprodução do vídeo"},preferredVideoCodec:{title:"Codificação de Vídeo Preferida",subtitle:"Escolha a codificação de vídeo preferida para reprodução"},afr:"Taxa de Quadros Automática",afrPauseDuration:{title:"Duração da Pausa da Taxa de Quadros Automática",subtitle:"Defina a duração (em segundos) da pausa na reprodução ao ajustar a taxa de quadros"},codecAny:"Qualquer um",qualityAuto:"Automática",hideRelatedVideosPlayer:"Ocultar Vídeos Relacionados"}},'
    'uiSettings:{title:"Configurações da Interface de Usuário",subtitle:"Personalize a interface ao seu gosto",options:{hideWatchedVideos:{title:"Ocultar Vídeos Assistidos",options:{enableHideWatchedVideos:"Ativar Ocultação de Vídeos Assistidos",watchedVideosThreshold:{title:"Percentual Mínimo Assistido",subtitle:"Defina o percentual mínimo assistido para ocultar vídeos já vistos."},setPagesToHideWatchedVideos:"Definir Páginas para Ocultar Vídeos Assistidos"}},screenDimming:{title:"Escurecimento da Tela",options:{enableScreenDimming:"Ativar Escurecimento da Tela",dimmingTimeout:{title:"Tempo de Espera do Escurecimento",subtitle:"Defina o tempo de espera por inatividade (em segundos) antes que a tela escureça"},dimmingOpacity:{title:"Opacidade do Escurecimento",subtitle:"Defina o nível de opacidade para o escurecimento da tela"}}},disableSidebarContents:{title:"Desativar Conteúdos da Barra Lateral",subtitle:"Selecione os conteúdos da barra lateral para ocultar"},launchToOnStartup:{title:"Página Inicial ao Abrir",subtitle:"Escolha a página padrão que o TubeRush abrirá na inicialização"},sortSubscriptionsByAlphabet:"Ordenar Inscrições em Ordem Alfabética",categories:{search:"Pesquisar",home:"Início",sports:"Esportes",news:"Notícias",music:"Música",podcasts:"Podcasts",moviesAndTv:"Filmes e TV",live:"Ao vivo",gaming:"Jogos",subscriptions:"Inscrições",library:"Biblioteca",more:"Mais",shorts:"Shorts",searchResults:"Resultados da Pesquisa"},disableChannelsOnSidebar:"Desativar Canais na Barra Lateral",clock:{title:"Relógio",subtitle:"Exibir um relógio na tela",options:{enableClock:"Ativar Relógio",isClock12HourFormat:"Usar Formato 12 Horas no Relógio",clockShowSeconds:"Mostrar Segundos no Relógio",clockHideWhenVideoPlaying:"Ocultar Relógio Durante a Reprodução"}},disableEnlargingThumbnails:"Desativar Miniaturas Ampliadas",enableShrinkingThumbnails:"Ativar Miniaturas Reduzidas",sortSidebarContents:{title:"Ordenar Barra Lateral",subtitle:"Reordene os itens da barra lateral como preferir",moveUp:{title:"Mover para Cima",subtitle:"Mover este item para cima na barra lateral"},moveDown:{title:"Mover para Baixo",subtitle:"Mover este item para baixo na barra lateral"},addToSidebar:"Adicionar Canal à Barra Lateral",removeFromSidebar:"Remover Canal da Barra Lateral"}}},'
    'updater:{title:"Atualizador do TubeRush",menuSubtitle:"Gerenciar Atualizações do TubeRush",versionSubtitle:"Versão Atual: {{version}}",options:{checkForUpdates:"Verificar Atualizações",checkForUpdatesOnStartup:"Verificar Atualizações na Inicialização"},updateAvailable:{title:"Atualização Disponível",subtitle:"Uma nova versão do TubeRush está disponível: {{latestVersion}}, atual: {{currentVersion}}"},releaseDate:"Data de Lançamento: {{date}}",updateNow:{title:"Atualizar Agora",subtitle:"Clique para baixar a versão mais recente."},remindLater:{title:"Lembrar Mais Tarde",subtitle:"Verificar atualizações depois."},upToDate:{title:"O TubeRush está atualizado",subtitle:"Você está usando a versão mais recente ({{version}}) do TubeRush."},checkFailed:{title:"Falha ao verificar atualizações",subtitle:"Não foi possível verificar atualizações."},downloading:{title:"Atualização do TubeRush",subtitle:"Baixando atualização, aguarde..."}}},'
    'time:{second:"{{count}} segundo",seconds:"{{count}} segundos",minute:"{{count}} minuto",minutes:"{{count}} minutos"},'
    'ttSettings:{title:"Configurações do TubeRush",madeByText:"Feito por Helium Marcos (L1) com ❤️",summary:"Abrir Configurações do TubeRush"},'
    'supportTT:{title:"Apoie o TubeRush",subtitle:"❤️ Mostre apoio ao TubeRush e seu desenvolvimento",content:{1:"Se você gosta de usar o TubeRush e gostaria de apoiar o seu desenvolvimento, considere o seguinte:",2:"1. Dê uma estrela no repositório do GitHub para aumentar sua visibilidade.",3:"2. Compartilhe o TubeRush com outras pessoas.",4:"Se você gostaria de contribuir financeiramente, considere doar:",5:"- Buy Me A Coffee: https://buymeacoffee.com/heliumzyzzy"}}},'
    'welcomeMsg:{title:"Bem-vindo ao TubeRush",subtitle:"Vá até as Configurações e clique em Configurações do TubeRush para ajustar suas preferências."},'
    'sponsorblock:{segments:{sponsor:"segmento patrocinado",intro:"introdução",outro:"encerramento",interaction:"lembrete de interação",selfpromo:"autopromoção",preview:"resumo/pré-visualização",filler:"assuntos paralelos",music_offtopic:"parte sem música",poi_highlight:"destaque"},toasts:{skipping:"Pulando {{segment}}",notSkipping:"Ignorando {{segment}} (foi pulado {{count}} vezes)",skip:"Pular {{segment}}",skipToHighlight:"Pular para Destaque"}},'
    'player:{playbackSpeed:{title:"Velocidade de Reprodução",button:"Controles de Velocidade",fixStuttering:"Corrigir travamentos (1.0001x)"},miniPlayer:"Mini Player",pictureInPicture:"Picture in Picture",previous:"Anterior",next:"Próximo",withTizenTube:"com TubeRush",share:{title:"Compartilhar",button:"Compartilhar",qrCodeScanMessage:"Escaneie o QR Code abaixo para compartilhar este vídeo."},screenOff:"Desligar tela",chapters:{title:"Capítulos",enterNudge:"Para ver os capítulos, pressione a seta para cima",navNudge:"Navegar entre capítulos",navNudgeA11y:"Pressione esquerda ou direita para navegar entre capítulos"},queue:{title:"Fila de Vídeos",clear:"Limpar Fila"},subtitles:{otherLanguages:"Outros Idiomas"}},'
    'toasts:{videoAddedToQueue:"Vídeo adicionado à fila.",videoQueueCleared:"Fila de vídeos limpa.",sidebarContentsUpdated:{title:"Barra Lateral Atualizada",subtitle:"Os itens da barra lateral foram atualizados."},feedbackSent:"Feedback enviado."},'
    'videoMenu:{notInterested:"Sem interesse",dontRecommendChannel:"Não recomendar canal",play:"Reproduzir",saveToWatchLater:"Salvar em Assistir mais tarde",removeFromWatchLater:"Remover de Assistir mais tarde",saveToPlaylist:"Salvar na playlist",addToQueue:"Adicionar à fila",goToChannel:"Ir para o canal",videoOptions:"Opções do vídeo"},'
    'common:{back:"Voltar"}}'
)
code = code[:ptbr_start] + ptbr_full + code[ptbr_end:]

exp_stage1 = r"""
/* === TizenTube E1 (exp/low-latency) Stage 1: Proxima/ULL + Preconnect + Live Auto-Catch-Up === */
(function () {
  'use strict';
  if (window.__ttExpStage1Loaded) return;
  window.__ttExpStage1Loaded = true;

  var state = window.__ttExpStage1 = {
    version: 'exp-stage1-v1',
    patchedResponses: 0,
    preconnectHosts: [],
    catchupActive: false,
    catchupActivations: 0,
    rebufferBackoffs: 0,
    lastVideoId: null,
    lastLatencyClass: null,
    lastSegDur: null,
    lastLl: null,
    lastBh: null,
    lastRate: 1,
    lastReason: 'init'
  };

  function safeParseJson(str) {
    try { return JSON.parse(str); } catch (_) { return null; }
  }

  function getBaseSpeed() {
    try {
      var raw = localStorage.getItem('ytaf-configuration');
      if (raw) {
        var cfg = JSON.parse(raw);
        if (cfg && typeof cfg.videoSpeed === 'number' && isFinite(cfg.videoSpeed) && cfg.videoSpeed > 0) {
          return cfg.videoSpeed;
        }
      }
    } catch (_) {}
    return 1;
  }

  function isDefaultSpeed(spd) {
    return Math.abs(spd - 1) <= 0.0005;
  }

  // 1. Seed Proxima ULL preference & initial bandwidth floor on cold start
  try {
    var now = Date.now();
    if (!localStorage.getItem('yt-player-proxima-pref')) {
      localStorage.setItem('yt-player-proxima-pref', JSON.stringify({
        data: '1',
        expiration: now + 31536000000,
        creation: now
      }));
    }
    var rawBw = localStorage.getItem('yt-player-bandwidth');
    var needSeedBw = !rawBw;
    if (rawBw) {
      var outerBw = safeParseJson(rawBw);
      var innerBw = outerBw && typeof outerBw.data === 'string' ? safeParseJson(outerBw.data) : null;
      if (!innerBw || typeof innerBw.byterate !== 'number' || innerBw.byterate < 3000000) {
        needSeedBw = true;
      }
    }
    if (needSeedBw) {
      localStorage.setItem('yt-player-bandwidth', JSON.stringify({
        data: JSON.stringify({ delay: 0.12, stall: 0, byterate: 6250000 }),
        expiration: now + 2592000000,
        creation: now
      }));
    }
  } catch (_) {}

  // 2. Non-blocking <link rel="preconnect"> helper
  var preconnected = Object.create(null);
  function addPreconnect(origin) {
    try {
      if (!origin || preconnected[origin] || state.preconnectHosts.length >= 8) return;
      preconnected[origin] = true;
      state.preconnectHosts.push(origin);
      var head = document.head || document.documentElement;
      if (!head) return;
      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      head.appendChild(link);
    } catch (_) {}
  }

  var scheduleIdle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
  scheduleIdle(function () {
    addPreconnect('https://youtubei.googleapis.com');
    addPreconnect('https://i.ytimg.com');
  });

  // 3. Patch ytcfg EXPERIMENT_FLAGS & WEB_PLAYER_CONTEXT_CONFIGS for official Proxima/ULL & fast startup
  var EXP_FLAG_OVERRIDES = {
    html5_enable_proxima: 'true',
    html5_sabr_force_proxima: 'true',
    html5_sabr_live_ultra_low_latency_streaming_xhr: 'true',
    html5_sabr_live_low_latency_streaming_xhr: 'true',
    html5_ultra_low_latency_subsegment_readahead: 'true',
    html5_live_chunk_readahead_proxima_override: '1',
    html5_liveness_drift_proxima_override: '2',
    html5_min_startup_buffered_media_duration_secs: '0.6',
    html5_min_startup_buffered_media_duration_for_live_secs: '0.0',
    html5_min_startup_duration_live_secs: '0.25'
  };

  function patchSerializedFlags(serialized) {
    if (typeof serialized !== 'string' || !serialized) return serialized;
    var parts = serialized.split('&');
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      var eq = p.indexOf('=');
      var k = eq >= 0 ? p.slice(0, eq) : p;
      if (Object.prototype.hasOwnProperty.call(EXP_FLAG_OVERRIDES, k)) {
        out.push(k + '=' + EXP_FLAG_OVERRIDES[k]);
        seen[k] = true;
      } else {
        out.push(p);
      }
    }
    for (var ok in EXP_FLAG_OVERRIDES) {
      if (Object.prototype.hasOwnProperty.call(EXP_FLAG_OVERRIDES, ok) && !seen[ok]) {
        out.push(ok + '=' + EXP_FLAG_OVERRIDES[ok]);
      }
    }
    return out.join('&');
  }

  function applyYtcfgPatches(obj) {
    if (!obj || typeof obj !== 'object') return;
    try {
      if (obj.EXPERIMENT_FLAGS && typeof obj.EXPERIMENT_FLAGS === 'object') {
        for (var k in EXP_FLAG_OVERRIDES) {
          if (Object.prototype.hasOwnProperty.call(EXP_FLAG_OVERRIDES, k)) {
            var val = EXP_FLAG_OVERRIDES[k];
            obj.EXPERIMENT_FLAGS[k] = val === 'true' ? true : (val === 'false' ? false : Number(val));
          }
        }
      }
      var wpcc = obj.WEB_PLAYER_CONTEXT_CONFIGS;
      if (wpcc && typeof wpcc === 'object') {
        for (var wk in wpcc) {
          if (wpcc[wk] && typeof wpcc[wk].serializedExperimentFlags === 'string') {
            wpcc[wk].serializedExperimentFlags = patchSerializedFlags(wpcc[wk].serializedExperimentFlags);
          }
        }
      }
    } catch (_) {}
  }

  function hookYtcfg() {
    try {
      if (!window.ytcfg) return false;
      if (window.ytcfg.data_) applyYtcfgPatches(window.ytcfg.data_);
      if (typeof window.ytcfg.set === 'function' && !window.ytcfg.__ttExpWrapped) {
        var origYtcfgSet = window.ytcfg.set;
        window.ytcfg.set = function () {
          try {
            if (arguments[0] && typeof arguments[0] === 'object') applyYtcfgPatches(arguments[0]);
          } catch (_) {}
          var res = origYtcfgSet.apply(this, arguments);
          try { if (this && this.data_) applyYtcfgPatches(this.data_); } catch (_) {}
          return res;
        };
        window.ytcfg.__ttExpWrapped = true;
      }
      return !!window.ytcfg.__ttExpWrapped;
    } catch (_) {
      return false;
    }
  }

  if (!hookYtcfg()) {
    var ytcfgPollCount = 0;
    var ytcfgPoll = setInterval(function () {
      ytcfgPollCount++;
      if (hookYtcfg() || ytcfgPollCount >= 100) clearInterval(ytcfgPoll);
    }, 100);
  }

  // 4. Hook both JSON.parse and Response.prototype.json to tune live playerConfig & preconnect media CDN
  function patchParsedPayload(res) {
    try {
      if (res && typeof res === 'object') {
        var sd = res.streamingData;
        if (sd && typeof sd === 'object') {
          var sampleUrl = sd.serverAbrStreamingUrl ||
            (Array.isArray(sd.adaptiveFormats) && sd.adaptiveFormats[0] && sd.adaptiveFormats[0].url);
          if (typeof sampleUrl === 'string' && sampleUrl.indexOf('http') === 0) {
            try { addPreconnect(new URL(sampleUrl).origin); } catch (_) {}
          }
        }
        var pc = res.playerConfig;
        if (pc && typeof pc === 'object') {
          var vd = res.videoDetails;
          var isLive = !!(vd && vd.isLive);
          if (pc.webPlayerConfig && typeof pc.webPlayerConfig === 'object') {
            pc.webPlayerConfig.enableProximaLowLatency = true;
          }
          if (isLive) {
            if (pc.livePlayerConfig && typeof pc.livePlayerConfig === 'object') {
              pc.livePlayerConfig.isLiveHeadPlayable = true;
            }
            state.patchedResponses++;
          }
        }
      }
    } catch (_) {}
    return res;
  }

  try {
    var prevJsonParse = JSON.parse;
    JSON.parse = function () {
      return patchParsedPayload(prevJsonParse.apply(this, arguments));
    };
  } catch (_) {}

  try {
    if (window.Response && Response.prototype && typeof Response.prototype.json === 'function' && !Response.prototype.__ttExpJson) {
      var origRespJson = Response.prototype.json;
      Response.prototype.json = function () {
        return origRespJson.apply(this, arguments).then(patchParsedPayload);
      };
      Response.prototype.__ttExpJson = true;
    }
  } catch (_) {}

  // 5. Intelligent Adaptive Live Auto-Catch-Up Controller
  var cachedPlayer = null;
  var cachedVideo = null;
  var hookedVideo = null;
  var lastRebufferAt = 0;
  var lastVideoSwitchAt = 0;
  var lastSeekJumpAt = 0;
  var weChangedRate = false;
  var lastTimeUpdateTime = 0;
  var manualDvrHold = false;

  function getPlayer() {
    if (cachedPlayer && cachedPlayer.isConnected) return cachedPlayer;
    cachedPlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    return cachedPlayer;
  }

  function getVideo() {
    if (cachedVideo && cachedVideo.isConnected) return cachedVideo;
    cachedVideo = document.querySelector('video');
    if (cachedVideo && cachedVideo !== hookedVideo) {
      hookedVideo = cachedVideo;
      try {
        hookedVideo.addEventListener('emptied', function () {
          manualDvrHold = false;
          lastTimeUpdateTime = 0;
          lastVideoSwitchAt = Date.now();
        }, true);
        hookedVideo.addEventListener('loadstart', function () {
          manualDvrHold = false;
          lastTimeUpdateTime = 0;
          lastVideoSwitchAt = Date.now();
        }, true);
        hookedVideo.addEventListener('waiting', function () {
          lastRebufferAt = Date.now();
          if (weChangedRate) {
            state.rebufferBackoffs++;
            try { hookedVideo.playbackRate = getBaseSpeed(); } catch (_) {}
            weChangedRate = false;
            state.catchupActive = false;
          }
        }, true);
        hookedVideo.addEventListener('seeking', function () {
          var vct = hookedVideo.currentTime || 0;
          if (Date.now() - lastVideoSwitchAt > 3500 && hookedVideo.readyState >= 2 && lastTimeUpdateTime > 0 && lastTimeUpdateTime - vct > 12) {
            manualDvrHold = true;
          }
          lastTimeUpdateTime = vct;
        }, true);
      } catch (_) {}
    }
    return cachedVideo;
  }

  function restoreBaseRate(v, reason) {
    var base = getBaseSpeed();
    if (v && weChangedRate && Math.abs((v.playbackRate || 1) - base) > 0.002) {
      try { v.playbackRate = base; } catch (_) {}
    }
    weChangedRate = false;
    state.catchupActive = false;
    state.lastRate = v ? v.playbackRate : base;
    state.lastReason = reason;
  }

  function refreshStreamMeta(p, vid) {
    state.lastVideoId = vid;
    state.lastSegDur = 5;
    state.lastLatencyClass = 'NORMAL';
    manualDvrHold = false;
    lastTimeUpdateTime = 0;
    lastVideoSwitchAt = Date.now();
    try {
      var pr = p.getPlayerResponse && p.getPlayerResponse();
      var vd = pr && pr.videoDetails;
      if (vd && vd.latencyClass) state.lastLatencyClass = String(vd.latencyClass);
    } catch (_) {}
    try {
      if (typeof p.getDebugText === 'function') {
        var dbg = safeParseJson(p.getDebugText(true));
        if (dbg) {
          if (dbg.segduration) state.lastSegDur = Number(dbg.segduration) || 5;
          if (dbg.latency_class) state.lastLatencyClass = String(dbg.latency_class);
        }
      }
    } catch (_) {}
  }

  function parseNumeric(val, samples) {
    if (typeof val === 'string') {
      var n = parseFloat(val);
      if (isFinite(n)) return n;
    } else if (typeof val === 'number' && isFinite(val)) {
      return val;
    }
    if (Array.isArray(samples) && samples.length) {
      var last = samples[samples.length - 1];
      if (typeof last === 'number' && isFinite(last)) return last;
    }
    return NaN;
  }

  setInterval(function () {
    var p = getPlayer();
    var v = getVideo();
    if (!p || !v) return;

    var baseSpeed = getBaseSpeed();
    if (!isDefaultSpeed(baseSpeed)) {
      restoreBaseRate(v, 'user-custom-speed');
      return;
    }

    var pState = typeof p.getPlayerState === 'function' ? p.getPlayerState() : -1;
    if (pState === 3) {
      lastRebufferAt = Date.now();
      if (weChangedRate) state.rebufferBackoffs++;
      restoreBaseRate(v, 'buffering');
      return;
    }
    if (pState !== 1) {
      if (weChangedRate) restoreBaseRate(v, 'not-playing');
      return;
    }

    var pr = null;
    try { pr = p.getPlayerResponse && p.getPlayerResponse(); } catch (_) {}
    var vd = pr && pr.videoDetails;
    if (!vd || !vd.isLive) {
      manualDvrHold = false;
      restoreBaseRate(v, 'vod');
      return;
    }

    var vid = vd.videoId || '';
    if (vid && vid !== state.lastVideoId) {
      refreshStreamMeta(p, vid);
    }
    lastTimeUpdateTime = v.currentTime || 0;

    if (Date.now() - lastRebufferAt < 8000) {
      restoreBaseRate(v, 'rebuffer-cooldown');
      return;
    }

    var st = null;
    try { st = p.getStatsForNerds && p.getStatsForNerds(); } catch (_) {}

    var ll = st ? parseNumeric(st.live_latency_secs || st.live_latency_seconds, st.live_latency_samples) : NaN;
    var bh = st ? parseNumeric(st.buffer_health_seconds, st.buffer_health_samples) : NaN;
    if (!isFinite(ll) || !isFinite(bh)) {
      try {
        if (typeof p.getDebugText === 'function') {
          var dbgMetrics = safeParseJson(p.getDebugText(true));
          if (dbgMetrics) {
            if (!isFinite(ll)) ll = parseNumeric(dbgMetrics.rawlivelatency || dbgMetrics.livelatency);
            if (!isFinite(bh)) bh = parseNumeric(dbgMetrics.vbu || dbgMetrics.bufferhealth);
          }
        }
      } catch (_) {}
    }
    state.lastLl = isFinite(ll) ? Math.round(ll * 100) / 100 : null;
    state.lastBh = isFinite(bh) ? Math.round(bh * 100) / 100 : null;

    if (!isFinite(ll) || !isFinite(bh)) return;

    var isHead = typeof p.isAtLiveHead === 'function' ? !!p.isAtLiveHead() : true;
    if (manualDvrHold || (!isHead && ll > 75)) {
      if (ll <= 6.5) {
        manualDvrHold = false;
      } else {
        restoreBaseRate(v, 'manual-dvr');
        return;
      }
    }

    var lc = state.lastLatencyClass || 'NORMAL';
    var sd = state.lastSegDur || 5;
    var safeBh = Math.max(3.6, sd * 0.72);
    var entryBh = Math.max(5.3, sd + 0.3);
    var targetLl = Math.max(5.5, sd * 1.1);
    if (lc.indexOf('ULTRA') >= 0 || sd <= 1.5) {
      safeBh = 1.2;
      entryBh = 2.2;
      targetLl = 2.0;
    } else if (lc.indexOf('LOW') >= 0 || sd <= 2.5) {
      safeBh = 1.8;
      entryBh = 3.2;
      targetLl = 3.2;
    }

    var headroom = bh - safeBh;
    var excess = ll - targetLl;

    if (headroom <= 0.05) {
      restoreBaseRate(v, 'low-buffer-guard');
      return;
    }

    if (ll > 18 && isHead && !manualDvrHold && bh >= entryBh && Date.now() - lastSeekJumpAt > 45000 && typeof p.seekTo === 'function') {
      lastSeekJumpAt = Date.now();
      restoreBaseRate(v, 'seek-live-head');
      try { p.seekTo(Infinity, true); } catch (_) {}
      return;
    }

    if (state.catchupActive) {
      if (excess <= 0.4 || headroom <= 0.15) {
        restoreBaseRate(v, 'at-target');
        return;
      }
    } else {
      if (excess < 1.2 || bh < entryBh) {
        restoreBaseRate(v, 'at-target');
        return;
      }
    }

    var desiredRate = 1.06;
    if (excess > 5.0 && headroom > 3.5) {
      desiredRate = 1.18;
    } else if (excess > 2.2 && headroom > 1.8) {
      desiredRate = 1.12;
    } else if (excess > 1.2 && headroom > 0.8) {
      desiredRate = 1.07;
    }

    try { v.preservesPitch = true; } catch (_) {}
    if (Math.abs((v.playbackRate || 1) - desiredRate) > 0.005) {
      try { v.playbackRate = desiredRate; } catch (_) {}
    }
    if (!state.catchupActive) state.catchupActivations++;
    state.catchupActive = true;
    weChangedRate = true;
    state.lastRate = desiredRate;
    state.lastReason = 'catching-up';
  }, 1200);
})();
"""

if args.variant == "experimental":
    code = code + "\n" + exp_stage1 + "\n"

out_path = args.output
po_bundle = (repo_root / "scripts" / "web_po.min.js").read_text(encoding="utf-8")
fallback = (repo_root / "scripts" / "vp9_fallback.js").read_text(encoding="utf-8")
quality = (repo_root / "scripts" / "quality_formats.js").read_text(encoding="utf-8")
quality_runtime = "\n(function(){if(window.__ttQualityController)return;\n" + quality + "\nwindow.__ttQualityController=window.TTQualityFormats.create(window);window.__ttQualityController.installMenu();\n})();\n"
runtime = "\n(function(){if(window.__ttVp9Fallback)return;\n" + po_bundle + "\nwindow.TTWebPo=TTWebPo;\n" + fallback + "\n})();\n"
with open(out_path, "w", encoding="utf-8", newline="\n") as f:
    policy = (repo_root / "scripts" / "l1" / "src" / "bitrate-policy.js").read_text(encoding="utf-8")
    f.write(header + "\n" + policy + "\n" + quality_runtime + runtime + code)

print("Built clean u.js:", os.path.getsize(out_path))
