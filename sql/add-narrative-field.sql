-- ============================================================
-- 家族迁徙平台 · 添加叙事字段
-- 为 migrations 表添加 narrative 字段，用于存储长篇迁徙故事
-- ============================================================

-- 1. 添加 narrative 字段
ALTER TABLE migrations
ADD COLUMN IF NOT EXISTS narrative TEXT;

-- 2. 添加字段注释
COMMENT ON COLUMN migrations.narrative IS '迁徙亲历者叙事（长篇故事）';

-- 3. 为林家 (闯关东) 添加叙事内容
UPDATE migrations SET narrative =
'「那天凌晨，天还没亮，父亲就把我叫醒。家里所有值钱的东西，就是几件破衣服和一袋干粮。

码头上全是人，大家都沉默着，没人知道过了海会是什么日子。船很小，浪很大，母亲抱着妹妹一直在哭。

我说别怕，过了海就有好日子了。可我自己心里也没底……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '林家')
AND sequence_order = 1;

UPDATE migrations SET narrative =
'「在营口歇了两年，还是站不住脚。听说北边有荒地可以开垦，咬咬牙又往北走。

一路上全是土路，马车走了半个月。到哈尔滨那天，下着大雪，天地间白茫茫一片。

我指着脚下的地说，就在这里了，这辈子再也不挪窝。没想到，这一待就是三代人……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '林家')
AND sequence_order = 2;

-- 4. 为陈家 (抗战西迁) 添加叙事内容
UPDATE migrations SET narrative =
'「1937 年 8 月 13 日，淞沪会战爆发。南京城里的空气每天都绷得紧紧的。

15 号那天，学校通知我紧急撤离。我只来得及收拾几箱书，还有文渊的手稿。码头上人山人海，船票早就卖光了。

最后是一位熟识的船长，看我们是教书的，悄悄让我们上了船。回头望着南京的方向，心里想，什么时候才能回来啊……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '陈家')
AND sequence_order = 1;

UPDATE migrations SET narrative =
'「在武汉待了不到一年，日本人已经打到安庆了。1938 年春天，我们跟着中央大学的队伍往重庆撤。

一路上走的都是山路，汽车在悬崖边上开，下面是万丈深渊。

到了重庆，住在歌乐山脚下，房子是土坯的，下雨天漏水。但好歹一家人在一起，孩子们还能继续读书……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '陈家')
AND sequence_order = 2;

UPDATE migrations SET narrative =
'「1945 年 8 月 15 日那天，整个重庆都在放鞭炮。八年了，终于等到了。

1946 年春天，我们坐船回南京。还是那个码头，还是那条长江，可已经不是当年的心情了。

家里的老房子还在，虽然破败了不少。站在院子里，想起离开那天的慌乱，恍如隔世……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '陈家')
AND sequence_order = 3;

-- 5. 为赵家 (三线建设) 添加叙事内容
UPDATE migrations SET narrative =
'「1964 年，厂里动员支援大西北。说是要建石化基地，需要技术骨干。我想都没想就报了名。秀英说，你去哪我去哪。

把上海的房子退了，家具全送了人，就带着几件行李和儿子的奶粉，坐上西去的火车。三天三夜，到了兰州。

一下车，满嘴都是土腥味。可这是自己选的路，跪着也要走下去……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '赵家')
AND sequence_order = 1;

UPDATE migrations SET narrative =
'「77 年冬天，广播里说恢复高考了。建华那小子高兴得跳起来，说他要考大学。那时候他都 19 岁了，在厂里当学徒。

每天晚上干活回来，就点着煤油灯看书。第二年夏天，收到西安交大的录取通知书。全家人在厂门口放了一挂鞭炮。

送他去车站那天，我没说话，就是拍着他的肩膀。他知道，这是咱们家翻身的机会……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '赵家')
AND sequence_order = 2;

UPDATE migrations SET narrative =
'「82 年毕业，建华说想回上海。我没拦他，说你想去哪就去哪。他说爸，我想回咱们老家看看。

我说好啊，你爷爷奶奶当年就是从上海出来的。他走那天，我送到火车站，看着火车远去。

心里想，这辈子，总算是把根从上海挪到了兰州，又从兰州散到了四面八方。可只要一家人平平安安，根在哪里，又有什么关系呢……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '赵家')
AND sequence_order = 3;

-- 6. 为周家 (南下创业) 添加叙事内容
UPDATE migrations SET narrative =
'「85 年，厂里说下岗就下岗了。拿了 500 块补偿金，留了 200 块，剩下的都给家里。梅子说，要不咱做点小生意？

我说要做就去深圳，那是特区，有机会。走那天，儿子才 5 岁，抱着我的腿哭。我说爸爸去挣钱，回来给你买大房子。

其实心里一点底都没有，就知道那边要人肯吃苦……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '周家')
AND sequence_order = 1;

UPDATE migrations SET narrative =
'「志强走了两年，梅子在家照顾老人孩子。87 年春天，她说要去深圳找志强。家里人都拦着，说一个女人家跑那么远不安全。

她说我不管，夫妻总不能一辈子两地分居。到深圳那天，志强来接她，瘦得不成样子。

他说你来了就好，咱俩一起干，总能把日子过起来……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '周家')
AND sequence_order = 2;

UPDATE migrations SET narrative =
'「天宇从小就聪明，考上了广州的大学，后来在深圳工作。10 年说公司要调他去广州，做区域经理。

我说好啊，离家近。他说爸，你和妈要不要一起过来？我说我们老了，在深圳挺好的，你去了好好干。

他走那天，梅子哭了，说孩子长大了，飞得越来越远。可这不就是我们想要的吗……」'
WHERE family_id = (SELECT id FROM family_profiles WHERE family_name = '周家')
AND sequence_order = 3;

-- ============================================================
-- 验证：查看各家族迁徙记录的叙事字段状态
-- ============================================================
SELECT
  fp.family_name,
  m.sequence_order,
  m.from_place_raw || ' → ' || m.to_place_raw AS route,
  CASE
    WHEN m.narrative IS NULL THEN '无叙事'
    WHEN LENGTH(m.narrative) < 50 THEN '短叙事 (' || LENGTH(m.narrative) || '字)'
    ELSE '长叙事 (' || LENGTH(m.narrative) || '字)'
  END AS narrative_status
FROM migrations m
JOIN family_profiles fp ON m.family_id = fp.id
ORDER BY fp.family_name, m.sequence_order;
