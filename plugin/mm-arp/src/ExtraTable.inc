// GENERE par tests/extra-gen.mjs depuis extra-params.json : ne pas editer.
enum ExtraId { ex_xQuality, ex_xLfo1Dest2, ex_xLfo1Depth2, ex_xLfo2Rate, ex_xLfo2Shape, ex_xLfo2Dest, ex_xLfo2Depth, ex_xRevSize, ex_xRevTone, ex_xRevPre, ex_xWarmth, ex_xBass, ex_xAir, ex_xWidth, ex_COUNT };
static const char* const kExSteps_xQuality[] = { "STD", "HQ" };
static const char* const kExSteps_xLfo1Dest2[] = { "OFF", "RES", "AMP", "PAN", "OSC 2 PITCH", "OSC MIX", "NOISE", "SUB", "DRIVE", "STACK", "ENV AMT" };
static const char* const kExSteps_xLfo2Rate[] = { "1/32", "1/16T", "1/16", "1/8T", "1/16.", "1/8", "1/4T", "1/8.", "1/4", "1/2", "1 BAR", "2 BAR", "4 BAR", "8 BAR" };
static const double kExBeats_xLfo2Rate[] = { 0.125, 0.16666666666666666, 0.25, 0.3333333333333333, 0.375, 0.5, 0.6666666666666666, 0.75, 1, 2, 4, 8, 16, 32 };
static const char* const kExSteps_xLfo2Shape[] = { "SINE", "TRI", "SAW", "RAMP", "SQR", "S&H", "RND" };
static const char* const kExSteps_xLfo2Dest[] = { "OFF", "WAVE", "CUTOFF", "FM", "PITCH", "RES", "AMP", "PAN", "OSC 2 PITCH", "OSC MIX", "NOISE", "SUB", "DRIVE", "STACK", "ENV AMT" };
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
};
