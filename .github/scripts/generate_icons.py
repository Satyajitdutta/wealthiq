from PIL import Image, ImageDraw
import os

def create_icon(size):
    bg = Image.new('RGBA', (size, size), (8, 13, 26, 255))
    circle_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(circle_img)
    padding = int(size * 0.04)
    r = size // 2 - padding
    cx, cy = size // 2, size // 2
    for i in range(r, 0, -1):
        t = i / r
        red   = int(56 * (1-t) + 37 * t)
        green = int(189 * (1-t) + 99 * t)
        blue  = int(248 * (1-t) + 235 * t)
        draw.ellipse([cx-i, cy-i, cx+i, cy+i], fill=(red, green, blue, 255))
    bg = Image.alpha_composite(bg, circle_img)
    draw2 = ImageDraw.Draw(bg)
    stroke = max(2, int(size * 0.055))
    top_x, top_y = cx, int(cy - r * 0.52)
    bl_x,  bl_y  = int(cx - r * 0.60), int(cy + r * 0.50)
    br_x,  br_y  = int(cx + r * 0.60), int(cy + r * 0.50)
    draw2.line([top_x, top_y, bl_x, bl_y], fill='white', width=stroke)
    draw2.line([top_x, top_y, br_x, br_y], fill='white', width=stroke)
    bar_y  = int(cy + r * 0.10)
    bar_xl = int(cx - r * 0.30)
    bar_xr = int(cx + r * 0.30)
    draw2.line([bar_xl, bar_y, bar_xr, bar_y], fill='white', width=stroke)
    bar_w  = max(2, int(size * 0.035))
    gap    = max(2, int(size * 0.025))
    base_y = int(cy + r * 0.42)
    bars = [
        (int(cx - gap - bar_w), int(cy + r * 0.18), base_y),
        (int(cx - bar_w // 2),  int(cy + r * 0.08), base_y),
        (int(cx + gap),          int(cy + r * 0.18), base_y),
    ]
    for (bx, by, ey) in bars:
        draw2.rectangle([bx, by, bx + bar_w, ey], fill='white')
    return bg.convert('RGB')

os.makedirs('icons_out', exist_ok=True)
for sz, name in [(512, 'icon-512.png'), (512, 'icon-512-maskable.png'), (192, 'icon-192.png')]:
    img = create_icon(sz)
    img.save(f'icons_out/{name}', 'PNG')
    print(f'Created {name}')
print('Done!')
