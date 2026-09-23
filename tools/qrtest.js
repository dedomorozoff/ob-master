/* Автотест QR-генератора qrcode.html (запуск: node tools/qrtest.js)
   Независимо декодирует матрицы: checks BCH format/version, синдромы
   Рида-Соломона, геометрию и содержимое полезной нагрузки. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, '..', 'qrcode.html'), 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){ console.error('FAIL :: <script> не найден в qrcode.html'); process.exit(1); }

var ctx = { fillStyle: '', fillRect: function() {} };
var canvas = { width: 0, height: 0, getContext: function() { return ctx; } };
var sandbox = {
  document: { getElementById: function() { return canvas; } },
  encodeURIComponent: encodeURIComponent,
  unescape: unescape,
  decodeURIComponent: decodeURIComponent
};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);
var QR = sandbox.QR;

var results = [];
function ok(name, cond, extra){
  results.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name + (extra !== undefined ? '  -> ' + extra : ''));
}

/* --- независимое GF(256) --- */
var EXP = [], LOG = [];
(function(){
  var x = 1;
  for(var i = 0; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if(x & 0x100) x ^= 0x11D; }
  for(var i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
function gmul(a, b){ if(!a || !b) return 0; return EXP[LOG[a] + LOG[b]]; }

/* --- эталонные таблицы (независимо от QR.VER) --- */
var VER = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44]
};
var TOTALS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
var DATA_TOTALS = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
var REMAIN = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

function alignCenters(size, ver){
  if(ver === 1) return [];
  var step = Math.floor(((size - 7) - 6) / (ver <= 6 ? 1 : 2));
  var out = [6];
  if(ver > 6) out.push(6 + step);
  out.push(size - 7);
  return out;
}

function buildFn(size, ver){
  var fn = [];
  for(var i = 0; i < size; i++){ fn.push([]); for(var j = 0; j < size; j++) fn[i].push(0); }
  function mark(r0, c0, h, w){
    for(var r = r0; r < r0 + h; r++) for(var c = c0; c < c0 + w; c++) fn[r][c] = 1;
  }
  mark(0, 0, 9, 9);
  mark(0, size - 8, 9, 8);
  mark(size - 8, 0, 8, 9);
  for(var i = 0; i < size; i++){ fn[6][i] = 1; fn[i][6] = 1; }
  var ac = alignCenters(size, ver);
  for(var i = 0; i < ac.length; i++){
    for(var j = 0; j < ac.length; j++){
      var ar = ac[i], ra = ac[j], last = ac[ac.length - 1];
      if((ar === 6 && ra === 6) || (ar === 6 && ra === last) || (ar === last && ra === 6)) continue;
      mark(ar - 2, ra - 2, 5, 5);
    }
  }
  if(ver >= 7){ mark(0, size - 11, 6, 3); mark(size - 11, 0, 3, 6); }
  return fn;
}

function bchCheck(raw, gen){
  var deg = 0;
  while((gen >> (deg + 1)) !== 0) deg++;
  var hi = 0;
  for(var b = 31; b >= 0; b--) if((raw >>> b) & 1){ hi = b; break; }
  for(var i = hi; i >= deg; i--) if((raw >> i) & 1) raw ^= gen << (i - deg);
  return raw === 0;
}

function maskCond(mk, r, c){
  switch(mk){
    case 0: return (c + r) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (c + r) % 3 === 0;
    case 4: return (Math.floor(c / 3) + Math.floor(r / 2)) % 2 === 0;
    case 5: return (c * r) % 2 + (c * r) % 3 === 0;
    case 6: return ((c * r) % 2 + (c * r) % 3) % 2 === 0;
    case 7: return ((c + r) % 2 + (c * r) % 3) % 2 === 0;
  }
  return false;
}

function readFormat(m){
  var size = m.length, f1 = 0, f2 = 0, i;
  for(i = 0; i <= 5; i++) f1 |= m[i][8] << i;
  f1 |= m[7][8] << 6;
  f1 |= m[8][8] << 7;
  f1 |= m[8][7] << 8;
  for(i = 9; i < 15; i++) f1 |= m[8][14 - i] << i;
  for(i = 0; i < 8; i++) f2 |= m[8][size - 1 - i] << i;
  for(i = 8; i < 15; i++) f2 |= m[size - 15 + i][8] << i;
  return [f1, f2];
}

function readVersion(m){
  var size = m.length, vb = 0;
  for(var i = 0; i < 18; i++){
    var a = size - 11 + (i % 3), b = Math.floor(i / 3);
    vb |= m[b][a] << i;
  }
  return vb;
}

function checkFinder(m, r0, c0){
  for(var dr = 0; dr < 7; dr++){
    for(var dc = 0; dc < 7; dc++){
      var on = (dr === 0 || dr === 6 || dc === 0 || dc === 6) ||
               (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
      if(m[r0 + dr][c0 + dc] !== (on ? 1 : 0)) return false;
    }
  }
  var size = m.length;
  if(r0 + 7 < size) for(var i = 0; i < 8; i++) if(c0 + i < size && m[r0 + 7][c0 + i] !== 0) return false;
  if(c0 + 7 < size) for(var i = 0; i < 8; i++) if(r0 + i < size && m[r0 + i][c0 + 7] !== 0) return false;
  return true;
}

function decode(m){
  var size = m.length;
  var ver = (size - 17) / 4;
  var fn = buildFn(size, ver);
  var fmt = readFormat(m);
  var raw = fmt[0] ^ 0x5412;
  var data5 = raw >>> 10;
  var ecl = data5 >>> 3;
  var mask = data5 & 7;
  var bits = [];
  var idx = 0;
  for(var right = size - 1; right >= 1; right -= 2){
    if(right === 6) right = 5;
    for(var vert = 0; vert < size; vert++){
      for(var j = 0; j < 2; j++){
        var c = right - j;
        var upward = ((right + 1) & 2) === 0;
        var r = upward ? size - 1 - vert : vert;
        if(!fn[r][c]) bits[idx++] = m[r][c] ^ maskCond(mask, r, c);
      }
    }
  }
  var cws = [];
  for(var i = 0; i + 8 <= bits.length; i += 8){
    var b = 0;
    for(var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cws.push(b);
  }
  var remOk = true;
  for(var i = cws.length * 8; i < bits.length; i++) if(bits[i] !== 0) remOk = false;
  var t = VER[ver];
  var kbs = [];
  var nblk = t[1] + t[3];
  for(var i = 0; i < t[1]; i++) kbs.push(t[2]);
  for(var i = 0; i < t[3]; i++) kbs.push(t[4]);
  var ec = t[0];
  var maxK = Math.max(t[2], t[4]);
  var blkD = [];
  for(var i = 0; i < nblk; i++) blkD.push([]);
  var pos = 0;
  for(var i = 0; i < maxK; i++){
    for(var b = 0; b < nblk; b++) if(i < kbs[b]) blkD[b].push(cws[pos++]);
  }
  var blkE = [];
  for(var i = 0; i < nblk; i++) blkE.push([]);
  for(var i = 0; i < ec; i++){
    for(var b = 0; b < nblk; b++) blkE[b].push(cws[pos++]);
  }
  var synOk = true;
  for(var b = 0; b < nblk && synOk; b++){
    var poly = blkD[b].concat(blkE[b]);
    var n = poly.length;
    for(var s = 0; s < ec; s++){
      var acc = 0;
      for(var k = 0; k < n; k++){
        acc ^= gmul(poly[k], EXP[((s * (n - 1 - k)) % 255) + 255]);
      }
      if(acc !== 0){ synOk = false; break; }
    }
  }
  var dataBytes = [];
  for(var b = 0; b < nblk; b++) dataBytes = dataBytes.concat(blkD[b]);
  function readBits(off, len){
    var v = 0;
    for(var i = 0; i < len; i++) v = (v << 1) | ((dataBytes[(off + i) >> 3] >>> (7 - ((off + i) & 7))) & 1);
    return v;
  }
  var mode = readBits(0, 4);
  var cnt = readBits(4, ver < 10 ? 8 : 16);
  var payload = [];
  for(var k = 0; k < cnt; k++) payload.push(readBits(4 + (ver < 10 ? 8 : 16) + k * 8, 8));
  return {
    ver: ver, fmtCopyEqual: fmt[0] === fmt[1], raw: raw, ecl: ecl, mask: mask,
    bchOk: bchCheck(raw, 0x537), remOk: remOk, synOk: synOk, mode: mode, cnt: cnt,
    payload: payload, cwsLen: cws.length, pos: pos, versionBits: readVersion(m), size: size
  };
}

function utf8Decode(bytes){
  return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
}
function byteLen(s){ return Buffer.byteLength(s, 'utf8'); }

/* --- 1. Известные векторы format/version --- */
ok('formatInfo M, mask0 = 0x5412', QR.formatInfo(0, 0) === 0x5412, QR.formatInfo(0, 0).toString(16));
ok('formatInfo L, mask0 = 0x77C4', QR.formatInfo(1, 0) === 0x77C4, QR.formatInfo(1, 0).toString(16));
ok('versionInfo 7 = 0x07C94', QR.versionInfo(7) === 0x07C94, QR.versionInfo(7).toString(16));

/* --- 2. Порождающий полином RS: корни α^0..α^{n-1} --- */
(function(){
  var lens = [10, 16, 18, 22, 24, 26];
  var all = true;
  lens.forEach(function(n, li){
    var g = QR.rsGenerator(n);
    if(!g || g.length !== n + 1 || g[0] !== 1) { all = false; return; }
    for(var j = 0; j < n; j++){
      if(g[0] !== 1) { all = false; break; }
      var acc = 0;
      for(var i = 0; i < g.length; i++) acc = gmul(acc, EXP[j + 255]) ^ g[i];
      if(acc !== 0) all = false;
    }
    if(!all && li === 0) return;
  });
  ok('gen-полиномы RS имеют корни α^0..α^{n-1} (n=10,16,18,22,24,26)', all);
})();

/* --- 3. Таблицы версий согласованы с каноническими итогами --- */
(function(){
  var okTab = true;
  for(var v = 1; v <= 10; v++){
    var t = VER[v];
    var dataTotal = t[1] * t[2] + t[3] * t[4];
    var total = dataTotal + t[0] * (t[1] + t[3]);
    if(dataTotal !== DATA_TOTALS[v - 1] || total !== TOTALS[v - 1]) okTab = false;
  }
  ok('таблицы версий совпадают с каноническими (10 версий)', okTab);
})();

/* --- 4. Ёмкость области данных = codewords*8 + remainder для всех версий --- */
(function(){
  var okGeo = true;
  for(var v = 1; v <= 10; v++){
    var size = v * 4 + 17;
    var fn = buildFn(size, v);
    var dataModules = 0;
    for(var r = 0; r < size; r++) for(var c = 0; c < size; c++) if(!fn[r][c]) dataModules++;
    if(dataModules !== TOTALS[v - 1] * 8 + REMAIN[v - 1]) okGeo = false;
  }
  ok('геометрия: data-модули = total*8 + остаточные биты (1..10)', okGeo);
})();

/* --- 5. Раунд-трип: кодирование -> независимое декодирование --- */
function testText(text, label){
  var nbytes = byteLen(text);
  var expVer = 0;
  for(var v = 1; v <= 10; v++){
    var t = VER[v];
    var hdr = 4 + (v < 10 ? 8 : 16);
    if(hdr + nbytes * 8 <= (t[1] * t[2] + t[3] * t[4]) * 8){ expVer = v; break; }
  }
  var q = QR.encode(text);
  ok(label + ': выбрана версия ' + expVer, q.version === expVer, q.version + ' (норма ' + expVer + ', ' + nbytes + ' байт)');
  ok(label + ': размер матрицы', q.size === q.version * 4 + 17, q.size + 'x' + q.size);
  ok(label + ': маска в диапазоне 0..7', q.mask >= 0 && q.mask <= 7, 'mask=' + q.mask);
  ok(label + ': finder-паттерны трёх углов',
     checkFinder(q.matrix, 0, 0) &&
     checkFinder(q.matrix, 0, q.size - 7) &&
     checkFinder(q.matrix, q.size - 7, 0));
  var size = q.size;
  var tOk = true;
  for(var i = 8; i <= size - 9; i++){
    if(q.matrix[6][i] !== (i % 2 ? 0 : 1)) tOk = false;
    if(q.matrix[i][6] !== (i % 2 ? 0 : 1)) tOk = false;
  }
  ok(label + ': timing-паттерны', tOk);
  ok(label + ': тёмный модуль (size-8, 8)', q.matrix[size - 8][8] === 1);
  var dec = decode(q.matrix);
  ok(label + ': формат BCH корректен + ECC level M', dec.bchOk && dec.ecl === 0, 'ecl=' + dec.ecl);
  ok(label + ': маска из формата = маска кодера', dec.mask === q.mask, dec.mask + '/' + q.mask);
  ok(label + ': обе копии format-битов совпадают', dec.fmtCopyEqual);
  ok(label + ': version info проверяется BCH (v>=7)',
     q.version < 7 ||
     (bchCheck(dec.versionBits, 0x1F25) && (dec.versionBits >>> 12) === q.version),
     'v=' + q.version);
  ok(label + ': синдромы РС во всех блоках нулевые', dec.synOk);
  ok(label + ': остаточные модули после снятия маски нулевые', dec.remOk);
  ok(label + ': все кодовые слова прочитаны и распределены', dec.cwsLen === TOTALS[dec.ver - 1] && dec.pos === dec.cwsLen, 'cw=' + dec.cwsLen);
  ok(label + ': полезная нагрузка совпадает с исходным текстом',
     dec.mode === 4 && utf8Decode(dec.payload) === text, 'mode=' + dec.mode);
}

testText('A', 'один символ');
testText('https://example.com/', 'короткая ссылка');
testText('https://dedomorozoff.github.io/ob-master/', 'рабочая ссылка стенда');
testText(new Array(51).join('x'), 'блок 2 (v4, 2 блока РС)');
testText(new Array(108).join('y'), 'версия 7 (version info)');
testText(new Array(124).join('z'), 'версия 8 (группы 38+39)');
testText(new Array(214).join('w'), 'версия 10 (16-битный счётчик)');
testText('Привет, мир! QR-код тест №1', 'кириллица UTF-8');

console.log(results.join('\n'));
var failed = results.filter(function(r){ return r.indexOf('FAIL') === 0; }).length;
console.log('\nИТОГО: ' + (results.length - failed) + ' пройдено, ' + failed + ' провалено, всего ' + results.length);
process.exit(failed ? 1 : 0);