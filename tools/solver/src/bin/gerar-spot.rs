// Resolve um flop de um cenário qualquer (pote, stack, quem foi o agressor) e grava as estratégias:
// a aposta do agressor no flop, a defesa contra cada tamanho e (opcional) a segunda bala no turn.
// Uso: gerar-spot <faixa OOP> <faixa IP> <flop> <precisão %> <pote> <stack efetivo> <oop|ip> <turn 0|1>
use postflop_solver::*;
use std::fmt::Write;

fn node_json(game: &mut PostFlopGame, player: usize) -> String {
    game.cache_normalized_weights();
    let acts = game.available_actions();
    let s = game.strategy();
    let nw = game.normalized_weights(player);
    let n = game.private_cards(player).len();
    let mut out = String::from("{\"actions\":[");
    for (i, a) in acts.iter().enumerate() { if i > 0 { out.push(','); } write!(out, "\"{:?}\"", a).unwrap(); }
    out.push_str("],\"s\":[");
    for (i, x) in s.iter().enumerate() { if i > 0 { out.push(','); } write!(out, "{:.2}", x).unwrap(); }
    out.push_str("],\"nw\":[");
    for (i, x) in nw.iter().enumerate() { if i > 0 { out.push(','); } write!(out, "{:.3}", x).unwrap(); }
    write!(out, "],\"n\":{}}}", n).unwrap();
    out
}
fn find(acts: &[Action], f: impl Fn(&Action) -> bool) -> Option<usize> { acts.iter().position(|a| f(a)) }

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let card_config = CardConfig { range: [a[1].parse().unwrap(), a[2].parse().unwrap()], flop: flop_from_str(&a[3]).unwrap(), turn: NOT_DEALT, river: NOT_DEALT };
    let acc: f32 = a[4].parse().unwrap();
    let pot: i32 = a[5].parse().unwrap();
    let stack: i32 = a[6].parse().unwrap();
    let aggr_ip = a[7] == "ip";
    let want_turn = a.get(8).map(|x| x == "1").unwrap_or(false);
    let small_big = BetSizeOptions::try_from(("33%, 75%", "3x")).unwrap();
    let one = BetSizeOptions::try_from(("33%", "3x")).unwrap();
    let later = BetSizeOptions::try_from(("75%", "3x")).unwrap();
    let river = BetSizeOptions::try_from(("75%", "")).unwrap();
    // o agressor tem dois tamanhos no flop; o outro, um
    let flop_sizes = if aggr_ip { [one, small_big] } else { [small_big, one] };
    let tree_config = TreeConfig {
        initial_state: BoardState::Flop, starting_pot: pot, effective_stack: stack, rake_rate: 0.0, rake_cap: 0.0,
        flop_bet_sizes: flop_sizes, turn_bet_sizes: [later.clone(), later], river_bet_sizes: [river.clone(), river],
        turn_donk_sizes: None, river_donk_sizes: None, add_allin_threshold: 1.5, force_allin_threshold: 0.15, merging_threshold: 0.1,
    };
    let tree = ActionTree::new(tree_config).unwrap();
    let mut game = PostFlopGame::with_config(card_config, tree).unwrap();
    game.allocate_memory(true);
    let expl = solve(&mut game, 400, pot as f32 * acc / 100.0, false);
    let mut out = String::new();
    write!(out, "{{\"flop\":\"{}\",\"pot\":{},\"stack\":{},\"aggr\":\"{}\",\"expl\":{:.3}", a[3], pot, stack, a[7], expl / pot as f32 * 100.0).unwrap();
    for p in 0..2 {
        let h = holes_to_strings(game.private_cards(p)).unwrap();
        write!(out, ",\"hands{}\":[{}]", p, h.iter().map(|x| format!("\"{}\"", x)).collect::<Vec<_>>().join(",")).unwrap();
    }
    let (ag, df) = if aggr_ip { (1, 0) } else { (0, 1) };
    let mut base: Vec<usize> = vec![];
    if aggr_ip { base.push(0); } // o big blind passa
    game.apply_history(&base);
    write!(out, ",\"cbet\":{}", node_json(&mut game, ag)).unwrap();
    let acts = game.available_actions();
    out.push_str(",\"def\":[");
    let mut first = true;
    for (i, act) in acts.iter().enumerate() {
        if let Action::Bet(amt) | Action::AllIn(amt) = act {
            let mut h = base.clone(); h.push(i); game.apply_history(&h);
            if !first { out.push(','); } first = false;
            write!(out, "{{\"bet\":{},\"r\":{}}}", amt, node_json(&mut game, df)).unwrap();
        }
    }
    out.push(']');
    if want_turn {
        // o agressor aposta grande no flop, o outro paga; no turn o defensor passa (se for OOP) e o agressor decide
        game.apply_history(&base);
        let acts = game.available_actions();
        let big = acts.iter().enumerate().filter_map(|(i, x)| if let Action::Bet(v) = x { Some((i, *v)) } else { None }).max_by_key(|x| x.1).map(|x| x.0).unwrap();
        let mut h = base.clone(); h.push(big); game.apply_history(&h);
        let call = find(&game.available_actions(), |x| matches!(x, Action::Call)).unwrap();
        h.push(call); game.apply_history(&h);
        let mask = game.possible_cards();
        out.push_str(",\"turn\":[");
        let mut first = true;
        for c in 0..52u8 {
            if mask & (1u64 << c) == 0 { continue; }
            let mut t = h.clone(); t.push(c as usize);
            game.apply_history(&t);
            if aggr_ip { let chk = find(&game.available_actions(), |x| matches!(x, Action::Check)).unwrap(); t.push(chk); game.apply_history(&t); }
            if !first { out.push(','); } first = false;
            write!(out, "{{\"card\":\"{}\",\"r\":{}}}", card_to_string(c).unwrap(), node_json(&mut game, ag)).unwrap();
        }
        out.push(']');
    }
    out.push('}');
    println!("{}", out);
}
