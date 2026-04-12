/**
 * 旺祖 — 亲属关系数据库 (KinshipDatabase)
 * ============================================================
 * 权威数据源，覆盖四代亲属（太祖辈 gen-3 → 孙辈 gen+2）
 * 同时服务于：
 *   1. NLP 解析引擎（关键词匹配 + 歧义消除）
 *   2. 智能补全向导（getMissingRelations 推导缺失项）
 *
 * 字段说明：
 *   id              唯一 relationType 标识符
 *   displayName     界面显示名称
 *   aliases         所有同义/口语说法（NLP 匹配用）
 *   gender          male | female | unknown
 *   generation      相对代际  -3=太祖 -2=祖 -1=父 0=同辈 1=子 2=孙
 *   priority        填写优先级，数字越小越优先显示
 *   alwaysAvailable 无需前提，始终出现在补全列表
 *   availableIf     前提 relationType 列表（OR 关系，满足任一即显示）
 *   selfGender      限定"我"的性别 any | male | female
 *   icon            界面图标
 * ============================================================
 */

const KINSHIP_RELATIONS = [

  // ══════════════════════════════════════════════════════
  //  GEN 0  自辈 — 自己 & 配偶
  // ══════════════════════════════════════════════════════
  {
    id: 'self', displayName: '我', gender: 'unknown', generation: 0,
    priority: 0, alwaysAvailable: true, selfGender: 'any', icon: '👤',
    aliases: ['我', '我叫', '我是', '我的名字是', '本人']
  },
  {
    id: 'spouse_female', displayName: '妻子', gender: 'female', generation: 0,
    priority: 3, alwaysAvailable: true, selfGender: 'male', icon: '👩',
    aliases: ['妻子', '老婆', '太太', '爱人', '媳妇', '夫人', '内人', '娘子', '堂客']
  },
  {
    id: 'spouse_male', displayName: '丈夫', gender: 'male', generation: 0,
    priority: 3, alwaysAvailable: true, selfGender: 'female', icon: '👨',
    aliases: ['丈夫', '老公', '先生', '爱人', '夫君', '相公', '当家的']
  },

  // ══════════════════════════════════════════════════════
  //  GEN -1  父辈 — 父母
  // ══════════════════════════════════════════════════════
  {
    id: 'father', displayName: '父亲', gender: 'male', generation: -1,
    priority: 1, alwaysAvailable: true, selfGender: 'any', icon: '👨',
    aliases: ['爸爸', '父亲', '爸', '老爸', '爹', '爹爹', '阿爸', '老爷子', '爸咪']
  },
  {
    id: 'mother', displayName: '母亲', gender: 'female', generation: -1,
    priority: 2, alwaysAvailable: true, selfGender: 'any', icon: '👩',
    aliases: ['妈妈', '母亲', '妈', '老妈', '娘', '娘亲', '阿妈', '妈咪', '老母亲']
  },

  // ══════════════════════════════════════════════════════
  //  GEN -2  祖辈 — 祖父母 / 外祖父母
  // ══════════════════════════════════════════════════════
  {
    id: 'grandfather_paternal', displayName: '爷爷', gender: 'male', generation: -2,
    priority: 5, alwaysAvailable: false, availableIf: ['father'], selfGender: 'any', icon: '👴',
    aliases: ['爷爷', '祖父', '阿公', '爷', '老爷爷', '爷爷大人']
  },
  {
    id: 'grandmother_paternal', displayName: '奶奶', gender: 'female', generation: -2,
    priority: 6, alwaysAvailable: false, availableIf: ['father'], selfGender: 'any', icon: '👵',
    aliases: ['奶奶', '祖母', '阿婆', '奶', '老奶奶', '祖婆']
  },
  {
    id: 'grandfather_maternal', displayName: '外公', gender: 'male', generation: -2,
    priority: 7, alwaysAvailable: false, availableIf: ['mother'], selfGender: 'any', icon: '👴',
    aliases: ['外公', '外祖父', '姥爷', '外爷', '姥姥爷', '老外公']
  },
  {
    id: 'grandmother_maternal', displayName: '外婆', gender: 'female', generation: -2,
    priority: 8, alwaysAvailable: false, availableIf: ['mother'], selfGender: 'any', icon: '👵',
    aliases: ['外婆', '外祖母', '姥姥', '外奶奶', '老外婆', '姥']
  },

  // ══════════════════════════════════════════════════════
  //  GEN -3  太祖辈 — 曾祖父母 / 曾外祖父母
  // ══════════════════════════════════════════════════════
  {
    id: 'great_grandfather_paternal', displayName: '太爷爷', gender: 'male', generation: -3,
    priority: 30, alwaysAvailable: false, availableIf: ['grandfather_paternal'], selfGender: 'any', icon: '👴',
    aliases: ['太爷爷', '曾祖父', '老太爷', '太爷', '曾爷爷']
  },
  {
    id: 'great_grandmother_paternal', displayName: '太奶奶', gender: 'female', generation: -3,
    priority: 31, alwaysAvailable: false, availableIf: ['grandfather_paternal'], selfGender: 'any', icon: '👵',
    aliases: ['太奶奶', '曾祖母', '老太太', '太奶', '曾奶奶']
  },
  {
    id: 'great_grandfather_maternal', displayName: '太外公', gender: 'male', generation: -3,
    priority: 32, alwaysAvailable: false, availableIf: ['grandfather_maternal'], selfGender: 'any', icon: '👴',
    aliases: ['太外公', '曾外祖父', '老外公', '太姥爷', '老太外公']
  },
  {
    id: 'great_grandmother_maternal', displayName: '太外婆', gender: 'female', generation: -3,
    priority: 33, alwaysAvailable: false, availableIf: ['grandfather_maternal'], selfGender: 'any', icon: '👵',
    aliases: ['太外婆', '曾外祖母', '老外婆', '太姥姥', '老太外婆']
  },

  // ══════════════════════════════════════════════════════
  //  GEN -1  父辈 — 父系叔伯姑
  // ══════════════════════════════════════════════════════
  {
    id: 'uncle_paternal_elder', displayName: '伯父', gender: 'male', generation: -1,
    priority: 15, alwaysAvailable: false, availableIf: ['father'], selfGender: 'any', icon: '👨',
    aliases: ['伯父', '伯伯', '大爷', '大爸', '大伯父', '二伯', '三伯', '大爹']
  },
  {
    id: 'aunt_paternal_elder_wife', displayName: '伯母', gender: 'female', generation: -1,
    priority: 16, alwaysAvailable: false, availableIf: ['uncle_paternal_elder'], selfGender: 'any', icon: '👩',
    aliases: ['伯母', '大娘', '大妈', '大伯母', '二伯母', '三伯母', '大伯娘']
  },
  {
    id: 'uncle_paternal_younger', displayName: '叔叔', gender: 'male', generation: -1,
    priority: 17, alwaysAvailable: false, availableIf: ['father'], selfGender: 'any', icon: '👨',
    aliases: ['叔叔', '叔父', '大叔', '二叔', '三叔', '四叔', '小叔父', '阿叔']
  },
  {
    id: 'aunt_paternal_younger_wife', displayName: '婶婶', gender: 'female', generation: -1,
    priority: 18, alwaysAvailable: false, availableIf: ['uncle_paternal_younger'], selfGender: 'any', icon: '👩',
    aliases: ['婶婶', '婶母', '婶子', '叔妈', '二婶', '三婶', '小婶', '阿婶']
  },
  {
    id: 'aunt_paternal', displayName: '姑姑', gender: 'female', generation: -1,
    priority: 19, alwaysAvailable: false, availableIf: ['father'], selfGender: 'any', icon: '👩',
    aliases: ['姑姑', '姑妈', '姑母', '大姑', '二姑', '三姑', '小姑', '阿姑', '姑娘']
  },
  {
    id: 'uncle_paternal_by_marriage', displayName: '姑父', gender: 'male', generation: -1,
    priority: 20, alwaysAvailable: false, availableIf: ['aunt_paternal'], selfGender: 'any', icon: '👨',
    aliases: ['姑父', '姑夫', '大姑父', '二姑父', '三姑父', '小姑父']
  },

  // ══════════════════════════════════════════════════════
  //  GEN -1  父辈 — 母系舅姨
  // ══════════════════════════════════════════════════════
  {
    id: 'uncle_maternal', displayName: '舅舅', gender: 'male', generation: -1,
    priority: 21, alwaysAvailable: false, availableIf: ['mother'], selfGender: 'any', icon: '👨',
    aliases: ['舅舅', '舅', '大舅', '二舅', '三舅', '小舅', '舅父', '阿舅']
  },
  {
    id: 'aunt_maternal_by_marriage', displayName: '舅妈', gender: 'female', generation: -1,
    priority: 22, alwaysAvailable: false, availableIf: ['uncle_maternal'], selfGender: 'any', icon: '👩',
    aliases: ['舅妈', '舅母', '大舅妈', '二舅妈', '三舅妈', '小舅妈', '舅娘']
  },
  {
    id: 'aunt_maternal', displayName: '姨妈', gender: 'female', generation: -1,
    priority: 23, alwaysAvailable: false, availableIf: ['mother'], selfGender: 'any', icon: '👩',
    aliases: ['姨妈', '姨母', '大姨', '二姨', '三姨', '小姨', '阿姨', '姨娘']
  },
  {
    id: 'uncle_maternal_by_marriage', displayName: '姨父', gender: 'male', generation: -1,
    priority: 24, alwaysAvailable: false, availableIf: ['aunt_maternal'], selfGender: 'any', icon: '👨',
    aliases: ['姨父', '姨夫', '大姨父', '二姨父', '三姨父', '小姨父']
  },

  // ══════════════════════════════════════════════════════
  //  GEN -1  父辈 — 配偶父母（岳父母 / 公婆）
  // ══════════════════════════════════════════════════════
  {
    id: 'father_in_law_wife', displayName: '岳父', gender: 'male', generation: -1,
    priority: 11, alwaysAvailable: false, availableIf: ['spouse_female'], selfGender: 'male', icon: '👨',
    aliases: ['岳父', '丈人', '老丈人', '泰山', '妻父', '老岳父']
  },
  {
    id: 'mother_in_law_wife', displayName: '岳母', gender: 'female', generation: -1,
    priority: 12, alwaysAvailable: false, availableIf: ['spouse_female'], selfGender: 'male', icon: '👩',
    aliases: ['岳母', '丈母娘', '泰水', '妻母', '老岳母', '老泰水']
  },
  {
    id: 'father_in_law_husband', displayName: '公公', gender: 'male', generation: -1,
    priority: 11, alwaysAvailable: false, availableIf: ['spouse_male'], selfGender: 'female', icon: '👨',
    aliases: ['公公', '公爹', '公婆', '丈夫的父亲', '夫父', '老公的爸爸']
  },
  {
    id: 'mother_in_law_husband', displayName: '婆婆', gender: 'female', generation: -1,
    priority: 12, alwaysAvailable: false, availableIf: ['spouse_male'], selfGender: 'female', icon: '👩',
    aliases: ['婆婆', '婆母', '丈夫的母亲', '夫母', '老公的妈妈', '婆婆大人']
  },

  // ══════════════════════════════════════════════════════
  //  GEN 0  同辈 — 兄弟姐妹
  // ══════════════════════════════════════════════════════
  {
    id: 'brother_elder', displayName: '哥哥', gender: 'male', generation: 0,
    priority: 9, alwaysAvailable: true, selfGender: 'any', icon: '👦',
    aliases: ['哥哥', '哥', '兄长', '大哥', '二哥', '三哥', '长兄', '阿哥']
  },
  {
    id: 'sister_in_law_elder', displayName: '嫂子', gender: 'female', generation: 0,
    priority: 25, alwaysAvailable: false, availableIf: ['brother_elder'], selfGender: 'any', icon: '👩',
    aliases: ['嫂子', '大嫂', '二嫂', '三嫂', '嫂嫂', '嫂嫂', '哥哥的老婆', '哥哥的妻子']
  },
  {
    id: 'brother_younger', displayName: '弟弟', gender: 'male', generation: 0,
    priority: 10, alwaysAvailable: true, selfGender: 'any', icon: '👦',
    aliases: ['弟弟', '弟', '小弟', '兄弟', '老弟', '阿弟']
  },
  {
    id: 'sister_in_law_younger', displayName: '弟媳', gender: 'female', generation: 0,
    priority: 26, alwaysAvailable: false, availableIf: ['brother_younger'], selfGender: 'any', icon: '👩',
    aliases: ['弟媳', '弟妹', '弟媳妇', '小弟媳', '弟弟的老婆', '弟弟的妻子']
  },
  {
    id: 'sister_elder', displayName: '姐姐', gender: 'female', generation: 0,
    priority: 9, alwaysAvailable: true, selfGender: 'any', icon: '👧',
    aliases: ['姐姐', '姐', '大姐', '二姐', '三姐', '长姐', '阿姐']
  },
  {
    id: 'brother_in_law_elder', displayName: '姐夫', gender: 'male', generation: 0,
    priority: 27, alwaysAvailable: false, availableIf: ['sister_elder'], selfGender: 'any', icon: '👨',
    aliases: ['姐夫', '大姐夫', '二姐夫', '三姐夫', '姐姐的老公', '姐姐的丈夫']
  },
  {
    id: 'sister_younger', displayName: '妹妹', gender: 'female', generation: 0,
    priority: 10, alwaysAvailable: true, selfGender: 'any', icon: '👧',
    aliases: ['妹妹', '妹', '小妹', '阿妹', '老妹']
  },
  {
    id: 'brother_in_law_younger', displayName: '妹夫', gender: 'male', generation: 0,
    priority: 28, alwaysAvailable: false, availableIf: ['sister_younger'], selfGender: 'any', icon: '👨',
    aliases: ['妹夫', '小妹夫', '妹妹的老公', '妹妹的丈夫']
  },

  // ══════════════════════════════════════════════════════
  //  GEN 0  同辈 — 堂兄弟姐妹（父系）
  // ══════════════════════════════════════════════════════
  {
    id: 'cousin_paternal_male_elder', displayName: '堂哥', gender: 'male', generation: 0,
    priority: 35, alwaysAvailable: false,
    availableIf: ['uncle_paternal_elder', 'uncle_paternal_younger'], selfGender: 'any', icon: '👦',
    aliases: ['堂哥', '堂兄', '大堂哥', '二堂哥', '堂兄弟']
  },
  {
    id: 'cousin_paternal_male_younger', displayName: '堂弟', gender: 'male', generation: 0,
    priority: 36, alwaysAvailable: false,
    availableIf: ['uncle_paternal_elder', 'uncle_paternal_younger'], selfGender: 'any', icon: '👦',
    aliases: ['堂弟', '小堂弟', '堂兄弟']
  },
  {
    id: 'cousin_paternal_female_elder', displayName: '堂姐', gender: 'female', generation: 0,
    priority: 37, alwaysAvailable: false,
    availableIf: ['uncle_paternal_elder', 'uncle_paternal_younger', 'aunt_paternal'], selfGender: 'any', icon: '👧',
    aliases: ['堂姐', '大堂姐', '二堂姐', '堂姐妹']
  },
  {
    id: 'cousin_paternal_female_younger', displayName: '堂妹', gender: 'female', generation: 0,
    priority: 38, alwaysAvailable: false,
    availableIf: ['uncle_paternal_elder', 'uncle_paternal_younger', 'aunt_paternal'], selfGender: 'any', icon: '👧',
    aliases: ['堂妹', '小堂妹', '堂姐妹']
  },

  // ══════════════════════════════════════════════════════
  //  GEN 0  同辈 — 表兄弟姐妹（母系 + 父系姑家）
  // ══════════════════════════════════════════════════════
  {
    id: 'cousin_maternal_male_elder', displayName: '表哥', gender: 'male', generation: 0,
    priority: 39, alwaysAvailable: false,
    availableIf: ['uncle_maternal', 'aunt_maternal', 'aunt_paternal'], selfGender: 'any', icon: '👦',
    aliases: ['表哥', '表兄', '大表哥', '二表哥', '表兄弟']
  },
  {
    id: 'cousin_maternal_male_younger', displayName: '表弟', gender: 'male', generation: 0,
    priority: 40, alwaysAvailable: false,
    availableIf: ['uncle_maternal', 'aunt_maternal', 'aunt_paternal'], selfGender: 'any', icon: '👦',
    aliases: ['表弟', '小表弟', '表兄弟']
  },
  {
    id: 'cousin_maternal_female_elder', displayName: '表姐', gender: 'female', generation: 0,
    priority: 41, alwaysAvailable: false,
    availableIf: ['uncle_maternal', 'aunt_maternal', 'aunt_paternal'], selfGender: 'any', icon: '👧',
    aliases: ['表姐', '大表姐', '二表姐', '表姐妹']
  },
  {
    id: 'cousin_maternal_female_younger', displayName: '表妹', gender: 'female', generation: 0,
    priority: 42, alwaysAvailable: false,
    availableIf: ['uncle_maternal', 'aunt_maternal', 'aunt_paternal'], selfGender: 'any', icon: '👧',
    aliases: ['表妹', '小表妹', '表姐妹']
  },

  // ══════════════════════════════════════════════════════
  //  GEN 0  同辈 — 配偶的兄弟姐妹（妻方）
  // ══════════════════════════════════════════════════════
  {
    id: 'brother_in_law_wife_elder', displayName: '大舅子', gender: 'male', generation: 0,
    priority: 43, alwaysAvailable: false, availableIf: ['spouse_female'], selfGender: 'male', icon: '👦',
    aliases: ['大舅子', '大内兄', '妻子的哥哥', '老婆的哥哥']
  },
  {
    id: 'brother_in_law_wife_younger', displayName: '小舅子', gender: 'male', generation: 0,
    priority: 44, alwaysAvailable: false, availableIf: ['spouse_female'], selfGender: 'male', icon: '👦',
    aliases: ['小舅子', '小内兄弟', '妻子的弟弟', '老婆的弟弟']
  },
  {
    id: 'sister_in_law_wife_elder', displayName: '大姨子', gender: 'female', generation: 0,
    priority: 45, alwaysAvailable: false, availableIf: ['spouse_female'], selfGender: 'male', icon: '👧',
    aliases: ['大姨子', '大姨姐', '妻子的姐姐', '老婆的姐姐']
  },
  {
    id: 'sister_in_law_wife_younger', displayName: '小姨子', gender: 'female', generation: 0,
    priority: 46, alwaysAvailable: false, availableIf: ['spouse_female'], selfGender: 'male', icon: '👧',
    aliases: ['小姨子', '小姨妹', '妻子的妹妹', '老婆的妹妹']
  },

  // ══════════════════════════════════════════════════════
  //  GEN 0  同辈 — 配偶的兄弟姐妹（夫方）
  // ══════════════════════════════════════════════════════
  {
    id: 'brother_in_law_husband_elder', displayName: '大伯', gender: 'male', generation: 0,
    priority: 47, alwaysAvailable: false, availableIf: ['spouse_male'], selfGender: 'female', icon: '👨',
    aliases: ['大伯', '大伯子', '丈夫的哥哥', '老公的哥哥']
  },
  {
    id: 'brother_in_law_husband_younger', displayName: '小叔', gender: 'male', generation: 0,
    priority: 48, alwaysAvailable: false, availableIf: ['spouse_male'], selfGender: 'female', icon: '👨',
    aliases: ['小叔', '小叔子', '丈夫的弟弟', '老公的弟弟']
  },
  {
    id: 'sister_in_law_husband_elder', displayName: '大姑姐', gender: 'female', generation: 0,
    priority: 49, alwaysAvailable: false, availableIf: ['spouse_male'], selfGender: 'female', icon: '👩',
    aliases: ['大姑姐', '大姑子', '丈夫的姐姐', '老公的姐姐']
  },
  {
    id: 'sister_in_law_husband_younger', displayName: '小姑', gender: 'female', generation: 0,
    priority: 50, alwaysAvailable: false, availableIf: ['spouse_male'], selfGender: 'female', icon: '👩',
    aliases: ['小姑', '小姑子', '小姑娘', '丈夫的妹妹', '老公的妹妹']
  },

  // ══════════════════════════════════════════════════════
  //  GEN +1  子辈 — 子女
  // ══════════════════════════════════════════════════════
  {
    id: 'son', displayName: '儿子', gender: 'male', generation: 1,
    priority: 13, alwaysAvailable: true, selfGender: 'any', icon: '👦',
    aliases: ['儿子', '儿', '男孩', '小子', '孩子', '宝贝儿子', '大儿子', '小儿子']
  },
  {
    id: 'daughter_in_law', displayName: '儿媳', gender: 'female', generation: 1,
    priority: 29, alwaysAvailable: false, availableIf: ['son'], selfGender: 'any', icon: '👩',
    aliases: ['儿媳', '儿媳妇', '媳妇', '儿子的老婆', '儿子的妻子', '新媳妇']
  },
  {
    id: 'daughter', displayName: '女儿', gender: 'female', generation: 1,
    priority: 14, alwaysAvailable: true, selfGender: 'any', icon: '👧',
    aliases: ['女儿', '闺女', '丫头', '小囡', '宝贝女儿', '大女儿', '小女儿']
  },
  {
    id: 'son_in_law', displayName: '女婿', gender: 'male', generation: 1,
    priority: 29, alwaysAvailable: false, availableIf: ['daughter'], selfGender: 'any', icon: '👨',
    aliases: ['女婿', '姑爷', '乘龙快婿', '女儿的老公', '女儿的丈夫', '新女婿']
  },

  // ══════════════════════════════════════════════════════
  //  GEN +1  子辈 — 兄弟之子（侄）
  // ══════════════════════════════════════════════════════
  {
    id: 'nephew_son', displayName: '侄子', gender: 'male', generation: 1,
    priority: 51, alwaysAvailable: false,
    availableIf: ['brother_elder', 'brother_younger'], selfGender: 'any', icon: '👦',
    aliases: ['侄子', '侄儿', '大侄子', '小侄子', '哥哥的儿子', '弟弟的儿子']
  },
  {
    id: 'nephew_daughter', displayName: '侄女', gender: 'female', generation: 1,
    priority: 52, alwaysAvailable: false,
    availableIf: ['brother_elder', 'brother_younger'], selfGender: 'any', icon: '👧',
    aliases: ['侄女', '大侄女', '小侄女', '哥哥的女儿', '弟弟的女儿']
  },
  {
    id: 'nephew_son_wife', displayName: '侄媳', gender: 'female', generation: 1,
    priority: 60, alwaysAvailable: false, availableIf: ['nephew_son'], selfGender: 'any', icon: '👩',
    aliases: ['侄媳', '侄媳妇', '侄子的老婆', '侄子的妻子']
  },

  // ══════════════════════════════════════════════════════
  //  GEN +1  子辈 — 姐妹之子（外甥）
  // ══════════════════════════════════════════════════════
  {
    id: 'nephew_maternal_son', displayName: '外甥', gender: 'male', generation: 1,
    priority: 53, alwaysAvailable: false,
    availableIf: ['sister_elder', 'sister_younger'], selfGender: 'any', icon: '👦',
    aliases: ['外甥', '姐姐的儿子', '妹妹的儿子', '外甥儿']
  },
  {
    id: 'nephew_maternal_daughter', displayName: '外甥女', gender: 'female', generation: 1,
    priority: 54, alwaysAvailable: false,
    availableIf: ['sister_elder', 'sister_younger'], selfGender: 'any', icon: '👧',
    aliases: ['外甥女', '姐姐的女儿', '妹妹的女儿', '外甥女儿']
  },

  // ══════════════════════════════════════════════════════
  //  GEN +2  孙辈 — 子女之子女
  // ══════════════════════════════════════════════════════
  {
    id: 'grandson', displayName: '孙子', gender: 'male', generation: 2,
    priority: 55, alwaysAvailable: false, availableIf: ['son'], selfGender: 'any', icon: '👶',
    aliases: ['孙子', '孙儿', '大孙子', '小孙子', '儿子的儿子']
  },
  {
    id: 'granddaughter', displayName: '孙女', gender: 'female', generation: 2,
    priority: 56, alwaysAvailable: false, availableIf: ['son'], selfGender: 'any', icon: '👶',
    aliases: ['孙女', '孙女儿', '大孙女', '小孙女', '儿子的女儿']
  },
  {
    id: 'grandson_wife', displayName: '孙媳', gender: 'female', generation: 2,
    priority: 65, alwaysAvailable: false, availableIf: ['grandson'], selfGender: 'any', icon: '👩',
    aliases: ['孙媳', '孙媳妇', '孙子的老婆', '孙子的妻子']
  },
  {
    id: 'granddaughter_husband', displayName: '孙女婿', gender: 'male', generation: 2,
    priority: 66, alwaysAvailable: false, availableIf: ['granddaughter'], selfGender: 'any', icon: '👨',
    aliases: ['孙女婿', '孙女的丈夫', '孙女的老公']
  },
  {
    id: 'maternal_grandson', displayName: '外孙', gender: 'male', generation: 2,
    priority: 57, alwaysAvailable: false, availableIf: ['daughter'], selfGender: 'any', icon: '👶',
    aliases: ['外孙', '外孙儿', '女儿的儿子']
  },
  {
    id: 'maternal_granddaughter', displayName: '外孙女', gender: 'female', generation: 2,
    priority: 58, alwaysAvailable: false, availableIf: ['daughter'], selfGender: 'any', icon: '👶',
    aliases: ['外孙女', '外孙女儿', '女儿的女儿']
  },

  // ══════════════════════════════════════════════════════
  //  GEN +2  孙辈 — 侄/甥之子女
  // ══════════════════════════════════════════════════════
  {
    id: 'grand_nephew', displayName: '侄孙', gender: 'male', generation: 2,
    priority: 67, alwaysAvailable: false,
    availableIf: ['nephew_son'], selfGender: 'any', icon: '👶',
    aliases: ['侄孙', '侄孙子', '侄子的儿子']
  },
  {
    id: 'grand_niece', displayName: '侄孙女', gender: 'female', generation: 2,
    priority: 68, alwaysAvailable: false,
    availableIf: ['nephew_son'], selfGender: 'any', icon: '👶',
    aliases: ['侄孙女', '侄子的女儿']
  }
];

// ══════════════════════════════════════════════════════════
//  KinshipDatabase  —  查询 API
// ══════════════════════════════════════════════════════════

class KinshipDatabase {
  constructor() {
    this._db = KINSHIP_RELATIONS;
    // Build index by id for O(1) lookup
    this._byId = {};
    for (const r of this._db) {
      this._byId[r.id] = r;
    }
  }

  /** 全部关系定义 */
  getAll() { return this._db; }

  /** 按 relationType id 查找 */
  getById(id) { return this._byId[id] || null; }

  /** 按代际获取 */
  getByGeneration(gen) { return this._db.filter(r => r.generation === gen); }

  /**
   * 返回按关键词长度降序排列的 NLP 匹配表
   * 格式：[{ id, keyword, info }, ...]
   * 长关键词优先可避免"舅" 误匹配"舅妈"
   */
  getSortedKeywordsForNLP() {
    const result = [];
    for (const rel of this._db) {
      for (const kw of rel.aliases) {
        result.push({ id: rel.id, keyword: kw, info: rel });
      }
    }
    return result.sort((a, b) => b.keyword.length - a.keyword.length);
  }

  /**
   * 智能推导缺失亲属列表
   *
   * 算法：
   * 1. 从 existingMembers 提取已有 relationType 集合
   * 2. 推断 selfGender（查找 self 成员的 gender）
   * 3. 遍历 KINSHIP_RELATIONS，满足以下条件的加入 pending：
   *    a. 尚未录入（不在 filledTypes）
   *    b. 不是 'self'
   *    c. selfGender 过滤通过
   *    d. alwaysAvailable=true  OR  availableIf 中任一已存在
   * 4. 按 priority 升序返回
   *
   * @param {Array} existingMembers  DB 中已有成员数组
   * @returns {Array} 排好序的待填写关系列表
   */
  getMissingRelations(existingMembers) {
    const existingMembers_ = existingMembers || [];
    // 去除 confirmKeepBoth 产生的 _2、_3 等序号后缀，确保已录入的关系被正确识别
    const filledTypes = new Set(
      existingMembers_.map(m => m.relationType ? m.relationType.replace(/_\d+$/, '') : null).filter(Boolean)
    );

    // Detect self gender from self member
    const selfMember = existingMembers_.find(m => m.relationType === 'self');
    const selfGender = selfMember ? (selfMember.gender || 'unknown') : 'unknown';

    const missing = [];

    for (const rel of this._db) {
      // Skip self node — not asked in the fill-in flow
      if (rel.id === 'self') continue;

      // Skip already filled
      if (filledTypes.has(rel.id)) continue;

      // Gender filter (if self gender is known)
      if (selfGender !== 'unknown' && rel.selfGender !== 'any') {
        if (rel.selfGender !== selfGender) continue;
      }

      // Availability check
      if (rel.alwaysAvailable) {
        missing.push(rel);
        continue;
      }

      const prereqs = rel.availableIf || [];
      if (prereqs.length === 0) continue; // no prereq defined & not alwaysAvailable → hidden

      const satisfied = prereqs.some(prereqId => filledTypes.has(prereqId));
      if (satisfied) {
        missing.push(rel);
      }
    }

    // Sort by priority ascending
    missing.sort((a, b) => a.priority - b.priority);
    return missing;
  }

  /**
   * 检查某个关系是否"刚刚变得可用"（用于新增成员后触发提示）
   * 当 newRelationType 被添加后，哪些新关系变成了 available？
   *
   * @param {string}   newRelationType  刚添加的关系类型
   * @param {Set}      filledTypes      添加前已有的 relationType 集合
   * @returns {Array}  新变为 available 的关系列表
   */
  getNewlyAvailable(newRelationType, filledTypes) {
    const newFilled = new Set(filledTypes);
    newFilled.add(newRelationType);

    const result = [];
    for (const rel of this._db) {
      if (rel.id === 'self') continue;
      if (newFilled.has(rel.id)) continue;
      if (rel.alwaysAvailable) continue;

      const prereqs = rel.availableIf || [];
      // Was NOT available before
      const wasSatisfied = prereqs.some(p => filledTypes.has(p));
      // IS available now
      const nowSatisfied = prereqs.some(p => newFilled.has(p));

      if (!wasSatisfied && nowSatisfied) {
        result.push(rel);
      }
    }
    return result;
  }

  /**
   * 关系间的自然语言描述
   * 例：getDescription('grandfather_paternal') → '父亲的父亲'
   */
  getDescription(id) {
    const DESCS = {
      father:                       '我的父亲',
      mother:                       '我的母亲',
      spouse_female:                '我的妻子',
      spouse_male:                  '我的丈夫',
      grandfather_paternal:         '父亲的父亲',
      grandmother_paternal:         '父亲的母亲',
      grandfather_maternal:         '母亲的父亲',
      grandmother_maternal:         '母亲的母亲',
      great_grandfather_paternal:   '爷爷的父亲',
      great_grandmother_paternal:   '爷爷的母亲',
      great_grandfather_maternal:   '外公的父亲',
      great_grandmother_maternal:   '外公的母亲',
      uncle_paternal_elder:         '父亲的哥哥',
      aunt_paternal_elder_wife:     '伯父的妻子',
      uncle_paternal_younger:       '父亲的弟弟',
      aunt_paternal_younger_wife:   '叔叔的妻子',
      aunt_paternal:                '父亲的姐妹',
      uncle_paternal_by_marriage:   '姑姑的丈夫',
      uncle_maternal:               '母亲的兄弟',
      aunt_maternal_by_marriage:    '舅舅的妻子',
      aunt_maternal:                '母亲的姐妹',
      uncle_maternal_by_marriage:   '姨妈的丈夫',
      father_in_law_wife:           '妻子的父亲',
      mother_in_law_wife:           '妻子的母亲',
      father_in_law_husband:        '丈夫的父亲',
      mother_in_law_husband:        '丈夫的母亲',
      brother_elder:                '比我年长的兄弟',
      sister_in_law_elder:          '哥哥的妻子',
      brother_younger:              '比我年幼的兄弟',
      sister_in_law_younger:        '弟弟的妻子',
      sister_elder:                 '比我年长的姐妹',
      brother_in_law_elder:         '姐姐的丈夫',
      sister_younger:               '比我年幼的姐妹',
      brother_in_law_younger:       '妹妹的丈夫',
      cousin_paternal_male_elder:   '伯父或叔叔的儿子（年长）',
      cousin_paternal_male_younger: '伯父或叔叔的儿子（年幼）',
      cousin_paternal_female_elder: '伯父或叔叔的女儿（年长）',
      cousin_paternal_female_younger:'伯父或叔叔的女儿（年幼）',
      cousin_maternal_male_elder:   '舅舅或姨妈的儿子（年长）',
      cousin_maternal_male_younger: '舅舅或姨妈的儿子（年幼）',
      cousin_maternal_female_elder: '舅舅或姨妈的女儿（年长）',
      cousin_maternal_female_younger:'舅舅或姨妈的女儿（年幼）',
      brother_in_law_wife_elder:    '妻子的哥哥',
      brother_in_law_wife_younger:  '妻子的弟弟',
      sister_in_law_wife_elder:     '妻子的姐姐',
      sister_in_law_wife_younger:   '妻子的妹妹',
      brother_in_law_husband_elder: '丈夫的哥哥',
      brother_in_law_husband_younger:'丈夫的弟弟',
      sister_in_law_husband_elder:  '丈夫的姐姐',
      sister_in_law_husband_younger:'丈夫的妹妹',
      son:                          '我的儿子',
      daughter_in_law:              '儿子的妻子',
      daughter:                     '我的女儿',
      son_in_law:                   '女儿的丈夫',
      nephew_son:                   '哥哥或弟弟的儿子',
      nephew_daughter:              '哥哥或弟弟的女儿',
      nephew_son_wife:              '侄子的妻子',
      nephew_maternal_son:          '姐姐或妹妹的儿子',
      nephew_maternal_daughter:     '姐姐或妹妹的女儿',
      grandson:                     '儿子的儿子',
      granddaughter:                '儿子的女儿',
      grandson_wife:                '孙子的妻子',
      granddaughter_husband:        '孙女的丈夫',
      maternal_grandson:            '女儿的儿子',
      maternal_granddaughter:       '女儿的女儿',
      grand_nephew:                 '侄子的儿子',
      grand_niece:                  '侄子的女儿',
    };
    return DESCS[id] || (this._byId[id] ? `我的${this._byId[id].displayName}` : id);
  }
}

// Singleton
const KinshipDB = new KinshipDatabase();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KinshipDatabase, KinshipDB, KINSHIP_RELATIONS };
}
