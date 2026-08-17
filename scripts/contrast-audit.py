"""Ground-aware WCAG audit of every hard-coded text colour in the app.

Measuring against white alone would flag the deliberately dark deck lightbox and
the red sidebar, and would miss nothing else — so each file is measured against
the surface it actually renders on.
"""
import re, glob, io

def lum(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)

def cr(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + .05) / (lo + .05)

DARK = {
    # The lightbox is a deliberately black stage; its chrome is white on black.
    'src/components/deck-lightbox.tsx': '#0A0A0A',
}
# The sidebar is red, but every hard-coded colour in these two files is the
# ACTIVE pill and its hover, both of which flip the ground to white. The white
# text on red is written as text-white, which this scan does not collect.
RED = {}

rows = []
for f in sorted(glob.glob('src/**/*.tsx', recursive=True)):
    key = f.replace(chr(92), '/')
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'text-\[#([0-9A-Fa-f]{3,6})\]', s):
        c = '#' + m.group(1)
        if key in DARK:
            g, gname = DARK[key], 'dark card'
        elif key in RED:
            g, gname = RED[key], 'red sidebar'
        else:
            # Blush is the darker of the two page grounds, so it is the honest
            # one to measure against.
            g, gname = '#FDF3F2', 'white/blush'
        rows.append((cr(c, g), c, gname, key))

fails = [r for r in rows if r[0] < 4.5]
print(f"{len(rows)} hard-coded text colours checked across {len(set(r[3] for r in rows))} files\n")
if not fails:
    print("  every one clears WCAG AA (4.5:1) against the ground it sits on")
else:
    print(f"{'ratio':>6}  {'colour':9} {'ground':12} file")
    seen = set()
    for ratio, c, gname, f in sorted(fails):
        if (c, f) in seen:
            continue
        seen.add((c, f))
        print(f"{ratio:6.2f}  {c:9} {gname:12} {f}")
