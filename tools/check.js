/* Статическая проверка index.html: id-шники и баланс тегов (node _check.js) */
var fs = require('fs');
var path = require('path');
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var code = (html.match(/<script>([\s\S]*?)<\/script>/) || [,''])[1];
var fails = [];

/* 1. Все id, к которым обращается JS, должны быть в разметке */
var htmlIds = {};
(html.match(/\sid="([^"]+)"/g) || []).forEach(function(s){ htmlIds[s.slice(5,-1)] = true; });
var used = {};
(html.match(/\$\('([^']+)'\)/g) || []).forEach(function(s){ used[s.slice(3,-2)] = true; });
(html.match(/getElementById\('([^']+)'\)/g) || []).forEach(function(s){ used[s.slice(16,-2)] = true; });

Object.keys(used).sort().forEach(function(id){
  var dynamic = /^(q4_|why4_|u9_|why9_)\d+$/.test(id);
  if(!htmlIds[id] && !dynamic) fails.push('JS ищет несуществующий id: ' + id);
});

/* 2. Баланс тегов */
[['div','<div','</div>'],['section','<section','</section>'],['ul','<ul','</ul>'],
 ['li','<li','</li>'],['button','<button','</button>'],['span','<span','</span>'],
 ['style','<style','</style>'],['script','<script','</script>']].forEach(function(t){
  var name = t[0];
  var open = (html.match(new RegExp(t[1] + '[ >]', 'g')) || []).length;
  var close = (html.split(t[2]).length - 1);
  if(open !== close) fails.push('несбалансированные <' + name + '>: открыто ' + open + ', закрыто ' + close);
});
var popen = (html.match(/<p[ >]/g) || []).length, pclose = (html.split('</p>').length - 1);
if(popen !== pclose) fails.push('несбалансированные <p>: открыто ' + popen + ', закрыто ' + pclose);

/* 3. Служебных маркеров быть не должно */
['<!--P', '/*J', '/**PART', '/*PART'].forEach(function(mk){
  if(html.indexOf(mk) >= 0) fails.push('остался служебный маркер: ' + mk);
});

/* 4. Ответы не должны лежать в разметке открытым текстом (внутри <script> они допустимы) */
var markup = html.split('<script>')[0];
if(markup.indexOf('ХОРОШО ТЫ СПРАВИЛСЯ') >= 0) fails.push('открытый текст шифра найден в разметке!');
if(/ДОСТУП\s+РАЗРЕШЕН/i.test(markup)) fails.push('открытый текст миссии 10 найден в разметке!');
if(markup.indexOf('203.0.113.45') >= 0) fails.push('IP атаки найден в разметке (должен приходить из JS)!');

/* 5. Таймер, очки и кнопки на месте */
['timer','score','scoretotal','progbar','resetbtn','startbtn','mnav','fragbar','fragbar2','toast',
 'cert','certname','certscore','certcode','certdate','printbtn','stname','termout',
 'terminput','qwrap','phlog','pwhintbox','m2hintbox','m3hintbox','m4hintbox','m5hintbox',
 'keygrid','m6result','m7table','m7err','logwrap','m8result','m8err',
 'urlwrap','subwrap','m10cipher','m10answer','m10check','m10err',
 'm6hintbox','m7hintbox','m8hintbox','m9hintbox','m10hintbox']
 .forEach(function(id){ if(!htmlIds[id]) fails.push('нет обязательного элемента #' + id); });

console.log('id проверено: ' + Object.keys(used).length + ', всего id в разметке: ' + Object.keys(htmlIds).length);
if(fails.length){ console.log(fails.map(function(f){ return 'FAIL :: ' + f; }).join('\n')); process.exit(1); }
console.log('PASS :: структура index.html в порядке (id, теги, маркеры, отсутствие спойлеров)');
