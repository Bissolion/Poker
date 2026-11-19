"""Gera os ícones do app (PWA) em docs/icons. Uso: python3 tools/make-icons.py"""
from PIL import Image, ImageDraw, ImageFont
import os

BG = (13, 22, 19)        # --bg
FELT = (26, 92, 67)      # --felt
FELT_DEEP = (13, 54, 38)
RAIL = (59, 39, 25)
BRASS = (217, 173, 85)
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'icons')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def icon(size, maskable=False):
    S = size * 4  # desenha grande e reduz para suavizar
    im = Image.new('RGB', (S, S), BG)
    d = ImageDraw.Draw(im)
    # feltro oval (no maskable ocupa a área segura de 80%)
    pad = int(S * (0.14 if maskable else 0.06))
    d.ellipse([pad, pad, S - pad, S - pad], fill=RAIL)
    r = int(S * 0.035)  # espessura da borda de madeira
    # feltro com gradiente radial, do externo (escuro) para o interno (claro)
    steps = 60
    for i in range(steps):
        t = i / (steps - 1)
        col = tuple(int(FELT_DEEP[k] * (1 - t) + FELT[k] * t) for k in range(3))
        k = pad + r + int(t * (S / 2 - pad - r) * 0.7)
        d.ellipse([k, k, S - k, S - k], fill=col)
    # naipe de espadas em latão
    font = ImageFont.truetype(FONT, int(S * (0.42 if maskable else 0.5)))
    txt = '♠'
    bbox = d.textbbox((0, 0), txt, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((S - w) / 2 - bbox[0], (S - h) / 2 - bbox[1] + S * 0.01), txt, font=font, fill=BRASS)
    return im.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
icon(192).save(os.path.join(OUT, 'icon-192.png'))
icon(512).save(os.path.join(OUT, 'icon-512.png'))
icon(512, maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
icon(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('ícones gerados em', os.path.normpath(OUT))
