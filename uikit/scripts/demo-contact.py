# python3 scripts/demo-contact.py <dir> <out.png> — contact sheet of numbered PNGs (6 columns, 360px thumbs, labelled)
import sys, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
fs = sorted(f for f in os.listdir(d) if f.endswith(".png") and f[:2].isdigit())
W, H, L, C = 360, 225, 18, 6
R = (len(fs) + C - 1) // C
sheet = Image.new("RGB", (C * (W + 8) + 8, R * (H + L + 8) + 8), "white"); dr = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    x, y = 8 + (i % C) * (W + 8), 8 + (i // C) * (H + L + 8)
    sheet.paste(Image.open(os.path.join(d, f)).convert("RGB").resize((W, H), Image.LANCZOS), (x, y + L)); dr.text((x, y + 3), f[:-4], fill="black")
sheet.save(out); print(out, len(fs))
