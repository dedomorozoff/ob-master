/* e2e-прогон стенда в headless-браузере (node tools/e2e.js)
   Собирает временные страницы из index.html + tools/inject_*.html и проверяет:
   1) полный проход стенда «как студент», 2) восстановление прогресса после F5.
   Браузер ищется автоматически (Chrome, затем Edge); если не найден — SKIP. */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var TMP  = path.join(process.env.TEMP || '.', 'kiberbarier_e2e');
if(fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

var BROWSER = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(function(p){ return p && fs.existsSync(p); })[0];

if(!BROWSER){
  console.log('SKIP :: headless-браузер не найден, e2e пропущен (задайте CHROME_PATH)');
  process.exit(0);
}

var page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function build(injectName, outName){
  var inj = fs.readFileSync(path.join(__dirname, injectName), 'utf8');
  var p = path.join(TMP, outName);
  fs.writeFileSync(p, page.replace('</body>', inj));
  return p;
}
function run(file){
  var url = 'file:///' + file.replace(/\\/g, '/');
  var out = cp.execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--user-data-dir=' + path.join(TMP, 'profile'), '--virtual-time-budget=4000',
    '--dump-dom', url], { maxBuffer: 64 * 1024 * 1024 }).toString();
  var m = out.match(/<pre id="TESTLOG">([\s\S]*?)<\/pre>/);
  if(!m) return null;
  return m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"').replace(/^<<</, '').replace(/>>>$/, '')
              .split(' ||| ');
}

var scenarios = [
  ['Прохождение стенда от брифинга до сертификата', build('inject_full.html', 'e2e_full.html')],
  ['Восстановление прогресса после F5',             build('inject_restore.html', 'e2e_restore.html')]
];

var exitCode = 0;
console.log('Браузер: ' + BROWSER);
scenarios.forEach(function(s){
  console.log('\n=== ' + s[0] + ' ===');
  var log = run(s[1]);
  if(!log){
    console.log('  FAIL :: страница не выполнила сценарий (журнал не найден)');
    exitCode = 1;
    return;
  }
  log.forEach(function(l){ console.log('  ' + l); });
  var bad = log.filter(function(l){ return l.indexOf('FAIL') === 0; }).length;
  console.log('  --- пройдено ' + (log.length - bad) + ' из ' + log.length + ', провалено ' + bad);
  if(bad) exitCode = 1;
});
process.exit(exitCode);
