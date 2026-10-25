"""Deterministic CJK lettering and ICO export for the game's native SVG assets."""
import base64, io, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if sys.argv[1] == 'ico':
    Image.open(sys.argv[2]).convert('RGBA').save(sys.argv[3], sizes=[(16,16),(32,32),(48,48)])
    raise SystemExit

SCALE = 3
image = Image.new('RGBA', (1200*SCALE, 630*SCALE))
draw = ImageDraw.Draw(image)
choices = ['/System/Library/Fonts/STHeiti Medium.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']
cjk_path = next((p for p in choices if Path(p).exists()), None)
if not cjk_path:
    raise SystemExit('Install a CJK font or update the font paths in brand-lettering.py.')
latin_path = '/System/Library/Fonts/Avenir Next.ttc'
if not Path(latin_path).exists():
    latin_path = cjk_path

def text(content, xy, size, color, latin=False, tracking=0):
    font = ImageFont.truetype(latin_path if latin else cjk_path, int(size*SCALE))
    x,y=xy
    for char in content:
        draw.text((round(x*SCALE),round(y*SCALE)), char, font=font, fill=color, anchor='lt')
        x += draw.textlength(char,font=font)/SCALE + tracking

text('THE SOUP EXPEDITION', (80,92), 13, '#b9cca7', True, 2.8)
text('高湯遠征', (74,153), 92, '#edf1d7', tracking=1)
text('3D 英打冒險', (80,273), 31, '#c9dda1', tracking=1.2)
text('每個正確字元，都是一次攻擊。', (80,345), 19, '#c1cdb9', tracking=.25)
text('閉眼練習  ·  廚具養成  ·  菇王挑戰', (80,454), 15, '#cdd9b7', tracking=.25)
text('專心打字，深入蘑菇世界。', (80,541), 13, '#8aa28c', tracking=.3)
text('3D', (1098,71), 13, '#dce8b8', True, 1)
output=io.BytesIO()
image.save(output,format='PNG',optimize=True)
print(base64.b64encode(output.getvalue()).decode('ascii'))
