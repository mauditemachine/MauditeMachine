// GENERE par tests/extra-gen.mjs depuis extra-params.json : ne pas editer.
enum ExtraId { ex_xQuality, ex_xLfo1Dest2, ex_xLfo1Depth2, ex_xLfo2Rate, ex_xLfo2Shape, ex_xLfo2Dest, ex_xLfo2Depth, ex_xRevSize, ex_xRevTone, ex_xRevPre, ex_xWarmth, ex_xBass, ex_xAir, ex_xWidth, ex_xSwing, ex_xRing, ex_xFold, ex_xNoiseColor, ex_xUnison, ex_xHpf, ex_xComb, ex_xCombFb, ex_xPhMix, ex_xPhRate, ex_xPhDepth, ex_xPhFb, ex_xFlMix, ex_xFlRate, ex_xFlDepth, ex_xFlFb, ex_xPumpDepth, ex_xPumpRate, ex_xPumpShape, ex_xCrushBits, ex_xCrushRate, ex_xDlyMode, ex_xShimmer, ex_xM1Src, ex_xM1Dst, ex_xM1Amt, ex_xM2Src, ex_xM2Dst, ex_xM2Amt, ex_xM3Src, ex_xM3Dst, ex_xM3Amt, ex_xM4Src, ex_xM4Dst, ex_xM4Amt, ex_xM5Src, ex_xM5Dst, ex_xM5Amt, ex_xM6Src, ex_xM6Dst, ex_xM6Amt, ex_xVoiceMode, ex_xPbRange, ex_xFeedback, ex_xAmpMode, ex_xEqLow, ex_xEqMid, ex_xEqHigh, ex_xEqAir, ex_xDist, ex_xDistTone, ex_xHellMix, ex_xHellSync, ex_xHellTime, ex_xHellFb, ex_xHellShift, ex_xHellUpDown, ex_xHellSpread, ex_xHellLfoRate, ex_xHellLfoDepth, ex_xHellTone, ex_xSkyType, ex_xSkyDecay, ex_xSkyPre, ex_xSkyTone, ex_xSkyMod, ex_xSkyLow, ex_xSkyP1, ex_xSkyP2, ex_xSkyP3, ex_xSkyP4, ex_xSkyP5, ex_xHellCross, ex_xHellHp, ex_xHellLp, ex_xHellSmear, ex_xHellRange, ex_xHellPhase, ex_xHellAntiRefl, ex_xHellLfoShape, ex_xHellLfoSync, ex_xHellLfoAmt, ex_xHellLfoStereo, ex_xHellLfoTarget, ex_xDStyle, ex_xDPunish, ex_xDLow, ex_xDThump, ex_xDTone, ex_xDHigh, ex_xDSteep, ex_xDMix, ex_xDOut, ex_xDAuto, ex_xDMorph, ex_xDMorphTo, ex_xDDyn, ex_xDFb, ex_xDFbFreq, ex_xDBands, ex_xDXLo, ex_xDXHi, ex_xDB1Style, ex_xDB1Drive, ex_xDB1Mix, ex_xDB1Level, ex_xDB1Solo, ex_xDB1Byp, ex_xDB2Style, ex_xDB2Drive, ex_xDB2Mix, ex_xDB2Level, ex_xDB2Solo, ex_xDB2Byp, ex_xDB3Style, ex_xDB3Drive, ex_xDB3Mix, ex_xDB3Level, ex_xDB3Solo, ex_xDB3Byp, ex_xDEnvAmt, ex_xDEnvSpd, ex_xDLfoShape, ex_xDLfoRate, ex_xDLfoSync, ex_xDLfoAmt, ex_xDLfoTarget, ex_xDPreMode, ex_xDPreFreq, ex_xDPreReso, ex_xDPostMode, ex_xDPostFreq, ex_xDPostReso, ex_xDBox, ex_xDBoxSize, ex_xDBoxMix, ex_xDlStyle, ex_xDlSync, ex_xDlDiv, ex_xDlNote, ex_xDlMs, ex_xDlFb, ex_xDlMode, ex_xDlWidth, ex_xDlOffset, ex_xDlSat, ex_xDlWobble, ex_xDlDiff, ex_xDlLow, ex_xDlHigh, ex_xDlGroove, ex_xDlFeel, ex_xDlPrime, ex_xDlLofi, ex_xDlAnalog, ex_xDlDuck, ex_xDlDuckRel, ex_xDlRhythm, ex_xQ1On, ex_xQ1Type, ex_xQ1Freq, ex_xQ1Gain, ex_xQ1Q, ex_xQ1Slope, ex_xQ2On, ex_xQ2Type, ex_xQ2Freq, ex_xQ2Gain, ex_xQ2Q, ex_xQ2Slope, ex_xQ3On, ex_xQ3Type, ex_xQ3Freq, ex_xQ3Gain, ex_xQ3Q, ex_xQ3Slope, ex_xQ4On, ex_xQ4Type, ex_xQ4Freq, ex_xQ4Gain, ex_xQ4Q, ex_xQ4Slope, ex_xQ5On, ex_xQ5Type, ex_xQ5Freq, ex_xQ5Gain, ex_xQ5Q, ex_xQ5Slope, ex_xQ6On, ex_xQ6Type, ex_xQ6Freq, ex_xQ6Gain, ex_xQ6Q, ex_xQ6Slope, ex_xQOut, ex_xQAna, ex_xPhStages, ex_xPhCenter, ex_xPhSpread, ex_xPhSync, ex_xFlDelay, ex_xFlSpread, ex_xFlSync, ex_xFlThru, ex_xChBoth, ex_xChRate, ex_xChDepth, ex_xChWidth, ex_xChMix, ex_xCrTone, ex_xCrMix, ex_xPuAttack, ex_xPuCurve, ex_xExportHq, ex_xEngine, ex_xMidiIn, ex_xArpHold, ex_xArpRun, ex_xSkyLoCut, ex_xSkyLoSlope, ex_xSkyMidHz, ex_xSkyMidDb, ex_xSkyMidQ, ex_xSkyHiCut, ex_xSkyHiSlope, ex_xSkyWidth, ex_xSkyDuck, ex_xSkyFreeze, ex_COUNT };
static const char* const kExSteps_xQuality[] = { "ECO", "STD", "HQ" };
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
static const char* const kExSteps_xDlStyle[] = { "TAPE", "ANALOG", "DIGITAL", "SPACE", "LO-FI", "DUB", "CASSETTE", "CRYSTAL" };
static const char* const kExSteps_xDlSync[] = { "FREE", "SYNC" };
static const char* const kExSteps_xDlDiv[] = { "1/32", "1/16", "1/8", "1/4", "1/2", "1 BAR", "2 BAR" };
static const char* const kExSteps_xDlNote[] = { "STRAIGHT", "DOTTED", "TRIPLET" };
static const char* const kExSteps_xDlMode[] = { "SINGLE", "DUAL", "PING-PONG", "WIDE", "RHYTHM" };
static const char* const kExSteps_xDlPrime[] = { "OFF", "ON" };
static const char* const kExSteps_xDlLofi[] = { "OFF", "ON" };
static const char* const kExSteps_xDlRhythm[] = { "MACHINE", "FOUR", "CLAVE", "TRESILLO", "GALLOP", "DOTTED", "OFFBEAT", "BOUNCE", "SWELL", "ROLL", "SPARSE", "SKIP" };
static const char* const kExSteps_xQ1On[] = { "OFF", "ON" };
static const char* const kExSteps_xQ1Type[] = { "HP", "LOW SHELF", "BELL", "NOTCH", "HIGH SHELF", "LP" };
static const char* const kExSteps_xQ1Slope[] = { "12", "24", "48" };
static const char* const kExSteps_xQ2On[] = { "OFF", "ON" };
static const char* const kExSteps_xQ2Type[] = { "HP", "LOW SHELF", "BELL", "NOTCH", "HIGH SHELF", "LP" };
static const char* const kExSteps_xQ2Slope[] = { "12", "24", "48" };
static const char* const kExSteps_xQ3On[] = { "OFF", "ON" };
static const char* const kExSteps_xQ3Type[] = { "HP", "LOW SHELF", "BELL", "NOTCH", "HIGH SHELF", "LP" };
static const char* const kExSteps_xQ3Slope[] = { "12", "24", "48" };
static const char* const kExSteps_xQ4On[] = { "OFF", "ON" };
static const char* const kExSteps_xQ4Type[] = { "HP", "LOW SHELF", "BELL", "NOTCH", "HIGH SHELF", "LP" };
static const char* const kExSteps_xQ4Slope[] = { "12", "24", "48" };
static const char* const kExSteps_xQ5On[] = { "OFF", "ON" };
static const char* const kExSteps_xQ5Type[] = { "HP", "LOW SHELF", "BELL", "NOTCH", "HIGH SHELF", "LP" };
static const char* const kExSteps_xQ5Slope[] = { "12", "24", "48" };
static const char* const kExSteps_xQ6On[] = { "OFF", "ON" };
static const char* const kExSteps_xQ6Type[] = { "HP", "LOW SHELF", "BELL", "NOTCH", "HIGH SHELF", "LP" };
static const char* const kExSteps_xQ6Slope[] = { "12", "24", "48" };
static const char* const kExSteps_xQAna[] = { "OFF", "PRE", "POST" };
static const char* const kExSteps_xPhStages[] = { "4", "6", "8", "12" };
static const char* const kExSteps_xPhSync[] = { "FREE", "SYNC" };
static const char* const kExSteps_xFlSync[] = { "FREE", "SYNC" };
static const char* const kExSteps_xFlThru[] = { "OFF", "ON" };
static const char* const kExSteps_xChBoth[] = { "OFF", "ON" };
static const char* const kExSteps_xExportHq[] = { "OFF", "ON" };
static const char* const kExSteps_xEngine[] = { "CLASSIC", "PRO" };
static const char* const kExSteps_xMidiIn[] = { "NOTES", "ARP", "LAYER" };
static const char* const kExSteps_xArpHold[] = { "OFF", "ON" };
static const char* const kExSteps_xArpRun[] = { "STOP", "RUN" };
static const char* const kExSteps_xSkyLoSlope[] = { "12 DB", "24 DB" };
static const char* const kExSteps_xSkyHiSlope[] = { "12 DB", "24 DB" };
static const char* const kExSteps_xSkyFreeze[] = { "OFF", "ON" };
static const ExtraDef kExtraDefs[ex_COUNT] = {
  { "xQuality", "QUALITY", "engine", 0.5, 3, kExSteps_xQuality },
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
  { "xDlyMode", "OLD DLY MODE", "old", 0, 3, kExSteps_xDlyMode },
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
  { "xEqLow", "OLD EQ LOW", "old", 0.5, 0, nullptr },
  { "xEqMid", "OLD EQ MID", "old", 0.5, 0, nullptr },
  { "xEqHigh", "OLD EQ HIGH", "old", 0.5, 0, nullptr },
  { "xEqAir", "OLD EQ AIR", "old", 0.5, 0, nullptr },
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
  { "xDlStyle", "DELAY STYLE", "delay", 0, 8, kExSteps_xDlStyle },
  { "xDlSync", "DELAY SYNC", "delay", 1, 2, kExSteps_xDlSync },
  { "xDlDiv", "DELAY DIVISION", "delay", 0.3333333333333333, 7, kExSteps_xDlDiv },
  { "xDlNote", "DELAY NOTE", "delay", 0.5, 3, kExSteps_xDlNote },
  { "xDlMs", "DELAY TIME", "delay", 0.721, 0, nullptr },
  { "xDlFb", "DELAY FEEDBACK", "delay", 0.4325, 0, nullptr },
  { "xDlMode", "DELAY MODE", "delay", 0.5, 5, kExSteps_xDlMode },
  { "xDlWidth", "DELAY WIDTH", "delay", 1, 0, nullptr },
  { "xDlOffset", "DELAY OFFSET", "delay", 0.5, 0, nullptr },
  { "xDlSat", "DELAY SATURATION", "delay", 0, 0, nullptr },
  { "xDlWobble", "DELAY WOBBLE", "delay", 0.3, 0, nullptr },
  { "xDlDiff", "DELAY DIFFUSION", "delay", 0, 0, nullptr },
  { "xDlLow", "DELAY LOW CUT", "delay", 0.5, 0, nullptr },
  { "xDlHigh", "DELAY HIGH CUT", "delay", 0.5, 0, nullptr },
  { "xDlGroove", "DELAY GROOVE", "delay", 0, 0, nullptr },
  { "xDlFeel", "DELAY FEEL", "delay", 0.5, 0, nullptr },
  { "xDlPrime", "DELAY PRIME", "delay", 0, 2, kExSteps_xDlPrime },
  { "xDlLofi", "DELAY LOFI", "delay", 0, 2, kExSteps_xDlLofi },
  { "xDlAnalog", "DELAY ANALOG", "delay", 0, 0, nullptr },
  { "xDlDuck", "DELAY DUCKING", "delay", 0, 0, nullptr },
  { "xDlDuckRel", "DELAY RELEASE", "delay", 0.35, 0, nullptr },
  { "xDlRhythm", "DELAY RHYTHM", "delay", 0, 12, kExSteps_xDlRhythm },
  { "xQ1On", "EQ 1 ON", "eq", 0, 2, kExSteps_xQ1On },
  { "xQ1Type", "EQ 1 TYPE", "eq", 0, 6, kExSteps_xQ1Type },
  { "xQ1Freq", "EQ 1 FREQ", "eq", 0.059, 0, nullptr },
  { "xQ1Gain", "EQ 1 GAIN", "eq", 0.5, 0, nullptr },
  { "xQ1Q", "EQ 1 Q", "eq", 0.21, 0, nullptr },
  { "xQ1Slope", "EQ 1 SLOPE", "eq", 0, 3, kExSteps_xQ1Slope },
  { "xQ2On", "EQ 2 ON", "eq", 1, 2, kExSteps_xQ2On },
  { "xQ2Type", "EQ 2 TYPE", "eq", 0.2, 6, kExSteps_xQ2Type },
  { "xQ2Freq", "EQ 2 FREQ", "eq", 0.233, 0, nullptr },
  { "xQ2Gain", "EQ 2 GAIN", "eq", 0.5, 0, nullptr },
  { "xQ2Q", "EQ 2 Q", "eq", 0.21, 0, nullptr },
  { "xQ2Slope", "EQ 2 SLOPE", "eq", 0, 3, kExSteps_xQ2Slope },
  { "xQ3On", "EQ 3 ON", "eq", 1, 2, kExSteps_xQ3On },
  { "xQ3Type", "EQ 3 TYPE", "eq", 0.4, 6, kExSteps_xQ3Type },
  { "xQ3Freq", "EQ 3 FREQ", "eq", 0.434, 0, nullptr },
  { "xQ3Gain", "EQ 3 GAIN", "eq", 0.5, 0, nullptr },
  { "xQ3Q", "EQ 3 Q", "eq", 0.21, 0, nullptr },
  { "xQ3Slope", "EQ 3 SLOPE", "eq", 0, 3, kExSteps_xQ3Slope },
  { "xQ4On", "EQ 4 ON", "eq", 1, 2, kExSteps_xQ4On },
  { "xQ4Type", "EQ 4 TYPE", "eq", 0.4, 6, kExSteps_xQ4Type },
  { "xQ4Freq", "EQ 4 FREQ", "eq", 0.699, 0, nullptr },
  { "xQ4Gain", "EQ 4 GAIN", "eq", 0.5, 0, nullptr },
  { "xQ4Q", "EQ 4 Q", "eq", 0.21, 0, nullptr },
  { "xQ4Slope", "EQ 4 SLOPE", "eq", 0, 3, kExSteps_xQ4Slope },
  { "xQ5On", "EQ 5 ON", "eq", 1, 2, kExSteps_xQ5On },
  { "xQ5Type", "EQ 5 TYPE", "eq", 0.8, 6, kExSteps_xQ5Type },
  { "xQ5Freq", "EQ 5 FREQ", "eq", 0.867, 0, nullptr },
  { "xQ5Gain", "EQ 5 GAIN", "eq", 0.5, 0, nullptr },
  { "xQ5Q", "EQ 5 Q", "eq", 0.21, 0, nullptr },
  { "xQ5Slope", "EQ 5 SLOPE", "eq", 0, 3, kExSteps_xQ5Slope },
  { "xQ6On", "EQ 6 ON", "eq", 0, 2, kExSteps_xQ6On },
  { "xQ6Type", "EQ 6 TYPE", "eq", 1, 6, kExSteps_xQ6Type },
  { "xQ6Freq", "EQ 6 FREQ", "eq", 0.985, 0, nullptr },
  { "xQ6Gain", "EQ 6 GAIN", "eq", 0.5, 0, nullptr },
  { "xQ6Q", "EQ 6 Q", "eq", 0.21, 0, nullptr },
  { "xQ6Slope", "EQ 6 SLOPE", "eq", 0, 3, kExSteps_xQ6Slope },
  { "xQOut", "EQ OUTPUT", "eq", 0.5, 0, nullptr },
  { "xQAna", "EQ ANALYZER", "eq", 1, 3, kExSteps_xQAna },
  { "xPhStages", "PHASER STAGES", "phaser", 0.3333333333333333, 4, kExSteps_xPhStages },
  { "xPhCenter", "PHASER CENTER", "phaser", 0.5, 0, nullptr },
  { "xPhSpread", "PHASER SPREAD", "phaser", 0.5, 0, nullptr },
  { "xPhSync", "PHASER SYNC", "phaser", 0, 2, kExSteps_xPhSync },
  { "xFlDelay", "FLANGER DELAY", "flanger", 0.5, 0, nullptr },
  { "xFlSpread", "FLANGER SPREAD", "flanger", 0.5, 0, nullptr },
  { "xFlSync", "FLANGER SYNC", "flanger", 0, 2, kExSteps_xFlSync },
  { "xFlThru", "FLANGER THRU-0", "flanger", 1, 2, kExSteps_xFlThru },
  { "xChBoth", "CHORUS I+II", "chorus", 0, 2, kExSteps_xChBoth },
  { "xChRate", "CHORUS RATE", "chorus", 0.5, 0, nullptr },
  { "xChDepth", "CHORUS DEPTH", "chorus", 0.5, 0, nullptr },
  { "xChWidth", "CHORUS WIDTH", "chorus", 1, 0, nullptr },
  { "xChMix", "CHORUS MIX", "chorus", 0.5, 0, nullptr },
  { "xCrTone", "CRUSH TONE", "crush", 1, 0, nullptr },
  { "xCrMix", "CRUSH MIX", "crush", 1, 0, nullptr },
  { "xPuAttack", "PUMP ATTACK", "pump", 0.5, 0, nullptr },
  { "xPuCurve", "PUMP CURVE", "pump", 0.5, 0, nullptr },
  { "xExportHq", "EXPORT HQ", "engine", 1, 2, kExSteps_xExportHq },
  { "xEngine", "ENGINE", "engine", 1, 2, kExSteps_xEngine },
  { "xMidiIn", "MIDI IN", "engine", 0, 3, kExSteps_xMidiIn },
  { "xArpHold", "HOLD", "engine", 0, 2, kExSteps_xArpHold },
  { "xArpRun", "ARP RUN", "engine", 1, 2, kExSteps_xArpRun },
  { "xSkyLoCut", "REVERB LOW CUT", "sky", 0, 0, nullptr },
  { "xSkyLoSlope", "REVERB LOW CUT SLOPE", "sky", 0, 2, kExSteps_xSkyLoSlope },
  { "xSkyMidHz", "REVERB MID FREQ", "sky", 0.5, 0, nullptr },
  { "xSkyMidDb", "REVERB MID GAIN", "sky", 0.5, 0, nullptr },
  { "xSkyMidQ", "REVERB MID Q", "sky", 0.3, 0, nullptr },
  { "xSkyHiCut", "REVERB HIGH CUT", "sky", 1, 0, nullptr },
  { "xSkyHiSlope", "REVERB HIGH CUT SLOPE", "sky", 0, 2, kExSteps_xSkyHiSlope },
  { "xSkyWidth", "REVERB WIDTH", "sky", 0.5, 0, nullptr },
  { "xSkyDuck", "REVERB DUCK", "sky", 0, 0, nullptr },
  { "xSkyFreeze", "REVERB FREEZE", "sky", 0, 2, kExSteps_xSkyFreeze },
};
