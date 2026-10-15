import {test} from 'node:test';import assert from 'node:assert/strict';import {sharedQuestionKey,normalizeQuestion,shareableAnswer} from '../server/tutor-cache.js';
test('cache matches harmless spacing/diacritics, keeps negation and units distinct and rejects personal or context-dependent prompts',()=>{
 const key=q=>sharedQuestionKey(q,'version1');assert.ok(key('شلون أطلب قهوة بدون سكر؟'));assert.equal(key('شلون أَطلب قهوة بدون سكر!'),key(' شلون أطلب قهوة بدون سكر؟ '));assert.notEqual(key('شلون أطلب قهوة مع سكر؟'),key('شلون أطلب قهوة بدون سكر؟'));assert.notEqual(key('شلون أطلب قهوة ساخنة؟'),key('شلون أطلب قهوة باردة؟'));assert.equal(normalizeQuestion('آب'), 'آب');assert.notEqual(normalizeQuestion('آب'),normalizeQuestion('اب'));
 for(const q of ['خليها اقصر','ترجم اسمي أحمد','شلون أگول رقمي 07712345678','ترجم user@example.com','ترجم عنواني شارع النور','ترجم أنا اسكن هنا','شلون أطلب دواء لمرضي','شلون أطلب '+ 'سالم','ترجم\nكلام خاص','ترجم النص السابق'])assert.equal(key(q),null,q);
 assert.notEqual(sharedQuestionKey('شلون أطلب قهوة بدون سكر؟','version2'),key('شلون أطلب قهوة بدون سكر؟'));
 assert.equal(shareableAnswer('أرسل عنوانك؟'),false);assert.equal(shareableAnswer('گول: email@example.com\nالنطق التقريبي: خاص\nالمعنى: خاص'),false);
});
