#!/usr/bin/env python3
"""Link-preview artwork for each Partner (and the neutral default).

Writes, from src/tenant/partners.seed.json and the bundled Inter fonts:
  public/og-image.png                          neutral 1200x630 preview (unknown hosts)
  public/partners/<id>/og-image.png            Partner 1200x630 preview (og:image / twitter:image)
  public/partners/<id>/icon-96.png             favicon
  public/partners/<id>/apple-touch-icon.png    180x180 home-screen icon

Optional source art in scripts/partner-art/<id>/ (transparent PNGs):
  logo.png   full logo, shown on a white card in the preview
  mark.png   square brand mark, used for the icons instead of the monogram

The outputs are committed; re-run after changing a Partner's name, subtitle,
domain, colours or art:  python3 scripts/generate-partner-images.py   (needs Pillow)
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src/tenant/partners.seed.json"
FONTS = ROOT / "public/fonts"
PUBLIC = ROOT / "public"
ART = ROOT / "scripts/partner-art"

W, H = 1200, 630
SS = 2  # supersample, then downscale for smooth text and lines
MARGIN = 88

# Letters on the icon tile; anything not listed uses the first letter of shortName.
MONOGRAMS = {"itelematics": "iT", "gamyaa": "G", "uflight": "U", "ev-engineer": "EV"}

NEUTRAL = {
    "label": "",
    "title": "Engineering Command Center",
    "subtitle": "Engineering teams, intern programs, QA workflows and mission-ready evidence",
    "footer": "",
    "primary": "#2563eb",
    "secondary": "#0f172a",
    "accent": "#60a5fa",
}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), size * SS)


def gradient(w, h, start, end):
    """Diagonal gradient from bottom-left (start) to top-right (end)."""
    small = Image.new("RGB", (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x / 63 + (63 - y) / 63) / 2
            px[x, y] = mix(start, end, t)
    return small.resize((w, h), Image.BICUBIC)


def wrap(draw, text, fnt, max_width):
    lines, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if line and draw.textlength(candidate, font=fnt) > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + ([line] if line else [])


def fit(art, box):
    """Scale (up or down) to fit a box x box square, keeping the aspect ratio."""
    scale = box / max(art.size)
    return art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)


def og_image(spec):
    primary, secondary, accent = (hex_rgb(spec[k]) for k in ("primary", "secondary", "accent"))
    img = gradient(W * SS, H * SS, mix(secondary, primary, 0.38), secondary).convert("RGBA")

    lines = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lines)
    for x in range(-200, W + 400, 110):
        ld.line([(x * SS, (H - 80) * SS), ((x + 260) * SS, 80 * SS)], fill=accent + (70,), width=2 * SS)
    img = Image.alpha_composite(img, lines)

    d = ImageDraw.Draw(img)
    text_width = W - 2 * MARGIN
    if spec.get("logo"):
        card = 380
        cx, cy = W - MARGIN - card, (H - card) // 2
        d.rounded_rectangle([cx * SS, cy * SS, (cx + card) * SS, (cy + card) * SS], radius=36 * SS, fill="white")
        logo = fit(spec["logo"], (card - 64) * SS)
        img.alpha_composite(logo, ((cx * 2 + card) * SS // 2 - logo.width // 2, (cy * 2 + card) * SS // 2 - logo.height // 2))
        text_width = cx - MARGIN - 40

    light = mix(accent, (255, 255, 255), 0.45)
    x = MARGIN * SS
    y = 96 * SS
    if spec["label"]:
        d.text((x, y), spec["label"], font=font("SemiBold", 30), fill=light)
    y += 70 * SS

    title_font = font("Bold", 80)
    for line in wrap(d, spec["title"], title_font, text_width * SS):
        d.text((x, y), line, font=title_font, fill="white")
        y += 96 * SS
    y += 18 * SS

    sub_font = font("SemiBold", 44)
    for line in wrap(d, spec["subtitle"], sub_font, (text_width - 60) * SS)[:3]:
        d.text((x, y), line, font=sub_font, fill=(226, 232, 240))
        y += 58 * SS

    if spec["footer"]:
        d.text((x, (H - 96) * SS), spec["footer"], font=font("Regular", 30), fill=light)

    return img.convert("RGB").resize((W, H), Image.LANCZOS)


def icon(spec, size, rounded):
    """Brand mark on white when the Partner has one, else the monogram on its colours."""
    primary, secondary = hex_rgb(spec["primary"]), hex_rgb(spec["secondary"])
    s = size * 4
    mark = spec.get("mark")
    tile = Image.new("RGBA", (s, s), "white") if mark else gradient(s, s, primary, secondary).convert("RGBA")
    if mark:
        art = fit(mark, int(s * 0.84))
        tile.alpha_composite(art, ((s - art.width) // 2, (s - art.height) // 2))
    else:
        d = ImageDraw.Draw(tile)
        text = spec["monogram"]
        fnt = ImageFont.truetype(str(FONTS / "Inter-Bold.ttf"), int(s * (0.56 if len(text) == 1 else 0.44)))
        d.text((s / 2, s / 2), text, font=fnt, fill="white", anchor="mm")
    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 5, fill=255)
        tile.putalpha(mask)
    return tile.resize((size, size), Image.LANCZOS)


def art(partner_id, name):
    path = ART / partner_id / name
    return Image.open(path).convert("RGBA") if path.exists() else None


def save_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {path.stat().st_size // 1024} KB")


def main():
    seed = json.loads(SEED.read_text())
    save_png(og_image(NEUTRAL), PUBLIC / "og-image.png")
    for p in seed["partners"]:
        b = p.get("branding", {})
        spec = {
            "label": p["defaultDomain"],
            "title": p["displayName"],
            "subtitle": p.get("login", {}).get("subtitle") or p.get("description", ""),
            "footer": p.get("platform", {}).get("tagline") or NEUTRAL["title"],
            "primary": b.get("primaryColor") or NEUTRAL["primary"],
            "secondary": b.get("secondaryColor") or NEUTRAL["secondary"],
            "accent": b.get("accentColor") or NEUTRAL["accent"],
            "monogram": MONOGRAMS.get(p["id"], (p.get("shortName") or p["displayName"])[:1].upper()),
            "logo": art(p["id"], "logo.png"),
            "mark": art(p["id"], "mark.png"),
        }
        out = PUBLIC / "partners" / p["id"]
        save_png(og_image(spec), out / "og-image.png")
        save_png(icon(spec, 96, rounded=True), out / "icon-96.png")
        save_png(icon(spec, 180, rounded=False), out / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
