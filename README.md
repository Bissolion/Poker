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
- **Estudo:**
  - *Mãos:* replay das últimas 25 mãos passo a passo, com as notas do coach, opção de ver as cartas de todos e atalho para o próximo erro.
  - *Faixas:* grade 13×13 de mãos iniciais por posição e situação, para 6 jogadores ou heads-up, com a mesma regra usada pelo coach.
  - *Quiz:* pot odds, contagem de outs e qual mão ganha, com explicação, placar por tipo e sequência de acertos.
  - *Sessão:* saldo no cash, VPIP, PFR, histórico de torneios e últimas decisões, salvos no navegador.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `engine.js` | Regras, avaliador de mãos, equity, bots, coach, torneio e quiz (sem DOM, roda no Node) |
| `src.html` | Interface da mesa |
| `build.js` | Gera `mesa-de-treino.html` (página única) e `docs/` (app instalável) |
| `docs/` | Versão PWA: `index.html`, `manifest.webmanifest`, `sw.js` (funciona offline) e ícones |
| `tools/make-icons.py` | Gera os ícones do app (Python + Pillow) |
| `test.js` | Testes: avaliador, side pots, heads-up, eliminação e torneio completo, dificuldade, push/fold, equity, quiz e 1.500 mãos simuladas |

## Desenvolvimento

Precisa só de Node.js.

```sh
npm test        # roda os testes
npm run build   # gera mesa-de-treino.html e docs/ depois de editar engine.js ou src.html
```

Os ícones já estão em `docs/icons/`. Para refazê-los: `python3 tools/make-icons.py`.

## Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main` e pasta `/docs`.
3. O app fica em `https://bissolion.github.io/poker/`.

O GitHub Pages em repositório privado exige um plano pago (Pro, Team ou Enterprise), e o site publicado fica público. Sem plano pago, é preciso tornar o repositório público.
