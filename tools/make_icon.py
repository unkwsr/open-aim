"""Draw the app icon (crosshair on a dark tile) and save build/icon.ico + build/icon.png.

    .modenv\\Scripts\\python.exe -I tools\\make_icon.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(os.path.dirname(HERE), "app", "build")
S = 1024                      # drawn large, then downsampled for clean edges
BG_TOP, BG_BOTTOM = (24, 36, 46), (10, 16, 22)
RED, WHITE = (255, 70, 85), (245, 248, 250)


def tile():
    grad = Image.new("RGB", (S, S))
    px = grad.load()
    for y in range(S):
        t = y / (S - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        for x in range(S):
            px[x, y] = c
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out


def draw():
    img = tile()
    c = S // 2
    # soft red glow behind the ring
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([c - 330, c - 330, c + 330, c + 330], outline=RED + (150,), width=90)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(40)))
    d = ImageDraw.Draw(img)
    d.ellipse([c - 300, c - 300, c + 300, c + 300], outline=RED, width=64)        # target ring
    gap, arm, w = 90, 330, 56                                                       # crosshair
    for x0, y0, x1, y1 in [(c - w // 2, c - arm, c + w // 2, c - gap), (c - w // 2, c + gap, c + w // 2, c + arm),
                           (c - arm, c - w // 2, c - gap, c + w // 2), (c + gap, c - w // 2, c + arm, c + w // 2)]:
        d.rounded_rectangle([x0, y0, x1, y1], radius=w // 2, fill=WHITE)
    d.ellipse([c - 40, c - 40, c + 40, c + 40], fill=RED)                          # centre dot
    return img


def main():
    os.makedirs(BUILD, exist_ok=True)
    img = draw()
    img.resize((512, 512), Image.LANCZOS).save(os.path.join(BUILD, "icon.png"))
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    img.resize((256, 256), Image.LANCZOS).save(os.path.join(BUILD, "icon.ico"), sizes=sizes)
    print("wrote", os.path.join(BUILD, "icon.ico"), "and icon.png")


if __name__ == "__main__":
    main()
