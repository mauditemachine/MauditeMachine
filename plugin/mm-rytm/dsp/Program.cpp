#include "Program.h"

#include <cstdio>

namespace mm {

bool shotFromSiteId(const std::string& s, ShotId& out) { return shotFromName(s, out); }

std::string ProgSound::key() const {
    char buf[512];
    std::snprintf(buf, sizeof(buf), "%s|%d|%.6f|%.6f|%.6f|%.6f|%.6f|%d|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%d|%.6f|%.6f|%d|",
                  shotName(id), static_cast<int>(tw.model), tw.tune, tw.attack, tw.decay, tw.drive, tw.snappy, tw.gate ? 1 : 0, tw.sweep,
                  tw.sdTune, tw.sdDecay, tw.sdTone, tw.syn, tw.smp.lev, tw.smp.st, tw.smp.start, tw.smp.len, tw.smp.rev ? 1 : 0, ts, pf,
                  variants ? 1 : 0);
    return std::string(buf) + sample;
}

} // namespace mm
