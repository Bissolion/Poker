# Mesa de Treino

Texas Hold'em No-Limit contra 5 bots com estilos diferentes, com um coach que explica cada decisão. Cash ou torneio, mesa de 6 ou heads-up, três níveis de dificuldade. Roda no navegador, sem servidor e sem dependências, e pode ser instalado no celular para jogar sem internet.

## Como jogar

- **No computador:** abra `mesa-de-treino.html` no navegador.
- **No celular (app instalável):** publique a pasta `docs/` no GitHub Pages (veja abaixo), abra o endereço no celular e use **Adicionar à tela inicial**.

## O que tem

- **Formatos:** cash (blinds 5/10, recompra) ou torneio (1.500 fichas, blinds que sobem a cada 5, 8 ou 12 mãos, eliminação e colocação final).
- **Mesa:** 6 jogadores ou heads-up contra o bot que você escolher. As posições, a ordem de ação e as faixas do coach se ajustam ao número de jogadores.
- **Dificuldade:** Iniciante (bots erram e pagam no automático), Normal e Difícil (continuation bet, leitura das suas tendências, blefes ajustados contra quem desiste demais).
- **Bots com personalidade:** Marta (sólida), Diego (agressivo), Seu Zé (paga tudo), Helena (cautelosa) e Rafa (equilibrado).
- **Leitura da mão e da mesa, sempre visível (sem precisar do coach):**
  - *Canto esquerdo:* antes do flop, a força da mão com a conta da fórmula de Chen; depois do flop, a sua combinação (par, dois pares, trinca…) e seus projetos (flush draw, straight draw, gutshot) com os outs. As cartas que formam a combinação ficam com contorno dourado na mesa.
  - *Canto direito:* o que a mesa permite (flush, sequência, full house, draws possíveis), se ela é seca, molhada, perigosa ou pareada, e a melhor mão possível.
  - Um toque em cada quadro abre a explicação completa. Dá para esconder em Jogo → Preferências.
- **Coach ao vivo:** força da mão pré-flop por posição, push/fold com 12 BB ou menos, equity por simulação Monte Carlo, pot odds, projetos e outs (regra do 2 e 4), com sugestão de jogada.
- **Leitura dos rivais:** a equity estreita a faixa de cada rival pela ação pré-flop e pelas apostas e calls depois do flop (com margem para blefes).
- **Feedback por decisão:** cada jogada recebe nota (Boa / Ok / Erro) e explicação; apostas e aumentos também recebem nota de tamanho.
- **All-in:** quando ninguém mais pode agir, as cartas são abertas e o board é revelado rua por rua, com a chance de cada jogador.
- **Ritmo e som:** quatro velocidades para os bots e sons opcionais (gerados no navegador, sem arquivos).
- **Coach depois do flop:** continuation bet, tamanho da aposta pela textura da mesa, odds implícitas e reversas, defesa mínima no river e o que a aposta do rival representa (a faixa dele dividida em categorias).
- **Faixas modernas:** abertura por posição, defesa contra abertura e contra 3-bet com frequências (jogadas mistas), e push/fold calculado por equilíbrio para stacks curtos.
- **Torneio com prêmios:** 65/35 ou 50/30/20 em pontos (sem dinheiro). Perto da bolha, o coach usa o ICM para dizer quanto de equity a mais um all-in exige.
- **Idiomas:** português e inglês (Jogo → Preferências). Começa no idioma do aparelho.
- **Estudo:**
  - *Mãos:* replay das últimas 25 mãos passo a passo, com as notas do coach, as cartas de todos e atalho para o próximo erro.
  - *Faixas:* grade 13×13 para abrir, contra abertura, contra 3-bet e all-in curto, em 6 jogadores ou heads-up.
  - *Treinos:* séries de 10 decisões montadas no ponto da dúvida (abrir, defender o big blind, push/fold, projetos, continuation bet, call no river), que ficam mais difíceis conforme você acerta.
  - *Quiz:* pot odds, outs, qual mão ganha, abrir ou desistir, textura, nuts, combinações e defesa mínima.
  - *Sessão:* seus vazamentos (só quando o desvio é estatisticamente claro), VPIP por posição, estatísticas de jogo, esta sessão contra a anterior, torneios e histórico em CSV.

## Estrutura

| Pasta / arquivo | Conteúdo |
| --- | --- |
| `engine/` | Motor em módulos: cartas, avaliador, equity, mesa, bots, coach pré e pós-flop, faixas, vazamentos, treinos, quiz e ICM (sem DOM, roda no Node) |
| `ui/` | Interface: `head.html`, `corpo.html`, `estilo.css` e os scripts da tela |
| `i18n/en.json` | Textos em inglês. O português é o próprio texto do código (`` tx`...` ``) |
| `build.js` | Junta os módulos e gera `mesa-de-treino.html` (página única) e `docs/` (app instalável) |
| `docs/` | Versão PWA: `index.html`, manifest, service worker e ícones |
| `tools/` | `gerar-dados.js` (tabelas de equity e push/fold), `i18n-chaves.js` (lista os textos a traduzir), `make-icons.py` |
| `tests/` | `motor.test.js` (regras, coach, faixas, vazamentos, treinos, ICM), `idiomas.test.js` e `fumaca.test.js` (navegador, nos dois idiomas) |

## Desenvolvimento

Precisa só de Node.js. O CI do GitHub roda os testes a cada push.

```sh
npm test               # build + testes do motor e dos idiomas
npm run fumaca         # abre o jogo no Chromium (Playwright) em português e em inglês
node tools/i18n-chaves.js   # mostra os textos novos ainda sem tradução
```

Texto novo na interface ou no coach: escreva em português dentro de `` tx`...` `` (ou direto no HTML) e acrescente a tradução em `i18n/en.json`. O teste de idiomas falha se faltar alguma.

Os ícones já estão em `docs/icons/`. Para refazê-los: `python3 tools/make-icons.py`.

## Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages** e escolha **Source: GitHub Actions**.
2. Na aba **Actions**, rode o workflow **Publicar** (por enquanto ele só roda manualmente).
3. O app fica em `https://bissolion.github.io/poker/`.

O GitHub Pages em repositório privado exige um plano pago (Pro, Team ou Enterprise), e o site publicado fica público. Sem plano pago, é preciso tornar o repositório público.
