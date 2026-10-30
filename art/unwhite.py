# /// script
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""白い背景の絵（webp / png / jpg）を、背景が透明な PNG にする。
使い方: uv run art/unwhite.py 入力 出力.png [x,y ...]
外がわから つながった 白と、x,y で しめした 白い すきま（なげなわの わの 中など）を 透明に する。
ユニコーンの 体のような 白い ぬりは、外と つながっていなければ のこる。
ふちは 白との まざりぐあいから アルファを もどして、なめらかさを のこす。
さいごに、のこった 大きな 白い ところの 位置を 出すので、すきまの 見おとしが あれば x,y を たして やりなおす。"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
seeds = [tuple(map(int, s.split(','))) for s in sys.argv[3:]]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
dark = 255 - rgb.min(axis=2)              # 白から どれだけ はなれているか
lab, n = ndimage.label(dark < 24)         # ほぼ 白の かたまり
keep = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) | {lab[y, x] for x, y in seeds}
keep.discard(0)
bg = np.isin(lab, list(keep))
edge = ndimage.binary_dilation(bg, iterations=3) & ~bg
a = np.ones(dark.shape, np.float32)
a[bg] = 0
a[edge] = np.clip(dark[edge] / 180, 0, 1)
m = edge & (a > 0)
col = rgb.copy()
col[m] = (rgb[m] - (1 - a[m, None]) * 255) / a[m, None]
Image.fromarray(np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8), 'RGBA').save(dst)

sizes = ndimage.sum(np.ones_like(dark), lab, index=np.arange(1, n + 1))
for i, s in enumerate(sizes, 1):
    if i not in keep and s > 1500:
        ys, xs = np.nonzero(lab == i)
        print(f'  のこった 白い ところ: {int(s)}px  x,y={int(xs.mean())},{int(ys.mean())}')
