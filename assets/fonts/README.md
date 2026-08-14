# Poppins — required for KOYOPO slides

The KOYOPO renderer (`src/lib/koyopo.ts`) draws text as real Poppins glyphs. The
TTFs here are the source of truth, but **shipping them in this folder is not
enough** — they have to be installed on the machine that renders.

## Why bundling alone doesn't work

`sharp` rasterises SVG through librsvg. On Windows, librsvg resolves fonts via
the OS font stack and **ignores `FONTCONFIG_FILE` / `FONTCONFIG_PATH`** — the
`fonts.conf` in this directory has no effect there. Verified directly: with the
fonts present and fontconfig pointed at them, `Poppins` still rendered
byte-identical to a nonexistent font name, i.e. it silently fell back to the
default face. After installing the same TTFs into Windows, it rendered correctly.

The failure is silent. There is no error, no warning — slides just come out in
the wrong typeface. If a deck looks subtly off, check this first.

## Install

**Windows (per user, no admin):**

```powershell
$dst = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"
$reg = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts"
Copy-Item .\Poppins-*.ttf $dst -Force
# then register each file, e.g.:
New-ItemProperty -Path $reg -Name "Poppins (TrueType)" -Value "$dst\Poppins-Regular.ttf" -PropertyType String -Force
```

Or simply double-click each `.ttf` and press **Install**.

**macOS:** double-click each file, or `cp Poppins-*.ttf ~/Library/Fonts/`

**Linux / Docker:** `cp Poppins-*.ttf /usr/share/fonts/truetype/ && fc-cache -f`
(fontconfig *is* the mechanism on Linux, so this works.)

## Verify

```bash
node -e "const s=require('sharp');const svg=f=>Buffer.from('<svg width=\"400\" height=\"90\" xmlns=\"http://www.w3.org/2000/svg\"><text x=\"10\" y=\"60\" font-family=\"'+f+'\" font-size=\"44\">Handgloves</text></svg>');(async()=>{const a=await s(svg('Poppins')).png().toBuffer(),b=await s(svg('NoSuchFont')).png().toBuffer();console.log(a.equals(b)?'FALLBACK - not installed':'Poppins OK');})()"
```

## The .pptx export

`src/lib/koyopo-pptx.ts` only writes the font *name* into the file. PowerPoint
substitutes silently if the viewer lacks Poppins, so hand these TTFs over with
any deck you send to a client.

## Licence

Poppins is licensed under the SIL Open Font License 1.1 (Indian Type Foundry and
contributors), which permits bundling and redistribution.
