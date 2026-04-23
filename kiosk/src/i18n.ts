export type Lang = "en" | "es" | "ht" | "zh" | "pt";

export type UiTextKey =
  | "title"
  | "subtitle"
  | "allTopics"
  | "emergency"
  | "housing"
  | "food"
  | "health"
  | "immigration"
  | "family"
  | "benefits"
  | "city311"
  | "searchLabel"
  | "searchPlaceholder"
  | "noSearchMatches"
  | "resultsCount"
  | "typeShelter"
  | "typeFood"
  | "typeHealth"
  | "typeImmigration"
  | "typeFamily"
  | "typeBenefits"
  | "trustImmigration"
  | "skipToContent"
  | "transitHelp"
  | "eligibilityLabel"
  | "sourcesLabel"
  | "emptyCategory"
  | "hub"
  | "mbtaNote"
  | "allPins"
  | "mbtaNearYou"
  | "mbtaPlanTrip"
  | "mbtaAreaHaymarket"
  | "mbtaAreaGovt"
  | "mbtaAreaOther"
  | "mapSectionTitle"
  | "detailSectionTitle"
  | "mapIntro"
  | "textSizeLabel"
  | "textSizeDefault"
  | "textSizeLarge"
  | "textSizeLarger"
  | "researchHint"
  | "chatOpen"
  | "chatTitle"
  | "chatIntro"
  | "chatPlaceholder"
  | "chatSend"
  | "chatMic"
  | "chatStopRec"
  | "chatSpeakLast"
  | "chatClose"
  | "chatThinking"
  | "chatVoiceWorking"
  | "chatDisclaimer"
  | "chatMicUnsupported";

type Dict = Record<Lang, Record<UiTextKey, string>>;

const dict: Dict = {
  en: {
    title: "CityBridge Boston",
    subtitle:
      "AI-assisted civic resource guidance from curated public listings. Always call ahead to confirm hours and whether you qualify.",
    allTopics: "All",
    emergency: "Shelter & crisis",
    housing: "Housing & rent help",
    food: "Food & meals",
    health: "Health services",
    immigration: "Immigration help",
    family: "Family & kids",
    benefits: "Benefits & cash programs",
    city311: "City services (311)",
    searchLabel: "Search this list",
    searchPlaceholder: "Name, street, phone, or service…",
    noSearchMatches: "No entries match that search. Try fewer words or pick another topic.",
    resultsCount: "{{count}} places",
    typeShelter: "Shelter / crisis",
    typeFood: "Food",
    typeHealth: "Health",
    typeImmigration: "Immigration",
    typeFamily: "Family",
    typeBenefits: "Benefits",
    trustImmigration:
      "Not legal advice. If it is about your case, you need a lawyer or clinic, not a website.",
    skipToContent: "Skip to main content",
    transitHelp: "Bus and train stops near here",
    eligibilityLabel: "Before you go",
    sourcesLabel: "Source",
    emptyCategory: "Nothing in this list yet for that topic.",
    hub: "More data on Analyze Boston",
    mbtaNote: "Times change. Check mbta.com or the sign at the stop.",
    allPins: "Show everything on the map",
    mbtaNearYou: "Stops sorted by distance from the map center",
    mbtaPlanTrip: "Trip planner (mbta.com)",
    mbtaAreaHaymarket: "Haymarket area",
    mbtaAreaGovt: "Government Center & Downtown",
    mbtaAreaOther: "Other nearby stops",
    mapSectionTitle: "Map",
    detailSectionTitle: "What’s open, where, and what they say about eligibility",
    mapIntro: "Pick a topic, search, or tap a map dot.",
    textSizeLabel: "Text size",
    textSizeDefault: "Default",
    textSizeLarge: "Large",
    textSizeLarger: "Larger",
    researchHint:
      "311, printed flyers, and each organization’s website are the best way to confirm details that change often.",
    chatOpen: "Help chat",
    chatTitle: "CityBridge assistant",
    chatIntro:
      "Ask about food, shelter, health, immigration, family, or benefits in Greater Boston. Answers use this site’s directory—always confirm hours and eligibility by phone. You can type, speak (microphone), or play the last reply as audio.",
    chatPlaceholder: "What do you need help with?",
    chatSend: "Send",
    chatMic: "Speak",
    chatStopRec: "Stop",
    chatSpeakLast: "Play last reply",
    chatClose: "Close",
    chatThinking: "Thinking…",
    chatVoiceWorking: "Working on audio…",
    chatDisclaimer:
      "Not legal advice. Emergencies: call 911. City requests (non-emergency): Boston 311. AI can be wrong—verify with each program.",
    chatMicUnsupported: "This device or browser does not allow microphone recording here.",
  },
  es: {
    title: "CityBridge Boston",
    subtitle:
      "Teléfonos y direcciones de listas públicas. Llame siempre antes para confirmar horario y requisitos.",
    allTopics: "Todo",
    emergency: "Refugio y crisis",
    housing: "Vivienda y alquiler",
    food: "Comida",
    health: "Salud",
    immigration: "Ayuda migratoria",
    family: "Familia y niños",
    benefits: "Beneficios y efectivo",
    city311: "Servicios municipales (311)",
    searchLabel: "Buscar en esta lista",
    searchPlaceholder: "Nombre, calle, teléfono o servicio…",
    noSearchMatches: "Nada coincide con esa búsqueda. Use menos palabras u otro tema.",
    resultsCount: "{{count}} lugares",
    typeShelter: "Refugio / crisis",
    typeFood: "Comida",
    typeHealth: "Salud",
    typeImmigration: "Inmigración",
    typeFamily: "Familia",
    typeBenefits: "Beneficios",
    trustImmigration: "No es asesoría legal. Para su caso, necesita abogado o clínica, no una página.",
    skipToContent: "Ir al contenido principal",
    transitHelp: "Paradas de autobús y tren cerca",
    eligibilityLabel: "Antes de ir",
    sourcesLabel: "Fuente",
    emptyCategory: "Nada en esta lista todavía para ese tema.",
    hub: "Más datos en Analyze Boston",
    mbtaNote: "Los horarios cambian. Mire mbta.com o el letrero en la parada.",
    allPins: "Mostrar todo en el mapa",
    mbtaNearYou: "Paradas por distancia desde el centro del mapa",
    mbtaPlanTrip: "Planificador (mbta.com)",
    mbtaAreaHaymarket: "Zona Haymarket",
    mbtaAreaGovt: "Government Center y centro",
    mbtaAreaOther: "Otras paradas cercanas",
    mapSectionTitle: "Mapa",
    detailSectionTitle: "Dirección, horario y qué dicen sobre requisitos",
    mapIntro: "Elija un tema, busque o toque el mapa.",
    textSizeLabel: "Tamaño del texto",
    textSizeDefault: "Normal",
    textSizeLarge: "Grande",
    textSizeLarger: "Más grande",
    researchHint:
      "311, folletos impresos y la página web de cada programa son la mejor forma de confirmar datos que cambian.",
    chatOpen: "Asistente",
    chatTitle: "Asistente CityBridge",
    chatIntro:
      "Pregunte por comida, refugio, salud, inmigración, familia o beneficios en Boston y alrededores. Las respuestas usan el listado de este sitio—confirme siempre horario y requisitos por teléfono. Puede escribir, hablar (micrófono) o reproducir la última respuesta en audio.",
    chatPlaceholder: "¿En qué necesita ayuda?",
    chatSend: "Enviar",
    chatMic: "Hablar",
    chatStopRec: "Parar",
    chatSpeakLast: "Reproducir última respuesta",
    chatClose: "Cerrar",
    chatThinking: "Pensando…",
    chatVoiceWorking: "Procesando audio…",
    chatDisclaimer:
      "No es asesoría legal. Emergencias: 911. Trámites municipales (no emergencia): 311 de Boston. La IA puede equivocarse—verifique con cada programa.",
    chatMicUnsupported: "Este dispositivo o navegador no permite usar el micrófono aquí.",
  },
  ht: {
    title: "CityBridge Boston",
    subtitle:
      "Nimewo telefòn ak adrès ofisyèl ki sòti nan lis piblik. Toujou rele anvan pou konfime lè ak kondisyon yo.",
    allTopics: "Tout",
    emergency: "Abrij ak kriz",
    housing: "Lojman ak lwaye",
    food: "Manje",
    health: "Sante",
    immigration: "Èd imigrasyon",
    family: "Fanmi ak timoun",
    benefits: "Benefis ak lajan",
    city311: "Sèvis vil (311)",
    searchLabel: "Chèche nan lis la",
    searchPlaceholder: "Non, lari, telefòn, oswa sèvis…",
    noSearchMatches: "Pa gen rezilta. Eseye mwens mo oswa yon lòt sijè.",
    resultsCount: "{{count}} kote",
    typeShelter: "Abrij / kriz",
    typeFood: "Manje",
    typeHealth: "Sante",
    typeImmigration: "Imigrasyon",
    typeFamily: "Fanmi",
    typeBenefits: "Benefis",
    trustImmigration: "Pa konsè legal. Pou ka ou, bezwen avoka oswa klinik, pa yon sit entènèt.",
    skipToContent: "Ale dirèkteman nan kontni an",
    transitHelp: "Estasyon bis ak tren toupre",
    eligibilityLabel: "Anvan ou ale",
    sourcesLabel: "Sous",
    emptyCategory: "Pa gen anye nan lis la pou sijè sa a.",
    hub: "Plis done sou Analyze Boston",
    mbtaNote: "Orè ka chanje. Gade mbta.com oswa pano a nan estasyon an.",
    allPins: "Montre tout sou kat la",
    mbtaNearYou: "Estasyon pa distans soti nan sant kat la",
    mbtaPlanTrip: "Plan vwayaj (mbta.com)",
    mbtaAreaHaymarket: "Zòn Haymarket",
    mbtaAreaGovt: "Government Center ak sant vil la",
    mbtaAreaOther: "Lòt estasyon toupre",
    mapSectionTitle: "Kat",
    detailSectionTitle: "Kote ak lè",
    mapIntro: "Chwazi yon sijè, chèche, oswa peze kat la.",
    textSizeLabel: "Gwosè tèks",
    textSizeDefault: "Nòmal",
    textSizeLarge: "Gwo",
    textSizeLarger: "Pi gwo",
    researchHint:
      "311, bwochi enprime, ak sit entènèt chak òganizasyon se pi bon fason pou verifye detay ki chanje souvan.",
    chatOpen: "Asistan",
    chatTitle: "Asistan CityBridge",
    chatIntro:
      "Mande sou manje, abrij, sante, imigrasyon, fanmi oswa benefis nan zòn Boston. Repons yo baze sou lis sit la—toujou verifye lè ak kondisyon pa telefòn. Ou ka ekri, pale (mikwofòn), oswa jwe dènye repons kòm odyo.",
    chatPlaceholder: "Kisa ou bezwen èd?",
    chatSend: "Voye",
    chatMic: "Pale",
    chatStopRec: "Kanpe",
    chatSpeakLast: "Jwe dènye repons",
    chatClose: "Fèmen",
    chatThinking: "Ap reflechi…",
    chatVoiceWorking: "Ap trete odyo…",
    chatDisclaimer:
      "Pa konsè legal. Ijans: rele 911. Pou sèvis vil (pa ijans): 311 Boston. IA ka fè erè—verifye ak chak pwogram.",
    chatMicUnsupported: "Aparèy oswa navigatè a pa pèmèt mikwofòn isit la.",
  },
  zh: {
    title: "CityBridge Boston",
    subtitle: "基于公开名单的精选市政资源与智能引导。请务必先致电确认开放时间与资格要求。",
    allTopics: "全部",
    emergency: "庇护与紧急",
    housing: "住房与租房协助",
    food: "食物与餐食",
    health: "医疗服务",
    immigration: "移民相关帮助",
    family: "家庭与儿童",
    benefits: "福利与现金补助",
    city311: "市政服务（311）",
    searchLabel: "在本列表中搜索",
    searchPlaceholder: "名称、街道、电话或服务…",
    noSearchMatches: "没有匹配项。请减少关键词或更换类别。",
    resultsCount: "{{count}} 个地点",
    typeShelter: "庇护 / 紧急",
    typeFood: "食物",
    typeHealth: "医疗",
    typeImmigration: "移民",
    typeFamily: "家庭",
    typeBenefits: "福利",
    trustImmigration: "不是法律意见。涉及您个人情况，请咨询律师或法律援助机构。",
    skipToContent: "跳到主要内容",
    transitHelp: "附近的公交与轨道站",
    eligibilityLabel: "去之前请先了解",
    sourcesLabel: "信息来源",
    emptyCategory: "该主题下暂时没有条目。",
    hub: "更多数据见 Analyze Boston",
    mbtaNote: "时刻会变，以 mbta.com 或车站告示为准。",
    allPins: "显示地图上全部点",
    mbtaNearYou: "按离地图中心的距离排序的站点",
    mbtaPlanTrip: "行程规划（mbta.com）",
    mbtaAreaHaymarket: "Haymarket 一带",
    mbtaAreaGovt: "Government Center 与市中心",
    mbtaAreaOther: "其他附近站点",
    mapSectionTitle: "地图",
    detailSectionTitle: "地址、时间与资格说明",
    mapIntro: "选类别、搜索，或点击地图标记。",
    textSizeLabel: "文字大小",
    textSizeDefault: "默认",
    textSizeLarge: "大",
    textSizeLarger: "更大",
    researchHint: "311、纸质材料及各机构官网最适合核实经常变动的信息。",
    chatOpen: "咨询助手",
    chatTitle: "CityBridge 助手",
    chatIntro:
      "可询问大波士顿地区的食物、庇护、医疗、移民、家庭或福利等问题。回答依据本网站目录—请务必电话确认开放时间与资格。您可打字、语音（麦克风）或将上一条回复播放为语音。",
    chatPlaceholder: "您需要什么帮助？",
    chatSend: "发送",
    chatMic: "说话",
    chatStopRec: "停止",
    chatSpeakLast: "播放上条回复",
    chatClose: "关闭",
    chatThinking: "正在思考…",
    chatVoiceWorking: "正在处理语音…",
    chatDisclaimer:
      "非法律意见。紧急情况请拨打911。非紧急市政事务请拨打波士顿311。人工智能可能有误，请向各机构核实。",
    chatMicUnsupported: "此设备或浏览器无法在此使用麦克风录音。",
  },
  pt: {
    title: "CityBridge Boston",
    subtitle:
      "Telefones e endereços de listas públicas. Sempre ligue antes para confirmar horário e elegibilidade.",
    allTopics: "Tudo",
    emergency: "Abrigo e crise",
    housing: "Moradia e aluguel",
    food: "Comida",
    health: "Saúde",
    immigration: "Ajuda com imigração",
    family: "Família e crianças",
    benefits: "Benefícios e dinheiro",
    city311: "Serviços da cidade (311)",
    searchLabel: "Pesquisar nesta lista",
    searchPlaceholder: "Nome, rua, telefone ou serviço…",
    noSearchMatches: "Nada encontrado. Tente menos palavras ou outro assunto.",
    resultsCount: "{{count}} locais",
    typeShelter: "Abrigo / crise",
    typeFood: "Comida",
    typeHealth: "Saúde",
    typeImmigration: "Imigração",
    typeFamily: "Família",
    typeBenefits: "Benefícios",
    trustImmigration: "Não é aconselhamento jurídico. Para o seu caso, fale com advogado ou clínica, não com um site.",
    skipToContent: "Ir para o conteúdo principal",
    transitHelp: "Paradas de ônibus e trem por perto",
    eligibilityLabel: "Antes de ir",
    sourcesLabel: "Fonte",
    emptyCategory: "Nada nesta lista ainda para esse assunto.",
    hub: "Mais dados no Analyze Boston",
    mbtaNote: "Horários mudam. Veja mbta.com ou o letreiro na parada.",
    allPins: "Mostrar tudo no mapa",
    mbtaNearYou: "Paradas por distância do centro do mapa",
    mbtaPlanTrip: "Planejador (mbta.com)",
    mbtaAreaHaymarket: "Região Haymarket",
    mbtaAreaGovt: "Government Center e centro",
    mbtaAreaOther: "Outras paradas próximas",
    mapSectionTitle: "Mapa",
    detailSectionTitle: "Endereço, horário e o que dizem sobre requisitos",
    mapIntro: "Escolha um tema, pesquise ou toque no mapa.",
    textSizeLabel: "Tamanho do texto",
    textSizeDefault: "Normal",
    textSizeLarge: "Grande",
    textSizeLarger: "Maior",
    researchHint:
      "311, folhetos impressos e o site de cada organização são a melhor forma de confirmar dados que mudam.",
    chatOpen: "Assistente",
    chatTitle: "Assistente CityBridge",
    chatIntro:
      "Pergunte sobre comida, abrigo, saúde, imigração, família ou benefícios na região de Boston. As respostas usam o diretório deste site—confirme sempre horários e elegibilidade por telefone. Você pode digitar, falar (microfone) ou ouvir a última resposta em áudio.",
    chatPlaceholder: "Em que você precisa de ajuda?",
    chatSend: "Enviar",
    chatMic: "Falar",
    chatStopRec: "Parar",
    chatSpeakLast: "Ouvir última resposta",
    chatClose: "Fechar",
    chatThinking: "Pensando…",
    chatVoiceWorking: "Processando áudio…",
    chatDisclaimer:
      "Não é aconselhamento jurídico. Emergências: ligue 911. Serviços municipais (não emergência): 311 de Boston. A IA pode errar—confirme com cada programa.",
    chatMicUnsupported: "Este dispositivo ou navegador não permite usar o microfone aqui.",
  },
};

export function t(lang: Lang, key: UiTextKey): string {
  return dict[lang][key] ?? dict.en[key] ?? key;
}
