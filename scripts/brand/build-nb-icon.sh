#!/bin/zsh
# Neo-brutalist Coach Connect app icon from the EXACT original logo (src/assets/logo/Logo.PNG).
# Flow: cut the mark off its black background -> trace a black outline from its real edges -> hard shadow on the outside -> paper background.
# Usage (from repo root): scripts/brand/build-nb-icon.sh  -> writes assets/icon.png, assets/adaptive-icon.png, iOS + Android launcher icons.
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd); WORK=$(mktemp -d); cd $WORK
# Manipulate here: mark size, outline thickness, shadow offset, background colour.
SCALE=118; OUTLINE=18; SHADOW=28; PAPER="#F2F2F0"
magick "$ROOT/src/assets/logo/Logo.PNG" -channel RGB -separate -evaluate-sequence Max -level 8%,30% mask.png 2>/dev/null
magick "$ROOT/src/assets/logo/Logo.PNG" mask.png -alpha off -compose CopyOpacity -composite PNG32:mark.png
build() {
  SCALE=$1; OUTL=$2; SH=$3; BG=$4; OUT=$5; PAD=$((OUTL+SH+6))
  magick mark.png -trim +repage -filter Lanczos -resize ${SCALE}% PNG32:m.png
  # 1. Outline silhouette from the solid body only (faint glow pixels dropped, specks opened away), grown by OUTL px.
  magick m.png -alpha extract -threshold 55% -morphology Open Disk:4 -bordercolor black -border $PAD \
    -morphology Dilate Disk:$OUTL -blur 0x1 -level 45%,55% sil.png
  W=$(magick identify -format %w sil.png); H=$(magick identify -format %h sil.png)
  magick -size ${W}x${H} xc:"rgb(10,10,11)" -colorspace sRGB sil.png -alpha off -compose CopyOpacity -composite PNG32:outline.png
  # 2. Shadow only on the outer edge: "blob" = silhouette with the C holes and openings closed up,
  #    shrunk back from its edge, so the shadow stays full along the outside but never drops deep into the
  #    counters (that left bumps under the diagonal tip).
  magick sil.png -bordercolor black -border 200 -morphology Close Disk:170 -shave 200x200 -fill gray50 -draw "color 0,0 floodfill" -fill white -opaque black -fill black -opaque gray50 blob.png
  magick -size ${W}x${H} xc:black sil.png -geometry +${SH}+${SH} -compose Over -composite \( blob.png -morphology Erode Disk:$((SH+OUTL)) -negate \) -compose Multiply -composite shadowmask.png
  magick -size ${W}x${H} xc:"rgb(10,10,11)" -colorspace sRGB shadowmask.png -alpha off -compose CopyOpacity -composite PNG32:shadow.png
  # 3. Stack: shadow, outline, exact mark. Transparent sRGB base keeps the gradient in colour.
  magick -size ${W}x${H} xc:"rgba(0,0,0,0)" -colorspace sRGB \
    shadow.png -compose Over -composite outline.png -compose Over -composite \
    m.png -geometry +${PAD}+${PAD} -compose Over -composite PNG32:stack.png
  # 4. Centre on the 1024 canvas (shadow included).
  if [ "$BG" = none ]; then magick -size 1024x1024 xc:"rgba(0,0,0,0)" -colorspace sRGB stack.png -gravity center -composite PNG32:$OUT
  else magick -size 1024x1024 xc:"$BG" -colorspace sRGB stack.png -gravity center -composite -alpha off PNG24:$OUT; fi
}
build $SCALE $OUTLINE $SHADOW "$PAPER" "$ROOT/assets/icon.png" 2>/dev/null
# Android adaptive foreground: transparent, smaller so the circle crop never clips it.
build 82 13 20 none "$ROOT/assets/adaptive-icon.png" 2>/dev/null
cp "$ROOT/assets/icon.png" "$ROOT/ios/CoachConnect/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do d=${pair%%:*}; n=${pair##*:}; r="$ROOT/android/app/src/main/res/mipmap-$d"
  magick "$ROOT/assets/icon.png" -resize ${n}x${n} -quality 95 "$r/ic_launcher.webp"
  magick "$ROOT/assets/icon.png" -resize ${n}x${n} \( -size ${n}x${n} xc:none -fill white -draw "circle $((n/2)),$((n/2)) $((n/2)),0" \) -compose DstIn -composite -quality 95 "$r/ic_launcher_round.webp"
done
rm -rf $WORK; echo "icons written"
