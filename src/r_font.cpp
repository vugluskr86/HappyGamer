//
// Created by vugluskr on 20.03.16.
//

#include "r_font.h"

// http://nehe.gamedev.net/tutorial/freetype_fonts_in_opengl/24001/

static FT_Library ft_library;

void r_font_init()
{
    std::cout << "r_font_init()" << std::endl;

    if (FT_Init_FreeType( &ft_library ))
        throw std::runtime_error("FT_Init_FreeType failed");
}

void r_font_build(const char* font, FT_ULong fontBase, uint32_t maxGlyphs, uint32_t h, PolyVox::RawVolume<voxel>& volData, const std::wstring& _string)
{
    FT_Face face;

    if ( FT_New_Face( ft_library, font, 0, &face ) )
        throw std::runtime_error("FT_New_Face failed (there is probably a problem with your font file)");

    FT_Set_Char_Size( face, h << 6, h << 6, 96, 96 );

    int32_t x = 0;

    // формирование геометрии для текста
    for (auto ch : _string)
    {
        if(FT_Load_Glyph( face, FT_Get_Char_Index( face, ch ), FT_LOAD_DEFAULT ))
            throw std::runtime_error("FT_Load_Glyph failed");

        FT_Render_Glyph(face->glyph, FT_RENDER_MODE_LCD);
        FT_Bitmap& bitmap = face->glyph->bitmap;


        for(int32_t j = 0; j < bitmap.rows; j++) //rows
        {
            for(int32_t i = 0; i < bitmap.width; i++) //cols
            {
                voxel v;

                uint8_t r = bitmap.buffer[j * bitmap.pitch + i * 3];
                uint8_t g = bitmap.buffer[j * bitmap.pitch + i * 3 + 1];
                uint8_t b = bitmap.buffer[j * bitmap.pitch + i * 3 + 2];

                v.v[0] = ((r >> 0) & 255) / 255.0f;
                v.v[1] = ((g >> 8) & 255) / 255.0f;
                v.v[2] = ((b >> 16)  & 255) / 255.0f;

                volData.setVoxel(x + i, 0, j, v);
            }
        }

        x += bitmap.width + 4;
    }

    FT_Done_Face(face);
}
