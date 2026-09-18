/* items.js — 商品中英文对照库（只增不减，中英文 key/value 都用最基础的商品名）
   规则：
   1. key = 英文 normalize 后的小写字符串——不含品牌、产地、状态词（Fresh/Live/Frozen）、
      规格数量（454g、10lb、(Large)），只留"这是什么东西"这一层
   2. value = 中文名称，同样去掉品牌/产地/状态词，只留最基础的中文名
   3. 每周有新品时，只在 GLOSSARY 里"增加一条"，不删除旧条目
   4. 规格/数量/品牌信息放进 deals-data.json 的 price 字段，不放进商品名
*/

(function () {
  const GLOSSARY = {

    /* ===========================
       本项目当前实际使用的商品
       （已统一精简为最基础中英文名）
       =========================== */

    "saury fish": "秋刀鱼",
    "sea cucumber": "海参",
    "tilapia": "罗非鱼",
    "lobster": "龙虾",
    "blue crab": "蓝蟹",
    "pork chop": "猪排",
    "korean cabbage": "高丽菜",
    "rice sticks": "粿条",
    "light soy sauce": "生抽",
    "instant noodles": "方便面",
    "pork bone": "猪骨",
    "sour mustard": "酸芥菜",
    "luncheon meat": "午餐肉",
    "chicken breast": "鸡胸肉",
    "salmon fillet": "三文鱼柳",
    "white bread": "白面包",
    "2% milk": "2%牛奶",
    "tuna": "金枪鱼",
    "oranges": "橙子",
    "avocado": "牛油果",
    "chicken wings": "鸡翅",
    "bananas": "香蕉",
    "eggs": "鸡蛋",
    "chicken drumsticks": "鸡腿",
    "hotdog": "热狗",
    "ground beef": "免治牛肉",
    "potatoes": "土豆",
    "juice": "果汁",
    "watermelon": "西瓜",

    /* ===========================
       2026-09-09 新增（Food Basics / No Frills / FreshCo 9月10-16特价）
       =========================== */

    "eye of round roast": "牛霖烤肉",
    "pork tenderloin": "猪柳",
    "pork loin": "猪展肉",
    "grapes": "葡萄",
    "strawberries": "草莓",
    "yogurt": "酸奶",
    "carrots": "胡萝卜",
    "onions": "洋葱",
    "chicken wieners": "鸡肉热狗肠",
    "cauliflower": "椰菜花",
    "bell pepper": "甜椒",
    "butter": "牛油",
    "blackberries": "黑莓",
    "romaine hearts": "罗马生菜心",
    "sweet corn": "甜玉米",

    /* ===========================
       2026-09-16 新增（Food Basics / No Frills / FreshCo 9月17-23特价）
       =========================== */

    "sirloin tip roast": "西冷烤牛肉尖",
    "janes chicken": "Janes炸鸡粒",
    "coca-cola": "可口可乐",
    "villaggio bread": "Villaggio面包",
    "bok choy": "白菜",
    "asian yellow pears": "亚洲黄梨",
    "honey pomelo": "蜜柚",
    "red onions": "红洋葱",
    "pork belly": "五花肉",
    "lean ground pork": "瘦猪肉碎",
    "schneiders bacon": "Schneiders培根",

    /* ===========================
       2026-09-18 新增（冠业 / 百福 9月18-24特价）
       =========================== */

    "pork shoulder butt": "梅头肉",
    "pork shoulder blade": "猪肩肉",
    "butter chicken": "黄油鸡",
    "beef shank": "牛腱",
    "beef rib finger meat": "牛仔骨条",
    "young duck": "嫩鸭",
    "beef short ribs": "牛仔骨",
    "beef chunk roll": "牛肩卷",
    "lamb shoulder": "羊肩",
    "beef chuck rib": "牛肩排",
    "fragrant pears": "香梨",
    "mandarin": "柑橘",
    "longan": "龙眼",
    "prune plum": "西梅",
    "lemon": "柠檬",
    "tong ho": "茼蒿",
    "ginger": "生姜",
    "mustard greens": "芥菜",
    "baby napa": "娃娃菜",
    "iron yam": "铁棍山药",
    "water chestnut": "马蹄",
    "seafood mushroom": "海鲜菇",
    "top shell snail": "花螺",
    "butterfish": "瓜子鱼",
    "dungeness crab": "温哥华蟹",
    "cherrystone clams": "蛤蜊",
    "spanish mackerel": "花鲛鱼",
    "white eel": "白鳝",
    "oyster meat": "蚝肉",
    "pomelo": "柚子",
    "golden kiwi": "黄金奇异果",
    "dragon fruit": "火龙果",
    "yu choy": "油菜苗",
    "peanuts": "花生",
    "king oyster mushrooms": "杏鲍菇",
    "beech mushrooms": "松茸菇",
    "eggplant": "茄子",
    "celery": "西芹",
    "garlic stem": "蒜芯",
    "pork ham bone": "猪筒骨",
    "pork back ribs": "猪肉排",
    "beef striploin": "牛扒",
    "beef tripe": "牛肚",
    "white perch": "单线鱼",
    "sea eel": "海鳗",
    "abalone": "鲍鱼",
    "sea bream": "海银立",
    "basa fillets": "龙利鱼柳",
    "grouper": "石斑鱼",
    "pomfret": "金鲳鱼",
    "black tiger shrimp": "黑虎虾",
    "razor clams": "蛏子",
    "mussels": "青口",
    "shrimp dumplings": "虾饺",
    "cuttlefish cakes": "墨鱼饼",
    "dumplings": "水饺",
    "cup noodles": "杯面",
    "rice vermicelli": "排粉",
    "japanese curry": "日本咖喱",
    "shiitake mushrooms": "冬菇",
    "pearl barley": "生薏米",
    "honey dates": "蜜枣",
    "salted eggs": "咸蛋",
    "mooncakes": "月饼",

    /* ===========================
       2026-09-18 新增（FreshCo / No Frills / Food Basics 9月17-23特价）
       =========================== */

    "basa steaks": "巴沙鱼扒",
    "jasmine rice": "茉莉香米",
    "udon noodles": "乌冬面",
    "scallion pancakes": "葱油饼",
    "chestnuts": "板栗",
    "soy sauce": "酱油",
    "coconut milk": "椰浆",
    "sriracha": "是拉差辣酱",
    "honey": "蜂蜜",
    "chicken broth": "鸡汤",
    "mayonnaise": "蛋黄酱",
    "vegetable oil": "植物油",
    "bacon": "培根",
    "raspberries": "覆盆子",
    "sourdough bread": "酸种面包",
    "ham": "火腿",
    "evaporated milk": "淡奶",
    "salad kit": "沙拉包",
    "green cabbage": "圆白菜",
    "whole chicken": "整鸡",
    "blueberries": "蓝莓",
    "sweet potatoes": "红薯",
    "limes": "青柠",
    "kiwi": "奇异果",
    "green onions": "葱",
    "pumpkin": "南瓜",
    "lettuce": "生菜",
    "beef stir-fry strips": "牛肉丝",
    "shrimp": "虾",
    "duck": "鸭",
    "clam meat": "蛤蜊肉",
    "sardines": "沙丁鱼",
    "edamame": "毛豆",
    "guava": "番石榴",
    "mango": "芒果",
    "royal gala apples": "皇家嘎啦苹果",

    /* ===========================
       2026-09-10 新增（冠业超市 9月11-17特价）
       =========================== */

    "hami melon": "哈密瓜",
    "spring lamb": "春羔羊肉",
    "beef steak aaa": "AAA牛排",
    "muscadine grapes": "麝香葡萄",
    "lean pork": "瘦肉",
    "tango mandarin": "柑橘",

    /* ===========================
       预存词库（供以后新品类使用，未在本周数据中出现，暂未改动）
       =========================== */

    "bbq pork belly": "烧烤五花肉",
    "lamb shanks": "羊腱子",
    "beef brisket": "牛腩",
    "fresh ginger": "生姜",
    "cilantro": "香菜",
    "chinese eggplant": "中国茄子",
    "fresh green radish": "青萝卜",
    "fresh tong ho": "茼蒿",
    "fresh shanghai miu": "上海苗",
    "fresh baby choy sum": "小菜心",
    "fresh watercress": "西洋菜",
    "fresh water jujube": "鲜蜜枣",
    "shine muscat grapes": "香印青提",
    "tianshan honey pear": "天山蜜梨",
    "wogan mandarin seedless": "无核沃柑",
    "south africa seedless orange": "南非无籽橙",
    "fresh silky chicken": "乌鸡",
    "fresh pork spare rib": "鲜排骨",
    "fresh beef shank": "牛腱",
    "fresh butter chicken": "鲜黄油鸡",
    "fresh pork side ribs bbq": "鲜排骨（BBQ款）",
    "fresh beef rib boneless finger meat": "牛仔骨条",
    "nz lamb shortloin saddle": "新西兰羊里脊",
    "bbq beef short ribs": "烧烤牛仔骨",
    "black angus beef chunk roll": "安格斯牛肩卷",
    "boneless lamb shoulder": "去骨羊肩",
    "fresh skin-on pork belly": "带皮五花肉",
    "fresh beef brisket full": "整块牛腩",

    "prb vinegar sweetened": "PRB 甜醋",
    "prb light soy sauce": "PRB 生抽",
    "prb sauce series": "PRB 酱料系列",
    "prb soy sauce": "PRB 酱油",
    "prb sesame oil": "PRB 香油",
    "prb chili fermented bean curd": "PRB 辣腐乳",
    "prb vinegar": "PRB 醋",
    "prb seasoned soy sauce": "PRB 调味酱油",
    "prb yellow rock sugar": "PRB 黄冰糖",
    "prb jiangxi rice noodle": "PRB 江西米粉",
    "prb monosodium glutamate": "PRB 味精",

    "kohlrabi": "球茎甘蓝",
    "napa cabbage": "大白菜",
    "purple cabbage": "紫甘蓝",
    "winter melon": "冬瓜",
    "spinach": "菠菜",
    "corn": "玉米",
    "tomatoes": "西红柿",
    "cucumbers": "黄瓜",
    "green pepper": "青椒",
    "red pepper": "红椒",
    "mushrooms": "蘑菇",
    "pears": "梨",
    "apples": "苹果",
    "honeydew": "蜜瓜",
    "cantaloupe": "哈密瓜",

    "seaweed salad": "海藻沙拉",
    "alaska roll": "阿拉斯加卷",
    "lobster roll": "龙虾卷",
    "classic combo": "经典寿司拼盘",
    "maki tray b": "寿司卷拼盘 B",

    "roast duck": "烧鸭",
    "soy sauce chicken leg": "豉油鸡腿",
    "sesame balls lotus paste": "莲蓉芝麻球",
    "steam shrimp rice roll": "鲜虾肠粉",
    "steamed glutinous corn": "糯玉米",
    "deep fried dough stick": "油条",
    "steam beancurd skin roll": "腐皮卷",

    "beef ho fen": "牛肉河粉",
    "sweet sour pork": "糖醋里脊",
    "mushroom chicken": "蘑菇鸡",
    "mixed vegetables": "杂菜",
    "stir fried green beans": "干煸四季豆",
    "salt pepper shrimp with head": "椒盐带头虾",
    "beef with mushroom": "蘑菇牛肉",

    "wonder white bread": "Wonder 白面包",
    "wonder hamburger bun": "Wonder 汉堡包",
    "wonder hotdog buns": "Wonder 热狗包",
    "crispy tandoori naan": "脆皮印度馕",
    "crispy cake rush series": "脆皮蛋糕系列",
    "crispy sliced loaf series": "脆皮切片面包系列",
    "dempsters bread": "Dempster's 面包",
    "me le wa coconut bun": "椰蓉包",
    "dimanno dinner rolls": "Di Manno 晚餐卷",
    "kevins baked cheese cake": "Kevin's 芝士蛋糕",
    "larooca cake slices": "Larooca 蛋糕片",
    "tan hue vien snow flake cake": "天惠雪花饼",
    "egg tarts": "蛋挞",

    /* ===========================
       2026-09-11 新增（百福 9月11-17特价）
       =========================== */

    "broccoli": "西兰花",
    "pork spare ribs": "排骨",
    "ground lean pork": "瘦肉碎",
    "mini cucumbers": "迷你青瓜",
    "salmon steaks": "三文鱼扒",
    "pork ham meat": "猪后腿肉",
    "bok choy sum": "白菜芯",
    "shanghai bok choy": "上海白菜",
    "kabocha squash": "西人南瓜",
    "taro": "大芋头",
    "coral trout": "东星斑",
    "whiting": "竹签鱼",
    "sole fish": "挞沙",
    "sea urchin": "海胆",
    "yellow croaker": "黄旗斑",
    "beef back ribs": "牛排骨",
    "beef finger meat": "牛坑腩",
    "chicken mid wings": "鸡中翅",
    "grade u duck": "U级鸭",
    "chinese sausage": "腊肠"
  };

  window.SupermarketItems = {
    glossary: GLOSSARY,

    /* 以后如果你想在控制台里动态加条目，也可以用这个方法 */
    add: function (en, cn) {
      GLOSSARY[String(en || '').trim().toLowerCase()] = cn;
    }
  };
})();
