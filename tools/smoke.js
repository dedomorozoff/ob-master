/* Автотест логики стенда «КИБЕРБАРЬЕР» (запуск: node _smoke.js) */
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){ console.error('FAIL :: <script> не найден в index.html'); process.exit(1); }

function mkEl(id){
  return { id:id, style:{}, className:'', textContent:'', innerHTML:'', value:'',
    appendChild:function(){}, scrollTop:0, scrollHeight:0, scrollIntoView:function(){},
    getElementsByClassName:function(){ return []; }, getElementsByTagName:function(){ return []; },
    getAttribute:function(){ return null; } };
}
var els = {};
var htmlIds = {};
(html.match(/\sid="([^"]+)"/g) || []).forEach(function(s){ htmlIds[s.slice(5,-1)] = true; });
var unknownIds = {};
var document = {
  getElementById: function(id){
    if(!els[id]){
      if(!htmlIds[id] && !/^(q4_|why4_|u9_|why9_)\d+$/.test(id)) unknownIds[id] = true;
      els[id] = mkEl(id);
    }
    return els[id];
  },
  createElement: function(){ return mkEl('new'); }
};
var store = {};
var localStorage = {
  getItem: function(k){ return store[k] || null; },
  setItem: function(k,v){ store[k] = v; },
  removeItem: function(k){ delete store[k]; }
};
var sandbox = { document:document, localStorage:localStorage, window:{ addEventListener:function(){} },
                Math:Math, JSON:JSON, String:String, Date:Date, Array:Array,
                parseInt:parseInt, parseFloat:parseFloat, setTimeout:function(){},
                clearTimeout:function(){}, setInterval:function(){ return 0; }, confirm:function(){ return false; } };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);

var results = [];
function ok(name, cond, extra){
  results.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name + (extra !== undefined ? '  -> ' + extra : ''));
}

/* --- 1. Шифр Цезаря --- */
var cipher = sandbox.m2rotate(sandbox.m2plain(), 5);
ok('шифртекст совпадает с зашитым в задание', cipher === 'ЪУХУЭУ ЧА ЦФХЕЖНРЦД', cipher);
ok('расшифровка при сдвиге -5 даёт открытый текст',
   sandbox.m2rotate(cipher, -5) === sandbox.m2plain(), sandbox.m2plain());
ok('нормализация не зависит от регистра и пробелов',
   sandbox.m2norm('  хорошо   ты справился ') === sandbox.m2norm(sandbox.m2plain()));

/* --- 2. Миссия 2 --- */
sandbox.$('m2answer').value = '  хорошо ты справился ';
sandbox.m2check();
ok('миссия 2 засчитана по введённому ответу', sandbox.S.done.m2 === true);

/* --- 3. Пароль --- */
sandbox.updatePw('qwerty123');
ok('слабый пароль НЕ засчитан', sandbox.S.done.m1 === false);
ok('слабый пароль = мгновенный подбор',
   String(sandbox.$('pwtime').textContent).indexOf('мгновенно') === 0, sandbox.$('pwtime').textContent);
sandbox.updatePw('Гвоздика-Монитор-77!');
ok('сильный пароль засчитан', sandbox.S.done.m1 === true);
ok('время подбора сильного пароля велико',
   /лет|тыс|млн|млрд/.test(sandbox.$('pwtime').textContent), sandbox.$('pwtime').textContent);

/* --- 4. Фишинг --- */
var lures = ['sender','subject','hello','link','file','sms'];
lures.forEach(function(s){ sandbox.phClick({ className:'spot', getAttribute:function(){ return s; } }); });
ok('фишинг: все 6 ловушек найдены', sandbox.S.done.m3 === true, sandbox.phFoundCount());
sandbox.phClick({ className:'spot', getAttribute:function(){ return 'to'; } });
ok('посторонний элемент не считается ловушкой', sandbox.phFoundCount() === 6);

/* --- 5. Социальная инженерия --- */
var q4 = sandbox.Q4, i;
for(i=0;i<q4.length;i++){
  sandbox.q4answer({ getAttribute:function(k){ return k === 'data-q' ? String(i) : (q4[i].bad ? '1' : '0'); } });
}
ok('соц. инженерия: все ' + q4.length + ' кейсов решены', sandbox.S.done.m4 === true, sandbox.q4solved());
ok('в наборе есть и «безопасный» вариант (не все ответы «опасно»), ', 
   q4.filter(function(x){ return x.bad === false; }).length >= 1);

/* --- 6. Терминал --- */
sandbox.termExec('flag');
ok('flag заблокирован до scan/crack', sandbox.S.done.m5 === false);
sandbox.termExec('scan 10.0.0.1');
ok('скан чужого адреса не даёт уязвимость', sandbox.S.done.m5 === false);
sandbox.termExec('crack');
ok('crack без скана заблокирован', sandbox.S.done.m5 === false);
sandbox.termExec('cat notes.txt');
sandbox.termExec('scan 192.168.1.10');
sandbox.termExec('crack');
sandbox.termExec('flag');
ok('миссия 5 засчитана по цепочке help-scan-crack-flag', sandbox.S.done.m5 === true);
sandbox.termExec('полный бред');
ok('неизвестная команда не ломает терминал', true);

/* --- 7. Миссия 6: два фактора --- */
sandbox.F6_SEL = {};
sandbox.F6_SEL['0'] = true;      /* пароль — «знание»                  */
sandbox.F6_SEL['3'] = true;      /* секретный вопрос — тоже «знание»   */
sandbox.f6check();
ok('миссия 6: два ключа одного типа НЕ засчитаны', sandbox.S.done.m6 === false);

sandbox.F6_SEL = {};
sandbox.F6_SEL['0'] = true;      /* пароль — «знание»        */
sandbox.F6_SEL['1'] = true;      /* код на телефоне — владение */
sandbox.f6check();
ok('миссия 6: два ключа разных типов засчитаны', sandbox.S.done.m6 === true);

/* --- 8. Миссия 7: минимальные права --- */
var p7need = 0;
sandbox.P7_ROLES.forEach(function(r){ p7need += r.need.length; });
ok('миссия 7: в эталонной настройке ровно 6 разрешений из 20', p7need === 6, p7need + '/20');
ok('миссия 7: администратору нужно больше прав, чем остальным',
   sandbox.P7_ROLES[2].need.length === 3 && sandbox.P7_ROLES[0].need.length === 1);

/* матрицу доступов эмулируем: подсовываем функции p7box готовые чекбоксы */
var p7boxes = [];
for(var pr = 0; pr < sandbox.P7_ROLES.length; pr++){
  for(var pc = 0; pc < sandbox.P7_RES.length; pc++){
    (function(rr, cc){
      p7boxes.push({
        checked: false,
        need: sandbox.P7_ROLES[rr].need.indexOf(cc) >= 0,
        getAttribute: function(k){ return k === 'data-role' ? String(rr) : String(cc); }
      });
    })(pr, pc);
  }
}
sandbox.$('m7table').getElementsByTagName = function(){ return p7boxes; };

sandbox.p7check();
ok('миссия 7: пустая таблица не принимается (6 разрешений не хватает)', sandbox.S.done.m7 === false);

p7boxes[1].checked = true;                    /* Ирина + «Сервер разработки» — лишнее право */
sandbox.p7check();
ok('миссия 7: лишнее право не принимается', sandbox.S.done.m7 === false);

p7boxes[1].checked = false;
p7boxes.forEach(function(b){ b.checked = b.need; });
sandbox.p7check();
ok('миссия 7: эталонная матрица (6 разрешений) принята', sandbox.S.done.m7 === true);

/* --- 9. Миссия 8: журнал сервера --- */
sandbox.L8_SEL = {};
for(var li = 0; li < sandbox.L8.length; li++) sandbox.L8_SEL[li] = true;
sandbox.l8check();
ok('миссия 8: «отметить все строки» не принимается', sandbox.S.done.m8 === false);

sandbox.L8_SEL = {};
var l8atk = 0;
sandbox.L8.forEach(function(r, ix){ if(r.attack){ sandbox.L8_SEL[ix] = true; l8atk++; } });
sandbox.l8check();
ok('миссия 8: атака найдена (' + l8atk + ' строк из ' + sandbox.L8.length + ')',
   sandbox.S.done.m8 === true, l8atk);
ok('миссия 8: в журнале есть ложное срабатывание (одна опечатка пользователя)',
   sandbox.L8.filter(function(r){ return !r.attack && r.res === 'FAILED'; }).length === 1);

/* --- 10. Миссия 9: поддельные адреса --- */
ok('миссия 9: домены-двойники выглядят одинаково, но различаются посимвольно',
   sandbox.U9[2].a !== sandbox.U9[2].b && sandbox.U9[2].b.indexOf(sandbox.CYR_A) > 0,
   sandbox.U9[2].a + ' / ' + sandbox.U9[2].b);

var u9before = sandbox.S.score;
sandbox.u9pick({ getAttribute: function(k){ return k === 'data-p' ? '0' : '0'; } });
ok('миссия 9: клик по настоящему адресу штрафует и пару не закрывает',
   sandbox.S.score === u9before - 2 && !sandbox.U9_SOLVED['0'], sandbox.S.score);

for(var up = 0; up < sandbox.U9.length; up++){
  (function(p){
    sandbox.u9pick({ getAttribute: function(k){
      return k === 'data-p' ? String(p) : String(sandbox.U9[p].fake);
    }});
  })(up);
}
ok('миссия 9: все 6 поддельных адресов найдены', sandbox.S.done.m9 === true, sandbox.u9count() + '/6');

/* --- 11. Миссия 10: шифр замены --- */
ok('миссия 10: ключ — перестановка 33 букв без повторов', (function(){
  var o = {}, d = 0, k = sandbox.S10_KEY;
  for(var i = 0; i < k.length; i++){ var c = k.charAt(i); if(o[c]) d++; o[c] = 1; }
  return k.length === 33 && d === 0 && Object.keys(o).length === 33;
})());
ok('миссия 10: шифрование и дешифрование взаимно обратны',
   sandbox.s10dec(sandbox.s10enc(sandbox.s10plain())) === sandbox.s10plain());
sandbox.$('m10answer').value = '  доступ   разрешен ';
sandbox.s10check();
ok('миссия 10: ответ принят несмотря на регистр и лишние пробелы', sandbox.S.done.m10 === true);

/* --- 12. Итог --- */
ok('очки = 198 из 200 (минус 2 за неверную попытку в миссии 9)', sandbox.S.score === 198, sandbox.S.score);
ok('собраны все 10 фрагментов', sandbox.doneCount() === 10, sandbox.doneCount());
sandbox.openFinal();
ok('код доступа сформирован в формате KB-XXXXXX', /^KB-\d{6}$/.test(sandbox.S.code), sandbox.S.code);
ok('фраза-итог собрана полностью из 10 фрагментов',
   String(sandbox.$('codephraseOut').innerHTML).indexOf(
     'БЕЗОПАСНОСТЬ ЭТО ПРОЦЕСС, А НЕ ПРОДУКТ И ЕГО ДЕЛАЮТ ЛЮДИ КАЖДЫЙ ДЕНЬ') >= 0,
   sandbox.$('codephraseOut').innerHTML);

/* --- 13. Сертификат --- */
sandbox.$('stname').value = 'Тестов Тест';
sandbox.issueCert();
ok('сертификат выдаётся на введённое ФИО', sandbox.$('certname').textContent === 'Тестов Тест');
sandbox.$('stname').value = 'аб';
sandbox.issueCert();
ok('слишком короткое ФИО отклонено', sandbox.$('certname').textContent === 'Тестов Тест');
ok('личный код попал в сертификат', sandbox.$('certcode').textContent === sandbox.S.code);
ok('дата заполнена', /\d{2}\.\d{2}\.\d{4}/.test(sandbox.$('certdate').textContent), sandbox.$('certdate').textContent);

/* --- 14. Восстановление прогресса --- */
ok('состояние сохранено в localStorage',
   typeof store['kiberbarier_v2'] === 'string' && store['kiberbarier_v2'].length > 20);
var restored = JSON.parse(store['kiberbarier_v2']);
ok('в сохранении есть все 10 миссий, очки и штрафы',
   restored.done.m1 === true && restored.done.m6 === true && restored.done.m10 === true &&
   restored.score === 198);
var restoredKeys = 0;
for(var rk in restored.done){ if(restored.done[rk]) restoredKeys++; }
ok('в сохранении ровно 10 записей о миссиях', Object.keys(restored.done).length === 10 && restoredKeys === 10);
ok('JS не обращается к отсутствующим в разметке id',
   Object.keys(unknownIds).length === 0, Object.keys(unknownIds).join(', ') || 'нет');

console.log(results.join('\n'));
var failed = results.filter(function(r){ return r.indexOf('FAIL') === 0; }).length;
console.log('\nИТОГО: ' + (results.length - failed) + ' пройдено, ' + failed + ' провалено, всего ' + results.length);
process.exit(failed ? 1 : 0);
