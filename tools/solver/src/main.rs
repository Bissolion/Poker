// Resolve um flop do pote de abertura BTN x BB (100 BB) e grava as estratégias das primeiras decisões em JSON.
// Uso: gerar-posflop <faixa OOP> <faixa IP> <flop ex. Td9d6h> <precisão em % do pote>
use postflop_solver::*;
use std::fmt::Write;

fn strat_json(game: &PostFlopGame, player: usize) -> String {
    let acts = game.available_actions();
    let s = game.strategy();
    let n = game.private_cards(player).len();
    let mut out = String::from("{\"actions\":[");
    for (i, a) in acts.iter().enumerate() { if i > 0 { out.push(','); } write!(out, "\"{:?}\"", a).unwrap(); }
    out.push_str("],\"s\":[");
    for (i, x) in s.iter().enumerate() { if i > 0 { out.push(','); } write!(out, "{:.3}", x).unwrap(); }
    write!(out, "],\"n\":{}}}", n).unwrap();
    out
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let card_config = CardConfig {
        range: [a[1].parse().unwrap(), a[2].parse().unwrap()],
        flop: flop_from_str(&a[3]).unwrap(),
        turn: NOT_DEALT,
        river: NOT_DEALT,
    };
    let acc: f32 = a[4].parse().unwrap();
    let oop_flop = BetSizeOptions::try_from(("33%", "3x")).unwrap();
    let ip_flop = BetSizeOptions::try_from(("33%, 75%", "3x")).unwrap();
    let later = BetSizeOptions::try_from(("75%", "3x")).unwrap();
    let river = BetSizeOptions::try_from(("75%", "")).unwrap();
    let tree_config = TreeConfig {
        initial_state: BoardState::Flop,
        starting_pot: 55,
        effective_stack: 975,
        rake_rate: 0.0,
        rake_cap: 0.0,
        flop_bet_sizes: [oop_flop, ip_flop],
        turn_bet_sizes: [later.clone(), later],
        river_bet_sizes: [river.clone(), river],
        turn_donk_sizes: None,
        river_donk_sizes: None,
        add_allin_threshold: 1.5,
        force_allin_threshold: 0.15,
        merging_threshold: 0.1,
    };
    let tree = ActionTree::new(tree_config).unwrap();
    let mut game = PostFlopGame::with_config(card_config, tree).unwrap();
    game.allocate_memory(true);
    let expl = solve(&mut game, 400, 55.0 * acc / 100.0, false);
    game.cache_normalized_weights();
    let mut out = String::new();
    write!(out, "{{\"flop\":\"{}\",\"expl\":{:.3}", a[3], expl / 55.0 * 100.0).unwrap();
    for p in 0..2 {
        let h = holes_to_strings(game.private_cards(p)).unwrap();
        let w = game.initial_weights(p);
        write!(out, ",\"hands{}\":[{}],\"w{}\":[{}]", p, h.iter().map(|x| format!("\"{}\"", x)).collect::<Vec<_>>().join(","), p,
            w.iter().map(|x| format!("{:.2}", x)).collect::<Vec<_>>().join(",")).unwrap();
    }
    // raiz: OOP (big blind) age primeiro
    write!(out, ",\"oop_root\":{}", strat_json(&game, 0)).unwrap();
    // OOP passa → IP (botão) decide
    game.play(0);
    write!(out, ",\"ip_vs_check\":{}", strat_json(&game, 1)).unwrap();
    // IP aposta cada tamanho → OOP responde
    let acts = game.available_actions();
    out.push_str(",\"oop_vs_bet\":[");
    let mut first = true;
    for (i, act) in acts.iter().enumerate() {
        if let Action::Bet(_) | Action::AllIn(_) = act {
            game.play(i);
            if !first { out.push(','); } first = false;
            write!(out, "{{\"bet\":\"{:?}\",\"r\":{}}}", act, strat_json(&game, 0)).unwrap();
            game.back_to_root(); game.play(0);
        }
    }
    out.push_str("]}");
    println!("{}", out);
}
