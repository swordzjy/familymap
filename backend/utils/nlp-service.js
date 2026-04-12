/**
 * 旺祖 — AI自然语言解析引擎  v3
 * ============================================================
 * 关键词库统一来自 KinshipDB（kinship-db.js），
 * 本文件只包含解析逻辑，不再内联亲属词典。
 * ============================================================
 */
const { KinshipDB } = require('./kinship-db');

class FamilyNLPProcessor {
  constructor() {
    // NLP-specific姓名抽取模式（与关系识别解耦）
    this.namePatterns = [
      // 最长/最明确模式优先
      { pattern: /我的?名字[叫是]([\u4e00-\u9fa5]{2,4})/ },       // 我的名字叫/是
      { pattern: /我[叫是]([\u4e00-\u9fa5]{2,4})/ },              // 我叫/我是
      { pattern: /叫做([\u4e00-\u9fa5]{2,4})/ },                  // 叫做
      { pattern: /叫([\u4e00-\u9fa5]{2,4})/ },                    // 叫
      { pattern: /姓([\u4e00-\u9fa5])[，,\s]*名[字]?[叫是]?([\u4e00-\u9fa5]{1,3})/ }, // 姓X名Y
      { pattern: /([\u4e00-\u9fa5]{2,4})是(?:我|俺)(?:的)?(?:爸|妈|爷|奶|姥)/ }, // 张建国是我爸
      { pattern: /是([\u4e00-\u9fa5]{2,4})$/ },                   // ...是张建国（句末）
    ];

    // 姓氏库（用于验证姓名有效性和备选识别）
    this.surnames = new Set([
      '张','王','李','刘','陈','杨','黄','赵','周','吴',
      '徐','孙','马','朱','胡','郭','林','何','高','罗',
      '郑','梁','谢','宋','唐','许','韩','冯','邓','曹',
      '彭','曾','肖','田','董','袁','潘','于','蒋','蔡',
      '余','杜','叶','程','苏','魏','吕','丁','任','沈',
      '姚','卢','姜','崔','钟','谭','陆','汪','范','金',
      '石','廖','贾','夏','韦','付','方','白','邹','孟',
      '熊','秦','邱','江','尹','薛','闫','段','雷','侯',
      '龙','史','陶','黎','贺','顾','毛','郝','龚','邵',
      '万','钱','严','覃','武','戴','莫','孔','向','汤',
      '温','柳','蒋','钮','邢','洪','卫','冀','柯','房',
      '仇','麻','鲁','施','花','尚','荣','华','丰','常'
    ]);

    // 男性名字常用字（用于性别推断）
    this.maleChars = new Set([
      '国','建','军','强','伟','磊','超','勇','杰','涛',
      '明','辉','刚','健','峰','宇','浩','文','斌','龙',
      '志','成','华','鹏','飞','波','彬','林','武','力',
      '平','刚','博','鑫','晨','泽','宁','凯','栋','洪'
    ]);

    // 女性名字常用字
    this.femaleChars = new Set([
      '芳','娜','秀','玲','丽','敏','静','洁','艳','燕',
      '华','梅','霞','莉','婷','雪','颖','红','萍','娟',
      '倩','晴','琴','英','莹','云','珍','香','翠','凤',
      '兰','菊','春','晓','欢','媛','佳','美','慧','璐'
    ]);

    // 缓存已排序关键词（首次调用时生成）
    this._sortedKeywords = null;
    
    // 关系链映射表（用于复杂句式解析）
    this._relationChainMap = this._buildRelationChainMap();
  }

  // ─── 构建关系链映射表 ─────────────────────────────────
  _buildRelationChainMap() {
    // 定义关系链推导规则
    // key: "起点关系->中间关系"  value: 最终关系ID
    return {
      // 配偶关系链
      'spouse_female->brother_elder': 'brother_in_law_wife_elder',      // 妻子->哥哥 = 大舅子
      'spouse_female->brother_younger': 'brother_in_law_wife_younger',  // 妻子->弟弟 = 小舅子
      'spouse_female->sister_elder': 'sister_in_law_wife_elder',        // 妻子->姐姐 = 大姨子
      'spouse_female->sister_younger': 'sister_in_law_wife_younger',    // 妻子->妹妹 = 小姨子
      'spouse_female->father': 'father_in_law_wife',                    // 妻子->父亲 = 岳父
      'spouse_female->mother': 'mother_in_law_wife',                    // 妻子->母亲 = 岳母
      
      'spouse_male->brother_elder': 'brother_in_law_husband_elder',     // 丈夫->哥哥 = 大伯
      'spouse_male->brother_younger': 'brother_in_law_husband_younger', // 丈夫->弟弟 = 小叔
      'spouse_male->sister_elder': 'sister_in_law_husband_elder',       // 丈夫->姐姐 = 大姑姐
      'spouse_male->sister_younger': 'sister_in_law_husband_younger',   // 丈夫->妹妹 = 小姑
      'spouse_male->father': 'father_in_law_husband',                   // 丈夫->父亲 = 公公
      'spouse_male->mother': 'mother_in_law_husband',                   // 丈夫->母亲 = 婆婆
      
      // 父辈关系链
      'father->brother_elder': 'uncle_paternal_elder',      // 父亲->哥哥 = 伯父
      'father->brother_younger': 'uncle_paternal_younger',  // 父亲->弟弟 = 叔叔
      'father->sister': 'aunt_paternal',                    // 父亲->姐妹 = 姑姑
      'father->father': 'grandfather_paternal',             // 父亲->父亲 = 爷爷
      'father->mother': 'grandmother_paternal',             // 父亲->母亲 = 奶奶
      
      'mother->brother': 'uncle_maternal',                  // 母亲->兄弟 = 舅舅
      'mother->sister': 'aunt_maternal',                    // 母亲->姐妹 = 姨妈
      'mother->father': 'grandfather_maternal',             // 母亲->父亲 = 外公
      'mother->mother': 'grandmother_maternal',             // 母亲->母亲 = 外婆
      
      // 祖辈关系链
      'grandfather_paternal->brother_elder': 'grand_uncle_paternal_elder',  // 爷爷->哥哥 = 伯祖父
      'grandfather_paternal->brother_younger': 'grand_uncle_paternal_younger', // 爷爷->弟弟 = 叔祖父
      'grandfather_paternal->sister': 'grand_aunt_paternal', // 爷爷->姐妹 = 姑祖母
      
      // 同辈关系链（通过配偶）
      'brother_elder->spouse_female': 'sister_in_law_elder',  // 哥哥->妻子 = 嫂子
      'brother_younger->spouse_female': 'sister_in_law_younger', // 弟弟->妻子 = 弟媳
      'sister_elder->spouse_male': 'brother_in_law_elder',    // 姐姐->丈夫 = 姐夫
      'sister_younger->spouse_male': 'brother_in_law_younger', // 妹妹->丈夫 = 妹夫

      // 子女关系链
      'son->spouse_female': 'daughter_in_law',   // 儿子->妻子 = 儿媳
      'daughter->spouse_male': 'son_in_law',     // 女儿->丈夫 = 女婿
      'son->son': 'grandson',                    // 儿子->儿子 = 孙子
      'son->daughter': 'granddaughter',          // 儿子->女儿 = 孙女
      'daughter->son': 'maternal_grandson',      // 女儿->儿子 = 外孙
      'daughter->daughter': 'maternal_granddaughter', // 女儿->女儿 = 外孙女

      // 三级链：叔伯/舅姨 → 子女 = 堂/表兄弟姐妹
      'uncle_paternal_elder->son':      'cousin_paternal_male_elder',
      'uncle_paternal_elder->daughter': 'cousin_paternal_female_elder',
      'uncle_paternal_younger->son':    'cousin_paternal_male_younger',
      'uncle_paternal_younger->daughter':'cousin_paternal_female_younger',
      'aunt_paternal->son':             'cousin_paternal_male_elder',
      'aunt_paternal->daughter':        'cousin_paternal_female_elder',
      'uncle_maternal->son':            'cousin_maternal_male_elder',
      'uncle_maternal->daughter':       'cousin_maternal_female_elder',
      'aunt_maternal->son':             'cousin_maternal_male_elder',
      'aunt_maternal->daughter':        'cousin_maternal_female_elder',

      // 三级链：兄弟姐妹 → 子女 = 侄/甥
      'brother_elder->son':             'nephew_son',
      'brother_elder->daughter':        'nephew_daughter',
      'brother_younger->son':           'nephew_son',
      'brother_younger->daughter':      'nephew_daughter',
      'sister_elder->son':              'nephew_maternal_son',
      'sister_elder->daughter':         'nephew_maternal_daughter',
      'sister_younger->son':            'nephew_maternal_son',
      'sister_younger->daughter':       'nephew_maternal_daughter',

      // 三级链：孙辈
      'grandson->son':                  'grand_nephew',
      'grandson->daughter':             'grand_niece',
    };
  }

  // ─── 内部：获取排好序的关键词表（惰性初始化）─────────────
  _getSortedKeywords() {
    if (!this._sortedKeywords) {
      // 依赖 KinshipDB（必须在 kinship-db.js 之后加载）
      this._sortedKeywords = KinshipDB.getSortedKeywordsForNLP();
    }
    return this._sortedKeywords;
  }

  // ─────────────────────────────────────────────────────────
  //  主解析入口
  // ─────────────────────────────────────────────────────────
  /**
   * @param {string} text 自然语言输入
   * @returns {{ persons: Array, incomplete: Array, tree: Object, raw: string }}
   */
  parse(text) {
    if (!text || typeof text !== 'string') {
      return { persons: [], tree: null, raw: text, incomplete: [] };
    }

    const results   = [];
    const incomplete = [];

    for (const sentence of this.splitSentences(text)) {
      const person = this.parseSentence(sentence);
      if (!person) continue;
      if (person.confidence >= 0.6) results.push(person);
      else incomplete.push(person);
    }

    return {
      persons:  results,
      incomplete,
      tree:     this.buildRelationTree(results),
      raw:      text
    };
  }

  // ─────────────────────────────────────────────────────────
  //  分句
  // ─────────────────────────────────────────────────────────
  splitSentences(text) {
    return text.split(/[，,。！!？?;；\n]+/).map(s => s.trim()).filter(Boolean);
  }

  // ─────────────────────────────────────────────────────────
  //  解析单句
  // ─────────────────────────────────────────────────────────
  parseSentence(sentence) {
    const person = {
      name: null, surname: null, givenName: null,
      relation: null, relationType: null,
      gender: null, generation: 0,
      confidence: 0, raw: sentence
    };

    // 1. 识别关系
    const rel = this.identifyRelation(sentence);
    if (rel) {
      person.relation    = rel.displayName;
      person.relationType = rel.id;
      person.gender      = rel.gender;
      person.generation  = rel.generation;
    }

    // 2. 提取姓名
    const nameInfo = this.extractName(sentence);
    if (nameInfo) {
      person.name      = nameInfo.name;
      person.surname   = nameInfo.surname;
      person.givenName = nameInfo.givenName;
    }

    // 3. 特殊处理 self
    if (person.relationType === 'self' && !person.name) {
      const m = sentence.match(/我(?:叫|的?名字?[叫是]?)([\u4e00-\u9fa5]{2,4})/);
      if (m && m[1]) {
        person.name      = m[1];
        person.surname   = m[1][0];
        person.givenName = m[1].slice(1);
      }
    }

    // 4. 性别推断
    if (!person.gender || person.gender === 'unknown') {
      person.gender = this.inferGender(person.name);
    }

    // 5. 置信度
    person.confidence = this.calculateConfidence(person);

    return person;
  }

  // ─────────────────────────────────────────────────────────
  //  关系识别  — 核心算法
  //
  //  句式优先级：
  //   P1. "我的<关系>叫/是..."  →  最明确
  //   P2. "我<关系>叫/是..."   →  次明确
  //   P3. "我叫/是/名字是..."  →  self 识别
  //   P4. 全文关键词扫描        →  兜底
  // ─────────────────────────────────────────────────────────
  identifyRelation(sentence) {
    const kws = this._getSortedKeywords();

    // P1: 我[的之]<kw>[叫是...]
    // 注意：如果包含多个"的"，说明是链式关系，跳过P1让P2.5处理
    const p1 = sentence.match(/我[的之](.+?)(?:叫|是|[，,。！!？?;；\n]|$)/);
    if (p1) {
      const after = p1[1].trim();
      // 检查是否是链式关系（包含"的"或"之"）
      if (!after.includes('的') && !after.includes('之')) {
        for (const { id, keyword, info } of kws) {
          if (id === 'self') continue;
          if (after.startsWith(keyword)) {
            return info;
          }
        }
      }
    }

    // P2: 我<kw>叫/是（含"的/之"的留给 P2.5 链式解析器处理）
    const p2 = sentence.match(/我(.+?)(?:叫|是|[，,。！!？?;；\n]|$)/);
    if (p2) {
      const after = p2[1].trim();
      if (!after.startsWith('叫') && !after.startsWith('是') && !after.startsWith('姓')
          && !after.includes('的') && !after.includes('之')) {
        for (const { id, keyword, info } of kws) {
          if (id === 'self') continue;
          if (after.startsWith(keyword)) {
            return info;
          }
        }
      }
    }

    // P2.5: 复杂链式关系解析（如"我老婆的哥哥"）
    const chainRel = this.identifyChainRelation(sentence);
    if (chainRel) {
      return chainRel;
    }

    // P3: self
    if (/我(?:叫|是|的?名字?[叫是]?)/.test(sentence)) {
      return KinshipDB.getById('self');
    }

    // P4: 全文扫描 — 取最靠前且最长的匹配
    let best = null, bestPos = Infinity, bestLen = 0;
    for (const { id, keyword, info } of kws) {
      const pos = sentence.indexOf(keyword);
      if (pos !== -1) {
        if (pos < bestPos || (pos === bestPos && keyword.length > bestLen)) {
          bestPos = pos;
          bestLen = keyword.length;
          best    = info;
        }
      }
    }
    return best;
  }

  // ─────────────────────────────────────────────────────────
  //  复杂链式关系解析（如"我老婆的哥哥"）
  // ─────────────────────────────────────────────────────────
  /**
   * 解析链式关系，支持如"我老婆的哥哥"、"我父亲的弟弟"、"我老婆她哥"等复杂句式
   * @param {string} sentence 输入句子
   * @returns {Object|null} 解析后的关系信息
   */
  identifyChainRelation(sentence) {
    const kws = this._getSortedKeywords();
    
    // 统一代词：将"她/他"替换为"的"，统一处理
    const normalizedSentence = sentence.replace(/([的之])[她他]/g, '$1').replace(/她[的之]/g, '的').replace(/他[的之]/g, '的');
    
    console.log('[NLP] 链式解析输入:', sentence);
    console.log('[NLP] 规范化后:', normalizedSentence);
    
    // 匹配链式关系模式：我<关系1>的<关系2>[的<关系3>...]叫/是
    const chainPattern = /我[的之]?(.+?)(?:叫|是|名字[叫是]|姓)/;
    const match = normalizedSentence.match(chainPattern);
    
    if (!match) {
      console.log('[NLP] 不匹配链式模式');
      return null;
    }
    
    const relationPart = match[1].trim();
    console.log('[NLP] 关系部分:', relationPart);
    
    // 检查是否包含"的/之"字，表示链式关系
    if (!relationPart.includes('的') && !relationPart.includes('之')) {
      console.log('[NLP] 不是链式关系');
      return null;
    }
    
    // 分解关系链，支持"的"和"之"
    const parts = relationPart.split(/的|之/).map(p => p.trim()).filter(Boolean);
    console.log('[NLP] 分解部分:', parts);
    
    if (parts.length < 2) return null;
    
    // 逐级解析关系链
    let currentRelationId = null;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let matched = false;
      
      console.log(`[NLP] 处理第${i+1}层: "${part}"`);
      
      // 在当前部分中查找匹配的关系关键词
      // 优先匹配长的关键词，避免部分匹配
      const sortedKws = [...kws].sort((a, b) => b.keyword.length - a.keyword.length);
      
      for (const { id, keyword, info } of sortedKws) {
        // 仅允许 part 包含 keyword（关键词是 part 的子串），
        // 不允许反向匹配（keyword.includes(part)），避免 "儿子" 错误匹配 "儿子的妻子"
        if (part.includes(keyword)) {
          console.log(`[NLP]   匹配到: ${keyword} -> ${id}`);
          
          if (i === 0) {
            // 第一层关系
            currentRelationId = id;
            console.log(`[NLP]   第一层设为: ${currentRelationId}`);
          } else {
            // 后续层级：查找关系链映射
            const chainKey = `${currentRelationId}->${id}`;
            console.log(`[NLP]   查找映射: ${chainKey}`);
            const mappedId = this._relationChainMap[chainKey];
            
            if (mappedId) {
              currentRelationId = mappedId;
              console.log(`[NLP]   映射结果: ${currentRelationId}`);
            } else {
              // 尝试模糊匹配（如 brother_elder/brother_younger 都匹配 brother）
              console.log(`[NLP]   尝试模糊匹配...`);
              const fuzzyMatch = this._fuzzyChainMatch(currentRelationId, id);
              if (fuzzyMatch) {
                currentRelationId = fuzzyMatch;
                console.log(`[NLP]   模糊匹配结果: ${currentRelationId}`);
              } else {
                // 映射失败，返回当前已解析的关系
                console.log(`[NLP]   映射失败，返回当前: ${currentRelationId}`);
                return KinshipDB.getById(currentRelationId);
              }
            }
          }
          matched = true;
          break;
        }
      }
      
      if (!matched && i === 0) {
        // 第一层就没匹配到，放弃链式解析
        console.log('[NLP] 第一层未匹配，放弃');
        return null;
      }
    }
    
    if (currentRelationId) {
      const result = KinshipDB.getById(currentRelationId);
      console.log('[NLP] 最终解析结果:', result);
      return result;
    }
    
    return null;
  }
  
  /**
   * 模糊链式匹配（处理兄弟/姐妹的长幼区分）
   */
  _fuzzyChainMatch(currentId, nextId) {
    // 映射 brother 到 brother_elder/brother_younger
    const brotherMap = {
      'spouse_female': 'brother_in_law_wife_elder',  // 默认大舅子
      'spouse_male': 'brother_in_law_husband_elder', // 默认大伯
      'father': 'uncle_paternal_elder',              // 默认伯父
      'mother': 'uncle_maternal',                    // 舅舅（不分长幼）
    };
    
    // 映射 sister 到 sister_elder/sister_younger
    const sisterMap = {
      'spouse_female': 'sister_in_law_wife_elder',    // 默认大姨子
      'spouse_male': 'sister_in_law_husband_elder',   // 默认大姑姐
      'father': 'aunt_paternal',                      // 姑姑（不分长幼）
      'mother': 'aunt_maternal',                      // 姨妈（不分长幼）
    };
    
    if (nextId.includes('brother')) {
      return brotherMap[currentId] || null;
    }
    if (nextId.includes('sister')) {
      return sisterMap[currentId] || null;
    }
    
    return null;
  }

  // ─────────────────────────────────────────────────────────
  //  姓名提取
  // ─────────────────────────────────────────────────────────
  extractName(sentence) {
    for (const { pattern } of this.namePatterns) {
      const m = sentence.match(pattern);
      if (m) {
        const name = m[2] ? (m[1] + m[2]) : m[1];
        if (this.isValidName(name)) {
          return { name, surname: name[0], givenName: name.slice(1) };
        }
      }
    }

    // 备选：找姓氏开头的2-4字词
    const chunks = sentence.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    for (const chunk of chunks) {
      if (this.surnames.has(chunk[0]) && chunk.length >= 2) {
        // 排除已知关系词
        const isKw = this._getSortedKeywords().some(({ keyword }) => keyword === chunk);
        if (!isKw) {
          return { name: chunk, surname: chunk[0], givenName: chunk.slice(1) };
        }
      }
    }
    return null;
  }

  isValidName(name) {
    if (!name || name.length < 2 || name.length > 4) return false;
    if (!/[\u4e00-\u9fa5]/.test(name)) return false;
    return this.surnames.has(name[0]);
  }

  // ─────────────────────────────────────────────────────────
  //  性别推断
  // ─────────────────────────────────────────────────────────
  inferGender(name) {
    if (!name || name.length < 2) return 'unknown';
    for (const ch of name.slice(1)) {
      if (this.maleChars.has(ch))   return 'male';
      if (this.femaleChars.has(ch)) return 'female';
    }
    return 'unknown';
  }

  // ─────────────────────────────────────────────────────────
  //  置信度计算
  // ─────────────────────────────────────────────────────────
  calculateConfidence(person) {
    let s = 0;
    if (person.name && person.name.length >= 2) s += 0.4;
    else if (person.surname)                    s += 0.2;
    if (person.relation)                        s += 0.4;
    if (person.gender && person.gender !== 'unknown') s += 0.2;
    return s;
  }

  // ─────────────────────────────────────────────────────────
  //  建立关系树（用于可视化）
  // ─────────────────────────────────────────────────────────
  buildRelationTree(persons) {
    if (!persons?.length) return null;
    const byGen = {};
    for (const p of persons) {
      const g = p.generation || 0;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(p);
    }
    return { root: { name: '我', generation: 0 }, generations: byGen, members: persons };
  }

  // ─────────────────────────────────────────────────────────
  //  批量解析（多轮对话合并）
  // ─────────────────────────────────────────────────────────
  parseBatch(texts) {
    const all = [];
    for (const text of texts) {
      for (const person of this.parse(text).persons) {
        const dup = all.find(p => p.name && p.name === person.name);
        if (dup) {
          if (!dup.relation && person.relation) {
            dup.relation    = person.relation;
            dup.relationType = person.relationType;
          }
          if (dup.gender === 'unknown' && person.gender !== 'unknown') {
            dup.gender = person.gender;
          }
        } else {
          all.push(person);
        }
      }
    }
    return { persons: all, tree: this.buildRelationTree(all) };
  }

  /**
   * 信息完整性检查（给补全向导使用）
   */
  checkIncomplete(person) {
    const issues = [];
    if (!person.name) issues.push('缺少姓名');
    else if (!person.givenName) issues.push('姓名不完整');
    if (!person.relation) issues.push('关系不明确');
    return issues;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FamilyNLPProcessor;
}
