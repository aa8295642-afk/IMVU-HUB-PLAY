#!/usr/bin/env python3
import sys, json, math, os
from PIL import Image, ImageDraw, ImageFont

COLORS = [
    (43,110,174),(123,142,200),(74,90,158),(107,126,190),
    (58,74,142),(139,158,216),(42,58,126),(155,174,232),
    (74,95,174),(122,141,192),(90,111,174),(106,127,184),
    (58,79,158),(138,158,200),(74,106,174),(122,142,192),
    (42,63,142),(154,174,200),(90,106,174),(106,126,192),
]

def load_font(size):
    paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def draw_frame(players, angle_offset, winner_idx, highlight=False):
    SIZE = 480
    cx = cy = SIZE // 2
    R = 210
    INNER = 65

    img  = Image.new("RGB", (SIZE, SIZE), (15, 15, 40))
    draw = ImageDraw.Draw(img)

    n = len(players)
    slice_deg = 360.0 / n

    for i, p in enumerate(players):
        s = i * slice_deg + angle_offset
        e = s + slice_deg
        c = (200, 210, 255) if (highlight and i == winner_idx) else COLORS[i % len(COLORS)]
        draw.pieslice([cx-R, cy-R, cx+R, cy+R],
                      start=s, end=e, fill=c, outline=(13,13,46), width=2)

    for i in range(n):
        angle = (i * slice_deg + angle_offset) * math.pi / 180
        draw.line([(cx,cy),(cx+R*math.cos(angle), cy+R*math.sin(angle))],
                  fill=(13,13,46), width=2)

    font_sm = load_font(11)
    for i, p in enumerate(players):
        mid_deg = i * slice_deg + slice_deg/2 + angle_offset
        mid_rad = mid_deg * math.pi / 180
        tx = cx + R * 0.62 * math.cos(mid_rad)
        ty = cy + R * 0.62 * math.sin(mid_rad)
        label = f"{p['number']}-{p['username']}"[:11]

        tmp  = Image.new("RGBA", (160, 26), (0,0,0,0))
        d2   = ImageDraw.Draw(tmp)
        d2.text((80,13), label, font=font_sm, fill=(255,255,255),
                anchor="mm", stroke_width=1, stroke_fill=(0,0,0))
        rotated = tmp.rotate(-mid_deg, expand=True, resample=Image.BICUBIC)
        if rotated.mode == "RGBA":
            bg   = Image.new("RGB", rotated.size, (15,15,40))
            mask = rotated.split()[3]
            bg.paste(rotated.convert("RGB"), (0,0), mask)
            img.paste(bg, (int(tx-rotated.width//2), int(ty-rotated.height//2)))

    draw.ellipse([cx-R-2,cy-R-2,cx+R+2,cy+R+2], outline=(107,126,200), width=3)
    draw.ellipse([cx-INNER,cy-INNER,cx+INNER,cy+INNER],
                 fill=(13,13,46), outline=(107,126,200), width=3)

    font_c = load_font(14)
    draw.text((cx,cy), "ROULETTE", font=font_c, fill=(139,158,232), anchor="mm")

    ax  = cx + R + 4
    col = (255,215,0) if highlight else (255,255,255)
    draw.polygon([(ax,cy),(ax+26,cy-14),(ax+26,cy+14)], fill=col)

    return img

def make_gif(players, winner_idx, output_path):
    n          = len(players)
    slice_deg  = 360.0 / n
    winner_mid = winner_idx * slice_deg + slice_deg / 2
    final_off  = -winner_mid

    frames = []
    durations = []

    SPIN = 30
    for i in range(SPIN):
        t    = i / SPIN
        ease = 1 - (1 - t) ** 4
        angle = final_off - (5 * 360) * (1 - ease)
        f = draw_frame(players, angle % 360, winner_idx, False)
        frames.append(f.convert("P", palette=Image.ADAPTIVE, colors=64))
        if t < 0.3:    durations.append(30)
        elif t < 0.6:  durations.append(60)
        elif t < 0.85: durations.append(100)
        else:          durations.append(180)

    for _ in range(5):
        f = draw_frame(players, final_off % 360, winner_idx, True)
        frames.append(f.convert("P", palette=Image.ADAPTIVE, colors=64))
        durations.append(700)

    frames[0].save(
        output_path, save_all=True,
        append_images=frames[1:],
        duration=durations, loop=0, optimize=True,
    )

if __name__ == "__main__":
    json_arg    = sys.argv[1]
    winner_idx  = int(sys.argv[2])
    output_path = sys.argv[3]

    if os.path.isfile(json_arg):
        with open(json_arg, 'r', encoding='utf-8') as f:
            players = json.load(f)
    else:
        players = json.loads(json_arg)

    make_gif(players, winner_idx, output_path)
    print(f"OK:{output_path}")
