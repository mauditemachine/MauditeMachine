// GENERE par tests/extra-gen.mjs depuis extra-params.json : ne pas editer.
enum ExtraId { ex_xQuality, ex_xLfo1Dest2, ex_xLfo1Depth2, ex_xLfo2Rate, ex_xLfo2Shape, ex_xLfo2Dest, ex_xLfo2Depth, ex_xRevSize, ex_xRevTone, ex_xRevPre, ex_xWarmth, ex_xBass, ex_xAir, ex_xWidth, ex_xSwing, ex_xRing, ex_xFold, ex_xNoiseColor, ex_xUnison, ex_xHpf, ex_xComb, ex_xCombFb, ex_xPhMix, ex_xPhRate, ex_xPhDepth, ex_xPhFb, ex_xFlMix, ex_xFlRate, ex_xFlDepth, ex_xFlFb, ex_xPumpDepth, ex_xPumpRate, ex_xPumpShape, ex_xCrushBits, ex_xCrushRate, ex_xDlyMode, ex_xShimmer, ex_xM1Src, ex_xM1Dst, ex_xM1Amt, ex_xM2Src, ex_xM2Dst, ex_xM2Amt, ex_xM3Src, ex_xM3Dst, ex_xM3Amt, ex_xM4Src, ex_xM4Dst, ex_xM4Amt, ex_xM5Src, ex_xM5Dst, ex_xM5Amt, ex_xM6Src, ex_xM6Dst, ex_xM6Amt, ex_xVoiceMode, ex_xPbRange, ex_xFeedback, ex_xAmpMode, ex_xEqLow, ex_xEqMid, ex_xEqHigh, ex_xEqAir, ex_xDist, ex_xDistTone, ex_xHellMix, ex_xHellSync, ex_xHellTime, ex_xHellFb, ex_xHellShift, ex_xHellUpDown, ex_xHellSpread, ex_xHellLfoRate, ex_xHellLfoDepth, ex_xHellTone, ex_xSkyType, ex_xSkyDecay, ex_xSkyPre, ex_xSkyTone, ex_xSkyMod, ex_xSkyLow, ex_xSkyP1, ex_xSkyP2, ex_xSkyP3, ex_xSkyP4, ex_xSkyP5, ex_xHellCross, ex_xHellHp, ex_xHellLp, ex_xHellSmear, ex_xHellRange, ex_xHellPhase, ex_xHellAntiRefl, ex_xHellLfoShape, ex_xHellLfoSync, ex_xHellLfoAmt, ex_xHellLfoStereo, ex_xHellLfoTarget, ex_xDStyle, ex_xDPunish, ex_xDLow, ex_xDThump, ex_xDTone, ex_xDHigh, ex_xDSteep, ex_xDMix, ex_xDOut, ex_xDAuto, ex_xDMorph, ex_xDMorphTo, ex_xDDyn, ex_xDFb, ex_xDFbFreq, ex_xDBands, ex_xDXLo, ex_xDXHi, ex_xDB1Style, ex_xDB1Drive, ex_xDB1Mix, ex_xDB1Level, ex_xDB1Solo, ex_xDB1Byp, ex_xDB2Style, ex_xDB2Drive, ex_xDB2Mix, ex_xDB2Level, ex_xDB2Solo, ex_xDB2Byp, ex_xDB3Style, ex_xDB3Drive, ex_xDB3Mix, ex_xDB3Level, ex_xDB3Solo, ex_xDB3Byp, ex_xDEnvAmt, ex_xDEnvSpd, ex_xDLfoShape, ex_xDLfoRate, ex_xDLfoSync, ex_xDLfoAmt, ex_xDLfoTarget, ex_xDPreMode, ex_xDPreFreq, ex_xDPreReso, ex_xDPostMode, ex_xDPostFreq, ex_xDPostReso, ex_xDBox, ex_xDBoxSize, ex_xDBoxMix, ex_COUNT };
static const char* const kExSteps_xQuality[] = { "STD", "HQ" };
static const char* const kExSteps_xLfo1Dest2[] = { "OFF", "RES", "AMP", "PAN", "OSC 2 PITCH", "OSC MIX", "NOISE", "SUB", "DRIVE", "STACK", "ENV AMT" };
static const char* const kExSteps_xLfo2Rate[] = { "1/32", "1/16T", "1/16", "1/8T", "1/16.", "1/8", "1/4T", "1/8.", "1/4", "1/2", "1 BAR", "2 BAR", "4 BAR", "8 BAR" };
static const double kExBeats_xLfo2Rate[] = { 0.125, 0.16666666666666666, 0.25, 0.3333333333333333, 0.375, 0.5, 0.6666666666666666, 0.75, 1, 2, 4, 8, 16, 32 };
static const char* const kExSteps_xLfo2Shape[] = { "SINE", "TRI", "SAW", "RAMP", "SQR", "S&H", "RND" };
static const char* const kExSteps_xLfo2Dest[] = { "OFF", "WAVE", "CUTOFF", "FM", "PITCH", "RES", "AMP", "PAN", "OSC 2 PITCH", "OSC MIX", "NOISE", "SUB", "DRIVE", "STACK", "ENV AMT" };
static const char* const kExSteps_xUnison[] = { "OFF", "5", "7" };
static const char* const kExSteps_xPumpRate[] = { "1/8", "1/4", "1/2" };
static const char* const kExSteps_xDlyMode[] = { "PING PONG", "STEREO", "WIDE" };
static const char* const kExSteps_xM1Src[] = { "OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM" };
static const char* const kExSteps_xM1Dst[] = { "OFF", "PITCH", "OSC 2 PITCH", "WAVE", "FM", "OSC MIX", "NOISE", "SUB", "RING", "FOLD", "CUTOFF", "RES", "ENV AMT", "DRIVE", "AMP", "PAN", "STACK", "LFO 1 DEPTH", "LFO 2 DEPTH", "COMB" };
static const char* const kExSteps_xM2Src[] = { "OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM" };
static const char* const kExSteps_xM2Dst[] = { "OFF", "PITCH", "OSC 2 PITCH", "WAVE", "FM", "OSC MIX", "NOISE", "SUB", "RING", "FOLD", "CUTOFF", "RES", "ENV AMT", "DRIVE", "AMP", "PAN", "STACK", "LFO 1 DEPTH", "LFO 2 DEPTH", "COMB" };
static const char* const kExSteps_xM3Src[] = { "OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM" };
static const char* const kExSteps_xM3Dst[] = { "OFF", "PITCH", "OSC 2 PITCH", "WAVE", "FM", "OSC MIX", "NOISE", "SUB", "RING", "FOLD", "CUTOFF", "RES", "ENV AMT", "DRIVE", "AMP", "PAN", "STACK", "LFO 1 DEPTH", "LFO 2 DEPTH", "COMB" };
static const char* const kExSteps_xM4Src[] = { "OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM" };
static const char* const kExSteps_xM4Dst[] = { "OFF", "PITCH", "OSC 2 PITCH", "WAVE", "FM", "OSC MIX", "NOISE", "SUB", "RING", "FOLD", "CUTOFF", "RES", "ENV AMT", "DRIVE", "AMP", "PAN", "STACK", "LFO 1 DEPTH", "LFO 2 DEPTH", "COMB" };
static const char* const kExSteps_xM5Src[] = { "OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM" };
static const char* const kExSteps_xM5Dst[] = { "OFF", "PITCH", "OSC 2 PITCH", "WAVE", "FM", "OSC MIX", "NOISE", "SUB", "RING", "FOLD", "CUTOFF", "RES", "ENV AMT", "DRIVE", "AMP", "PAN", "STACK", "LFO 1 DEPTH", "LFO 2 DEPTH", "COMB" };
static const char* const kExSteps_xM6Src[] = { "OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM" };
static const char* const kExSteps_xM6Dst[] = { "OFF", "PITCH", "OSC 2 PITCH", "WAVE", "FM", "OSC MIX", "NOISE", "SUB", "RING", "FOLD", "CUTOFF", "RES", "ENV AMT", "DRIVE", "AMP", "PAN", "STACK", "LFO 1 DEPTH", "LFO 2 DEPTH", "COMB" };
static const char* const kExSteps_xVoiceMode[] = { "POLY", "MONO", "LEGATO" };
static const char* const kExSteps_xPbRange[] = { "1", "2", "3", "5", "7", "12", "24" };
static const char* const kExSteps_xAmpMode[] = { "CLEAN", "TRIODE", "PENTODE", "SATURATED" };
static const char* const kExSteps_xHellSync[] = { "FREE", "1/32", "1/16T", "1/16", "1/16.", "1/8T", "1/8", "1/8.", "1/4T", "1/4", "1/4.", "1/2", "1/2.", "1 BAR" };
static const char* const kExSteps_xSkyType[] = { "CLASSIC", "ROOM", "HALL", "PLATE", "SPRING", "SWELL", "BLOOM", "CLOUD", "CHORALE", "SHIMMER", "MAGNETO", "NONLINEAR", "REFLECTIONS" };
static const char* const kExSteps_xHellCross[] = { "OFF", "ON" };
static const char* const kExSteps_xHellRange[] = { "FINE", "WIDE", "SYNC", "MIDI" };
static const char* const kExSteps_xHellAntiRefl[] = { "OFF", "ON" };
static const char* const kExSteps_xHellLfoShape[] = { "SINE", "SAW", "SQUARE", "RANDOM" };
static const char* const kExSteps_xHellLfoSync[] = { "OFF", "ON" };
static const char* const kExSteps_xHellLfoStereo[] = { "OFF", "ON" };
static const char* const kExSteps_xHellLfoTarget[] = { "FREQ", "PHASE", "LOW-PASS", "DELAY" };
static const char* const kExSteps_xDStyle[] = { "MM", "A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH" };
static const char* const kExSteps_xDPunish[] = { "OFF", "ON" };
static const char* const kExSteps_xDThump[] = { "OFF", "ON" };
static const char* const kExSteps_xDSteep[] = { "OFF", "ON" };
static const char* const kExSteps_xDAuto[] = { "OFF", "ON" };
static const char* const kExSteps_xDMorphTo[] = { "A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH" };
static const char* const kExSteps_xDBands[] = { "1", "2", "3" };
static const char* const kExSteps_xDB1Style[] = { "MAIN", "A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH" };
static const char* const kExSteps_xDB1Solo[] = { "OFF", "ON" };
static const char* const kExSteps_xDB1Byp[] = { "OFF", "ON" };
static const char* const kExSteps_xDB2Style[] = { "MAIN", "A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH" };
static const char* const kExSteps_xDB2Solo[] = { "OFF", "ON" };
static const char* const kExSteps_xDB2Byp[] = { "OFF", "ON" };
static const char* const kExSteps_xDB3Style[] = { "MAIN", "A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH" };
static const char* const kExSteps_xDB3Solo[] = { "OFF", "ON" };
static const char* const kExSteps_xDB3Byp[] = { "OFF", "ON" };
static const char* const kExSteps_xDLfoShape[] = { "SINE", "TRI", "SAW", "SQUARE", "RANDOM" };
static const char* const kExSteps_xDLfoSync[] = { "FREE", "SYNC" };
static const char* const kExSteps_xDLfoTarget[] = { "DRIVE", "MORPH", "TONE", "PRE", "POST", "MIX" };
static const char* const kExSteps_xDPreMode[] = { "OFF", "LP", "BP", "HP", "PEAK" };
static const char* const kExSteps_xDPostMode[] = { "OFF", "LP", "BP", "HP", "PEAK" };
static const char* const kExSteps_xDBox[] = { "OFF", "SMALL", "COMBO", "STACK", "RADIO" };
static const ExtraDef kExtraDefs[ex_COUNT] = {
  { "xQuality", "QUALITY", "engine", 1, 2, kExSteps_xQuality },
  { "xLfo1Dest2", "TARGET 2", "lfo1", 0, 11, kExSteps_xLfo1Dest2 },
  { "xLfo1Depth2", "DEPTH 2", "lfo1", 0.5, 0, nullptr },
  { "xLfo2Rate", "SPEED", "lfo2", 0.6153846153846154, 14, kExSteps_xLfo2Rate },
  { "xLfo2Shape", "SHAPE", "lfo2", 0, 7, kExSteps_xLfo2Shape },
  { "xLfo2Dest", "TARGET", "lfo2", 0, 15, kExSteps_xLfo2Dest },
  { "xLfo2Depth", "DEPTH", "lfo2", 0.5, 0, nullptr },
  { "xRevSize", "SIZE", "reverb", 0.5, 0, nullptr },
  { "xRevTone", "TONE", "reverb", 0.5, 0, nullptr },
  { "xRevPre", "PRE DELAY", "reverb", 0.2, 0, nullptr },
  { "xWarmth", "WARMTH", "master", 0, 0, nullptr },
  { "xBass", "BASS", "master", 0.5, 0, nullptr },
  { "xAir", "AIR", "master", 0.5, 0, nullptr },
  { "xWidth", "WIDTH", "master", 0.5, 0, nullptr },
  { "xSwing", "SWING", "seq", 0, 0, nullptr },
  { "xRing", "RING MOD", "osc", 0, 0, nullptr },
  { "xFold", "FOLD", "osc", 0, 0, nullptr },
  { "xNoiseColor", "NOISE COLOR", "osc", 0.5, 0, nullptr },
  { "xUnison", "UNISON", "osc", 0, 3, kExSteps_xUnison },
  { "xHpf", "HIGH PASS", "filter", 0, 0, nullptr },
  { "xComb", "COMB", "filter", 0, 0, nullptr },
  { "xCombFb", "COMB FB", "filter", 0.5, 0, nullptr },
  { "xPhMix", "PHASER", "phaser", 0, 0, nullptr },
  { "xPhRate", "RATE", "phaser", 0.3, 0, nullptr },
  { "xPhDepth", "DEPTH", "phaser", 0.6, 0, nullptr },
  { "xPhFb", "FEEDBACK", "phaser", 0.4, 0, nullptr },
  { "xFlMix", "FLANGER", "flanger", 0, 0, nullptr },
  { "xFlRate", "RATE", "flanger", 0.25, 0, nullptr },
  { "xFlDepth", "DEPTH", "flanger", 0.6, 0, nullptr },
  { "xFlFb", "FEEDBACK", "flanger", 0.5, 0, nullptr },
  { "xPumpDepth", "PUMP", "pump", 0, 0, nullptr },
  { "xPumpRate", "RATE", "pump", 0.5, 3, kExSteps_xPumpRate },
  { "xPumpShape", "RELEASE", "pump", 0.5, 0, nullptr },
  { "xCrushBits", "CRUSH", "crush", 0, 0, nullptr },
  { "xCrushRate", "DOWNSAMPLE", "crush", 0, 0, nullptr },
  { "xDlyMode", "DELAY MODE", "space", 0, 3, kExSteps_xDlyMode },
  { "xShimmer", "SHIMMER", "space", 0, 0, nullptr },
  { "xM1Src", "SOURCE 1", "matrix", 0, 12, kExSteps_xM1Src },
  { "xM1Dst", "DEST 1", "matrix", 0, 20, kExSteps_xM1Dst },
  { "xM1Amt", "AMOUNT 1", "matrix", 0.5, 0, nullptr },
  { "xM2Src", "SOURCE 2", "matrix", 0, 12, kExSteps_xM2Src },
  { "xM2Dst", "DEST 2", "matrix", 0, 20, kExSteps_xM2Dst },
  { "xM2Amt", "AMOUNT 2", "matrix", 0.5, 0, nullptr },
  { "xM3Src", "SOURCE 3", "matrix", 0, 12, kExSteps_xM3Src },
  { "xM3Dst", "DEST 3", "matrix", 0, 20, kExSteps_xM3Dst },
  { "xM3Amt", "AMOUNT 3", "matrix", 0.5, 0, nullptr },
  { "xM4Src", "SOURCE 4", "matrix", 0, 12, kExSteps_xM4Src },
  { "xM4Dst", "DEST 4", "matrix", 0, 20, kExSteps_xM4Dst },
  { "xM4Amt", "AMOUNT 4", "matrix", 0.5, 0, nullptr },
  { "xM5Src", "SOURCE 5", "matrix", 0, 12, kExSteps_xM5Src },
  { "xM5Dst", "DEST 5", "matrix", 0, 20, kExSteps_xM5Dst },
  { "xM5Amt", "AMOUNT 5", "matrix", 0.5, 0, nullptr },
  { "xM6Src", "SOURCE 6", "matrix", 0, 12, kExSteps_xM6Src },
  { "xM6Dst", "DEST 6", "matrix", 0, 20, kExSteps_xM6Dst },
  { "xM6Amt", "AMOUNT 6", "matrix", 0.5, 0, nullptr },
  { "xVoiceMode", "VOICE MODE", "voice", 0, 3, kExSteps_xVoiceMode },
  { "xPbRange", "BEND RANGE", "voice", 0.16666666666666666, 7, kExSteps_xPbRange },
  { "xFeedback", "FEEDBACK", "amp", 0, 0, nullptr },
  { "xAmpMode", "AMP MODE", "amp", 0, 4, kExSteps_xAmpMode },
  { "xEqLow", "LOW", "eq", 0.5, 0, nullptr },
  { "xEqMid", "MID", "eq", 0.5, 0, nullptr },
  { "xEqHigh", "HIGH", "eq", 0.5, 0, nullptr },
  { "xEqAir", "AIR BAND", "eq", 0.5, 0, nullptr },
  { "xDist", "OLD PEDAL", "dist", 0, 0, nullptr },
  { "xDistTone", "OLD PEDAL TONE", "dist", 0.5, 0, nullptr },
  { "xHellMix", "HELL", "hell", 0, 0, nullptr },
  { "xHellSync", "HELL TIME SYNC", "hell", 0.5384615384615384, 14, kExSteps_xHellSync },
  { "xHellTime", "HELL TIME", "hell", 0.5, 0, nullptr },
  { "xHellFb", "HELL FEEDBACK", "hell", 0.5, 0, nullptr },
  { "xHellShift", "HELL SHIFT", "hell", 0.5, 0, nullptr },
  { "xHellUpDown", "HELL UP/DOWN", "hell", 1, 0, nullptr },
  { "xHellSpread", "HELL SPREAD", "hell", 0, 0, nullptr },
  { "xHellLfoRate", "HELL LFO RATE", "hell", 0.4, 0, nullptr },
  { "xHellLfoDepth", "HELL LFO DEPTH", "hell", 0, 0, nullptr },
  { "xHellTone", "HELL TONE", "hell", 0.5, 0, nullptr },
  { "xSkyType", "REVERB TYPE", "sky", 0.16666666666666666, 13, kExSteps_xSkyType },
  { "xSkyDecay", "REVERB DECAY", "sky", 0.43, 0, nullptr },
  { "xSkyPre", "REVERB PRE-DELAY", "sky", 0.14, 0, nullptr },
  { "xSkyTone", "REVERB TONE", "sky", 0.5, 0, nullptr },
  { "xSkyMod", "REVERB MOD", "sky", 0.35, 0, nullptr },
  { "xSkyLow", "REVERB LOW END", "sky", 0.5, 0, nullptr },
  { "xSkyP1", "REVERB PARAM 1", "sky", 0.5, 0, nullptr },
  { "xSkyP2", "REVERB PARAM 2", "sky", 0, 0, nullptr },
  { "xSkyP3", "REVERB PARAM 3", "sky", 0, 0, nullptr },
  { "xSkyP4", "REVERB PARAM 4", "sky", 0, 0, nullptr },
  { "xSkyP5", "REVERB PARAM 5", "sky", 0, 0, nullptr },
  { "xHellCross", "HELL CROSS", "hell", 0, 2, kExSteps_xHellCross },
  { "xHellHp", "HELL HIGH-PASS", "hell", 0, 0, nullptr },
  { "xHellLp", "HELL LOW-PASS", "hell", 1, 0, nullptr },
  { "xHellSmear", "HELL SMEAR", "hell", 0, 0, nullptr },
  { "xHellRange", "HELL RANGE", "hell", 0, 4, kExSteps_xHellRange },
  { "xHellPhase", "HELL PHASE", "hell", 0, 0, nullptr },
  { "xHellAntiRefl", "HELL ANTI REFL", "hell", 0, 2, kExSteps_xHellAntiRefl },
  { "xHellLfoShape", "HELL LFO SHAPE", "hell", 0, 4, kExSteps_xHellLfoShape },
  { "xHellLfoSync", "HELL LFO SYNC", "hell", 0, 2, kExSteps_xHellLfoSync },
  { "xHellLfoAmt", "HELL LFO AMOUNT", "hell", 0.5, 0, nullptr },
  { "xHellLfoStereo", "HELL LFO STEREO", "hell", 0, 2, kExSteps_xHellLfoStereo },
  { "xHellLfoTarget", "HELL LFO TARGET", "hell", 0, 4, kExSteps_xHellLfoTarget },
  { "xDStyle", "DISTO STYLE", "disto", 0, 13, kExSteps_xDStyle },
  { "xDPunish", "DISTO PUNISH", "disto", 0, 2, kExSteps_xDPunish },
  { "xDLow", "DISTO LOW CUT", "disto", 0, 0, nullptr },
  { "xDThump", "DISTO THUMP", "disto", 0, 2, kExSteps_xDThump },
  { "xDTone", "DISTO TONE", "disto", 0.5, 0, nullptr },
  { "xDHigh", "DISTO HIGH CUT", "disto", 1, 0, nullptr },
  { "xDSteep", "DISTO STEEP", "disto", 0, 2, kExSteps_xDSteep },
  { "xDMix", "DISTO MIX", "disto", 1, 0, nullptr },
  { "xDOut", "DISTO OUTPUT", "disto", 0.5, 0, nullptr },
  { "xDAuto", "DISTO AUTO", "disto", 1, 2, kExSteps_xDAuto },
  { "xDMorph", "DISTO MORPH", "disto", 0, 0, nullptr },
  { "xDMorphTo", "DISTO MORPH TO", "disto", 0, 12, kExSteps_xDMorphTo },
  { "xDDyn", "DISTO DYNAMICS", "disto", 0.5, 0, nullptr },
  { "xDFb", "DISTO FEEDBACK", "disto", 0, 0, nullptr },
  { "xDFbFreq", "DISTO FB FREQ", "disto", 0.5, 0, nullptr },
  { "xDBands", "DISTO BANDS", "disto", 0, 3, kExSteps_xDBands },
  { "xDXLo", "DISTO XOVER LOW", "disto", 0.4, 0, nullptr },
  { "xDXHi", "DISTO XOVER HIGH", "disto", 0.5, 0, nullptr },
  { "xDB1Style", "DISTO LOW STYLE", "disto", 0, 13, kExSteps_xDB1Style },
  { "xDB1Drive", "DISTO LOW DRIVE", "disto", 0.5, 0, nullptr },
  { "xDB1Mix", "DISTO LOW MIX", "disto", 1, 0, nullptr },
  { "xDB1Level", "DISTO LOW LEVEL", "disto", 0.5, 0, nullptr },
  { "xDB1Solo", "DISTO LOW SOLO", "disto", 0, 2, kExSteps_xDB1Solo },
  { "xDB1Byp", "DISTO LOW BYPASS", "disto", 0, 2, kExSteps_xDB1Byp },
  { "xDB2Style", "DISTO MID STYLE", "disto", 0, 13, kExSteps_xDB2Style },
  { "xDB2Drive", "DISTO MID DRIVE", "disto", 0.5, 0, nullptr },
  { "xDB2Mix", "DISTO MID MIX", "disto", 1, 0, nullptr },
  { "xDB2Level", "DISTO MID LEVEL", "disto", 0.5, 0, nullptr },
  { "xDB2Solo", "DISTO MID SOLO", "disto", 0, 2, kExSteps_xDB2Solo },
  { "xDB2Byp", "DISTO MID BYPASS", "disto", 0, 2, kExSteps_xDB2Byp },
  { "xDB3Style", "DISTO HIGH STYLE", "disto", 0, 13, kExSteps_xDB3Style },
  { "xDB3Drive", "DISTO HIGH DRIVE", "disto", 0.5, 0, nullptr },
  { "xDB3Mix", "DISTO HIGH MIX", "disto", 1, 0, nullptr },
  { "xDB3Level", "DISTO HIGH LEVEL", "disto", 0.5, 0, nullptr },
  { "xDB3Solo", "DISTO HIGH SOLO", "disto", 0, 2, kExSteps_xDB3Solo },
  { "xDB3Byp", "DISTO HIGH BYPASS", "disto", 0, 2, kExSteps_xDB3Byp },
  { "xDEnvAmt", "DISTO ENV AMOUNT", "disto", 0.5, 0, nullptr },
  { "xDEnvSpd", "DISTO ENV SPEED", "disto", 0.3, 0, nullptr },
  { "xDLfoShape", "DISTO LFO SHAPE", "disto", 0, 5, kExSteps_xDLfoShape },
  { "xDLfoRate", "DISTO LFO RATE", "disto", 0.4, 0, nullptr },
  { "xDLfoSync", "DISTO LFO SYNC", "disto", 0, 2, kExSteps_xDLfoSync },
  { "xDLfoAmt", "DISTO LFO AMOUNT", "disto", 0.5, 0, nullptr },
  { "xDLfoTarget", "DISTO LFO TARGET", "disto", 0, 6, kExSteps_xDLfoTarget },
  { "xDPreMode", "DISTO PRE FILTER", "disto", 0, 5, kExSteps_xDPreMode },
  { "xDPreFreq", "DISTO PRE FREQ", "disto", 0.5, 0, nullptr },
  { "xDPreReso", "DISTO PRE RESO", "disto", 0, 0, nullptr },
  { "xDPostMode", "DISTO POST FILTER", "disto", 0, 5, kExSteps_xDPostMode },
  { "xDPostFreq", "DISTO POST FREQ", "disto", 0.5, 0, nullptr },
  { "xDPostReso", "DISTO POST RESO", "disto", 0, 0, nullptr },
  { "xDBox", "DISTO BOX", "disto", 0, 5, kExSteps_xDBox },
  { "xDBoxSize", "DISTO BOX SIZE", "disto", 0.5, 0, nullptr },
  { "xDBoxMix", "DISTO BOX MIX", "disto", 1, 0, nullptr },
};
