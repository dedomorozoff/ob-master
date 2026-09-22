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
      if(!htmlIds[id] && !/^(q4_|why4_|u9_|why9_|h11row|h11hash|h12mk|a13row|h14b|t15sel|w17mk|r18sel|e20q)\d+$/.test(id)) unknownIds[id] = true;
      els[id] = mkEl(id);
    }
    return els[id];
  },
  createElement: function(){ return mkEl('new'); },
  getElementsByName: function(){ return []; }
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

/* --- 12. Эксперт-блок: миссии 11-20 --- */
/* Миссия 11: хеш */
ok('миссия 11: подмена ловится по хешу, а не по глазам',
   sandbox.h11hash('Договор №14\nСумма: 100000 руб.\nСрок оплаты: 31.12.2026') !==
   sandbox.h11hash('Договор №14\nСумма: 1000000 руб.\nСрок оплаты: 31.12.2026'));
sandbox.h11mark(2);
ok('миссия 11: подменённый файл найден', sandbox.S.done.m11 === true);

/* Миссия 12: заголовки */
sandbox.h12toggle({ getAttribute: function(k){ return '1'; } });
sandbox.h12toggle({ getAttribute: function(k){ return '3'; } });
sandbox.h12toggle({ getAttribute: function(k){ return '4'; } });
sandbox.h12check();
ok('миссия 12: подделка доказана через Return-Path, Reply-To и SPF/DKIM/DMARC',
   sandbox.S.done.m12 === true);

/* Миссия 13: аудит */
for(var a13i = 0; a13i < sandbox.A13.length; a13i++){
  (function(i){ sandbox.a13fix(i); })(a13i);
}
ok('миссия 13: исправлены все 6 опасных настроек', sandbox.S.done.m13 === true);

/* Миссия 14: цепочка атаки */
ok('миссия 14: события показаны перемешанными, а не в хронологии', (function(){
  for(var q = 0; q < sandbox.H14_EV.length; q++){ if(sandbox.H14_EV[q].pos !== q + 1) return true; }
  return false;
})());
var h14order = [];
for(var h14p = 1; h14p <= sandbox.H14_EV.length; h14p++){
  for(var h14j = 0; h14j < sandbox.H14_EV.length; h14j++){
    if(sandbox.H14_EV[h14j].pos === h14p) h14order.push(h14j);
  }
}
h14order.forEach(function(i){ sandbox.h14pick(i); });
sandbox.h14check();
ok('миссия 14: хронология атаки восстановлена', sandbox.S.done.m14 === true);

/* Миссия 15: крипто-инструменты */
for(var t15i = 0; t15i < sandbox.T15_TASKS.length; t15i++){
  sandbox.$('t15sel' + t15i).value = String(sandbox.T15_TASKS[t15i].a);
}
sandbox.t15check();
ok('миссия 15: все 6 задач сопоставлены инструментам', sandbox.S.done.m15 === true);

/* Миссия 16: стеганография */
sandbox.$('m16answer').value = '  нЕзбасмамм ';
sandbox.m16check();
ok('миссия 16: акростих разгадан (регистр и пробелы не мешают)', sandbox.S.done.m16 === true);

/* Миссия 17: SQL-инъекция */
sandbox.document.getElementsByName = function(name){
  if(name === 'w17fix') return [{ checked:true, value:'1' }];   /* параметризованные запросы */
  var m = /^e20q(\d+)$/.exec(String(name));
  if(m) return [{ checked:true, value:String(sandbox.E20[parseInt(m[1], 10)].c) }];
  return [];
};
['1','3','5'].forEach(function(w){ sandbox.w17toggle({ getAttribute: function(k){ return w; } }); });
sandbox.w17check();
ok('миссия 17: инъекции найдены, выбрана параметризация', sandbox.S.done.m17 === true);

/* Миссия 18: оценка риска */
(function(){
  var want = sandbox.R18.map(function(r, i){ return {i:i, s:r.p * r.d}; })
                        .sort(function(a, b){ return b.s - a.s; })
                        .map(function(x){ return x.i; });
  for(var k = 0; k < 4; k++) sandbox.$('r18sel' + want[k]).value = String(k + 1);
})();
sandbox.r18check();
ok('миссия 18: приоритеты по произведению вероятность×ущерб', sandbox.S.done.m18 === true);

/* Миссия 19: Wi-Fi */
sandbox.n19pick(0, { className:'' });
ok('миссия 19: выбор открытой сети не засчитан', sandbox.S.done.m19 !== true);
sandbox.n19pick(3, { className:'' });
ok('миссия 19: WPA3-Enterprise сеть выбрана верно', sandbox.S.done.m19 === true);

/* Миссия 20: экзамен */
sandbox.e20check();
ok('миссия 20: экзамен 8 из 8', sandbox.S.done.m20 === true);

/* --- 13. Итог --- */
ok('собраны все 20 фрагментов', sandbox.doneCount() === 20, sandbox.doneCount());
sandbox.openFinal(true);
ok('код доступа сформирован в формате KB-XXXXXX', /^KB-\d{6}$/.test(sandbox.S.code), sandbox.S.code);
ok('экспертный финал: заголовок уровня ЭКСПЕРТ',
   String(sandbox.$('finaltitle').innerHTML).indexOf('ЭКСПЕРТ') >= 0,
   sandbox.$('finaltitle').innerHTML);

/* --- 14. Сертификат --- */
sandbox.$('stname').value = 'Тестов Тест';
sandbox.issueCert();
ok('сертификат выдаётся на введённое ФИО', sandbox.$('certname').textContent === 'Тестов Тест');
sandbox.$('stname').value = 'аб';
sandbox.issueCert();
ok('слишком короткое ФИО отклонено', sandbox.$('certname').textContent === 'Тестов Тест');
ok('личный код попал в сертификат', sandbox.$('certcode').textContent === sandbox.S.code);
ok('дата заполнена', /\d{2}\.\d{2}\.\d{4}/.test(sandbox.$('certdate').textContent), sandbox.$('certdate').textContent);

/* --- 15. Восстановление прогресса --- */
ok('состояние сохранено в localStorage',
   typeof store['kiberbarier_v3'] === 'string' && store['kiberbarier_v3'].length > 20);
var restored = JSON.parse(store['kiberbarier_v3']);
ok('в сохранении есть все миссии, очки и штрафы',
   restored.done.m1 === true && restored.done.m11 === true && restored.done.m20 === true &&
   restored.score === sandbox.S.score);
var restoredKeys = 0;
for(var rk in restored.done){ if(restored.done[rk]) restoredKeys++; }
ok('в сохранении ровно 20 записей о миссиях', Object.keys(restored.done).length === 20 && restoredKeys === 20);
ok('JS не обращается к отсутствующим в разметке id',
   Object.keys(unknownIds).length === 0, Object.keys(unknownIds).join(', ') || 'нет');

console.log(results.join('\n'));
var failed = results.filter(function(r){ return r.indexOf('FAIL') === 0; }).length;
console.log('\nИТОГО: ' + (results.length - failed) + ' пройдено, ' + failed + ' провалено, всего ' + results.length);
process.exit(failed ? 1 : 0);
