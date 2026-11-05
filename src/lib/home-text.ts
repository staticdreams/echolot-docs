import type { Lang } from './i18n';

/** The home page's words in each language. */
export const homeText: Record<Lang, { title: string; description: string; lead: string; read: string; demo: string; shotAlt: string }> = {
  en: {
    title: 'Echolot documentation',
    description: 'How to use Echolot, the native Mac API client for HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT and MCP.',
    lead: 'How to use Echolot, the native Mac API client for HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT and MCP: the direct download and the Mac App Store edition, the command-line tool and CI.',
    read: 'Read the docs',
    demo: 'Try the demo API',
    shotAlt: "Echolot's window: the Alpenglow example workspace with its requests in the sidebar, List products open, and its JSON response beside it",
  },
  de: {
    title: 'Echolot-Dokumentation',
    description: 'So verwendest du Echolot, den nativen Mac-API-Client für HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT und MCP.',
    lead: 'So verwendest du Echolot, den nativen Mac-API-Client für HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT und MCP: den direkten Download und die Mac-App-Store-Edition, das Kommandozeilen-Tool und CI.',
    read: 'Dokumentation lesen',
    demo: 'Demo-API ausprobieren',
    shotAlt: 'Das Echolot-Fenster: der Beispiel-Arbeitsbereich Alpenglow mit seinen Anfragen in der Seitenleiste, geöffnet ist List products, daneben die JSON-Antwort',
  },
  es: {
    title: 'Documentación de Echolot',
    description: 'Cómo usar Echolot, el cliente de API nativo para Mac para HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT y MCP.',
    lead: 'Cómo usar Echolot, el cliente de API nativo para Mac para HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT y MCP: la descarga directa y la edición de la Mac App Store, la herramienta de línea de comandos y la CI.',
    read: 'Leer la documentación',
    demo: 'Probar la API de demostración',
    shotAlt: 'La ventana de Echolot: el espacio de trabajo de ejemplo Alpenglow con sus solicitudes en la barra lateral, List products abierta y su respuesta JSON al lado',
  },
  fr: {
    title: 'Documentation d’Echolot',
    description: 'Comment utiliser Echolot, le client d’API natif pour Mac pour HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT et MCP.',
    lead: 'Comment utiliser Echolot, le client d’API natif pour Mac pour HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT et MCP : le téléchargement direct et l’édition du Mac App Store, l’outil en ligne de commande et la CI.',
    read: 'Lire la documentation',
    demo: 'Essayer l’API de démonstration',
    shotAlt: 'La fenêtre d’Echolot : l’espace de travail d’exemple Alpenglow avec ses requêtes dans la barre latérale, List products ouverte et sa réponse JSON à côté',
  },
  ja: {
    title: 'Echolot ドキュメント',
    description: 'HTTP、GraphQL、gRPC、WebSocket、Socket.IO、MQTT、MCP に対応するネイティブ Mac 用 API クライアント、Echolot の使い方。',
    lead: 'HTTP、GraphQL、gRPC、WebSocket、Socket.IO、MQTT、MCP に対応するネイティブ Mac 用 API クライアント、Echolot の使い方です。直接ダウンロード版と Mac App Store 版、コマンドラインツール、CI を扱います。',
    read: 'ドキュメントを読む',
    demo: 'デモ API を試す',
    shotAlt: 'Echolot のウインドウ: サイドバーにリクエストが並ぶ Alpenglow サンプルワークスペース、開いている List products と、その横の JSON レスポンス',
  },
  ko: {
    title: 'Echolot 문서',
    description: 'HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, MCP를 지원하는 네이티브 Mac API 클라이언트 Echolot 사용법.',
    lead: 'HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, MCP를 지원하는 네이티브 Mac API 클라이언트 Echolot 사용법입니다. 직접 다운로드 버전과 Mac App Store 버전, 명령줄 도구, CI를 다룹니다.',
    read: '문서 읽기',
    demo: '데모 API 사용해 보기',
    shotAlt: 'Echolot 창: 사이드바에 요청이 보이는 Alpenglow 예제 작업 공간, 열려 있는 List products와 그 옆의 JSON 응답',
  },
  ru: {
    title: 'Документация Echolot',
    description: 'Как пользоваться Echolot, нативным клиентом API для Mac: HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT и MCP.',
    lead: 'Как пользоваться Echolot, нативным клиентом API для Mac: HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT и MCP. Версия для прямой загрузки и версия из Mac App Store, инструмент командной строки и CI.',
    read: 'Читать документацию',
    demo: 'Попробовать демо-API',
    shotAlt: 'Окно Echolot: учебное рабочее пространство Alpenglow с запросами на боковой панели, открытый запрос List products и его JSON-ответ рядом',
  },
  zh: {
    title: 'Echolot 文档',
    description: '如何使用 Echolot：支持 HTTP、GraphQL、gRPC、WebSocket、Socket.IO、MQTT 和 MCP 的原生 Mac API 客户端。',
    lead: '如何使用 Echolot：支持 HTTP、GraphQL、gRPC、WebSocket、Socket.IO、MQTT 和 MCP 的原生 Mac API 客户端。涵盖直接下载版和 Mac App Store 版、命令行工具与 CI。',
    read: '阅读文档',
    demo: '试用演示 API',
    shotAlt: 'Echolot 的窗口：Alpenglow 示例工作区，边栏里是它的请求，打开的是 List products，旁边是它的 JSON 响应',
  },
};
