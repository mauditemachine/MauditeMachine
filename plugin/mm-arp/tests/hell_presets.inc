// GENERE par tests/hell-presets-gen.mjs depuis src/v4/plugin/arp/hell.ts (HELL_PRESETS) : ne pas editer.
enum HellPresetKey { hp_xHellSync, hp_xHellTime, hp_xHellFb, hp_xHellCross, hp_xHellRange, hp_xHellShift, hp_xHellUpDown, hp_xHellSpread, hp_xHellPhase, hp_xHellAntiRefl, hp_xHellSmear, hp_xHellHp, hp_xHellLp, hp_xHellLfoShape, hp_xHellLfoSync, hp_xHellLfoRate, hp_xHellLfoAmt, hp_xHellLfoStereo, hp_xHellLfoTarget, hp_xHellLfoDepth, hp_xHellTone, hp_COUNT };
struct HellPresetRef { const char* name; const char* desc; double v[hp_COUNT]; };
static const HellPresetRef kHellPresets[24] = {
    {"SLOW ASCENT", "Each repeat climbs a little: a slow rising spiral", {0.6923076923076923, 0.5, 0.72, 0, 0, 0.7987144103508876, 1, 0.2, 0, 0, 0, 0, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"BARBER DOWN", "Endless falling staircase on sixteenths", {0.23076923076923078, 0.5, 0.88, 0, 0, 0.27807991240797025, 1, 0, 0, 0, 0, 0, 0.7052473130740612, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"TIN CAN", "Short metallic box, both sidebands", {0, 0.2137931110817234, 0.82, 0, 0, 0.6128496000712608, 0.5, 0.5, 0, 0, 0, 0.3381751875681663, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"HALO", "Bright shimmer, a fifth-ish up each pass", {0.5384615384615384, 0.5, 0.7, 0, 0.3333333333333333, 0.8066949445818912, 1, 0.35, 0, 0, 0.25, 0.28387831319289425, 1, 0, 0, 0.43575558719297985, 0.61, 0, 0, 0, 0.5}},
    {"ABYSS", "Falls deep and dark, repeat after repeat", {0.7692307692307693, 0.5, 0.9, 0, 0, 0.04119035613272437, 1, 0, 0, 1, 0, 0, 0.38322641294768445, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"CROOKED PONG", "Left climbs, right falls: a bent ping-pong", {0.46153846153846156, 0.5, 0.6, 1, 0, 0.6750952335163879, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"INFERNAL DUB", "Dub echo that drifts out of tune", {0.7692307692307693, 0.5, 0.85, 0, 0, 0.40495238324180605, 1, 0, 0, 0, 0, 0.3672694582890028, 0.49513989747336457, 0, 0, 0.40641800807190165, 0.635, 0, 0, 0, 0.5}},
    {"SIREN", "The shift swings with a slow LFO", {0.38461538461538464, 0.5, 0.65, 0, 0, 0.8609600437960149, 1, 0.5, 0, 0, 0, 0, 1, 0, 0, 0.48204685253034196, 0.895, 0, 0, 0, 0.5}},
    {"GHOST CHOIR", "Barely shifted, both ways: a ghostly chorus", {0, 0.48241489792196424, 0.78, 0, 0, 0.515, 0.5, 0, 0, 0, 0.4, 0, 1, 0, 0, 0.258976573734829, 0.5700000000000001, 0, 0, 0, 0.5}},
    {"BROKEN RADIO", "Far shift, thin and wide", {0, 0.36672579134208466, 0.7, 0, 0.3333333333333333, 0.8661738239237102, 0.5, 0.7, 0, 0, 0, 0.6710334273172837, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"DEEP STAIRS", "Half notes stepping down", {0.8461538461538461, 0.5, 0.8, 0, 0, 0.14908840414435187, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"INIT", "Plain delay, no shift", {0.5384615384615384, 0.5, 0.5, 0, 0, 0.5, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"SULFUR RAIN", "Smeared falling drops, each one a little lower", {0.3076923076923077, 0.5, 0.82, 0, 0, 0.24485714972541817, 1, 0, 0, 1, 0.7, 0, 0.6283911085841041, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"CHAPEL OF RUST", "A diffused halo whose phase turns slowly", {0, 0.5561585959452309, 0.86, 0, 0, 0.5, 1, 0, 0, 0, 0.85, 0.3924720619434383, 1, 0, 0, 0.22307027879551292, 1, 1, 0.3333333333333333, 0, 0.5}},
    {"MOLTEN TAPE", "A melting tape echo: the delay time wobbles", {0.46153846153846156, 0.5, 0.7, 0, 0, 0.515, 1, 0, 0, 0, 0, 0.28387831319289425, 0.6045600402826351, 0, 0, 0.5720952963055016, 0.675, 0, 1, 0, 0.5}},
    {"CROSSFIRE", "Crossed feedback, opposite shifts: the echo bounces and bends", {0.5384615384615384, 0.5, 0.78, 1, 0, 0.7598571497254181, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0.48204685253034196, 0.5, 1, 0, 0, 0.5}},
    {"PURGATORY LOOP", "The shift locked to the tempo: a rhythmic barber pole", {0.6923076923076923, 0.5, 0.9, 0, 0.6666666666666666, 0.7575000000000001, 1, 0, 0, 0, 0.3, 0, 0.7500247981630549, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"DEVIL TRILL", "A square LFO flips the shift on the beat", {0.23076923076923078, 0.5, 0.6, 0, 0, 0.5, 1, 0, 0, 0, 0, 0, 1, 0.6666666666666666, 1, 0.75, 0.775, 1, 0, 0, 0.5}},
    {"BLACK MASS", "Low ring modulation, a dark bell under every note", {0, 0.6594787781042036, 0.55, 0, 0.3333333333333333, 0.7021363710935329, 0.5, 0, 0, 0, 0, 0, 0.4744214481117836, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"EMBER DRIFT", "Random LFO on the low-pass: embers that flicker", {0.38461538461538464, 0.5, 0.75, 0, 0, 0.6418724708338357, 1, 0, 0, 0, 0.35, 0, 0.5141990233379701, 1, 1, 0.75, 0.9, 0, 0.6666666666666666, 0, 0.5}},
    {"NOTE GHOST", "The shift follows the played note: a harmonic shadow", {0.5384615384615384, 0.5, 0.66, 0, 1, 0.806, 1, 0, 0, 0, 0, 0.30376396902828084, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"PHASE MONK", "No shift, only the phase swinging: a slow hollow sweep", {0, 0.29905200225092193, 0.62, 0, 0, 0.5, 1, 0, 0, 0, 0, 0, 1, 0.3333333333333333, 0, 0.3242204477952234, 1, 1, 0.3333333333333333, 0, 0.5}},
    {"TEMPO SPIRAL", "Upward spiral in tempo, crossed and smeared", {0.46153846153846156, 0.5, 0.85, 1, 0.6666666666666666, 0.8652777777777778, 1, 0, 0, 1, 0.5, 0, 1, 0, 0, 0.48204685253034196, 0.5, 0, 0, 0, 0.5}},
    {"HELLFIRE SWELL", "A rising saw opens and closes the loop", {0.7692307692307693, 0.5, 0.8, 0, 0, 0.18586481027962698, 1, 0, 0, 1, 0, 0, 0.42663935585985513, 0.3333333333333333, 1, 0.375, 0.04999999999999999, 0, 0.6666666666666666, 0, 0.5}},
};
