//
// Created by vugluskr on 20.03.16.
//

#ifndef HAPPYGAMER_R_FONT_H
#define HAPPYGAMER_R_FONT_H

#include "global_includes.h"


extern void r_font_init();

/**
 * SPECIAL CODES:
 * §0 : Black
 * §1 : Dark Blue
 * §2 : Dark Green
 * §3 : Dark Aqua
 * §4 : Dark Red
 * §5 : Dark Purple
 * §6 : Gold
 * §7 : Gray
 * §8 : Dark Gray
 * §9 : Blue
 * §a : Green
 * §b : Aqua
 * §c : Red
 * §d : Light Purple
 * §e : Yellow
 * §f : White
 * §k : Obfuscated
 * §l : Bold
 * §m : Strikethrough
 * §n : Underline
 * §o : Italic
 * §r : Reset
 * \n : Extra line
 */
// http://minecraft.gamepedia.com/Formatting_codes
extern void r_font_build(const char* font, FT_ULong fontBase, uint32_t maxGlyphs, uint32_t h, PolyVox::RawVolume<voxel>& volData, const std::wstring& string);

#endif //HAPPYGAMER_R_FONT_H
