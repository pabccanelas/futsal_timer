# Futsal Timer

Aplicação web para controlo de tempos de utilização de jogadores de futsal durante o jogo.

## Funcionalidades atuais

- uma equipa acompanhada com tempos individuais
- cinco inicial, banco e substituições
- relógio corrido e cronometrado
- timeout de 60 segundos
- separação entre 1.ª parte, intervalo e 2.ª parte
- registo de ações coletivas das duas equipas
- exportação CSV com tempos por parte e totais
- armazenamento local no browser (`localStorage`)
- partilha de equipas por QR Code ou link, sem conta nem servidor
- importação de equipas noutro dispositivo
- interface pensada para tablet
- PWA instalável no ecrã principal
- funcionamento offline depois da primeira visita online

## Estrutura

- `index.html` — interface principal
- `styles.css` — estilos
- `core.js` — estado e utilitários
- `teams.js` — equipas e configuração do jogo
- `timing.js` — relógio, tempos e timeout
- `match.js` — interface e controlos do jogo
- `events.js` — eventos
- `export.js` — persistência e exportações CSV
- `history.js` — histórico e arranque da aplicação
- `manifest.webmanifest` — configuração da PWA
- `service-worker.js` — cache e funcionamento offline
- `icons/` — ícones da aplicação

## Publicação

O projeto pode ser publicado diretamente com GitHub Pages a partir da branch `main` e da pasta raiz `/`.

## Nota sobre dados

Os dados são guardados localmente no browser/dispositivo. Não existe sincronização automática entre dispositivos.

As equipas podem ser transferidas por QR Code ou link. O conteúdo partilhado inclui apenas o nome da equipa e a lista de jogadores (número, nome e posição). Os dados são codificados no próprio link e não são enviados para um backend da aplicação.

A geração local de QR Code usa a biblioteca open-source QRCode.js (MIT), incluída em `vendor/`.

## Instalação como aplicação

Depois de publicar com GitHub Pages, abre a aplicação uma vez com internet.

- Android/Chrome: usa **Instalar aplicação** ou **Adicionar ao ecrã principal**.
- iPad/iPhone/Safari: usa **Partilhar → Adicionar ao ecrã principal**.

O service worker guarda a aplicação para utilização offline. Os dados dos jogos continuam a ser guardados localmente no dispositivo.
