// GENERE par tests/extra-gen.mjs depuis extra-params.json : ne pas editer.
enum ExtraId { ex_xQuality, ex_xLfo1Dest2, ex_xLfo1Depth2, ex_xLfo2Rate, ex_xLfo2Shape, ex_xLfo2Dest, ex_xLfo2Depth, ex_xRevSize, ex_xRevTone, ex_xRevPre, ex_xWarmth, ex_xBass, ex_xAir, ex_xWidth, ex_xSwing, ex_xRing, ex_xFold, ex_xNoiseColor, ex_xUnison, ex_xHpf, ex_xComb, ex_xCombFb, ex_xPhMix, ex_xPhRate, ex_xPhDepth, ex_xPhFb, ex_xFlMix, ex_xFlRate, ex_xFlDepth, ex_xFlFb, ex_xPumpDepth, ex_xPumpRate, ex_xPumpShape, ex_xCrushBits, ex_xCrushRate, ex_xDlyMode, ex_xShimmer, ex_xM1Src, ex_xM1Dst, ex_xM1Amt, ex_xM2Src, ex_xM2Dst, ex_xM2Amt, ex_xM3Src, ex_xM3Dst, ex_xM3Amt, ex_xM4Src, ex_xM4Dst, ex_xM4Amt, ex_xM5Src, ex_xM5Dst, ex_xM5Amt, ex_xM6Src, ex_xM6Dst, ex_xM6Amt, ex_xVoiceMode, ex_xPbRange, ex_xFeedback, ex_xAmpMode, ex_xEqLow, ex_xEqMid, ex_xEqHigh, ex_xEqAir, ex_xDist, ex_xDistTone, ex_COUNT };
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
  { "xDist", "DISTORTION", "dist", 0, 0, nullptr },
  { "xDistTone", "TONE", "dist", 0.5, 0, nullptr },
};
