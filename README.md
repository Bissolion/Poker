# Mesa de Treino

Texas Hold'em No-Limit (6 jogadores, blinds 5/10) contra 5 bots com estilos diferentes, com um coach que explica cada decisão. Roda no navegador, sem servidor e sem dependências.

## Como jogar

Abra `mesa-de-treino.html` no navegador.

## O que tem

- **Bots com personalidade:** Marta (sólida), Diego (agressivo), Seu Zé (paga tudo), Helena (cautelosa) e Rafa (equilibrado).
- **Coach ao vivo:** força da mão pré-flop por posição, equity por simulação Monte Carlo, pot odds, projetos e outs (regra do 2 e 4), com sugestão de jogada.
- **Leitura dos rivais:** a equity estreita a faixa de cada rival pela ação pré-flop e pelas apostas e calls depois do flop (com margem para blefes).
- **Feedback por decisão:** cada jogada recebe nota (Boa / Ok / Erro) e explicação; apostas e aumentos também recebem nota de tamanho.
- **Estudo:**
  - *Mãos:* replay das últimas 25 mãos passo a passo, com as notas do coach, opção de ver as cartas de todos e atalho para o próximo erro.
  - *Faixas:* grade 13×13 de mãos iniciais por posição e situação (abrir, contra aumento, contra re-aumento), com a mesma regra usada pelo coach.
  - *Sessão:* saldo, VPIP, PFR e últimas decisões, salvos no navegador.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `engine.js` | Regras, avaliador de mãos, equity, bots e coach (sem DOM, roda no Node) |
| `src.html` | Interface da mesa |
| `build.js` | Junta motor e interface em `mesa-de-treino.html` |
| `test.js` | Testes: avaliador, side pots, empates, all-in curto, leitura pós-flop, tamanho de aposta, gravação de mãos e 1.500 mãos simuladas |

## Desenvolvimento

Precisa só de Node.js.

```sh
npm test        # roda os testes
npm run build   # gera mesa-de-treino.html depois de editar engine.js ou src.html
```

## Próximos passos

- Modos de treino: quiz de pot odds, outs e faixas
- Níveis de dificuldade, modo heads-up e modo torneio
- Animação do board em all-ins, ritmo ajustável e PWA para jogar offline
