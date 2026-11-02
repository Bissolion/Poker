# Mesa de Treino

Texas Hold'em No-Limit (6 jogadores, blinds 5/10) contra 5 bots com estilos diferentes, com um coach que explica cada decisão. Roda no navegador, sem servidor e sem dependências.

## Como jogar

Abra `mesa-de-treino.html` no navegador.

## O que tem

- **Bots com personalidade:** Marta (sólida), Diego (agressivo), Seu Zé (paga tudo), Helena (cautelosa) e Rafa (equilibrado).
- **Coach ao vivo:** força da mão pré-flop por posição, equity por simulação Monte Carlo, pot odds, projetos e outs (regra do 2 e 4), com sugestão de jogada.
- **Feedback por decisão:** cada jogada recebe nota (Boa / Ok / Erro) e explicação.
- **Revisão da sessão:** saldo, VPIP, PFR e últimas decisões, salvos no navegador.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `engine.js` | Regras, avaliador de mãos, equity, bots e coach (sem DOM, roda no Node) |
| `src.html` | Interface da mesa |
| `build.js` | Junta motor e interface em `mesa-de-treino.html` |
| `test.js` | Testes: avaliador, side pots, empates, all-in curto e 1.500 mãos simuladas |

## Desenvolvimento

Precisa só de Node.js.

```sh
npm test        # roda os testes
npm run build   # gera mesa-de-treino.html depois de editar engine.js ou src.html
```

## Próximos passos

- Replay das mãos anteriores com os erros marcados
- Faixas dos rivais atualizadas pelas apostas depois do flop
- Modos de treino: quiz de pot odds e de faixas
