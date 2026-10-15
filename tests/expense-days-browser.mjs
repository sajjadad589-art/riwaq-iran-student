import {mockAccountData} from './mock-account-data.mjs';
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/account/session',r=>r.fulfill({json:{user:{id:'test',name:'فحص',phone:'+9647700000000',role:'user'}}}));await page.route('**/api/notifications',r=>r.fulfill({json:{messages:[],publicKey:null}}));await page.route('**/api/presence',r=>r.fulfill({json:{ok:true}}));await page.route('**/api/market',r=>r.fulfill({status:502,json:{errors:[]}}));
const cloud=await mockAccountData(page);
try{await page.goto((process.env.APP_URL||'http://127.0.0.1:8794')+'/#expenses');await page.locator('#expense-save-day').waitFor();
 const add=async(name,amount)=>{await page.locator('#expense-name').fill(name);await page.locator('#expense-amount').fill(String(amount));await page.locator('#expense-form button').click();};
 await add('غداء',250000);page.once('dialog',async d=>{assert.match(d.message(),/غير محفوظ/);await d.dismiss();});await page.locator('#expense-reset').click();assert.equal(await page.locator('#expense-list>p').count(),1);
 await page.locator('#expense-save-day').click();await page.locator('#expense-save-day').click();assert.equal(cloud.document.saved.length,1);
 page.once('dialog',d=>d.accept());await page.locator('#expense-reset').click();await page.waitForFunction(()=>document.querySelector('#expense-list').childElementCount===0);assert.match(await page.locator('#expense-days').textContent(),/250,000/);
 await add('قهوة',50000);await page.locator('#expense-save-day').click();await page.waitForFunction(()=>document.querySelector('#expense-days summary').textContent.includes('300,000'));assert.equal(await page.locator('#expense-days details p').count(),2);
 await page.reload();await page.locator('#expense-save-day').waitFor();await page.waitForFunction(()=>document.querySelector('#expense-total').textContent.includes('50,000'));assert.match(await page.locator('#expense-days').textContent(),/300,000/);
 cloud.document.expenses.push({id:'yesterday-item',day:'2026-10-13',name:'أمس',amount:10000});await page.reload();await page.locator('#expense-save-day').click();await page.waitForFunction(()=>document.querySelectorAll('#expense-days details').length===2);
 const before=JSON.stringify(cloud.document.saved);page.once('dialog',d=>d.accept());await page.locator('#expense-reset').click();assert.equal(JSON.stringify(cloud.document.saved),before);
 cloud.fail=true;await add('لازم يبقى',1000);await page.waitForFunction(()=>document.querySelector('#expense-save-status').textContent.includes('fetch'));assert.equal(await page.locator('#expense-list>p').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);console.log('PASS cancel reset, warn unsaved, save once, saved ledger survives reset/reload, append on same day, separate dates, failed writes do not mutate state.');
}finally{await browser.close();}
