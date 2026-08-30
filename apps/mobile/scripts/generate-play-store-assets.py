#!/usr/bin/env python3
"""Generate Google Play Store graphics for Vaara Parents."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "play-store"

NAVY = "#0D1B2A"
TEAL = "#0E9A8A"
CORAL = "#FF6F61"
WARM_WHITE = "#FFFCF7"
MUTED = "#5E6974"
WHITE = "#FFFFFF"

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_SEMIBOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def hex_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def paste_centered(base: Image.Image, overlay: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    fitted = overlay.copy()
    fitted.thumbnail((w, h), Image.Resampling.LANCZOS)
    ox = x0 + (w - fitted.width) // 2
    oy = y0 + (h - fitted.height) // 2
    if fitted.mode != "RGBA":
        fitted = fitted.convert("RGBA")
    base.paste(fitted, (ox, oy), fitted)


def paste_cover(
    base: Image.Image,
    overlay: Image.Image,
    box: tuple[int, int, int, int],
) -> None:
    """Scale overlay to cover box (center crop)."""
    x0, y0, x1, y1 = box
    box_w, box_h = x1 - x0, y1 - y0
    ow, oh = overlay.size
    scale = max(box_w / ow, box_h / oh)
    new_w, new_h = int(ow * scale), int(oh * scale)
    fitted = overlay.resize((new_w, new_h), Image.Resampling.LANCZOS).convert("RGBA")
    left = (new_w - box_w) // 2
    top = (new_h - box_h) // 2
    fitted = fitted.crop((left, top, left + box_w, top + box_h))
    base.paste(fitted, (x0, y0), fitted)


def line_height(font: ImageFont.FreeTypeFont, line: str) -> int:
    bbox = font.getbbox(line)
    return bbox[3] - bbox[1]


def draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: str,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        bbox = font.getbbox(trial)
        if bbox[2] - bbox[0] <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def draw_multiline_centered(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    color: str,
    cx: int,
    y: int,
    line_gap: int = 12,
) -> int:
    heights = [font.getbbox(line)[3] - font.getbbox(line)[1] for line in lines]
    total = sum(heights) + line_gap * (len(lines) - 1)
    cy = y
    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text((cx - w // 2, cy), line, fill=color, font=font)
        cy += h + (line_gap if i < len(lines) - 1 else 0)
    return y + total


def generate_icon_512() -> Path:
    src = ASSETS / "icon.png"
    out = OUT / "icon-512.png"
    img = Image.open(src).convert("RGB")
    img = img.resize((512, 512), Image.Resampling.LANCZOS)
    img.save(out, "PNG", optimize=True)
    return out


def generate_feature_graphic() -> Path:
    out = OUT / "feature-graphic-1024x500.png"
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), hex_rgb(WARM_WHITE))
    draw = ImageDraw.Draw(img)

    # Soft background accents
    draw.ellipse((-80, -60, 280, 260), fill=hex_rgb("#EAF8F6"))
    draw.ellipse((760, 220, 1120, 560), fill=hex_rgb("#FFE4DF"))
    draw.ellipse((420, -120, 720, 180), fill=hex_rgb("#F3EFE8"))

    logo = Image.open(ASSETS / "splash-icon.png").convert("RGBA")
    paste_centered(img, logo, (48, 90, 320, 410))

    title_font = font(FONT_BOLD, 52)
    tag_font = font(FONT_REG, 28)
    sub_font = font(FONT_REG, 22)

    draw.text((360, 130), "Vaara Parents", fill=hex_rgb(NAVY), font=title_font)
    draw.text((360, 195), "Your parenting village.", fill=hex_rgb(TEAL), font=tag_font)
    draw.text(
        (360, 250),
        "Connect with parents from your school, class & locality.",
        fill=hex_rgb(MUTED),
        font=sub_font,
    )
    draw.text((360, 290), "Privacy first. Always.", fill=hex_rgb(CORAL), font=sub_font)

    # Brand bar
    draw_rounded_rect(draw, (360, 360, 980, 420), 16, "#EAF8F6")
    draw.text((380, 375), "Circles  •  Activities  •  Marketplace  •  Experts", fill=hex_rgb(NAVY), font=sub_font)

    img.save(out, "PNG", optimize=True)
    return out


def generate_phone_screenshot(
    filename: str,
    illustration: str,
    eyebrow: str,
    title: str,
    accent: str,
    description: str,
) -> Path:
    out = OUT / filename
    w, h = 1080, 1920
    margin = 40
    text_x = 56
    text_max_w = w - margin * 2

    img = Image.new("RGB", (w, h), hex_rgb(WARM_WHITE))
    draw = ImageDraw.Draw(img)

    # Compact header
    header_h = 132
    draw_rounded_rect(draw, (0, 0, w, header_h), 0, hex_rgb(WHITE))
    logo = Image.open(ASSETS / "splash-icon.png").convert("RGBA")
    paste_centered(img, logo, (margin, 28, margin + 88, 116))
    draw.text(
        (margin + 104, 52),
        "Vaara Parents",
        fill=hex_rgb(NAVY),
        font=font(FONT_BOLD, 42),
    )

    brand_font = font(FONT_BOLD, 42)
    eyebrow_font = font(FONT_BOLD, 38)
    title_font = font(FONT_BOLD, 68)
    accent_font = font(FONT_BOLD, 68)
    body_font = font(FONT_REG, 40)
    footer_font = font(FONT_SEMIBOLD, 32)

    y = header_h + 36
    if eyebrow:
        draw.text((text_x, y), eyebrow, fill=hex_rgb(TEAL), font=eyebrow_font)
        y += line_height(eyebrow_font, eyebrow) + 20

    title_lines = wrap_text(title, title_font, text_max_w)
    for line in title_lines:
        if accent and accent in line:
            before, after = line.split(accent, 1)
            x = text_x
            for part, color, f in [
                (before, NAVY, title_font),
                (accent, TEAL, accent_font),
                (after, NAVY, title_font),
            ]:
                if not part:
                    continue
                draw.text((x, y), part, fill=hex_rgb(color), font=f)
                x += f.getbbox(part)[2] - f.getbbox(part)[0]
        else:
            draw.text((text_x, y), line, fill=hex_rgb(NAVY), font=title_font)
        y += line_height(title_font, line) + 14
    y += 12

    body_lines = wrap_text(description, body_font, text_max_w)
    for line in body_lines[:3]:
        draw.text((text_x, y), line, fill=hex_rgb(MUTED), font=body_font)
        y += line_height(body_font, line) + 12

    footer_h = 88
    card_top = y + 28
    card_bottom = h - 24
    draw_rounded_rect(draw, (margin, card_top, w - margin, card_bottom), 36, WHITE)

    ill = Image.open(ASSETS / "illustrations" / illustration).convert("RGBA")
    ill_pad = 12
    paste_cover(
        img,
        ill,
        (
            margin + ill_pad,
            card_top + ill_pad,
            w - margin - ill_pad,
            card_bottom - ill_pad,
        ),
    )

    # Footer overlaid on illustration card bottom
    footer_top = card_bottom - footer_h - 8
    overlay = Image.new("RGBA", (w - margin * 2, footer_h), (234, 248, 246, 235))
    img.paste(overlay, (margin, footer_top), overlay)
    draw_rounded_rect(draw, (margin, footer_top, w - margin, card_bottom - 8), 24, "#EAF8F6")
    draw.text(
        (margin + 28, footer_top + 22),
        "Privacy first. Always.",
        fill=hex_rgb(TEAL),
        font=footer_font,
    )

    img.save(out, "PNG", optimize=True)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    generated = [
        generate_icon_512(),
        generate_feature_graphic(),
        generate_phone_screenshot(
            "phone-screenshot-01-welcome.png",
            "family-welcome.png",
            "",
            "Connect with parents from the same school, class and locality.",
            "same school, class and locality.",
            "Verified tutors, schools, activities and more for your child.",
        ),
        generate_phone_screenshot(
            "phone-screenshot-02-circles.png",
            "school-community.png",
            "Your trusted parent network",
            "Parents from your school, class and locality",
            "school, class and locality",
            "Auto-join circles for your child's school, curriculum and neighborhood.",
        ),
        generate_phone_screenshot(
            "phone-screenshot-03-tutors.png",
            "verified-tutor.png",
            "Local and accountable",
            "Verified tutors and trainers near you",
            "tutors and trainers near you",
            "Connect with reviewed teachers and institutions in your area.",
        ),
        generate_phone_screenshot(
            "phone-screenshot-04-curriculum.png",
            "curriculum-parents.png",
            "Decisions with context",
            "IB, IGCSE & Cambridge parent advice",
            "IB, IGCSE & Cambridge",
            "Curriculum tips from families on the same board near you.",
        ),
    ]
    print("Generated Play Store assets:")
    for path in generated:
        im = Image.open(path)
        print(f"  {path.relative_to(ROOT)}  ({im.width}x{im.height})")


if __name__ == "__main__":
    main()
