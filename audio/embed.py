#!/usr/bin/env python3
"""audio/se/*（ドラが フリー素材サイトから あつめた 効果音。wav・mp3・ogg）を mp3 に して、
index.html の SE_SRC（// SOUNDS:BEGIN 〜 // SOUNDS:END）に うめこむ。
使い方: uv run --with av --with numpy audio/embed.py
ファイル名から se_ を とった ものが sfx の 名前（se_hit.ogg → sfx.hit）。ある 音は 合成音の かわりに なる。
モノラルに して、あたまの 無音を けずり、CUT の ながさで きって、LOUD の 大きさに そろえる。"""
import base64, io, pathlib, re
import av, numpy as np

SE = pathlib.Path(__file__).parent / 'se'
HTML = pathlib.Path(__file__).parent.parent / 'index.html'
SR = 44100
# ながさの 上限（びょう）。れんだで かさなる 音は みじかく（every() の 間かく 0.05〜0.1びょう）。ないものは そのまま
CUT = {'hit': .2, 'kb': .6, 'base': .35, 'shot': .3, 'deploy': .24, 'boss': 1.2, 'crash': 1.6, 'pop': .8, 'bossstop': 1.0}   # deploy は「ピヨ」1かいぶん、boss は たいこの「ドン」と ひびきの はじめ、
# kb（中パンチ）は ふっとぶ 0.55びょうと おなじ くらい、pop（大パンチ）は おいかえした てきが とんで きえる 0.77びょう まで、crash（爆発3）は とりでが しずむ まで（止め 0.35＋FALL_T 1.2）、
# base（打撃4。いわが くだける）は つよい ところ 0.35びょう（おしろ・とりでを たたくと 0.08びょう ごとに かさなるので みじかく）、shot（弓矢）は「ヒュッ」の 0.3びょう、
# bossstop（剣で 打ちあう 3。ボスの 大わざを とめた とき）は ひびきの はじめ 1びょう
# 大きさ（A特性で はかった いちばん 大きい 50ミリびょうの dB）。おいかえす ＞ ふっとぶ ＞ ヒット ＞ だす（桜井 #032）。
# A特性は ひくい 音を かるく はかる（スマホの スピーカーでは ひくい 音は でない）。とがった ところが 0.9 を こえる 音は そこで 上限
LOUD = {'pop': -19, 'kb': -21, 'hit': -23, 'deploy': -26, 'thud': -22, 'base': -24, 'crash': -19, 'cannon': -18,
        'gun': -18, 'shot': -28, 'tap': -26, 'coin': -22, 'win': -19, 'lose': -21, 'boss': -18, 'clear': -17, 'bossstop': -19}
FADE = {'boss': .35, 'kb': .15, 'hit': .08, 'crash': .5, 'pop': .25, 'base': .12, 'shot': .06, 'bossstop': .3}   # おわりを けす ながさ（びょう）。ないものは 0.03


def load(p):
    c = av.open(str(p))
    r = av.AudioResampler(format='flt', layout='mono', rate=SR)
    return np.concatenate([f.to_ndarray().reshape(-1) for fr in c.decode(c.streams.audio[0]) for f in r.resample(fr)])


def a_weight(x):
    f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    ra = 12194 ** 2 * f ** 4 / ((f ** 2 + 20.6 ** 2) * np.sqrt((f ** 2 + 107.7 ** 2) * (f ** 2 + 737.9 ** 2)) * (f ** 2 + 12194 ** 2))
    return np.fft.irfft(np.fft.rfft(x) * ra * 10 ** (2 / 20), len(x))


def level(x):
    n = int(.05 * SR)
    return 20 * np.log10(max(np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, max(1, len(x) - n), n // 4)))


def lowcut(x):   # 60Hz いかを けし、150Hz まで だんだん のこす。きこえない ひくい 音が とがった ところを つくって 大きく できないので
    n = len(x); f = np.fft.rfftfreq(2 * n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x, 2 * n) * np.clip((f - 60) / 90, 0, 1), 2 * n)[:n]


def shape(k, x):
    x = lowcut(x)
    pk = np.abs(x).max()
    x = x[max(0, np.argmax(np.abs(x) > pk * .05) - int(.003 * SR)):]   # あたまの 無音（おした しゅんかんに なるように）
    x = x[:len(x) - np.argmax(np.abs(x[::-1]) > pk * .003)]   # おしりの 無音
    if k in CUT and len(x) > CUT[k] * SR:
        x = x[:int(CUT[k] * SR)].copy()
    n = min(int(FADE.get(k, .03) * SR), len(x) // 4)
    x[-n:] *= np.linspace(1, 0, n)
    g, lim = 10 ** ((LOUD.get(k, -20) - level(a_weight(x))) / 20), .9 / np.abs(x).max()
    return x * min(g, lim), g > lim


def mp3(x):
    buf = io.BytesIO()
    with av.open(buf, 'w', format='mp3') as out:
        s = out.add_stream('libmp3lame', rate=SR, layout='mono')
        s.bit_rate = 96000
        f = av.AudioFrame.from_ndarray(x.astype(np.float32).reshape(1, -1), format='fltp', layout='mono')
        f.sample_rate = SR
        for p in s.encode(f): out.mux(p)
        for p in s.encode(None): out.mux(p)
    return buf.getvalue()


html = HTML.read_text()
names = set(re.findall(r'^  (\w+)\(', html.split('const sfx = {')[1].split('\n};')[0], re.M))
lines = []
for p in sorted(SE.glob('*')):   # つかわない 音は audio/se/unused/ に
    if p.suffix not in ('.wav', '.mp3', '.ogg'): continue
    k = p.stem.removeprefix('se_')
    assert k in names, f'{p.name}: sfx に {k} が ない'
    x, capped = shape(k, load(p))
    data = mp3(x)
    print(f'  {k}: {len(x) / SR:.2f}びょう {level(a_weight(x)):.0f}dB(A){"（とがった ところで 上限）" if capped else ""} → {len(data) // 1024}KB')
    lines.append(f"  {k}: 'data:audio/mpeg;base64,{base64.b64encode(data).decode()}',")
block = '// SOUNDS:BEGIN（audio/embed.py が書きかえる）\nconst SE_SRC = {\n' + '\n'.join(lines) + '\n};\n// SOUNDS:END'
html, n = re.subn(r'// SOUNDS:BEGIN.*?// SOUNDS:END', lambda _: block, html, flags=re.S)
assert n == 1, 'index.html に // SOUNDS:BEGIN 〜 // SOUNDS:END が ない'
HTML.write_text(html)
print(f'{len(lines)} この 音を うめこみました')
