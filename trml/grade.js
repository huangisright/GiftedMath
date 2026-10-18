/* TRML 競速練習：答案比對（學生頁的範例模式與 Apps Script 共用同一份）
 *
 * 答案表的寫法（questions 工作表的 answer 欄）：
 *   1009                一般數字
 *   2017/2018           分數；學生寫 2017/2018 或 4034/4036 都算對（數值相等）
 *   3√2   2+√3   4π     根號、圓周率；學生可打 √ 或 sqrt，π 或 pi
 *   (1,2)               有序數對：依序逐項比對
 *   set:1,3,5           不計順序的多個答案
 *   甲|A                用 | 分隔多個可接受的寫法
 * 學生答案尾端的單位（度、°、公分、cm、個、種……）會先去掉再比。
 */
(function (root) {
  'use strict';

  function toHalfWidth(s) {
    s = String(s == null ? '' : s)
      .replace(/²/g, '^2').replace(/³/g, '^3');
    if (s.normalize) s = s.normalize('NFKC');
    return s;
  }

  function normalize(s) {
    s = toHalfWidth(s).trim().toLowerCase();
    s = s.replace(/[\s　]+/g, '')
      .replace(/[×＊·⋅]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[−–—‒－]/g, '-')
      .replace(/，|、/g, ',')
      .replace(/（/g, '(').replace(/）/g, ')')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/sqrt\{/g, 'sqrt(').replace(/\}/g, ')').replace(/\{/g, '(');
    // 去掉尾端單位
    s = s.replace(/(%|％|平方公分|立方公分|平方公尺|公分|公尺|公里|cm\^?[23]?|度|°|個|種|人|元|分鐘|分|秒|條|塊|次|天|歲|題|組|根|張|頁|位|顆|隻|輛|本|支|台)+$/, '');
    // 開頭的「x=」「答:」之類
    s = s.replace(/^(答[:：]?|ans[:：]?)/, '');
    s = s.replace(/^[a-z]=/, '');
    return s;
  }

  // ---- 數值解析：+ - * / ^、括號、sqrt、pi、隱含乘法（3sqrt2、2pi、2(3)）
  function evaluate(src, env) {
    var s = src, i = 0;
    env = env || {};
    function peek() { return s[i]; }
    function eat(c) { if (s[i] === c) { i++; return true; } return false; }
    function fail() { throw new Error('parse'); }

    function parseExpr() {
      var v = parseTerm();
      for (;;) {
        if (eat('+')) v += parseTerm();
        else if (eat('-')) v -= parseTerm();
        else return v;
      }
    }
    function startsAtom() {
      var c = peek();
      return c !== undefined && (/[0-9.(a-z]/.test(c));
    }
    function parseTerm() {
      var v = parseUnary();
      for (;;) {
        if (eat('*')) v *= parseUnary();
        else if (eat('/')) { var d = parseUnary(); v /= d; }
        else if (startsAtom()) v *= parsePower(); // 隱含乘法
        else return v;
      }
    }
    function parseUnary() {
      if (eat('-')) return -parseUnary();
      if (eat('+')) return parseUnary();
      return parsePower();
    }
    function parsePower() {
      var b = parseAtom();
      if (eat('^')) { var e = parseUnary(); return Math.pow(b, e); }
      return b;
    }
    function parseAtom() {
      var c = peek();
      if (c === '(') { i++; var v = parseExpr(); if (!eat(')')) fail(); return v; }
      if (s.substr(i, 4) === 'sqrt') {
        i += 4;
        var a;
        if (peek() === '(') { i++; a = parseExpr(); if (!eat(')')) fail(); }
        else a = parsePower();
        if (a < 0) fail();
        return Math.sqrt(a);
      }
      if (s.substr(i, 2) === 'pi') { i += 2; return Math.PI; }
      if (/[a-z]/.test(c)) { if (!(c in env)) fail(); i++; return env[c]; }
      var m = /^[0-9]*\.?[0-9]+(e[-+]?[0-9]+)?|^[0-9]+\./.exec(s.slice(i));
      if (!m) fail();
      i += m[0].length;
      return parseFloat(m[0]);
    }
    var v = parseExpr();
    if (i !== s.length || !isFinite(v)) fail();
    return v;
  }

  // 含字母（例如答案是 a/3）時，代兩組數值進去比較
  var ENVS = [{}, {}];
  'abcdefghijklmnoqrstuvwxyz'.split('').forEach(function (ch, k) {
    ENVS[0][ch] = 1.3 + 0.37 * k; ENVS[1][ch] = 2.9 - 0.071 * k;
  });
  function tryNum(s, env) {
    if (!s || !/[0-9a-z]/.test(s)) return null;
    try { return evaluate(s, env); } catch (e) { return null; }
  }
  function close(x, y) {
    return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  }
  function sameScalar(a, b) {
    if (a === b) return true;
    var vars = /[a-z]/.test(b.replace(/sqrt|pi/g, '')) || /[a-z]/.test(a.replace(/sqrt|pi/g, ''));
    var envs = vars ? ENVS : [{}];
    for (var k = 0; k < envs.length; k++) {
      var x = tryNum(a, envs[k]), y = tryNum(b, envs[k]);
      if (x === null || y === null || !close(x, y)) return false;
    }
    return true;
  }

  function splitParts(s) {
    s = s.replace(/^\((.*)\)$/, '$1');
    // 只在最外層逗號切開
    var parts = [], depth = 0, cur = '';
    for (var k = 0; k < s.length; k++) {
      var c = s[k];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur);
    return parts.filter(function (p) { return p !== ''; });
  }

  function matchOne(input, spec) {
    var unordered = false;
    spec = toHalfWidth(spec).trim();
    if (/^set:/i.test(spec)) { unordered = true; spec = spec.slice(4); }
    var a = normalize(input), b = normalize(spec);
    if (!a) return false;
    if (b.indexOf(',') === -1) return sameScalar(a, b);
    var pa = splitParts(a), pb = splitParts(b);
    if (pa.length !== pb.length) return false;
    if (!unordered) {
      for (var k = 0; k < pb.length; k++) if (!sameScalar(pa[k], pb[k])) return false;
      return true;
    }
    var used = pa.map(function () { return false; });
    for (var j = 0; j < pb.length; j++) {
      var hit = -1;
      for (var t = 0; t < pa.length; t++) if (!used[t] && sameScalar(pa[t], pb[j])) { hit = t; break; }
      if (hit < 0) return false;
      used[hit] = true;
    }
    return true;
  }

  function isCorrect(input, answerSpec) {
    var specs = String(answerSpec == null ? '' : answerSpec).split('|');
    for (var k = 0; k < specs.length; k++) if (specs[k].trim() && matchOne(input, specs[k])) return true;
    return false;
  }

  var api = { isCorrect: isCorrect, normalize: normalize, evaluate: evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TRMLGrade = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
