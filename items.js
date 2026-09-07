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
       预存词库（供以后新品类使用，未在本周数据中出现，暂未改动）
       =========================== */

    "bbq pork belly": "烧烤五花肉",
    "lamb shanks": "羊腱子",
    "beef brisket": "牛腩",
    "fresh ginger": "生姜",
    "cilantro": "香菜",
    "chinese eggplant": "中国茄子",
    "fresh spinach": "菠菜",
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
    "fresh beef steak aaa": "AAA 牛排",
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
    "egg tarts": "蛋挞"
  };

  window.SupermarketItems = {
    glossary: GLOSSARY,

    /* 以后如果你想在控制台里动态加条目，也可以用这个方法 */
    add: function (en, cn) {
      GLOSSARY[String(en || '').trim().toLowerCase()] = cn;
    }
  };
})();
