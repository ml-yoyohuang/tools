import type { CategoryId, Difficulty, EffectMeta, RendererKind } from '../engine/types';

export const CATEGORIES: { id: CategoryId; label: string; color: string }[] = [
  { id: 'impact', label: '衝擊與節奏', color: '#FF7153' },
  { id: 'flow', label: '流動與排列', color: '#27D3C2' },
  { id: 'switch', label: '切換與資訊', color: '#F4F1E8' },
  { id: 'space', label: '空間與立體', color: '#9D7BFF' },
  { id: 'material', label: '材質與解構', color: '#E383B4' },
  { id: 'interactive', label: '互動與實驗', color: '#D7FF00' },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: '入門',
  intermediate: '中階',
  advanced: '進階',
};

export const RENDERER_LABEL: Record<RendererKind, string> = {
  dom: 'DOM',
  svg: 'SVG',
  canvas: 'Canvas',
  '3d': '3D',
};

type M = Omit<EffectMeta, 'number'>;
const B: Difficulty = 'beginner';
const I: Difficulty = 'intermediate';
const A: Difficulty = 'advanced';

const LIST: M[] = [
  // 01–08 衝擊與基本節奏
  {
    id: 'word-burst', nameZh: '文字爆開', nameEn: 'Word Burst', category: 'impact', difficulty: B, renderer: 'dom',
    description: '文字瞬間過衝放大，字元向外錯開後回收，搭配短暫放射線強化爆發感。',
    tags: ['過衝', '放射線', '開場'], defaultText: '衝擊', suitableFor: ['開場', '重點詞'],
    implementationNotes: 'GSAP timeline：字元以 back.out 過衝縮放並沿放射方向位移後回收；放射線用 scaleX 由中心拉出再收回。與「爆炸四散」不同，字元最後會回到原位。',
  },
  {
    id: 'letter-sequence', nameZh: '逐字敲擊', nameEn: 'Letter Sequence', category: 'impact', difficulty: B, renderer: 'dom',
    description: '每個字依序從上方落下，碰到基線時壓扁再回彈，像節拍一樣敲進畫面。',
    tags: ['逐字', '落下', '擠壓'], defaultText: '一字一句', suitableFor: ['節拍', '強調'],
    implementationNotes: '逐字 stagger：y 位移使用 power3.in 加速落下，觸地瞬間 scaleY < 1、scaleX > 1，再以 elastic 回復比例，transform-origin 設於字的底部。',
  },
  {
    id: 'text-stamp', nameZh: '印章', nameEn: 'Text Stamp', category: 'impact', difficulty: B, renderer: 'dom',
    description: '帶外框的文字印章以不同角度依序蓋下，伴隨短暫震動與墨色由深轉淡。',
    tags: ['印章', '震動', '公告'], defaultText: '確定／完成／核准', suitableFor: ['公告', '完成狀態'],
    implementationNotes: '每個詞是一個帶雙框線的印章：從 scale 2.4 以 expo.in 壓下，落地時舞台局部震動並出現墨點；以 seed 決定每枚印章的角度與位置。',
  },
  {
    id: 'punch-zoom', nameZh: '衝擊放大', nameEn: 'Punch Zoom', category: 'impact', difficulty: B, renderer: 'dom',
    description: '整個詞從遠處高速放大，過衝後停住，後方留下短暫的方向性殘影。',
    tags: ['放大', '殘影', '標題'], defaultText: '突破', suitableFor: ['標題', '強調'],
    implementationNotes: '主字從 scale 0.04 以 expo.in 衝向鏡頭，過衝到 1.18 後以 back.out 定格；殘影是數個延遲跟隨、逐漸變淡的副本，只在衝擊階段可見，停住後主字完全清晰。',
  },
  {
    id: 'kinetic-stack', nameZh: '動態堆疊', nameEn: 'Kinetic Stack', category: 'impact', difficulty: I, renderer: 'dom',
    description: '詞句分批從不同方向飛入，堆疊成多行，以錯位與字重對比建立層次。',
    tags: ['堆疊', '歌詞', '多行'], defaultText: '穿過／黑夜／現在就走', suitableFor: ['歌詞', '口號'],
    implementationNotes: '以「／」切成多行，每行有不同字重與對齊；行依序從左右交替滑入並以遮罩裁切，最後整組向上推出換下一輪。',
  },
  {
    id: 'stretch-text', nameZh: '伸縮字', nameEn: 'Stretch Text', category: 'impact', difficulty: B, renderer: 'dom',
    description: '指定的字被水平拉長，再以彈性回復原本比例，其餘字被推開讓位。',
    tags: ['拉長', '彈性', '幽默'], defaultText: '拉長了', suitableFor: ['幽默', '節奏變化'],
    implementationNotes: '逐字 scaleX 拉伸，並依拉伸後寬度即時重新計算相鄰字位置，回彈使用 elastic.out。可切換拉長的字。',
  },
  {
    id: 'zoom-through', nameZh: '穿越放大', nameEn: 'Text Zoom Through', category: 'space', difficulty: I, renderer: 'dom',
    description: '文字持續放大到超出畫面，鏡頭彷彿穿過字形的縫隙，再接上下一個詞。',
    tags: ['轉場', '速度', '穿越'], defaultText: '光速', suitableFor: ['轉場', '速度感'],
    implementationNotes: '以指數曲線放大（scale = e^kt），transform-origin 對準字形筆畫間的縫隙，下一個詞同時從深處出現，形成連續穿越。',
  },
  {
    id: 'text-squeeze', nameZh: '擠壓彈跳', nameEn: 'Text Squeeze', category: 'impact', difficulty: B, renderer: 'dom',
    description: '文字先垂直壓扁、水平變寬，蓄力後彈起，在空中與落地時恢復比例。',
    tags: ['擠壓', '彈跳', '活潑'], defaultText: '反彈', suitableFor: ['活潑', '切換'],
    implementationNotes: '整個詞的 squash & stretch：預備壓扁 → 起跳拉長 → 落地再壓扁 → 衰減回彈，保持體積感（scaleX × scaleY ≈ 1）。',
  },
  // 09–16 流動與排列
  {
    id: 'huge-scroll', nameZh: '巨字滑過', nameEn: 'Huge Text Scroll', category: 'flow', difficulty: B, renderer: 'dom',
    description: '超大文字橫向緩慢平移，字形刻意超出舞台，只露出局部輪廓。',
    tags: ['巨字', '背景', '無縫'], defaultText: '台北夜行', suitableFor: ['背景', '場景氛圍'],
    implementationNotes: '字高約為舞台高度的 1.3 倍，兩份文字首尾相接做無縫循環；前景再疊一層小字資訊帶，兩層速度不同。',
  },
  {
    id: 'vertical-typography', nameZh: '直書逆走', nameEn: 'Vertical Typography', category: 'flow', difficulty: I, renderer: 'dom',
    description: '多欄直排文字，奇數欄向上、偶數欄向下，形成交錯的流動。',
    tags: ['直排', '東方', '無縫'], defaultText: '寂靜／疾走', suitableFor: ['東方風格', '詩意畫面'],
    implementationNotes: '使用 writing-mode: vertical-rl 的直排欄，每欄重複內容並量測高度做無縫循環，相鄰欄方向相反。',
  },
  {
    id: 'repeating-wave', nameZh: '重複波浪', nameEn: 'Repeating Text Wave', category: 'flow', difficulty: I, renderer: 'canvas',
    description: '文字平鋪成網格，亮度與顏色以波浪形式斜向掃過整個畫面。',
    tags: ['網格', '亮度', '圖騰'], defaultText: '流行', suitableFor: ['背景', '圖騰'],
    implementationNotes: 'Canvas 繪製文字網格，每格亮度 = sin(距離 × 頻率 − 時間)，在主色與次色之間插值；只改變顏色亮度，不改變尺寸。',
  },
  {
    id: 'diagonal-bands', nameZh: '斜線帶', nameEn: 'Diagonal Text Bands', category: 'flow', difficulty: B, renderer: 'dom',
    description: '多條斜向文字帶交錯移動，相鄰帶方向相反，像街頭海報的色帶。',
    tags: ['斜向', '色帶', '街頭'], defaultText: '天亮以前', suitableFor: ['轉場', '街頭感'],
    implementationNotes: '整個帶組旋轉固定角度，每條帶內的文字重複並無縫平移，奇偶帶反向、填色與鏤空交替。',
  },
  {
    id: 'text-ribbon', nameZh: '緞帶', nameEn: 'Text Ribbon', category: 'flow', difficulty: I, renderer: 'svg',
    description: '文字沿平滑波浪路徑排列，緞帶本身緩慢起伏，文字沿路徑持續流動。',
    tags: ['textPath', '波浪', '路徑'], defaultText: '跟著節奏走', suitableFor: ['裝飾', '配樂視覺'],
    implementationNotes: 'SVG textPath：每幀重新計算波浪路徑的 d 屬性，並移動 startOffset；緞帶底色是同一路徑的粗描邊。',
  },
  {
    id: 'marquee', nameZh: '跑馬燈', nameEn: 'Marquee', category: 'flow', difficulty: B, renderer: 'dom',
    description: '多列文字以不同速度、交錯方向連續循環，重複單位無縫銜接。',
    tags: ['跑馬燈', '公告', '無縫'], defaultText: '新品上市・限時開賣', suitableFor: ['公告', '活動'],
    implementationNotes: '量測一個重複單位的實際寬度，平移量對該寬度取餘數，保證循環點完全不跳動；每列交替填色、鏤空與色帶。',
  },
  {
    id: 'parallax-columns', nameZh: '直書三層', nameEn: 'Parallax Columns', category: 'flow', difficulty: I, renderer: 'dom',
    description: '三層直排文字以不同速度移動，遠層小而淡、近層大而清楚，形成景深。',
    tags: ['視差', '直排', '景深'], defaultText: '雨／街／燈', suitableFor: ['景深', '東方氛圍'],
    implementationNotes: '三個深度層各有不同字級、透明度、模糊與速度（近快遠慢），每層多欄直排無縫循環。',
  },
  {
    id: 'tape-cross', nameZh: '封鎖膠帶', nameEn: 'Tape Cross', category: 'flow', difficulty: B, renderer: 'dom',
    description: '兩條以上的文字膠帶交叉成 X 形，各自沿自己的方向流動。',
    tags: ['膠帶', '警告', 'X 形'], defaultText: '禁止進入', suitableFor: ['警告', '街頭視覺'],
    implementationNotes: '每條膠帶是旋轉後的長條，帶有斜紋邊與陰影；內部文字無縫平移，交叉的膠帶方向相反，入場時先被「拉」進畫面。',
  },
  // 17–24 空間與立體
  {
    id: 'text-tunnel', nameZh: '文字隧道', nameEn: 'Text Tunnel', category: 'space', difficulty: A, renderer: '3d', webgl: true,
    description: '文字鋪滿方形隧道的四壁，框線沿 Z 軸重複，鏡頭持續向前穿越。',
    tags: ['Three.js', '隧道', '科幻'], defaultText: '宇宙', suitableFor: ['開場', '科幻'],
    implementationNotes: '詳情頁使用 Three.js：文字繪入 CanvasTexture 貼在方形管道四壁，配合霧化與循環位移；卡片與無 WebGL 環境改用 Canvas 2D 透視投影版本。',
  },
  {
    id: 'text-corridor', nameZh: '文字走廊', nameEn: 'Text Corridor', category: 'space', difficulty: A, renderer: '3d',
    description: '地板、牆面與天花板都由文字構成，攝影機沿著長廊向前推進。',
    tags: ['CSS 3D', '走廊', '沉浸'], defaultText: '前進', suitableFor: ['沉浸', 'MV'],
    implementationNotes: 'CSS preserve-3d 建立長方形走廊：牆面是旋轉 90° 的文字平面，地板是大字、天花板是細字列；整個走廊沿 translateZ 循環，盡頭有消失點光源。',
  },
  {
    id: 'text-cylinder', nameZh: '圓柱', nameEn: 'Text Cylinder', category: 'space', difficulty: I, renderer: '3d',
    description: '文字排在圓柱表面，多個圓柱反向旋轉，背面字變暗並反轉。',
    tags: ['CSS 3D', '旋轉', '圓柱'], defaultText: '轉／圈', suitableFor: ['標誌', '立體排列'],
    implementationNotes: '每個字以 rotateY(θ) translateZ(r) 貼在圓柱面上，依面向角度計算亮度；背面字保留可見但壓暗，呈現正確的前後關係。',
  },
  {
    id: 'text-vortex', nameZh: '漩渦', nameEn: 'Text Vortex', category: 'space', difficulty: I, renderer: 'canvas',
    description: '文字碎片沿螺旋軌跡旋轉並被吸向中心，聚集後再放開成完整的詞。',
    tags: ['螺旋', '聚集', '奇幻'], defaultText: '漩渦', suitableFor: ['奇幻', '焦點聚集'],
    implementationNotes: 'Canvas 中大量小字沿對數螺旋 r = r0·e^(−kθ) 移動，越靠近中心越快越小；中央主字在聚集後浮現。',
  },
  {
    id: 'ring-tunnel', nameZh: '圓環隧道', nameEn: 'Ring Text Tunnel', category: 'space', difficulty: I, renderer: 'canvas',
    description: '多圈環形文字沿 Z 軸迎面而來，每一圈都是一句完整的環形字。',
    tags: ['圓環', '透視', '科幻'], defaultText: '穿越光的邊界', suitableFor: ['科幻開場'],
    implementationNotes: '每一圈文字沿圓周排列，透過 1/z 透視投影決定半徑與字級；圈與圈交錯旋轉。與方形「文字隧道」不同，文字是面向鏡頭的圓環。',
  },
  {
    id: 'text-orbit', nameZh: '軌道', nameEn: 'Text Orbit', category: 'space', difficulty: I, renderer: 'dom',
    description: '一個詞沿傾斜的橢圓軌道運行，以大小、亮度與遮擋表現前後深度。',
    tags: ['軌道', '遮擋', '深度'], defaultText: '軌道', suitableFor: ['品牌', '標題'],
    implementationNotes: '字元在橢圓上以角度分布，依 sin(θ) 計算縮放、模糊與 z-index；中心有實心球體，軌道後半段的字會被它遮住。',
  },
  {
    id: 'text-cube', nameZh: '方塊', nameEn: 'Text Cube', category: 'space', difficulty: I, renderer: '3d',
    description: '立方體的四個面各放一個詞，依節奏翻轉到下一面並短暫停留。',
    tags: ['CSS 3D', '立方體', '切換'], defaultText: '春／夏／秋／冬', suitableFor: ['切換', '立體展示'],
    implementationNotes: 'CSS preserve-3d 立方體，每面是一個詞；以 back.inOut 旋轉 90°，翻轉時加上微幅縮小與側光陰影。',
  },
  {
    id: 'extruded-text', nameZh: '立體字', nameEn: 'Extruded Text', category: 'space', difficulty: A, renderer: '3d',
    description: '文字擁有真實厚度，側面隨角度明暗變化，緩慢旋轉展示體積。',
    tags: ['擠出', 'CSS 3D', '主標題'], defaultText: '立體', suitableFor: ['主標題'],
    implementationNotes: '分層輪廓擠出：沿 Z 軸疊放多層相同字形（translateZ 逐層遞增），側面層依深度與光源角度上色，正面層最亮；旋轉時可看見側面厚度，不是平面陰影。',
  },
  // 25–32 切換與資訊
  {
    id: 'split-flap', nameZh: '翻牌', nameEn: 'Split Flap', category: 'switch', difficulty: A, renderer: 'dom',
    description: '模擬車站機械翻牌，每格分上下兩片，沿中央鉸鏈翻過數張後定位。',
    tags: ['機械', '復古', '時刻表'], defaultText: '準時', suitableFor: ['復古', '時刻表'],
    implementationNotes: '每格由四片組成（上靜態、下靜態、上翻片、下翻片），翻片以 rotateX 繞中線翻轉；每格經過以 seed 決定張數的隨機字後停在目標字。',
  },
  {
    id: 'flip-cards', nameZh: '翻卡', nameEn: 'Flip Cards', category: 'switch', difficulty: I, renderer: 'dom',
    description: '整張字卡翻轉，翻到背面時換成下一個字，卡片依序翻動形成波。',
    tags: ['翻卡', '切換', '3D'], defaultText: '夜未眠', suitableFor: ['公告', '詞句切換'],
    implementationNotes: '每張卡片有正反兩面（backface-visibility），整張卡繞 Y 軸翻轉 180°，與上下分片的機械翻牌不同。',
  },
  {
    id: 'typewriter', nameZh: '打字機', nameEn: 'Typewriter', category: 'switch', difficulty: B, renderer: 'dom',
    description: '逐字輸入、游標閃爍，停留後刪除，再輸入下一句。',
    tags: ['打字', '游標', '字幕'], defaultText: '天亮以前，再見。', suitableFor: ['敘事', '字幕'],
    implementationNotes: '先以完整句子排版確定位置，再依時間顯示前 n 個字，標點後停頓較久；刪除速度較快，游標在打字時常亮、停頓時閃爍。用「／」分隔多句。',
  },
  {
    id: 'slot-text', nameZh: '拉霸', nameEn: 'Slot Text', category: 'switch', difficulty: I, renderer: 'dom',
    description: '每個字格內的字垂直高速滾動，依序減速並停靠在目標字上。',
    tags: ['滾動', '減速', '揭曉'], defaultText: '大吉利', suitableFor: ['揭曉', '遊戲'],
    implementationNotes: '每格是一條字帶，以遮罩只露出一格；滾動距離以 power4.out 減速並帶少量回彈，各格停止時間依序錯開。',
  },
  {
    id: 'odometer', nameZh: '計數器', nameEn: 'Odometer', category: 'switch', difficulty: I, renderer: 'dom',
    description: '每一位數字像里程表一樣滾動，正確處理進位，例如 99 → 100。',
    tags: ['數字', '統計', '進位'], defaultText: '累計 12,480 人', suitableFor: ['成果', '統計'],
    implementationNotes: '數值以 power2.out 從起始值補間到目標值；預設為機械式進位：高位只在低位由 9 滾到 0 的那一段同步轉動（例如 99 → 100），也可切換成連續式 (value / 10^k) mod 10。',
  },
  {
    id: 'headline-swap', nameZh: '標題切換', nameEn: 'Headline Swap', category: 'switch', difficulty: B, renderer: 'dom',
    description: '固定標籤搭配輪替的標題，新標題由下滑入、舊標題向上滑出遮罩。',
    tags: ['新聞', '遮罩', '輪播'], defaultText: '快訊／全面免費／正式上線', suitableFor: ['新聞', '公告'],
    implementationNotes: '第一段作為固定標籤，其餘輪播；標題容器 overflow hidden，進出各自使用不同 ease，並同步伸縮底線寬度。',
  },
  {
    id: 'led-text', nameZh: 'LED 看板', nameEn: 'LED Text', category: 'switch', difficulty: I, renderer: 'canvas',
    description: '文字由點陣亮點構成，在看板上水平捲動，亮度帶有輕微閃爍。',
    tags: ['點陣', '看板', '復古'], defaultText: '新消息', suitableFor: ['科技', '復古看板'],
    implementationNotes: '文字先畫進只有 N 列高的離屏 Canvas，逐點取樣成布林矩陣，再以圓點重繪；未點亮的 LED 保持暗色可見。',
  },
  {
    id: 'split-halves', nameZh: '上下裂開', nameEn: 'Split Halves', category: 'switch', difficulty: B, renderer: 'dom',
    description: '字形沿水平線分成上下兩半，各自錯開移走，露出下一個詞後再合攏。',
    tags: ['裂開', '反差', '轉場'], defaultText: '重生', suitableFor: ['反差', '轉場'],
    implementationNotes: '同一行文字複製兩份，以 clip-path 各取上半與下半，往相反方向位移；中間層放下一個詞，合攏後交換。',
  },
  // 33–40 能量與解構
  {
    id: 'lightning-strike', nameZh: '雷擊', nameEn: 'Lightning Strike', category: 'material', difficulty: I, renderer: 'svg',
    description: '鋸齒電光劈下，文字伴隨電弧出現並迅速穩定；提供低刺激模式。',
    tags: ['電光', '低刺激', '開場'], defaultText: '雷鳴', suitableFor: ['衝擊開場'],
    implementationNotes: 'SVG 折線以中點位移法產生閃電（固定 seed），只在局部發光，不做全屏白閃；低刺激模式移除亮度閃爍，只保留電弧描線。',
  },
  {
    id: 'laser-cut', nameZh: '雷射切割', nameEn: 'Laser Cut', category: 'material', difficulty: I, renderer: 'dom',
    description: '一道雷射斜向劃過文字，雷射經過處把字切成兩半並錯開。',
    tags: ['雷射', '切割', '科幻'], defaultText: '切斷', suitableFor: ['科幻轉場'],
    implementationNotes: '以 clip-path polygon 把文字沿雷射線切成兩片，切割進度跟著光束位置推進，兩片沿切線法線方向錯開，最後重新熔合。',
  },
  {
    id: 'coin-flip', nameZh: '硬幣翻轉', nameEn: 'Coin Flip', category: 'switch', difficulty: I, renderer: 'dom',
    description: '字元像硬幣一樣跳起並繞 Y 軸旋轉，落下時翻到另一面。',
    tags: ['硬幣', '3D', '選擇'], defaultText: '正／反', suitableFor: ['遊戲', '選擇'],
    implementationNotes: '每枚硬幣有正反兩面與多層薄邊，拋物線跳起時 rotateY 旋轉，地面陰影隨高度縮放。',
  },
  {
    id: 'explode-out', nameZh: '爆炸四散', nameEn: 'Explode Out', category: 'material', difficulty: I, renderer: 'dom',
    description: '完整詞句停留片刻後，各字沿不同方向飛出、旋轉並淡出，再重新組回。',
    tags: ['離場', '四散', '轉場'], defaultText: '爆發四散', suitableFor: ['離場', '強烈轉場'],
    implementationNotes: '以 seed 為每個字決定飛行角度、距離、旋轉與景深縮放，使用 expo.out 噴出；與「文字爆開」不同，這裡字元真的離開畫面。',
  },
  {
    id: 'disintegrate', nameZh: '粒子消散', nameEn: 'Disintegrate', category: 'material', difficulty: A, renderer: 'canvas',
    description: '完整文字從一側開始崩解成大量細粒子，受漂移力影響散開消失。',
    tags: ['粒子', '取樣', '消失'], defaultText: '消滅', suitableFor: ['戲劇', '消失效果'],
    implementationNotes: '將文字畫入 Canvas 取樣像素位置產生粒子；崩解前沿由左至右推進，粒子帶噪聲漂移、上升與淡出，最後再反向聚合。',
  },
  {
    id: 'heartbeat-zoom', nameZh: '心跳縮放', nameEn: 'Heartbeat Zoom', category: 'impact', difficulty: B, renderer: 'dom',
    description: '以「重拍、輕拍、停頓」的雙脈衝節奏縮放，每次心跳擴散出輪廓。',
    tags: ['脈衝', '節奏', '情緒'], defaultText: '鼓動', suitableFor: ['情緒', '音樂節奏'],
    implementationNotes: '一個心跳週期內包含兩個不同強度的脈衝與長停頓；每個脈衝放出一圈鏤空文字輪廓，向外擴大並淡出。',
  },
  {
    id: 'text-kaleido', nameZh: '文字萬花筒', nameEn: 'Text Kaleido', category: 'interactive', difficulty: A, renderer: 'canvas',
    description: '文字被多軸鏡像與旋轉對稱複製，組成持續變化的萬花筒圖案。',
    tags: ['鏡像', '對稱', '迷幻'], defaultText: '夢', suitableFor: ['迷幻背景'],
    implementationNotes: '在一個楔形區域內繪製移動的文字，再以 N 等分旋轉並交替鏡像（scale(1,-1)）複製到整個圓；楔形以 clip 限制，產生真正的鏡像接縫。',
  },
  {
    id: 'number-slam', nameZh: '數字重擊', nameEn: 'Number Slam', category: 'impact', difficulty: B, renderer: 'dom',
    description: '倒數數字依序從上方重重砸下並停住，衝擊瞬間帶局部震動與裂紋。',
    tags: ['倒數', '震動', '數字'], defaultText: '3／2／1', suitableFor: ['倒數', '開場'],
    implementationNotes: '每個數字從大尺寸以 power4.in 砸到定位，落地時震動容器、放出衝擊線；用「／」分隔每一拍。',
  },
  // 41–48 波動與連鎖
  {
    id: 'wave-letters', nameZh: '波浪字', nameEn: 'Wave Letters', category: 'flow', difficulty: B, renderer: 'dom',
    description: '每個字依照位置相位上下起伏，連成一道連續的正弦波。',
    tags: ['正弦', '起伏', '夏日'], defaultText: '起伏的浪', suitableFor: ['輕鬆', '夏日'],
    implementationNotes: 'y = A·sin(ωt − k·i)，同時以導數讓字隨坡度微傾；振幅與波長可調整。',
  },
  {
    id: 'stop-motion', nameZh: '停格動畫', nameEn: 'Stop Motion', category: 'interactive', difficulty: I, renderer: 'dom',
    description: '文字以離散時間步進改變位置與角度，呈現手工定格拍攝的抖動感。',
    tags: ['定格', '手作', '離散'], defaultText: '逐格拍攝', suitableFor: ['玩具', '手作'],
    implementationNotes: '時間量化為每秒 8～12 格，每一格以 seed 產生新的姿勢與微小抖動（不是平滑插值），並加上紙張陰影與偶爾換色。',
  },
  {
    id: 'letter-rain', nameZh: '文字雨', nameEn: 'Letter Rain', category: 'flow', difficulty: I, renderer: 'canvas',
    description: '字元從上方隨機落下，速度、大小與透明度不同，形成前後景深。',
    tags: ['落下', '景深', '氛圍'], defaultText: '雨落在城市', suitableFor: ['氣氛背景'],
    implementationNotes: 'Canvas 中三層雨滴字，近層大且快、遠層小且淡；以 seed 決定欄位與速度，落地時濺起小水花。',
  },
  {
    id: 'magnifier-lens', nameZh: '放大鏡', nameEn: 'Magnifier Lens', category: 'interactive', difficulty: I, renderer: 'dom',
    description: '放大鏡跟隨指標或自動滑過，只放大鏡片範圍內的文字與細節。',
    tags: ['局部放大', '指標', '解說'], defaultText: '細節值得看見', suitableFor: ['解說', '發現'],
    implementationNotes: '鏡片內是整個文字層的副本，以 translate + scale 對準鏡片中心座標，達到真實的局部放大；微小字在鏡片下才看得清楚。',
  },
  {
    id: 'scramble-decode', nameZh: '亂碼解碼', nameEn: 'Scramble Decode', category: 'switch', difficulty: B, renderer: 'dom',
    description: '字元由快速變換的亂碼逐步鎖定成正確文字，最終內容完整正確。',
    tags: ['亂碼', '駭客', '解碼'], defaultText: '訊號已解鎖', suitableFor: ['駭客', '科技'],
    implementationNotes: '每個字有以 seed 決定的鎖定時間，鎖定前以固定頻率從字元池抽字（同一時間點結果固定）；鎖定瞬間短暫高亮。',
  },
  {
    id: 'domino-letters', nameZh: '多米諾文字', nameEn: 'Domino Letters', category: 'impact', difficulty: I, renderer: 'dom',
    description: '字元以底部為支點依序倒下並推倒下一個字，靠在一起後再依序立起。',
    tags: ['連鎖', '支點', '幽默'], defaultText: '連鎖反應', suitableFor: ['幽默', '連鎖'],
    implementationNotes: 'transform-origin 設在字的右下角，旋轉角度以 power2.in 加速倒下，碰到下一個字時才觸發下一個，倒下的字會靠在下一個字上；復位時從第一個字依序立起。',
  },
  {
    id: 'gradient-flow', nameZh: '漸層流動', nameEn: 'Gradient Flow', category: 'material', difficulty: B, renderer: 'dom',
    description: '顏色漸層在字形內部持續流動，字形以外保持乾淨。',
    tags: ['漸層', 'background-clip', '柔和'], defaultText: '流動的色彩', suitableFor: ['標題', '柔和動態'],
    implementationNotes: 'background-clip: text 只在字形內顯示漸層，平移 background-position 製造流動；漸層由主色、次色與第三色組成無縫循環。',
  },
  {
    id: 'circle-text', nameZh: '圓環文字', nameEn: 'Circle Text', category: 'flow', difficulty: B, renderer: 'svg',
    description: '多圈文字在平面上環形排列，內外圈反向旋轉，形成催眠般的節奏。',
    tags: ['圓環', 'textPath', 'Logo'], defaultText: '循環往復', suitableFor: ['Logo', '催眠感'],
    implementationNotes: 'SVG 圓形路徑上的 textPath，依圓周長自動重複文字並以 textLength 對齊；內外圈反向旋轉。與 Z 軸隧道不同，這是平面排列。',
  },
  // 49–56 物理感與字形
  {
    id: 'water-reflection', nameZh: '水面倒影', nameEn: 'Water Reflection', category: 'material', difficulty: I, renderer: 'canvas',
    description: '文字下方有倒影，倒影受水波扭曲，並隨距離逐漸淡出。',
    tags: ['倒影', '波紋', '夜景'], defaultText: '水面', suitableFor: ['夜景', '安靜氛圍'],
    implementationNotes: '先把文字畫到離屏 Canvas，倒影逐列取樣並依 sin 疊加的波紋水平偏移，距離越遠振幅越大、透明度越低。',
  },
  {
    id: 'letter-bounce', nameZh: '逐字彈跳', nameEn: 'Letter Bounce', category: 'impact', difficulty: B, renderer: 'dom',
    description: '每個字依序起跳、落地並微幅回彈，持續循環跳動。',
    tags: ['彈跳', '循環', '可愛'], defaultText: '跳動文字', suitableFor: ['可愛', 'MV'],
    implementationNotes: '每個字以拋物線 y(t) 起跳，落地壓扁並做兩次衰減回彈，再等待下一輪；影子隨高度縮放。重點在持續循環而非入場。',
  },
  {
    id: 'text-flag', nameZh: '文字旗幟', nameEn: 'Text Flag', category: 'material', difficulty: A, renderer: '3d', webgl: true,
    description: '文字像旗面受風飄動，產生連續的波浪彎曲、明暗與透視變化。',
    tags: ['Three.js', '布料', '應援'], defaultText: '迎風而動', suitableFor: ['動感', '應援'],
    implementationNotes: '詳情頁以 Three.js 平面網格貼上文字材質，頂點著色器疊加多個行進波並依法線計算明暗；卡片與無 WebGL 環境使用 Canvas 切條位移版。',
  },
  {
    id: 'gravity-flip', nameZh: '重力反轉', nameEn: 'Gravity Flip', category: 'impact', difficulty: I, renderer: 'dom',
    description: '文字從底部「向上」落到頂部，碰撞回彈後重力再次反轉落回底部。',
    tags: ['重力', '碰撞', '科幻'], defaultText: '重力反轉', suitableFor: ['驚喜', '科幻'],
    implementationNotes: '每個字以固定步長模擬重力加速度、碰撞與恢復係數，重力方向週期性反轉，字形在空中翻面但保持可讀。',
  },
  {
    id: 'magnet-pull', nameZh: '磁力吸附', nameEn: 'Magnet Pull', category: 'interactive', difficulty: I, renderer: 'dom',
    description: '字元從分散位置被磁力吸向中心或指標位置，最後排列成完整的詞。',
    tags: ['吸附', '指標', 'Logo'], defaultText: '引力', suitableFor: ['聚焦', 'Logo'],
    implementationNotes: '字元與周圍小碎點受吸引力 F ∝ 1/d 作用並帶阻尼，最後被彈簧拉回排版位置；詳情頁可用指標當作磁鐵。',
  },
  {
    id: 'pulse-grid', nameZh: '文字脈衝網格', nameEn: 'Word Pulse Grid', category: 'impact', difficulty: I, renderer: 'canvas',
    description: '相同的詞平鋪成網格，縮放脈衝從中心一圈圈向外傳播。',
    tags: ['網格', '脈衝', '節拍'], defaultText: '脈動', suitableFor: ['節奏背景'],
    implementationNotes: '每格縮放 = 1 + A·pulse(t − 距離/波速)，以節拍為單位發出脈衝並衰減；與「重複波浪」只改亮度不同，這裡改變的是尺寸。',
  },
  {
    id: 'weight-grow', nameZh: '字重生長', nameEn: 'Weight Grow', category: 'material', difficulty: B, renderer: 'dom',
    description: '字形從極細逐字生長到極粗，再回到細，展示可變字重。',
    tags: ['可變字體', 'wght', '字體展示'], defaultText: '越來越有力', suitableFor: ['強調', '字體展示'],
    implementationNotes: '使用自架的 Noto Sans TC 可變字體（wght 100–900），以 font-variation-settings 逐字錯開補間字重。',
  },
  {
    id: 'text-fan', nameZh: '文字扇形', nameEn: 'Text Fan', category: 'flow', difficulty: B, renderer: 'dom',
    description: '多個相同的詞從共同支點向外展開成扇形，再依序收攏。',
    tags: ['扇形', '和風', '展開'], defaultText: '展開', suitableFor: ['和風', '登場'],
    implementationNotes: '每一扇骨是一個從支點出發的詞，以 rotate 依序展開到等分角度，顏色在主色與次色間交替。',
  },
  // 57–64 字幕與路徑
  {
    id: 'karaoke-ball', nameZh: '卡拉 OK 球', nameEn: 'Karaoke Ball', category: 'switch', difficulty: I, renderer: 'dom',
    description: '小球沿拋物線依序跳到每個字上方，同步把已唱過的字染色。',
    tags: ['歌詞', '節奏', '字幕'], defaultText: '跟著節奏唱', suitableFor: ['歌詞', '節奏引導'],
    implementationNotes: '球的位置在相鄰字中心間以拋物線插值，落點觸發該字由左至右的填色遮罩（clip-path inset）。',
  },
  {
    id: 'swing-letters', nameZh: '搖擺文字', nameEn: 'Swing Letters', category: 'impact', difficulty: B, renderer: 'dom',
    description: '每個字掛在上方的支點，像鐘擺一樣交錯搖動並逐漸衰減。',
    tags: ['鐘擺', '支點', '可愛'], defaultText: '悠悠晃晃', suitableFor: ['輕鬆', '可愛'],
    implementationNotes: '角度 θ = θ0·e^(−λt)·cos(ωt + φi)，transform-origin 位於字上方的吊點，並畫出吊線。',
  },
  {
    id: 'pixel-dissolve', nameZh: '像素溶解', nameEn: 'Pixel Dissolve', category: 'material', difficulty: I, renderer: 'canvas',
    description: '文字被切成較大的方塊，方塊分批消失，再分批重建。',
    tags: ['像素', '方塊', '數位'], defaultText: '像素', suitableFor: ['數位', '遊戲'],
    implementationNotes: '以文字遮罩切成方格，只保留覆蓋字形的格子；每格依 seed 的順序值決定消失與重建時間，與細粒子飄散不同，方塊不位移。',
  },
  {
    id: 'rotating-words', nameZh: '旋轉詞盤', nameEn: 'Rotating Words', category: 'switch', difficulty: I, renderer: 'svg',
    description: '外圍文字圓盤分段旋轉，每停在一個節點，中心詞就切換一次。',
    tags: ['圓盤', '季節', '切換'], defaultText: '春／夏／秋／冬', suitableFor: ['時間', '季節'],
    implementationNotes: 'SVG 圓盤上平均排列各詞與刻度，以 back.inOut 分段旋轉；中心詞在每段旋轉中點以上下遮罩切換。',
  },
  {
    id: 'blur-trail', nameZh: '模糊拖尾', nameEn: 'Blur Trail', category: 'impact', difficulty: I, renderer: 'dom',
    description: '文字高速橫越，後方留下逐漸淡出的方向性殘影，停下時主體恢復清晰。',
    tags: ['殘影', '速度', '模糊'], defaultText: '疾風', suitableFor: ['速度', '疾走'],
    implementationNotes: '殘影是延遲取樣主體位置的副本，模糊與拉伸量隨即時速度變化；靜止時殘影收回、模糊歸零。',
  },
  {
    id: 'checker-words', nameZh: '棋盤文字', nameEn: 'Checker Words', category: 'flow', difficulty: I, renderer: 'dom',
    description: '網格字卡依棋盤奇偶順序翻轉並換色，形成斜向移動的波。',
    tags: ['棋盤', '翻轉', '圖樣'], defaultText: '交錯', suitableFor: ['圖樣', '背景'],
    implementationNotes: '每格的翻轉時間 = 對角線索引 × 延遲 + 奇偶偏移，rotateX 翻到背面時換色；與尺寸脈衝不同，這是翻面與換色。',
  },
  {
    id: 'roller-path', nameZh: '雲霄飛車路徑', nameEn: 'Roller Path', category: 'flow', difficulty: I, renderer: 'svg',
    description: '文字沿 ∞ 形軌道前進，每個字的角度跟隨路徑切線。',
    tags: ['路徑', '切線', '趣味'], defaultText: '自由穿梭', suitableFor: ['速度', '趣味'],
    implementationNotes: 'SVG 路徑以 getPointAtLength 取樣位置與切線角，字元依弧長間距排列；速度隨高度變化（下坡較快）。',
  },
  {
    id: 'shuffle-letters', nameZh: '字母洗牌', nameEn: 'Shuffle Letters', category: 'switch', difficulty: B, renderer: 'dom',
    description: '字元的位置被打亂並互相交換，最後回到正確順序。',
    tags: ['洗牌', '交換', '拼字'], defaultText: '重新排列', suitableFor: ['遊戲', '拼字'],
    implementationNotes: '以 seed 產生多輪排列，字元沿弧線在槽位間移動（上下錯開避免重疊）；與亂碼解碼不同，字元內容不變，只有位置改變。',
  },
  // 65–80 延伸互動與實驗
  {
    id: 'cursor-repel', nameZh: '游標排斥', nameEn: 'Cursor Repel', category: 'interactive', difficulty: I, renderer: 'dom',
    description: '指標靠近時附近的字被推開，離開後以彈簧歸位；預覽時自動示範。',
    tags: ['指標', '彈簧', '互動'], defaultText: '靠近試試', suitableFor: ['互動標題'],
    implementationNotes: '每個字有獨立彈簧（固定步長模擬），排斥力以 (1 − d/R)² 隨距離衰減，只影響半徑內的字；阻尼保證不會無限震盪。',
  },
  {
    id: 'spotlight-reveal', nameZh: '聚光燈顯字', nameEn: 'Spotlight Reveal', category: 'interactive', difficulty: B, renderer: 'dom',
    description: '文字原本隱沒在暗處，柔邊光圈照到的地方才亮起來。',
    tags: ['光圈', '遮罩', '探索'], defaultText: '看見可能', suitableFor: ['探索', '品牌'],
    implementationNotes: '亮字層以 radial-gradient 的 mask-image 只露出光圈範圍；光圈跟隨指標，閒置或卡片預覽時自動掃光。',
  },
  {
    id: 'breathing-tracking', nameZh: '呼吸字距', nameEn: 'Breathing Tracking', category: 'flow', difficulty: B, renderer: 'dom',
    description: '字距像呼吸一樣緩慢展開再收回，伴隨微幅透明度變化。',
    tags: ['字距', '冥想', '緩慢'], defaultText: '留一點空間', suitableFor: ['安靜', '冥想'],
    implementationNotes: '只改變字與字的間距（每字 x 位移由中心向外遞增），字本身不縮放；4 秒吸、6 秒吐的 sine.inOut 節奏。',
  },
  {
    id: 'spring-chain', nameZh: '彈簧字串', nameEn: 'Spring Chain', category: 'interactive', difficulty: A, renderer: 'dom',
    description: '字元像被彈簧串在一起，拖動一端時動作沿字串延遲傳遞並衰減。',
    tags: ['彈簧', '拖曳', '物理'], defaultText: '一起擺動', suitableFor: ['互動', '物理感'],
    implementationNotes: '質點彈簧鏈（Verlet / 半隱式 Euler），首字跟隨指標或自動路徑，其餘字受相鄰彈簧與回原位的弱彈簧牽引；連線以 SVG 繪製。',
  },
  {
    id: 'scanline-reveal', nameZh: '掃描線顯字', nameEn: 'Scanline Reveal', category: 'switch', difficulty: I, renderer: 'canvas',
    description: '掃描線由上而下經過，字形以一條條水平線逐步顯現，最後穩定成實心字。',
    tags: ['掃描', '科技', '識別'], defaultText: '掃描完成', suitableFor: ['科技', '識別'],
    implementationNotes: 'Canvas 以文字遮罩為底，掃描線上方的區域先以間隔線條顯示，再逐漸填滿為實心；字形不分裂、不位移。',
  },
  {
    id: 'outline-draw', nameZh: '描邊成字', nameEn: 'Outline Draw', category: 'material', difficulty: I, renderer: 'svg',
    description: '先沿字形輪廓描出線條，描完後再填入實心顏色。',
    tags: ['描邊', '字形輪廓', 'Logo'], defaultText: '輪廓', suitableFor: ['Logo', '精緻登場'],
    implementationNotes: 'SVG <text> 套用 stroke-dasharray / stroke-dashoffset，瀏覽器會沿真實字形輪廓繪製虛線，因此描線就是字形本身的外框，不是矩形框。',
  },
  {
    id: 'ink-bleed', nameZh: '墨水暈染', nameEn: 'Ink Bleed', category: 'material', difficulty: A, renderer: 'svg',
    description: '字形像墨水滲入紙面，從乾淨的輪廓逐步出現邊緣擴散與墨暈。',
    tags: ['墨水', '濾鏡', '書寫'], defaultText: '墨', suitableFor: ['文化', '書寫氛圍'],
    implementationNotes: 'SVG 濾鏡鏈：feMorphology 擴張 + feTurbulence 驅動的 feDisplacementMap 產生不規則邊緣，墨暈層與清晰字形層分開，字形始終可辨識。',
  },
  {
    id: 'paper-peel', nameZh: '紙片揭露', nameEn: 'Paper Peel', category: 'switch', difficulty: I, renderer: 'dom',
    description: '覆蓋在文字上的紙片從一角捲起掀開，露出下方的文字。',
    tags: ['揭曉', '折角', '活動'], defaultText: '揭開新章', suitableFor: ['揭曉', '活動'],
    implementationNotes: '紙片以 clip-path 沿移動的折線裁切，折起的背面是鏡像三角形並帶漸層陰影；文字本體不動。',
  },
  {
    id: 'text-blinds', nameZh: '百葉窗文字', nameEn: 'Text Blinds', category: 'switch', difficulty: I, renderer: 'dom',
    description: '文字被切成多條水平切片，切片像百葉窗依序翻轉，換成新的詞。',
    tags: ['切片', '翻轉', '切換'], defaultText: '另一個視角', suitableFor: ['切換', '節奏'],
    implementationNotes: '每條切片是一個 3D 小稜柱：正面顯示舊詞的該段、底面顯示新詞的該段（以 clip-path 對齊），rotateX 依序翻轉 90°。',
  },
  {
    id: 'glass-refraction', nameZh: '玻璃折射', nameEn: 'Glass Refraction', category: 'material', difficulty: A, renderer: 'canvas',
    description: '一塊可移動的玻璃經過文字，只在玻璃內產生偏移、放大與輕微色散。',
    tags: ['折射', '色散', '材質'], defaultText: '折射', suitableFor: ['實驗', '精緻材質'],
    implementationNotes: 'Canvas 先繪製文字，再對玻璃區域以位移貼圖逐像素取樣（RGB 三通道偏移量不同造成色散）；玻璃外的像素完全不變。',
  },
  {
    id: 'eclipse-text', nameZh: '日蝕文字', nameEn: 'Eclipse Text', category: 'material', difficulty: I, renderer: 'svg',
    description: '圓形遮擋物緩慢掠過文字，遮住的部分只剩邊緣的輪廓光。',
    tags: ['遮擋', '輪廓光', '神祕'], defaultText: '光與影', suitableFor: ['神祕', '品牌開場'],
    implementationNotes: 'SVG mask：實心字被移動的圓遮蔽，圓內改顯示細描邊的字，圓周外圍有日冕光暈，清楚呈現前後遮擋關係。',
  },
  {
    id: 'topographic-text', nameZh: '等高線文字', nameEn: 'Topographic Text', category: 'material', difficulty: A, renderer: 'canvas',
    description: '同一字形的多層輪廓像等高線一樣向外擴張，每層之間有相位差。',
    tags: ['等高線', '字形偏移', '藝術'], defaultText: '地形', suitableFor: ['藝術', '背景'],
    implementationNotes: '以不同線寬描繪字形外框（strokeText）再挖空內側，得到與字形平行的偏移輪廓；各層偏移距離隨時間循環擴張，不是同心圓。',
  },
  {
    id: 'shard-assemble', nameZh: '文字碎片拼合', nameEn: 'Shard Assemble', category: 'material', difficulty: A, renderer: 'canvas',
    description: '字形被切成多邊形碎片，碎片從畫面外旋轉飛入並準確拼回原位。',
    tags: ['碎片', '多邊形', '重建'], defaultText: '完整', suitableFor: ['重建', '品牌'],
    implementationNotes: '以擾動網格把文字區域切成三角形，只保留覆蓋字形的碎片；每片以 clip 繪製文字貼圖並插值位移與旋轉，最終誤差為零。',
  },
  {
    id: 'audio-reactive', nameZh: '音頻節奏字', nameEn: 'Audio Reactive Type', category: 'interactive', difficulty: A, renderer: 'canvas',
    description: '依音量與頻段改變文字的尺度、字重與排列；預設使用模擬頻譜，可選本機音檔。',
    tags: ['音訊', '頻譜', 'Web Audio'], defaultText: '聽見節奏', suitableFor: ['音樂視覺'],
    implementationNotes: '預設以固定 seed 產生的模擬頻譜驅動；選擇本機音檔後才建立 AudioContext 與 AnalyserNode，不使用麥克風，離開頁面即停止。',
  },
  {
    id: 'scroll-story', nameZh: '滾動敘事字', nameEn: 'Scroll Story Type', category: 'interactive', difficulty: I, renderer: 'dom',
    description: '在舞台內捲動時，捲動進度控制分段顯字、位移與縮放。',
    tags: ['捲動', '敘事', 'Scroll'], defaultText: '向下，故事開始', suitableFor: ['敘事網站'],
    implementationNotes: '詳情舞台內是一個可捲動區域，scrollTop / scrollHeight 換算成進度；卡片預覽與播放模式以自動進度模擬，不攔截頁面滾輪。',
  },
  {
    id: 'metaball-type', nameZh: '距離場變形', nameEn: 'Metaball Type', category: 'interactive', difficulty: A, renderer: 'svg',
    description: '字元邊界柔軟融合，相鄰字靠近時形成液態連接，再緩緩分開。',
    tags: ['gooey', '液態', '濾鏡'], defaultText: '融合', suitableFor: ['液態', '實驗字體'],
    implementationNotes: 'SVG gooey 濾鏡（feGaussianBlur + feColorMatrix 提高 alpha 對比）讓靠近的字形融合；液態階段有時間上限，之後回到清晰字形。',
  },
];

export const CATALOG: EffectMeta[] = LIST.map((m, i) => ({ ...m, number: i + 1 }));

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, (typeof CATEGORIES)[number]>;
