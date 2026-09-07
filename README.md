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
- interface pensada para tablet

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

## Publicação

O projeto pode ser publicado diretamente com GitHub Pages a partir da branch `main` e da pasta raiz `/`.

## Nota sobre dados

Os dados são guardados localmente no browser/dispositivo. Não existe ainda sincronização entre dispositivos.
