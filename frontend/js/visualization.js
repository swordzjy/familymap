// ════════════════════════════════════════════════════════════════════════
//  FamilyGraph — 亲属关系图（双向邻接表 + BFS路径查询）
//
//  边类型：P(parent向上) / C(child向下) / S(spouse配偶)
//  所有连接以实际成员 ID 存储，与角色类型无关
//  bfs() 预留供节点关系查询功能调用
// ════════════════════════════════════════════════════════════════════════
class FamilyGraph {
  constructor() {
    this.nodes    = new Map(); // id → member
    this.parents  = new Map(); // id → [parentId, ...]
    this.children = new Map(); // id → [childId, ...]
    this.spouses  = new Map(); // id → spouseId  (1:1)
    this.adj      = new Map(); // id → [{id, type}]  全图邻接表，BFS用
  }

  addNode(member) {
    if (this.nodes.has(member.id)) return;
    this.nodes.set(member.id, member);
    this.parents.set(member.id,  []);
    this.children.set(member.id, []);
    this.adj.set(member.id, []);
  }

  linkParentChild(parentId, childId) {
    if (!parentId || !childId || parentId === childId) return;
    const ch = this.children.get(parentId);
    if (ch && !ch.includes(childId)) ch.push(childId);
    const pa = this.parents.get(childId);
    if (pa && !pa.includes(parentId)) pa.push(parentId);
    this._adj(parentId, childId, 'C');
    this._adj(childId,  parentId, 'P');
  }

  linkSpouse(idA, idB) {
    if (!idA || !idB || idA === idB) return;
    if (this.spouses.has(idA) || this.spouses.has(idB)) return;
    this.spouses.set(idA, idB);
    this.spouses.set(idB, idA);
    this._adj(idA, idB, 'S');
    this._adj(idB, idA, 'S');
  }

  _adj(from, to, type) {
    const list = this.adj.get(from);
    if (list && !list.find(e => e.id === to && e.type === type)) list.push({ id: to, type });
  }

  getParentIds(id)  { return this.parents.get(id)  || []; }
  getChildIds(id)   { return this.children.get(id) || []; }
  getSpouseId(id)   { return this.spouses.get(id)  || null; }
  getNeighbors(id)  { return this.adj.get(id)      || []; }

  bfs(startId) {
    const vis = new Map();
    vis.set(startId, { dist: 0, prev: null, type: null });
    const q = [startId];
    while (q.length) {
      const cur = q.shift();
      const d   = vis.get(cur).dist;
      for (const { id: nxt, type } of (this.adj.get(cur) || [])) {
        if (!vis.has(nxt)) {
          vis.set(nxt, { dist: d + 1, prev: cur, type });
          q.push(nxt);
        }
      }
    }
    return vis;
  }

  findPath(fromId, toId) {
    if (fromId === toId) return [];
    const bfsMap = this.bfs(fromId);
    if (!bfsMap.has(toId)) return null;
    const path = [];
    let cur = toId;
    while (cur !== fromId) {
      const { prev, type } = bfsMap.get(cur);
      path.unshift({ from: prev, to: cur, type });
      cur = prev;
    }
    return path;
  }

  distance(idA, idB) { return this.bfs(idA).get(idB)?.dist ?? Infinity; }
}

// ════════════════════════════════════════════════════════════════════════
//  亲属界定原则：
//
//  每个节点通过以下路径之一进入图：
//    路径A（血缘）：在 ROLE_PARENT_RULES 中有 [父角色 → 我] 的规则
//    路径B（婚姻）：在 ROLE_SPOUSE_RULES 中有 [我 ↔ 配偶] 的规则
//
//  孤立节点 = 两条路径都缺失
// ════════════════════════════════════════════════════════════════════════

const ROLE_PARENT_RULES = [
  // ── gen -3 → -2 ───────────────────────────────────────────────────
  ['great_grandfather_paternal', 'grandfather_paternal'],
  ['great_grandmother_paternal', 'grandfather_paternal'],
  ['great_grandfather_paternal', 'grandmother_paternal'],
  ['great_grandmother_paternal', 'grandmother_paternal'],
  ['great_grandfather_maternal', 'grandfather_maternal'],
  ['great_grandmother_maternal', 'grandfather_maternal'],
  ['great_grandfather_maternal', 'grandmother_maternal'],
  ['great_grandmother_maternal', 'grandmother_maternal'],

  // ── gen -2 → -1 (父系) ────────────────────────────────────────────
  ['grandfather_paternal', 'father'],
  ['grandmother_paternal', 'father'],
  ['grandfather_paternal', 'uncle_paternal_elder'],
  ['grandmother_paternal', 'uncle_paternal_elder'],
  ['grandfather_paternal', 'uncle_paternal_younger'],
  ['grandmother_paternal', 'uncle_paternal_younger'],
  ['grandfather_paternal', 'aunt_paternal'],
  ['grandmother_paternal', 'aunt_paternal'],

  // ── gen -2 → -1 (母系) ────────────────────────────────────────────
  ['grandfather_maternal', 'mother'],
  ['grandmother_maternal', 'mother'],
  ['grandfather_maternal', 'uncle_maternal'],
  ['grandmother_maternal', 'uncle_maternal'],
  ['grandfather_maternal', 'aunt_maternal'],
  ['grandmother_maternal', 'aunt_maternal'],

  // ── gen -1 → 0 ────────────────────────────────────────────────────
  ['father', 'self'],
  ['mother', 'self'],
  ['father', 'brother_elder'],
  ['mother', 'brother_elder'],
  ['father', 'brother_younger'],
  ['mother', 'brother_younger'],
  ['father', 'sister_elder'],
  ['mother', 'sister_elder'],
  ['father', 'sister_younger'],
  ['mother', 'sister_younger'],

  // ── 堂兄弟姐妹（父系叔伯之子女）先到先得 ─────────────────────────
  ['uncle_paternal_elder',   'cousin_paternal_male_elder'],
  ['uncle_paternal_elder',   'cousin_paternal_male_younger'],
  ['uncle_paternal_elder',   'cousin_paternal_female_elder'],
  ['uncle_paternal_elder',   'cousin_paternal_female_younger'],
  ['uncle_paternal_younger', 'cousin_paternal_male_elder'],
  ['uncle_paternal_younger', 'cousin_paternal_male_younger'],
  ['uncle_paternal_younger', 'cousin_paternal_female_elder'],
  ['uncle_paternal_younger', 'cousin_paternal_female_younger'],

  // ── 表兄弟姐妹（母系舅姨之子女）先到先得 ─────────────────────────
  ['uncle_maternal', 'cousin_maternal_male_elder'],
  ['uncle_maternal', 'cousin_maternal_male_younger'],
  ['uncle_maternal', 'cousin_maternal_female_elder'],
  ['uncle_maternal', 'cousin_maternal_female_younger'],
  ['aunt_maternal',  'cousin_maternal_male_elder'],
  ['aunt_maternal',  'cousin_maternal_male_younger'],
  ['aunt_maternal',  'cousin_maternal_female_elder'],
  ['aunt_maternal',  'cousin_maternal_female_younger'],

  // ── gen 0 → 1 ─────────────────────────────────────────────────────
  ['self', 'son'],
  ['self', 'daughter'],
  ['self', 'nephew_son'],
  ['self', 'nephew_daughter'],
  ['self', 'nephew_maternal_son'],
  ['self', 'nephew_maternal_daughter'],

  // ── gen 1 → 2 ─────────────────────────────────────────────────────
  ['son',      'grandson'],
  ['son',      'granddaughter'],
  ['daughter', 'maternal_grandson'],
  ['daughter', 'maternal_granddaughter'],

  // ── 岳父/岳母 → 妻子 + 妻方兄弟姐妹 ─────────────────────────────
  ['father_in_law_wife', 'spouse_female'],
  ['mother_in_law_wife', 'spouse_female'],
  ['father_in_law_wife', 'sister_in_law_wife_elder'],
  ['mother_in_law_wife', 'sister_in_law_wife_elder'],
  ['father_in_law_wife', 'sister_in_law_wife_younger'],
  ['mother_in_law_wife', 'sister_in_law_wife_younger'],
  ['father_in_law_wife', 'brother_in_law_wife_elder'],
  ['mother_in_law_wife', 'brother_in_law_wife_elder'],
  ['father_in_law_wife', 'brother_in_law_wife_younger'],
  ['mother_in_law_wife', 'brother_in_law_wife_younger'],

  // ── 公公/婆婆 → 丈夫 + 夫方兄弟姐妹 ─────────────────────────────
  ['father_in_law_husband', 'spouse_male'],
  ['mother_in_law_husband', 'spouse_male'],
  ['father_in_law_husband', 'brother_in_law_husband_elder'],
  ['mother_in_law_husband', 'brother_in_law_husband_elder'],
  ['father_in_law_husband', 'brother_in_law_husband_younger'],
  ['mother_in_law_husband', 'brother_in_law_husband_younger'],
  ['father_in_law_husband', 'sister_in_law_husband_elder'],
  ['mother_in_law_husband', 'sister_in_law_husband_elder'],
  ['father_in_law_husband', 'sister_in_law_husband_younger'],
  ['mother_in_law_husband', 'sister_in_law_husband_younger'],
];

const ROLE_SPOUSE_RULES = [
  ['great_grandfather_paternal', 'great_grandmother_paternal'],
  ['great_grandfather_maternal', 'great_grandmother_maternal'],
  ['grandfather_paternal',       'grandmother_paternal'],
  ['grandfather_maternal',       'grandmother_maternal'],
  ['father',                     'mother'],
  ['father_in_law_wife',         'mother_in_law_wife'],
  ['father_in_law_husband',      'mother_in_law_husband'],
  ['uncle_paternal_elder',       'aunt_paternal_elder_wife'],
  ['uncle_paternal_younger',     'aunt_paternal_younger_wife'],
  ['aunt_paternal',              'uncle_paternal_by_marriage'],
  ['uncle_maternal',             'aunt_maternal_by_marriage'],
  ['aunt_maternal',              'uncle_maternal_by_marriage'],
  ['brother_elder',              'sister_in_law_elder'],
  ['brother_younger',            'sister_in_law_younger'],
  ['sister_elder',               'brother_in_law_elder'],
  ['sister_younger',             'brother_in_law_younger'],
  ['self',                       'spouse_female'],
  ['self',                       'spouse_male'],
  ['son',                        'daughter_in_law'],
  ['daughter',                   'son_in_law'],
];

// ════════════════════════════════════════════════════════════════════════
//  LINEAGE_SCORE
//  负分 = 父系/出生家族 → LEFT
//  正分 = 母系/配偶家族 → RIGHT
//  零分 = self（锚点）
// ════════════════════════════════════════════════════════════════════════
const LINEAGE_SCORE = {
  // 太祖辈 gen -3
  great_grandfather_paternal: -8,  great_grandmother_paternal: -7,
  great_grandfather_maternal:  8,  great_grandmother_maternal:  7,
  // 祖辈 gen -2
  grandfather_paternal: -5,  grandmother_paternal: -4,
  grandfather_maternal:  5,  grandmother_maternal:  4,
  // 父辈 gen -1
  uncle_paternal_elder:      -3,   aunt_paternal_elder_wife:    -2.5,
  uncle_paternal_younger:    -2,   aunt_paternal_younger_wife:  -1.5,
  aunt_paternal:             -2.5, uncle_paternal_by_marriage:  -2,
  father: -1,
  mother:  1,
  uncle_maternal:             3,   aunt_maternal_by_marriage:   3.5,
  aunt_maternal:              2.5, uncle_maternal_by_marriage:  2,
  father_in_law_wife:    5,  mother_in_law_wife:    6,
  father_in_law_husband: 5,  mother_in_law_husband: 6,
  // 同辈 gen 0
  brother_elder:          -6,   sister_in_law_elder:    -5.5,
  brother_in_law_elder:   -5,   sister_elder:           -4.5,
  brother_younger:        -3,   sister_in_law_younger:  -2.5,
  brother_in_law_younger: -2,   sister_younger:         -1.5,
  self:          0,
  spouse_female: 0.1,   spouse_male: -0.1,
  // 妻方兄弟姐妹
  brother_in_law_wife_elder:      2,   brother_in_law_wife_younger:    3,
  sister_in_law_wife_elder:       4,   sister_in_law_wife_younger:     5,
  // 夫方兄弟姐妹
  brother_in_law_husband_elder:   2,   brother_in_law_husband_younger: 3,
  sister_in_law_husband_elder:    4,   sister_in_law_husband_younger:  5,
  // 堂/表兄弟姐妹
  cousin_paternal_male_elder:   -4,   cousin_paternal_male_younger:   -3,
  cousin_paternal_female_elder: -3.5, cousin_paternal_female_younger: -2.5,
  cousin_maternal_male_elder:    2,   cousin_maternal_male_younger:    3,
  cousin_maternal_female_elder:  4,   cousin_maternal_female_younger:  5,
  // 子辈 gen +1
  son:        -1,   daughter_in_law: -0.4,
  son_in_law: -0.5, daughter:        -0.3,
};

class TreeNode {
  constructor(member) {
    this.id      = member.id;
    this.member  = member;
    this.x = 0; this.y = 0; this.width = 0;
    this.children = [];
    this.parent   = null;
    this.spouse   = null;
  }
}

class FamilyVisualization {
  constructor(containerId) {
    this.canvas = document.getElementById(containerId);
    if (!this.canvas) { console.error('Canvas not found:', containerId); return; }
    this.ctx  = this.canvas.getContext('2d');
    this.members      = [];
    this.nodes        = [];
    this.connections  = [];
    this.kinshipGraph = null;

    this.layoutConfig = {
      minNodeGap: 20, minSiblingGap: 30, minSpouseGap: 20,
      levelHeight: 100, padding: 40, autoScale: true, fitToScreen: true
    };
    this.styles = {
      nodeWidth: 100, nodeHeight: 56, levelHeight: 100,
      siblingGap: 24, spouseGap: 16, padding: 40,
      colors: {
        male: '#4A90E2', female: '#E94B8A', unknown: '#9E9E9E',
        me: '#C84A3E', line: '#BDBDBD', lineParent: '#757575',
        text: '#FFFFFF', bg: '#FAFAFA'
      },
      fonts: {
        name:     'bold 14px -apple-system, BlinkMacSystemFont, sans-serif',
        relation: '11px -apple-system, BlinkMacSystemFont, sans-serif'
      }
    };
    this.transform  = { x: 0, y: 0, scale: 1 };
    this.isDragging = false;
    this.lastPos    = null;
    this.bounds     = { minX:0, maxX:0, minY:0, maxY:0, width:0, height:0 };
    this.dpr        = window.devicePixelRatio || 1;
    this.init();
  }

  init() {
    this.resize();
    this.bindGestures();
    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    this.resize();
    if (this.members.length > 0) { this.calculateLayout(); this.draw(); }
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      this.canvas.style.width  = rect.width  + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.canvas.width  = rect.width  * this.dpr;
      this.canvas.height = rect.height * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);
    }
  }

  bindGestures() {
    this.canvas.addEventListener('touchstart', e => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove',  e => this.handleTouchMove(e),  { passive: false });
    this.canvas.addEventListener('touchend',   () => this.handleTouchEnd());
    this.canvas.addEventListener('mousedown',  e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove',  e => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup',    () => this.handleMouseUp());
    this.canvas.addEventListener('wheel',      e => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick',   () => this.fitToScreen());
  }

  fitToScreen() {
    if (!this.nodes.length) return;
    this.calculateBounds();
    const pad = this.layoutConfig.padding;
    const aw = this.canvas.width  / this.dpr - pad * 2;
    const ah = this.canvas.height / this.dpr - pad * 2;
    let s = Math.min(aw / this.bounds.width, ah / this.bounds.height, 1.5);
    s = Math.max(0.3, s);
    const tx = (this.canvas.width  / this.dpr - this.bounds.width  * s) / 2 - this.bounds.minX * s;
    const ty = (this.canvas.height / this.dpr - this.bounds.height * s) / 2 - this.bounds.minY * s;
    this.animateTransform(tx, ty, s);
  }

  animateTransform(tx, ty, ts) {
    const sx = this.transform.x, sy = this.transform.y, ss = this.transform.scale;
    const dur = 300, t0 = Date.now();
    const go = () => {
      const p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      this.transform.x = sx + (tx - sx) * e;
      this.transform.y = sy + (ty - sy) * e;
      this.transform.scale = ss + (ts - ss) * e;
      this.draw();
      if (p < 1) requestAnimationFrame(go);
    };
    go();
  }

  handleTouchStart(e) {
    if (e.touches.length === 1) { this.isDragging = true; this.lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    else if (e.touches.length === 2) { this.isDragging = false; this.lastDistance = this.getTouchDistance(e.touches); }
  }
  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDragging && this.lastPos) {
      this.transform.x += e.touches[0].clientX - this.lastPos.x;
      this.transform.y += e.touches[0].clientY - this.lastPos.y;
      this.lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.draw();
    } else if (e.touches.length === 2) {
      const d = this.getTouchDistance(e.touches);
      if (this.lastDistance > 0) this.zoom(d / this.lastDistance);
      this.lastDistance = d;
    }
  }
  handleTouchEnd()   { this.isDragging = false; this.lastPos = null; this.lastDistance = 0; }
  handleMouseDown(e) { this.isDragging = true; this.lastPos = { x: e.clientX, y: e.clientY }; }
  handleMouseMove(e) {
    if (this.isDragging && this.lastPos) {
      this.transform.x += e.clientX - this.lastPos.x;
      this.transform.y += e.clientY - this.lastPos.y;
      this.lastPos = { x: e.clientX, y: e.clientY };
      this.draw();
    }
  }
  handleMouseUp()    { this.isDragging = false; this.lastPos = null; }
  handleWheel(e)     { e.preventDefault(); this.zoom(e.deltaY > 0 ? 0.9 : 1.1); }
  getTouchDistance(t){ return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  zoom(f) { this.transform.scale = Math.max(0.3, Math.min(4, this.transform.scale * f)); this.draw(); }
  resetView() { this.transform = { x: 0, y: 0, scale: 1 }; this.draw(); }

  setData(members) {
    this.members = (members || []).map(m => ({ ...m }));
    this.nodes = []; this.connections = [];
    const hasSelf = this.members.some(m => m.relationType === 'self');
    if (!hasSelf && this.members.length > 0) {
      const f  = this.members.find(m => m.relationType === 'father');
      const mo = this.members.find(m => m.relationType === 'mother');
      const gen = f ? f.generation + 1 : mo ? mo.generation + 1 : 0;
      this.members.push({ id: `self_${Date.now()}`, name: '我', gender: 'male', relation: '自己', relationType: 'self', generation: gen });
    }
    this.transform = { x: 0, y: 0, scale: 1 };
    this.adjustNodeSizeByCount();
    this.enrichMemberData();
    this.calculateLayout();
    if (this.layoutConfig.fitToScreen && this.nodes.length > 0) this.fitToScreen();
    else this.centerTree();
    this.draw();
  }

  adjustNodeSizeByCount() {
    const c = this.members.length;
    if      (c <= 5)  { this.styles.nodeWidth=100; this.styles.nodeHeight=56; this.styles.siblingGap=30; this.styles.spouseGap=20; }
    else if (c <= 10) { this.styles.nodeWidth=90;  this.styles.nodeHeight=50; this.styles.siblingGap=25; this.styles.spouseGap=16; }
    else if (c <= 20) { this.styles.nodeWidth=80;  this.styles.nodeHeight=45; this.styles.siblingGap=20; this.styles.spouseGap=14;
      this.styles.fonts.name='bold 12px -apple-system,BlinkMacSystemFont,sans-serif';
      this.styles.fonts.relation='10px -apple-system,BlinkMacSystemFont,sans-serif'; }
    else              { this.styles.nodeWidth=70;  this.styles.nodeHeight=40; this.styles.siblingGap=15; this.styles.spouseGap=10;
      this.styles.fonts.name='bold 11px -apple-system,BlinkMacSystemFont,sans-serif';
      this.styles.fonts.relation='9px -apple-system,BlinkMacSystemFont,sans-serif'; }
    this.styles.siblingGap = Math.max(this.styles.siblingGap, this.layoutConfig.minSiblingGap);
    this.styles.spouseGap  = Math.max(this.styles.spouseGap,  this.layoutConfig.minSpouseGap);
  }

  centerTree() {
    if (!this.nodes.length) return;
    this.calculateBounds();
    const cw = this.canvas.width / this.dpr, ch = this.canvas.height / this.dpr;
    this.transform.x = (cw - this.bounds.width)  / 2 - this.bounds.minX;
    this.transform.y = (ch - this.bounds.height) / 2 - this.bounds.minY + 20;
  }

  calculateBounds() {
    if (!this.nodes.length) return;
    let mnX=Infinity, mxX=-Infinity, mnY=Infinity, mxY=-Infinity;
    const hw = this.styles.nodeWidth / 2, hh = this.styles.nodeHeight / 2;
    this.nodes.forEach(n => {
      mnX=Math.min(mnX,n.x-hw); mxX=Math.max(mxX,n.x+hw);
      mnY=Math.min(mnY,n.y-hh); mxY=Math.max(mxY,n.y+hh);
    });
    this.bounds = { minX:mnX, maxX:mxX, minY:mnY, maxY:mxY, width:mxX-mnX, height:mxY-mnY };
  }

  enrichMemberData() {
    if (!this.members.length) return;
    this.members.forEach((m, i) => { if (!m.id) m.id = `member_auto_${i}`; });
    this.members.forEach(m => { m.parentIds = []; m.childrenIds = []; delete m.spouseId; });

    const byType = new Map();
    this.members.forEach(m => {
      const rt = m.relationType || '';
      if (!byType.has(rt)) byType.set(rt, []);
      byType.get(rt).push(m);
    });

    const g = new FamilyGraph();
    this.members.forEach(m => g.addNode(m));

    ROLE_SPOUSE_RULES.forEach(([rtA, rtB]) => {
      const as = byType.get(rtA) || [], bs = byType.get(rtB) || [];
      const len = Math.min(as.length, bs.length);
      for (let i = 0; i < len; i++) g.linkSpouse(as[i].id, bs[i].id);
    });

    const COUSIN_TYPES = new Set([
      'cousin_paternal_male_elder','cousin_paternal_male_younger',
      'cousin_paternal_female_elder','cousin_paternal_female_younger',
      'cousin_maternal_male_elder','cousin_maternal_male_younger',
      'cousin_maternal_female_elder','cousin_maternal_female_younger',
    ]);
    ROLE_PARENT_RULES.forEach(([parentRole, childRole]) => {
      const parents  = byType.get(parentRole) || [];
      const children = byType.get(childRole)  || [];
      if (!parents.length || !children.length) return;
      children.forEach(child => {
        if (COUSIN_TYPES.has(childRole) && g.getParentIds(child.id).length > 0) return;
        parents.forEach(parent => g.linkParentChild(parent.id, child.id));
      });
    });

    this.members.forEach(m => {
      const spouseId = g.getSpouseId(m.id);
      if (!spouseId) return;
      g.getChildIds(m.id).forEach(childId => g.linkParentChild(spouseId, childId));
    });

    this.members.forEach(m => {
      m.parentIds   = g.getParentIds(m.id);
      m.childrenIds = g.getChildIds(m.id);
      const sid     = g.getSpouseId(m.id);
      if (sid) m.spouseId = sid;
    });

    this.kinshipGraph = g;
    this.members.sort((a, b) => (a.generation || 0) - (b.generation || 0));

    console.log('=== 关系链建立 (BFS Graph) ===');
    this.members.forEach(m => console.log(
      `${m.name} (${m.relationType}): gen=${m.generation}`,
      `parents=${m.parentIds?.join(',') || 'none'}`,
      `spouse=${m.spouseId || 'none'}`,
      `children=${m.childrenIds?.join(',') || 'none'}`
    ));
  }

  calculateLayout() {
    this.nodes = []; this.connections = [];
    if (!this.members.length) return;
    this.calculateSmartLayout();
  }

  getLineageScore(relationType) { return LINEAGE_SCORE[relationType] ?? 0; }

  calculateSmartLayout() {
    const roots = this.buildTreeStructure();
    if (!roots.length) return;

    roots.sort((a, b) => this.getLineageScore(a.member.relationType) - this.getLineageScore(b.member.relationType));
    roots.forEach(r => this.sortTreeChildrenByScore(r));
    roots.forEach(r => this.calculateSubtreeWidth(r));

    let cx = this.layoutConfig.padding + 50;
    roots.forEach(root => {
      this.calculateNodePosition(root, cx);
      cx += root.width + this.styles.siblingGap * 4;
    });

    this.resolveTreeCollisions(roots);
    this.ensurePositiveCoordinates(roots);
    this.syncNodesFromTree(roots);
    this.calculateSmartConnections();
    this.calculateBounds();
    if (this.layoutConfig.fitToScreen) this.fitToScreen();
  }

  sortTreeChildrenByScore(node) {
    if (!node?.children?.length) return;
    node.children.sort((a, b) =>
      this.getLineageScore(a.member.relationType) - this.getLineageScore(b.member.relationType));
    node.children.forEach(c => this.sortTreeChildrenByScore(c));
  }

  // ════════════════════════════════════════════════════════════════════
  //  buildTreeStructure
  //
  //  非锚点（nonAnchorIds）判定规则：
  //
  //  通常情况：女性有男性配偶 → 女性是非锚点，由婚姻定位（紧靠丈夫）
  //
  //  ★ 例外（姑姑/aunt_paternal 等"嫁出去的女儿"）：
  //    若女方有血缘父节点（parentIds 非空）而男方无血缘父节点（parentIds 为空），
  //    则女方应挂在自己的血亲父节点下，男方（姑父）反而成为 _spouseConnected。
  //
  //  判定表：
  //    femaleHasParents=F, maleHasParents=F → 女方非锚（无处可挂，走婚姻定位）
  //    femaleHasParents=F, maleHasParents=T → 女方非锚（丈夫有家族树，女方跟随）✓ 常规
  //    femaleHasParents=T, maleHasParents=T → 女方非锚（两边都有树，男方优先）✓ 如母亲
  //    femaleHasParents=T, maleHasParents=F → 女方是锚（留在自己血亲树下）★ 姑姑
  // ════════════════════════════════════════════════════════════════════
  buildTreeStructure() {
    const nodeMap = new Map();
    this.members.forEach(m => nodeMap.set(m.id, new TreeNode(m)));

    // ── 非锚点检测 ────────────────────────────────────────────────────
    const nonAnchorIds = new Set();
    this.members.forEach(m => {
      if (m.spouseId && m.gender === 'female') {
        const sp = this.members.find(s => s.id === m.spouseId);
        if (sp?.gender === 'male') {
          const femaleHasParents = (m.parentIds?.length  ?? 0) > 0;
          const maleHasParents   = (sp.parentIds?.length ?? 0) > 0;
          // 女方是非锚点，当且仅当：她没有父节点，或她和丈夫都有父节点（男方优先）
          // 唯一例外：女方有父节点但丈夫没有 → 女方留在血亲树下，丈夫跟随
          if (!femaleHasParents || maleHasParents) {
            nonAnchorIds.add(m.id);
          }
        }
      }
    });

    // ── 子节点挂到血亲父节点 ──────────────────────────────────────────
    const placed = new Set();
    this.members.forEach(m => {
      if (!m.parentIds?.length || nonAnchorIds.has(m.id) || placed.has(m.id)) return;
      const parentNode = nodeMap.get(m.parentIds[0]);
      const childNode  = nodeMap.get(m.id);
      if (parentNode && childNode) {
        parentNode.children.push(childNode);
        childNode.parent = parentNode;
        placed.add(m.id);
        console.log(`  找到子女: ${childNode.member.name} (${m.id})`);
      }
    });

    // ── 配偶链接 ──────────────────────────────────────────────────────
    this.members.forEach(m => {
      if (m.spouseId && m.gender === 'male') {
        const n = nodeMap.get(m.id), sn = nodeMap.get(m.spouseId);
        if (n && sn && !n.spouse) { n.spouse = sn; sn.spouse = n; }
      }
    });
    this.members.forEach(m => {
      if (m.spouseId) {
        const n = nodeMap.get(m.id), sn = nodeMap.get(m.spouseId);
        if (n && sn && !n.spouse && !sn.spouse) { n.spouse = sn; sn.spouse = n; }
      }
    });

    // ── _spouseConnected：通过婚姻连接，不作为独立根节点 ─────────────
    nodeMap.forEach(node => {
      if (!node.parent && node.spouse) {
        const sp = node.spouse;
        if (sp.parent !== null || sp.children.length > 0) {
          node._spouseConnected = true;
        } else if (node.member.gender === 'female') {
          node._spouseConnected = true;
        }
      }
    });

    const roots = [];
    nodeMap.forEach(n => { if (!n.parent && !n._spouseConnected) roots.push(n); });
    console.log('树结构根节点:', roots.map(r =>
      `${r.member.name}(gen:${r.member.generation},children:${r.children.length})`));
    return roots;
  }

  calculateSubtreeWidth(node) {
    if (!node) return 0;
    node.children.forEach(c => this.calculateSubtreeWidth(c));
    const NW = this.styles.nodeWidth, SG = this.styles.siblingGap, SPG = this.styles.spouseGap;
    if (!node.children.length) {
      node.width = NW + (node.spouse ? SPG + NW : 0);
    } else {
      const cw = node.children.reduce((s, c, i) =>
        s + c.width + (i < node.children.length - 1 ? SG : 0), 0);
      node.width = Math.max(NW + (node.spouse ? SPG + NW : 0), cw);
    }
    return node.width;
  }

  calculateNodePosition(node, startX) {
    if (!node) return;
    const NW = this.styles.nodeWidth, SG = this.styles.siblingGap, SPG = this.styles.spouseGap;
    const y = 80 + ((node.member.generation || 0) - (-3)) * 120;

    if (!node.children.length) {
      node.x = startX + node.width / 2;
      node.y = y;
    } else {
      let cx = startX;
      node.children.forEach(c => { this.calculateNodePosition(c, cx); cx += c.width + SG; });
      const fc = node.children[0], lc = node.children[node.children.length - 1];
      node.x = (fc.x + lc.x) / 2;
      node.y = y;
    }

    if (node.spouse) {
      const dir = node.member.gender === 'male' ? 1 : -1;
      node.spouse.x = node.x + dir * (NW / 2 + SPG + NW / 2);
      node.spouse.y = y;
    }
  }

  collectAllTreeNodes(roots) {
    const all = [], vis = new Set();
    const go = n => {
      if (!n || vis.has(n.id)) return;
      vis.add(n.id); all.push(n);
      if (n.spouse && !vis.has(n.spouse.id)) { vis.add(n.spouse.id); all.push(n.spouse); }
      n.children.forEach(go);
    };
    roots.forEach(go);
    return all;
  }

  ensurePositiveCoordinates(roots) {
    const all = this.collectAllTreeNodes(roots);
    let mnX = Infinity;
    all.forEach(n => {
      if (n.spouse && n.x > n.spouse.x) return;
      mnX = Math.min(mnX, n.x - this.styles.nodeWidth / 2);
    });
    if (mnX < this.layoutConfig.padding) {
      const off = this.layoutConfig.padding - mnX;
      const done = new Set();
      all.forEach(n => {
        if (done.has(n.id)) return; n.x += off; done.add(n.id);
        if (n.spouse && !done.has(n.spouse.id)) { n.spouse.x += off; done.add(n.spouse.id); }
      });
    }
  }

  resolveTreeCollisions(roots) {
    const all = this.collectAllTreeNodes(roots);
    const NW = this.styles.nodeWidth, SG = this.styles.siblingGap;
    for (let i = 0; i < 20; i++) {
      let hit = false;
      const grp = new Map();
      all.forEach(n => { const g = n.member.generation || 0; if (!grp.has(g)) grp.set(g, []); grp.get(g).push(n); });
      grp.forEach(gs => {
        const anch = gs.filter(n => !n.spouse || n.x <= n.spouse.x).sort((a, b) => a.x - b.x);
        for (let j = 0; j < anch.length - 1; j++) {
          const n1 = anch[j], n2 = anch[j + 1];
          const r1 = n1.spouse ? Math.max(n1.x, n1.spouse.x) + NW/2 : n1.x + NW/2;
          const l2 = n2.x - NW/2;
          if (l2 - r1 < SG) {
            hit = true;
            const sh = (SG - (l2 - r1)) / 2 + 1;
            this.shiftTree(n1, -sh); this.shiftTree(n2, sh);
          }
        }
      });
      if (!hit) break;
    }
  }

  shiftTree(node, dx) {
    if (!node) return;
    node.x += dx;
    if (node.spouse) node.spouse.x += dx;
    node.children.forEach(c => this.shiftTree(c, dx));
  }

  syncNodesFromTree(roots) {
    this.nodes = this.collectAllTreeNodes(roots).map(n =>
      ({ id: n.member.id, x: n.x, y: n.y, member: n.member }));
  }

  calculateSmartConnections() {
    const nodeMap = new Map();
    this.nodes.forEach(n => nodeMap.set(n.id, n));
    const nh = this.styles.nodeHeight;

    const seenSp = new Set();
    this.members.forEach(m => {
      if (!m.spouseId) return;
      const k = [m.id, m.spouseId].sort().join('|');
      if (seenSp.has(k)) return; seenSp.add(k);
      const n1 = nodeMap.get(m.id), n2 = nodeMap.get(m.spouseId);
      if (n1 && n2) this.connections.push({ from: n1, to: n2, type: 'spouse' });
    });

    const famMap = new Map();
    this.members.forEach(m => {
      if (!m.parentIds?.length) return;
      const cn = nodeMap.get(m.id); if (!cn) return;
      const pns = m.parentIds.map(pid => nodeMap.get(pid)).filter(Boolean);
      if (!pns.length) return;
      const k = pns.map(p => p.id).sort().join('|');
      if (!famMap.has(k)) famMap.set(k, { parentNodes: pns, children: [] });
      famMap.get(k).children.push(cn);
    });

    famMap.forEach(({ parentNodes: pns, children: cns }) => {
      if (!cns.length) return;
      const px  = pns.reduce((s, p) => s + p.x, 0) / pns.length;
      const pby = pns[0].y + nh / 2;
      const cty = cns[0].y - nh / 2;
      const my  = (pby + cty) / 2;
      if (cns.length === 1) {
        this.connections.push({ type: 'parent-child', from: { x: px, y: pby }, to: { x: cns[0].x, y: cty } });
      } else {
        this.connections.push({ type: 'parent-children-bracket', parentX: px, parentBottomY: pby, midY: my,
          children: cns.map(c => ({ x: c.x, topY: c.y - nh/2 })) });
      }
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);
    this.drawConnections(ctx);
    this.nodes.forEach(n => this.drawNode(ctx, n));
    ctx.restore();
    if (!this.nodes.length) this.drawEmptyState(ctx);
  }

  drawConnections(ctx) {
    this.connections.forEach(conn => {
      ctx.beginPath();
      if (conn.type === 'spouse') {
        const L = conn.from.x <= conn.to.x ? conn.from : conn.to;
        const R = conn.from.x <= conn.to.x ? conn.to   : conn.from;
        ctx.strokeStyle = '#E94B8A'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
        ctx.moveTo(L.x + this.styles.nodeWidth/2, L.y);
        ctx.lineTo(R.x - this.styles.nodeWidth/2, R.y);
        ctx.stroke(); ctx.setLineDash([]);
        this.drawHeart(ctx, (L.x + R.x) / 2, L.y);
      } else if (conn.type === 'parent-child') {
        ctx.strokeStyle = this.styles.colors.lineParent; ctx.lineWidth = 2; ctx.setLineDash([]);
        const my = (conn.from.y + conn.to.y) / 2;
        ctx.moveTo(conn.from.x, conn.from.y); ctx.lineTo(conn.from.x, my);
        ctx.lineTo(conn.to.x, my); ctx.lineTo(conn.to.x, conn.to.y); ctx.stroke();
      } else if (conn.type === 'parent-children-bracket') {
        ctx.strokeStyle = this.styles.colors.lineParent; ctx.lineWidth = 2; ctx.setLineDash([]);
        const { parentX: px, parentBottomY: pby, midY: my, children: chs } = conn;
        ctx.beginPath(); ctx.moveTo(px, pby); ctx.lineTo(px, my); ctx.stroke();
        const xs = chs.map(c => c.x);
        ctx.beginPath(); ctx.moveTo(Math.min(...xs, px), my); ctx.lineTo(Math.max(...xs, px), my); ctx.stroke();
        chs.forEach(c => { ctx.beginPath(); ctx.moveTo(c.x, my); ctx.lineTo(c.x, c.topY); ctx.stroke(); });
      }
    });
  }

  drawHeart(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#E94B8A';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-3, -3, -6, 0, 0, 4); ctx.bezierCurveTo(6, 0, 3, -3, 0, 0);
    ctx.fill(); ctx.restore();
  }

  drawNode(ctx, node) {
    const m = node.member, w = this.styles.nodeWidth, h = this.styles.nodeHeight;
    const x = node.x - w/2, y = node.y - h/2;
    let bg = this.styles.colors.unknown, isSelf = false;
    if (m.relationType === 'self') { bg = this.styles.colors.me; isSelf = true; }
    else if (m.gender === 'male')   bg = this.styles.colors.male;
    else if (m.gender === 'female') bg = this.styles.colors.female;
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
    this.drawRoundedRect(ctx, x, y, w, h, 10, bg);
    ctx.shadowColor = 'transparent';
    if (isSelf) { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillStyle = this.styles.colors.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = this.styles.fonts.name;
    ctx.fillText(this.truncateText(ctx, m.name || '未知', w - 16), node.x, node.y - 5);
    ctx.font = this.styles.fonts.relation; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(this.truncateText(ctx, m.relation || '', w - 12), node.x, node.y + 14);
  }

  truncateText(ctx, text, max) {
    if (!text) return '';
    if (ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 0) { t = t.slice(0, -1); if (ctx.measureText(t + '...').width <= max) return t + '...'; }
    return '...';
  }

  drawRoundedRect(ctx, x, y, w, h, r, color) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }

  drawEmptyState(ctx) {
    ctx.fillStyle = '#999';
    ctx.font = '16px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无家族数据', this.canvas.width / this.dpr / 2, this.canvas.height / this.dpr / 2);
  }

  exportImage() { return this.canvas.toDataURL('image/png'); }
  addMember(m)  { this.members.push(m); this.enrichMemberData(); this.calculateLayout(); this.draw(); }
  clear()       { this.members = []; this.nodes = []; this.connections = []; this.kinshipGraph = null; this.transform = { x:0,y:0,scale:1 }; this.draw(); }
  getDebugInfo(){ return { memberCount: this.members.length, nodeCount: this.nodes.length, connectionCount: this.connections.length, bounds: this.bounds, transform: this.transform }; }

  // ════════════════════════════════════════════════════════════════════════
  //  GEDCOM 5.5.1 导出功能
  // ════════════════════════════════════════════════════════════════════════
  exportToGEDCOM() {
    if (!this.members || this.members.length === 0) return '';
    
    const now = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14);
    let gedcom = `0 HEAD\n1 SOUR WangZu\n2 VERS 2.0\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n1 DATE ${now.slice(0,4)} ${now.slice(4,6)} ${now.slice(6,8)}\n`;
    
    // 生成唯一ID映射
    const idMap = new Map();
    this.members.forEach((m, idx) => {
      idMap.set(m.id, `I${String(idx + 1).padStart(4, '0')}`);
    });
    
    // 导出个人记录 (INDI)
    this.members.forEach(m => {
      const id = idMap.get(m.id);
      gedcom += `0 @${id}@ INDI\n`;
      gedcom += `1 NAME ${m.name || 'Unknown'}\n`;
      
      // 性别
      if (m.gender === 'male') gedcom += '1 SEX M\n';
      else if (m.gender === 'female') gedcom += '1 SEX F\n';
      
      // 关系类型作为备注
      if (m.relation) {
        gedcom += `1 NOTE 关系: ${m.relation}\n`;
      }
      
      // 配偶关系 (FAMS)
      if (m.spouseId && idMap.has(m.spouseId)) {
        const spouseId = idMap.get(m.spouseId);
        const famId = `F${String(Math.min(parseInt(id.slice(1)), parseInt(spouseId.slice(1)))).padStart(4, '0')}`;
        gedcom += `1 FAMS @${famId}@\n`;
      }
      
      // 父母关系 (FAMC)
      if (m.parentIds && m.parentIds.length > 0) {
        const parentId = m.parentIds.find(pid => idMap.has(pid));
        if (parentId) {
          const pIndiId = idMap.get(parentId);
          // 找到父母的配偶来构建家庭ID
          const parent = this.members.find(pm => pm.id === parentId);
          if (parent && parent.spouseId && idMap.has(parent.spouseId)) {
            const spouseId = idMap.get(parent.spouseId);
            const famId = `F${String(Math.min(parseInt(pIndiId.slice(1)), parseInt(spouseId.slice(1)))).padStart(4, '0')}`;
            gedcom += `1 FAMC @${famId}@\n`;
          }
        }
      }
    });
    
    // 导出家庭记录 (FAM)
    const processedFamilies = new Set();
    this.members.forEach(m => {
      if (!m.spouseId || !idMap.has(m.spouseId)) return;
      
      const id1 = idMap.get(m.id);
      const id2 = idMap.get(m.spouseId);
      const famKey = [id1, id2].sort().join('-');
      
      if (processedFamilies.has(famKey)) return;
      processedFamilies.add(famKey);
      
      const famId = `F${String(Math.min(parseInt(id1.slice(1)), parseInt(id2.slice(1)))).padStart(4, '0')}`;
      gedcom += `0 @${famId}@ FAM\n`;
      
      // 丈夫和妻子
      const spouse1 = this.members.find(pm => pm.id === m.id);
      const spouse2 = this.members.find(pm => pm.id === m.spouseId);
      
      if (spouse1?.gender === 'male') gedcom += `1 HUSB @${id1}@\n`;
      else if (spouse1?.gender === 'female') gedcom += `1 WIFE @${id1}@\n`;
      
      if (spouse2?.gender === 'male') gedcom += `1 HUSB @${id2}@\n`;
      else if (spouse2?.gender === 'female') gedcom += `1 WIFE @${id2}@\n`;
      
      // 子女
      this.members.forEach(child => {
        if (child.parentIds?.includes(m.id) || child.parentIds?.includes(m.spouseId)) {
          const childId = idMap.get(child.id);
          if (childId) gedcom += `1 CHIL @${childId}@\n`;
        }
      });
    });
    
    gedcom += '0 TRLR\n';
    return gedcom;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  分享功能：生成分享数据对象
  // ════════════════════════════════════════════════════════════════════════
  exportToShareData() {
    return {
      version: '2.0',
      exportDate: new Date().toISOString(),
      members: this.members.map(m => ({
        id: m.id,
        name: m.name,
        gender: m.gender,
        relation: m.relation,
        relationType: m.relationType,
        generation: m.generation,
        spouseId: m.spouseId,
        parentIds: m.parentIds
      })),
      metadata: {
        memberCount: this.members.length,
        source: 'WangZu Family Tree'
      }
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  GEDCOM 5.5.1 导入功能
  // ════════════════════════════════════════════════════════════════════════
  
  /**
   * 解析 GEDCOM 5.5.1 格式内容
   * @param {string} gedcomContent - GEDCOM 文件内容
   * @returns {Object} { success: boolean, members: Array, errors: Array }
   */
  static parseGEDCOM(gedcomContent) {
    const errors = [];
    const warnings = [];
    
    if (!gedcomContent || !gedcomContent.trim()) {
      return { success: false, members: [], errors: ['GEDCOM内容为空'] };
    }

    const lines = gedcomContent.split(/\r?\n/);
    const individuals = new Map();  // GEDCOM ID -> person data
    const families = new Map();     // FAM ID -> family data
    
    let currentRecord = null;
    let currentType = null;
    let lineNum = 0;

    // 解析每一行
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 解析行级别和标签
      const match = trimmed.match(/^(\d+)\s+(@[^@]+@\s+)?(\w+)\s*(.*)?$/);
      if (!match) {
        warnings.push(`第${lineNum}行格式无法识别: ${trimmed.slice(0, 50)}`);
        continue;
      }

      const [, levelStr, xref, tag, value = ''] = match;
      const level = parseInt(levelStr);

      // 0级记录开始
      if (level === 0) {
        if (tag === 'INDI') {
          const id = xref?.trim().replace(/@/g, '');
          currentRecord = { 
            id, 
            gedcomId: id,
            name: '', 
            gender: 'unknown',
            fams: [],  // 配偶家庭
            famc: null // 父母家庭
          };
          currentType = 'INDI';
          individuals.set(id, currentRecord);
        } else if (tag === 'FAM') {
          const id = xref?.trim().replace(/@/g, '');
          currentRecord = {
            id,
            husband: null,
            wife: null,
            children: []
          };
          currentType = 'FAM';
          families.set(id, currentRecord);
        } else if (tag === 'HEAD' || tag === 'TRLR') {
          currentRecord = null;
          currentType = null;
        } else {
          currentRecord = null;
        }
        continue;
      }

      if (!currentRecord) continue;

      // INDI 记录内的标签
      if (currentType === 'INDI') {
        switch (tag) {
          case 'NAME':
            currentRecord.name = value.replace(/\//g, '').trim();
            break;
          case 'SEX':
            const sex = value.trim().toUpperCase();
            currentRecord.gender = sex === 'M' ? 'male' : sex === 'F' ? 'female' : 'unknown';
            break;
          case 'FAMS':
            const famsId = value.replace(/@/g, '').trim();
            if (famsId) currentRecord.fams.push(famsId);
            break;
          case 'FAMC':
            currentRecord.famc = value.replace(/@/g, '').trim();
            break;
          case 'NOTE':
            // 提取关系类型备注
            const relationMatch = value.match(/关系:\s*(.+)/);
            if (relationMatch) {
              currentRecord.relation = relationMatch[1].trim();
            }
            break;
        }
      }

      // FAM 记录内的标签
      if (currentType === 'FAM') {
        switch (tag) {
          case 'HUSB':
            currentRecord.husband = value.replace(/@/g, '').trim();
            break;
          case 'WIFE':
            currentRecord.wife = value.replace(/@/g, '').trim();
            break;
          case 'CHIL':
            const childId = value.replace(/@/g, '').trim();
            if (childId) currentRecord.children.push(childId);
            break;
        }
      }
    }

    // 转换为旺祖内部格式
    const members = [];
    const idMapping = new Map(); // GEDCOM ID -> 新UUID

    // 第一步：创建所有成员基础数据
    for (const [gedcomId, indi] of individuals) {
      const newId = 'mem_' + Math.random().toString(36).substr(2, 9);
      idMapping.set(gedcomId, newId);

      members.push({
        id: newId,
        name: indi.name || '未知',
        gender: indi.gender,
        relation: indi.relation || '',
        relationType: 'imported',
        generation: 0, // 稍后计算
        spouseId: null,
        parentIds: [],
        _gedcomId: gedcomId, // 临时保存用于关联
        _fams: indi.fams,
        _famc: indi.famc
      });
    }

    // 第二步：建立配偶关系
    for (const [famId, fam] of families) {
      const husbandNewId = idMapping.get(fam.husband);
      const wifeNewId = idMapping.get(fam.wife);

      if (husbandNewId && wifeNewId) {
        const husband = members.find(m => m.id === husbandNewId);
        const wife = members.find(m => m.id === wifeNewId);
        
        if (husband) husband.spouseId = wifeNewId;
        if (wife) wife.spouseId = husbandNewId;
      }
    }

    // 第三步：建立父母-子女关系
    for (const [famId, fam] of families) {
      const parentIds = [];
      if (fam.husband) {
        const id = idMapping.get(fam.husband);
        if (id) parentIds.push(id);
      }
      if (fam.wife) {
        const id = idMapping.get(fam.wife);
        if (id) parentIds.push(id);
      }

      for (const childGedcomId of fam.children) {
        const childNewId = idMapping.get(childGedcomId);
        if (childNewId) {
          const child = members.find(m => m.id === childNewId);
          if (child) {
            child.parentIds = [...parentIds];
          }
        }
      }
    }

    // 第四步：计算代际
    calculateGenerations(members);

    // 第五步：推断关系类型
    inferRelationTypes(members);

    // 清理临时字段
    for (const m of members) {
      delete m._gedcomId;
      delete m._fams;
      delete m._famc;
    }

    return {
      success: members.length > 0,
      members,
      errors: errors.length > 0 ? errors : null,
      warnings: warnings.length > 0 ? warnings : null,
      stats: {
        individualCount: individuals.size,
        familyCount: families.size,
        importedCount: members.length
      }
    };

    // 辅助函数：计算代际
    function calculateGenerations(members) {
      // 找到没有父母的根节点（最长辈）
      const visited = new Set();
      
      function setGeneration(member, gen) {
        if (visited.has(member.id)) return;
        visited.add(member.id);
        member.generation = gen;
        
        // 子女代际 +1
        for (const m of members) {
          if (m.parentIds?.includes(member.id)) {
            setGeneration(m, gen + 1);
          }
        }
      }

      // 从根节点开始
      for (const m of members) {
        if (!m.parentIds || m.parentIds.length === 0) {
          setGeneration(m, 1);
        }
      }

      // 处理孤立节点（没有父母也没有子女的）
      for (const m of members) {
        if (!visited.has(m.id)) {
          m.generation = 1;
        }
      }

      // 标准化代际，使最小为1
      const minGen = Math.min(...members.map(m => m.generation || 1));
      if (minGen < 1) {
        for (const m of members) {
          m.generation = (m.generation || 1) - minGen + 1;
        }
      }
    }

    // 辅助函数：推断关系类型
    function inferRelationTypes(members) {
      // 找到代数最多的人作为"我"
      const maxGen = Math.max(...members.map(m => m.generation || 1));
      const selfCandidates = members.filter(m => m.generation === maxGen);
      
      if (selfCandidates.length > 0) {
        // 选择有配偶的作为"我"，或第一个
        const self = selfCandidates.find(m => m.spouseId) || selfCandidates[0];
        self.relationType = 'self';
        self.relation = '我';

        // 根据关系推断其他人类型
        for (const m of members) {
          if (m === self) continue;
          
          const genDiff = m.generation - self.generation;
          
          if (genDiff === 0) {
            // 同代
            if (m.spouseId === self.id) {
              m.relationType = 'spouse';
              m.relation = m.gender === 'male' ? '丈夫' : '妻子';
            } else if (m.parentIds?.some(pid => self.parentIds?.includes(pid))) {
              m.relationType = 'sibling';
              m.relation = m.gender === 'male' ? '兄弟' : '姐妹';
            }
          } else if (genDiff === -1) {
            // 上一代
            if (m.gender === 'male') {
              m.relationType = 'father';
              m.relation = '父亲';
            } else {
              m.relationType = 'mother';
              m.relation = '母亲';
            }
          } else if (genDiff === -2) {
            // 祖父母辈
            if (m.gender === 'male') {
              m.relationType = 'grandfather';
              m.relation = '祖父';
            } else {
              m.relationType = 'grandmother';
              m.relation = '祖母';
            }
          } else if (genDiff === 1) {
            // 下一代
            if (m.gender === 'male') {
              m.relationType = 'son';
              m.relation = '儿子';
            } else {
              m.relationType = 'daughter';
              m.relation = '女儿';
            }
          }

          // 如果没有推断出关系，使用通用描述
          if (!m.relationType || m.relationType === 'imported') {
            m.relationType = 'relative';
            m.relation = '亲属';
          }
        }
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  FamilyTreeDOM — 简化DOM预览版（首页用）
// ════════════════════════════════════════════════════════════════════════
class FamilyTreeDOM {
  constructor(containerId) { this.container = document.getElementById(containerId); this.members = []; }
  setData(persons) { this.members = persons || []; this.render(); }

  render() {
    if (!this.container) return;
    if (!this.members.length) { this.container.innerHTML = '<div class="empty-tip">暂无家族数据</div>'; return; }
    const me  = this.members.find(m => m.relationType === 'self');
    const pat = this.members.filter(m => m.relationType?.includes('paternal') || m.relationType === 'father' || m.relationType === 'aunt_paternal');
    const mat = this.members.filter(m => m.relationType?.includes('maternal') || m.relationType === 'mother' || m.relationType === 'uncle_maternal' || m.relationType === 'aunt_maternal_by_marriage');
    let h = '<div style="display:flex;flex-direction:column;gap:24px;">';

    h += '<div><div style="font-size:14px;color:#64748b;font-weight:600;margin-bottom:12px;">祖辈</div><div style="display:flex;gap:40px;">';
    const patGP = pat.filter(m => m.relationType?.includes('grandfather') || m.relationType?.includes('grandmother'));
    if (patGP.length) { h += '<div style="flex:1;"><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">父系</div><div style="display:flex;gap:8px;">'; patGP.forEach(m => h += this.card(m)); h += '</div></div>'; }
    const matGP = mat.filter(m => m.relationType?.includes('grandfather') || m.relationType?.includes('grandmother'));
    if (matGP.length) { h += '<div style="flex:1;"><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">母系</div><div style="display:flex;gap:8px;">'; matGP.forEach(m => h += this.card(m)); h += '</div></div>'; }
    h += '</div></div>';

    h += '<div><div style="font-size:14px;color:#64748b;font-weight:600;margin-bottom:12px;">父辈</div><div style="display:flex;gap:40px;">';
    const patPar = pat.filter(m => m.generation === -1 && !m.relationType?.includes('grand'));
    if (patPar.length) { h += '<div style="flex:1;"><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">父亲一方</div><div style="display:flex;gap:8px;flex-wrap:wrap;">'; patPar.forEach(m => h += this.card(m)); h += '</div></div>'; }
    const matPar = mat.filter(m => m.generation === -1 && !m.relationType?.includes('grand'));
    if (matPar.length) { h += '<div style="flex:1;"><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">母亲一方</div><div style="display:flex;gap:8px;flex-wrap:wrap;">'; matPar.forEach(m => h += this.card(m)); h += '</div></div>'; }
    h += '</div></div>';

    h += '<div style="text-align:center;"><div style="font-size:14px;color:#64748b;font-weight:600;margin-bottom:12px;">我</div>';
    if (me) h += this.card(me, true);
    h += '</div></div>';
    this.container.innerHTML = h;
  }

  card(m, isSelf = false) {
    const c  = m.gender === 'male' ? '#4A90E2' : m.gender === 'female' ? '#E94B8A' : '#999';
    const bg = isSelf ? '#C84A3E' : c;
    return `<div style="background:${bg};color:white;padding:10px 16px;border-radius:8px;min-width:80px;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);${isSelf ? 'border:2px solid #fff;transform:scale(1.05);' : ''}"><div style="font-weight:600;font-size:15px;">${m.name || '未知'}</div><div style="font-size:12px;opacity:0.9;margin-top:2px;">${m.relation || ''}</div></div>`;
  }

  clear() { this.members = []; this.container.innerHTML = ''; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FamilyGraph, FamilyVisualization, FamilyTreeDOM };
}

// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.FamilyGraph = FamilyGraph;
  window.FamilyVisualization = FamilyVisualization;
  window.FamilyTreeDOM = FamilyTreeDOM;
}
