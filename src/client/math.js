/* ===================== 수식 표시 ===================== */
/* 1) 학생 풀이(평문 표기: x^2, √(3), (a)/(b), ±, ×...) → LaTeX → KaTeX
   2) 문제·튜터 문장 속 $...$ LaTeX → KaTeX */

var SYMBOL_LATEX = { '×': '\\times ', '÷': '\\div ', '±': '\\pm ', '∓': '\\mp ', '≠': '\\neq ', '≤': '\\le ', '≥': '\\ge ', 'π': '\\pi ',
  '∠': '\\angle ', '△': '\\triangle ', '⊥': '\\perp ', '∥': '\\parallel ', '≡': '\\equiv ', '∽': '\\backsim ', '→': '\\rightarrow ',
  '∴': '\\therefore ', '∵': '\\because ', '·': '\\cdot ', '*': '\\times ', '{': '\\{', '}': '\\}', '%': '\\%', '#': '\\#', '&': '\\&',
  '_': '\\_', '~': '\\sim ', '\\': '\\backslash ', '$': '\\$', '−': '-', '–': '-', '，': ',' };

/**
 * 학생이 곱하기를 알파벳 x로 적은 경우만 ×로 바꾼다.
 * - 숫자 x 숫자: 2x3, 2 x 3
 * - 띄어 쓴 홀로 x가 두 식 사이에 있을 때: (a+1) x (a-1), 3 x √2
 * 2x+3, 3x², x(x+1) 같은 변수 x는 그대로 둔다.
 */
function normalizeTimes(src) {
  return String(src || '')
    .replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1×')
    .replace(/([\d)\]²³])\s+[xX]\s+(?=[\d(\[√])/g, '$1 × ');
}

/* AI 전사나 학생이 쓴 LaTeX 명령 중 자주 나오는 것은 그대로 수식으로 살린다(예: \overline{AB}, \angle). */
var LATEX_ONE_ARG = { overline: 1, sqrt: 1, bar: 1, vec: 1, widehat: 1, overarc: 'overgroup', text: 1, mathrm: 1, boxed: 1 };
var LATEX_SYMBOLS = { angle: 1, triangle: 1, times: 1, div: 1, pm: 1, mp: 1, le: 1, ge: 1, leq: 1, geq: 1, ne: 1, neq: 1, pi: 1,
  circ: 1, perp: 1, parallel: 1, therefore: 1, because: 1, cdot: 1, sim: 1, equiv: 1, rightarrow: 1, theta: 1, alpha: 1, beta: 1,
  sin: 1, cos: 1, tan: 1, degree: 'circ', triangleq: 1, backsim: 1 };

function plainToLatex(src) {
  var s = normalizeTimes(src);
  var i = 0, n = s.length;
  function join(us) { return us.map(function (u) { return u.tex; }).join(''); }
  function argOf(a) { return a ? (a.kind === 'group' ? a.inner : a.tex) : ''; }
  function skipSp() { while (s[i] === ' ') i++; }
  /** {…} 안을 읽는다. 중괄호가 없으면 바로 다음 한 덩어리를 인자로 쓴다. */
  function braceArg() {
    skipSp();
    if (s[i] === '{') {
      i++;
      var inner = parseSeq('}');
      if (s[i] === '}') i++;
      return join(inner);
    }
    return argOf(parseAtom());
  }
  function parseAtom() {
    var ch = s[i];
    if (ch === undefined) return null;
    if (ch === '\\') {
      var cm = s.slice(i).match(/^\\([a-zA-Z]+)/);
      if (cm) {
        var name = cm[1];
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          i += cm[0].length;
          var fa = braceArg(), fb = braceArg();
          return { tex: '\\frac{' + fa + '}{' + fb + '}', op: true, kind: 'frac' };
        }
        if (LATEX_ONE_ARG[name]) {
          i += cm[0].length;
          var cmd = LATEX_ONE_ARG[name] === 1 ? name : LATEX_ONE_ARG[name];
          return { tex: '\\' + cmd + '{' + braceArg() + '}', op: true, kind: 'cmd' };
        }
        if (LATEX_SYMBOLS[name]) {
          i += cm[0].length;
          var sym = LATEX_SYMBOLS[name] === 1 ? name : LATEX_SYMBOLS[name];
          return { tex: '\\' + sym + ' ', op: sym === 'pi' || sym === 'theta' || sym === 'alpha' || sym === 'beta', kind: 'sym' };
        }
        if (name === 'left' || name === 'right') { i += cm[0].length; return { tex: '', op: false, kind: 'skip' }; }
      }
    }
    if (/[0-9.]/.test(ch)) {
      var m = s.slice(i).match(/^[0-9]+(\.[0-9]+)?|^\.[0-9]+/);
      var t = m ? m[0] : ch;
      i += t.length;
      return { tex: t, op: true, kind: 'num' };
    }
    if (ch === '(' || ch === '[') {
      var close = ch === '(' ? ')' : ']';
      i++;
      var inner = parseSeq(close);
      var closed = s[i] === close;
      if (closed) i++;
      var it = join(inner);
      return { tex: '\\left' + ch + it + '\\right' + (closed ? close : '.'), op: true, kind: 'group', inner: it };
    }
    if (ch === '√') {
      i++; skipSp();
      return { tex: '\\sqrt{' + argOf(parseAtom()) + '}', op: true, kind: 'sqrt' };
    }
    if (/[a-zA-Z]/.test(ch)) {
      var fm = s.slice(i).match(/^(sin|cos|tan)/);
      if (fm) { i += 3; return { tex: '\\' + fm[0] + ' ', op: false, kind: 'fn' }; }
      i++;
      return { tex: ch, op: true, kind: 'letter' };
    }
    return null;
  }
  function attachSup(units, arg) {
    var last = units[units.length - 1];
    if (last && last.op) { last.tex = '{' + last.tex + '}^{' + arg + '}'; last.kind = 'sup'; }
    else units.push({ tex: '{}^{' + arg + '}', op: true, kind: 'sup' });
  }
  function atomWithSup() {
    var a = parseAtom();
    if (!a) return null;
    while (s[i] === '²' || s[i] === '³' || s[i] === '^') {
      if (s[i] === '^') { i++; a = { tex: '{' + a.tex + '}^{' + argOf(parseAtom()) + '}', op: true, kind: 'sup' }; }
      else { a = { tex: '{' + a.tex + '}^{' + (s[i] === '²' ? '2' : '3') + '}', op: true, kind: 'sup' }; i++; }
    }
    return a;
  }
  function unitInto(units) {
    var ch = s[i];
    if (ch === ' ') { i++; return; }
    if (ch === '²' || ch === '³') { attachSup(units, ch === '²' ? '2' : '3'); i++; return; }
    if (ch === '°') { attachSup(units, '\\circ'); i++; return; }
    if (ch === '^') { i++; attachSup(units, argOf(parseAtom())); return; }
    if (ch === '/') {
      i++;
      var num = (units.length && units[units.length - 1].op) ? units.pop() : { tex: '', kind: '' };
      skipSp();
      var den = atomWithSup();
      units.push({ tex: '\\frac{' + argOf(num) + '}{' + argOf(den) + '}', op: true, kind: 'frac' });
      return;
    }
    var a = parseAtom();
    if (a) { units.push(a); return; }
    if (SYMBOL_LATEX[ch] !== undefined) { units.push({ tex: SYMBOL_LATEX[ch], op: false }); i++; return; }
    units.push({ tex: ch, op: false });
    i++;
  }
  function parseSeq(stop) {
    var units = [];
    while (i < n) {
      var ch = s[i];
      if (stop && ch === stop) break;
      if (ch === ')' || ch === ']') {
        if (stop) break;
        units.push({ tex: ch, op: false });
        i++;
        continue;
      }
      unitInto(units);
    }
    return units;
  }
  return join(parseSeq(null));
}

function safeKatex(tex, display, fallback) {
  if (!window.katex) return esc(fallback === undefined ? tex : fallback);
  try {
    return katex.renderToString(tex, { throwOnError: false, strict: 'ignore', displayMode: !!display, output: 'html' });
  } catch (e) { return esc(fallback === undefined ? tex : fallback); }
}

/** 학생 풀이 한 줄 → HTML (한글은 글자로, 나머지는 수식으로) */
function plainLineHtml(line) {
  var parts = String(line || '').split(/([가-힣ㄱ-ㅎㅏ-ㅣ][가-힣ㄱ-ㅎㅏ-ㅣ\s,.!?~:'"]*)/);
  return parts.map(function (p) {
    if (!p) return '';
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(p)) return '<span>' + esc(p) + '</span>';
    if (!p.trim()) return esc(p);
    if (/^\[그림/.test(p)) return esc(p);
    // 수식 앞뒤 띄어쓰기는 수식으로 바꾸면 사라지므로 따로 살린다(예: 'x=3 또는 x=-4').
    return (/^\s/.test(p) ? ' ' : '') + safeKatex(plainToLatex(p.trim()), false, p) + (/\s$/.test(p) ? ' ' : '');
  }).join('');
}

function textHtml(t) {
  return esc(String(t).replace(/\\n/g, '\n')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

/** 문장 속 $...$, $$...$$, \( \), \[ \] 를 KaTeX로 */
function richHtml(text) {
  var s = String(text === null || text === undefined ? '' : text);
  var re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  var out = '', last = 0, m;
  while ((m = re.exec(s))) {
    out += textHtml(s.slice(last, m.index));
    var tex = m[1] || m[2] || m[3] || m[4];
    out += safeKatex(tex, !!(m[1] || m[4]), m[0]);
    last = re.lastIndex;
  }
  return out + textHtml(s.slice(last));
}
