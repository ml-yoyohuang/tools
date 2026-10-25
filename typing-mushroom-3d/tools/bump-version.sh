#!/usr/bin/env bash
# 更新 CSS／JS 網址上的版本號（?v=…），讓瀏覽器在發布後一定載入新檔案，
# 不會出現「新 HTML 配舊 CSS／JS」的混搭。每次推到 main 發布前執行一次。
#   用法：tools/bump-version.sh            （自動用 日期-時分）
#         tools/bump-version.sh 20261026-1  （指定版本）
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-$(date +%Y%m%d-%H%M)}"
FILES=(index.html js/scene/index.js js/scene/actors.js)
for f in "${FILES[@]}"; do
    # 只改本專案檔案的 ?v=…，不碰 vendor
    perl -pi -e 's/((?:css|js)\/[\w\/.-]+\.(?:css|js)|\.\/[\w-]+\.js)(\?v=[\w-]+)?(?=["\x27])/$1?v='"$VERSION"'/g' "$f"
done
echo "版本號已更新為 $VERSION"
grep -c "?v=$VERSION" "${FILES[@]}"
