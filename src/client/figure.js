/* ===================== 그림 스펙(JSON) → SVG ===================== */

function compileExpr(src) {
  var s = String(src || '').replace(/\s+/g, '').replace(/²/g, '^2').replace(/³/g, '^3').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/^y=/, '');
  var i = 0;
  function expr() {
    var v = term();
    while (s[i] === '+' || s[i] === '-') {
      var op = s[i++], l = v, r = term();
      v = op === '+' ? (function (a, b) { return function (x) { return a(x) + b(x); }; })(l, r) : (function (a, b) { return function (x) { return a(x) - b(x); }; })(l, r);
    }
    return v;
  }
  function term() {
    var v = unary();
    for (;;) {
      var c = s[i];
      if (c === '*' || c === '/') {
        i++;
        var r = unary(), l = v;
        v = c === '*' ? (function (a, b) { return function (x) { return a(x) * b(x); }; })(l, r) : (function (a, b) { return function (x) { return a(x) / b(x); }; })(l, r);
      } else if (c && /[0-9x(.√sa]/.test(c)) {
        var r2 = power(), l2 = v;
        v = (function (a, b) { return function (x) { return a(x) * b(x); }; })(l2, r2);
      } else break;
    }
    return v;
  }
  function unary() {
    if (s[i] === '-') { i++; var u = unary(); return function (x) { return -u(x); }; }
    if (s[i] === '+') { i++; return unary(); }
    return power();
  }
  function power() {
    var b = atom();
    if (s[i] === '^') { i++; var e = unary(); return function (x) { return Math.pow(b(x), e(x)); }; }
    return b;
  }
  function atom() {
    var c = s[i];
    if (c === '(') { i++; var v = expr(); if (s[i] === ')') i++; return v; }
    if (c === 'x') { i++; return function (x) { return x; }; }
    if (c === '√' || s.substr(i, 4) === 'sqrt') { i += c === '√' ? 1 : 4; var a = atom(); return function (x) { return Math.sqrt(a(x)); }; }
    if (s.substr(i, 3) === 'abs') { i += 3; var b = atom(); return function (x) { return Math.abs(b(x)); }; }
    var m = s.slice(i).match(/^[0-9]*\.?[0-9]+/);
    if (m) { i += m[0].length; var k = parseFloat(m[0]); return function () { return k; }; }
    throw new Error('식을 해석할 수 없어요: ' + src);
  }
  var f = expr();
  if (i < s.length) throw new Error('식을 해석할 수 없어요: ' + src);
  return f;
}

function renderFigure(spec, opt) {
  if (!spec || !Array.isArray(spec.elements)) return null;
  try { return drawFigure_(spec, opt || {}); } catch (e) { return h('div', { class: 'muted small' }, '(그림을 그리지 못했어요)'); }
}

function drawFigure_(spec, opt) {
  var NS = 'http://www.w3.org/2000/svg';
  var W = opt.width || 340, H = opt.height || 280;
  var pts = {};
  function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function P(ref) {
    if (Array.isArray(ref)) return [num(ref[0], 0), num(ref[1], 0)];
    if (typeof ref === 'string' && pts[ref]) return pts[ref];
    return null;
  }
  var els = spec.elements.filter(function (e) { return e && e.type; });
  els.forEach(function (e) {
    if (e.type !== 'point') return;
    var xy;
    if (e.polar) {
      var c = P(e.polar.center) || [0, 0], a = num(e.polar.deg, 0) * Math.PI / 180, r = num(e.polar.r, 1);
      xy = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    } else xy = [num(e.x, 0), num(e.y, 0)];
    e._xy = xy;
    if (e.id) pts[e.id] = xy;
    else if (e.label && /^[A-Z]'?$/.test(e.label)) pts[e.label] = xy;
  });
  // 범위
  var v = spec.view || {};
  var xs = [], ys = [];
  els.forEach(function (e) {
    if (e._xy) { xs.push(e._xy[0]); ys.push(e._xy[1]); }
    if (e.type === 'circle') { var c = P(e.center) || [0, 0], r = num(e.r, 1); xs.push(c[0] - r, c[0] + r); ys.push(c[1] - r, c[1] + r); }
  });
  var pad = 1;
  var xmin = num(v.xmin, xs.length ? Math.min.apply(null, xs) - pad : -5), xmax = num(v.xmax, xs.length ? Math.max.apply(null, xs) + pad : 5);
  var ymin = num(v.ymin, ys.length ? Math.min.apply(null, ys) - pad : -5), ymax = num(v.ymax, ys.length ? Math.max.apply(null, ys) + pad : 5);
  if (xmax <= xmin) xmax = xmin + 1;
  if (ymax <= ymin) ymax = ymin + 1;
  var sx = W / (xmax - xmin), sy = H / (ymax - ymin);
  if (!spec.axes) { var sc = Math.min(sx, sy); sx = sy = sc; }
  var offX = (W - (xmax - xmin) * sx) / 2, offY = (H - (ymax - ymin) * sy) / 2;
  function X(x) { return offX + (x - xmin) * sx; }
  function Y(y) { return H - offY - (y - ymin) * sy; }
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'font-family': 'Pretendard, sans-serif' });
  var INK = '#222', HL = '#E8590C', BLUE = '#3B5BDB';
  function color(e, d) { return e.highlight ? HL : (e.color || d); }
  // 무게중심 (라벨 위치용)
  var cx = 0, cy = 0, cnt = 0;
  Object.keys(pts).forEach(function (k) { cx += pts[k][0]; cy += pts[k][1]; cnt++; });
  if (cnt) { cx /= cnt; cy /= cnt; }

  if (spec.grid) {
    for (var gx = Math.ceil(xmin); gx <= xmax; gx++) svg.appendChild(el('line', { x1: X(gx), y1: Y(ymin), x2: X(gx), y2: Y(ymax), stroke: '#EEF0F3' }));
    for (var gy = Math.ceil(ymin); gy <= ymax; gy++) svg.appendChild(el('line', { x1: X(xmin), y1: Y(gy), x2: X(xmax), y2: Y(gy), stroke: '#EEF0F3' }));
  }
  if (spec.axes) {
    svg.appendChild(el('line', { x1: X(xmin), y1: Y(0), x2: X(xmax), y2: Y(0), stroke: '#888', 'stroke-width': 1.2 }));
    svg.appendChild(el('line', { x1: X(0), y1: Y(ymin), x2: X(0), y2: Y(ymax), stroke: '#888', 'stroke-width': 1.2 }));
    svg.appendChild(el('text', { x: X(xmax) - 10, y: Y(0) - 6, 'font-size': 13, fill: '#555' }, 'x'));
    svg.appendChild(el('text', { x: X(0) + 6, y: Y(ymax) + 14, 'font-size': 13, fill: '#555' }, 'y'));
    svg.appendChild(el('text', { x: X(0) - 13, y: Y(0) + 15, 'font-size': 12, fill: '#555' }, 'O'));
    if (xmax - xmin <= 24) for (var tx = Math.ceil(xmin); tx <= xmax; tx++) if (tx !== 0) {
      svg.appendChild(el('line', { x1: X(tx), y1: Y(0) - 3, x2: X(tx), y2: Y(0) + 3, stroke: '#888' }));
      svg.appendChild(el('text', { x: X(tx) - 4, y: Y(0) + 15, 'font-size': 10, fill: '#777' }, String(tx)));
    }
    if (ymax - ymin <= 24) for (var ty = Math.ceil(ymin); ty <= ymax; ty++) if (ty !== 0) {
      svg.appendChild(el('line', { x1: X(0) - 3, y1: Y(ty), x2: X(0) + 3, y2: Y(ty), stroke: '#888' }));
      svg.appendChild(el('text', { x: X(0) - 18, y: Y(ty) + 4, 'font-size': 10, fill: '#777' }, String(ty)));
    }
  }
  var order = ['polygon', 'circle', 'function', 'line', 'segment', 'angle', 'point', 'text'];
  order.forEach(function (type) {
    els.filter(function (e) { return e.type === type; }).forEach(function (e) {
      if (type === 'polygon') {
        var ps = (e.points || []).map(P).filter(Boolean);
        if (ps.length >= 3) svg.appendChild(el('polygon', { points: ps.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' '), fill: e.highlight ? 'rgba(232,89,12,.08)' : 'rgba(59,91,219,.05)', stroke: color(e, INK), 'stroke-width': 1.6 }));
      } else if (type === 'circle') {
        var c = P(e.center) || [0, 0];
        svg.appendChild(el('circle', { cx: X(c[0]), cy: Y(c[1]), r: num(e.r, 1) * sx, fill: 'none', stroke: color(e, INK), 'stroke-width': 1.6 }));
      } else if (type === 'function') {
        var f;
        if (e.expr) f = compileExpr(e.expr);
        else if (e.kind === 'quadratic') f = (function (a, b, c2) { return function (x) { return a * x * x + b * x + c2; }; })(num(e.a, 1), num(e.b, 0), num(e.c, 0));
        else if (e.kind === 'linear') f = (function (a, b) { return function (x) { return a * x + b; }; })(num(e.a, 1), num(e.b, 0));
        if (!f) return;
        var d = '', pen = false;
        for (var k = 0; k <= 240; k++) {
          var x = xmin + (xmax - xmin) * k / 240, y = f(x);
          if (!isFinite(y) || y < ymin - (ymax - ymin) || y > ymax + (ymax - ymin)) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1) + ' ';
          pen = true;
        }
        svg.appendChild(el('path', { d: d, fill: 'none', stroke: color(e, BLUE), 'stroke-width': 2.2 }));
        if (e.label) svg.appendChild(el('text', { x: W - 8, y: 16, 'text-anchor': 'end', 'font-size': 13, fill: color(e, BLUE) }, e.label));
      } else if (type === 'line') {
        var t = (e.through || []).map(P).filter(Boolean);
        if (t.length < 2) return;
        var dx = t[1][0] - t[0][0], dy = t[1][1] - t[0][1], L = 1000;
        svg.appendChild(el('line', { x1: X(t[0][0] - dx * L), y1: Y(t[0][1] - dy * L), x2: X(t[0][0] + dx * L), y2: Y(t[0][1] + dy * L), stroke: color(e, INK), 'stroke-width': 1.4, 'stroke-dasharray': e.dashed ? '5 4' : '' }));
      } else if (type === 'segment') {
        var a2 = P(e.from), b2 = P(e.to);
        if (!a2 || !b2) return;
        svg.appendChild(el('line', { x1: X(a2[0]), y1: Y(a2[1]), x2: X(b2[0]), y2: Y(b2[1]), stroke: color(e, INK), 'stroke-width': e.highlight ? 2.4 : 1.6, 'stroke-dasharray': e.dashed ? '5 4' : '' }));
        if (e.label) {
          var mx = (X(a2[0]) + X(b2[0])) / 2, my = (Y(a2[1]) + Y(b2[1])) / 2;
          var nx = -(Y(b2[1]) - Y(a2[1])), ny = X(b2[0]) - X(a2[0]), nl = Math.sqrt(nx * nx + ny * ny) || 1;
          nx /= nl; ny /= nl;
          if ((mx + nx * 10 - X(cx)) * nx + (my + ny * 10 - Y(cy)) * ny < 0) { nx = -nx; ny = -ny; }
          svg.appendChild(el('text', { x: mx + nx * 13, y: my + ny * 13 + 4, 'text-anchor': 'middle', 'font-size': 14, fill: color(e, INK), 'font-weight': 600 }, e.label));
        }
      } else if (type === 'angle') {
        var V = P(e.vertex), A = P(e.from), B = P(e.to);
        if (!V || !A || !B) return;
        var vx = X(V[0]), vy = Y(V[1]);
        var a1 = Math.atan2(Y(A[1]) - vy, X(A[0]) - vx), a3 = Math.atan2(Y(B[1]) - vy, X(B[0]) - vx);
        var diff = a3 - a1;
        while (diff <= -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        var R = 20, col = color(e, '#C92A2A');
        if (e.right) {
          var u1 = [Math.cos(a1), Math.sin(a1)], u2 = [Math.cos(a1 + diff), Math.sin(a1 + diff)], q = 12;
          svg.appendChild(el('path', { d: 'M' + (vx + u1[0] * q) + ' ' + (vy + u1[1] * q) + ' L' + (vx + (u1[0] + u2[0]) * q) + ' ' + (vy + (u1[1] + u2[1]) * q) + ' L' + (vx + u2[0] * q) + ' ' + (vy + u2[1] * q), fill: 'none', stroke: col, 'stroke-width': 1.4 }));
        } else {
          var sxp = vx + R * Math.cos(a1), syp = vy + R * Math.sin(a1), exp = vx + R * Math.cos(a1 + diff), eyp = vy + R * Math.sin(a1 + diff);
          svg.appendChild(el('path', { d: 'M' + sxp + ' ' + syp + ' A' + R + ' ' + R + ' 0 0 ' + (diff > 0 ? 1 : 0) + ' ' + exp + ' ' + eyp, fill: 'none', stroke: col, 'stroke-width': 1.6 }));
        }
        if (e.label) {
          var mid = a1 + diff / 2;
          svg.appendChild(el('text', { x: vx + 36 * Math.cos(mid), y: vy + 36 * Math.sin(mid) + 5, 'text-anchor': 'middle', 'font-size': 13, fill: col, 'font-weight': 700 }, e.label));
        }
      } else if (type === 'point') {
        var p = e._xy;
        var px = X(p[0]), py = Y(p[1]);
        svg.appendChild(el('circle', { cx: px, cy: py, r: 3.4, fill: color(e, INK) }));
        if (e.label) {
          var lx = px - X(cx), ly = py - Y(cy), ll = Math.sqrt(lx * lx + ly * ly);
          if (ll < 1) { lx = 0.7; ly = -0.7; ll = 1; }
          svg.appendChild(el('text', { x: px + lx / ll * 14, y: py + ly / ll * 14 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: color(e, INK) }, e.label));
        }
      } else if (type === 'text') {
        var at = P(e.at);
        if (at) svg.appendChild(el('text', { x: X(at[0]), y: Y(at[1]), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: color(e, INK) }, e.text || ''));
      }
    });
  });
  return svg;
}
