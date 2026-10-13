import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/market.js';
test('unconfigured market never invents a price',async()=>{const r=await onRequestGet({env:{}});assert.equal(r.status,503);assert.equal((await r.json()).error,'market_feed_not_configured');});
test('valid feed is accepted and stale feed rejected',async()=>{const original=global.fetch;try{global.fetch=async()=>Response.json({rates:{IRT:100000,IQD:1500},source:'Test feed',updatedAt:new Date().toISOString()});let r=await onRequestGet({env:{MARKET_FEED_URL:'https://example.com/feed'}});assert.equal(r.status,200);assert.equal((await r.json()).rates.IRT,100000);global.fetch=async()=>Response.json({rates:{IRT:100000,IQD:1500},source:'Test feed',updatedAt:'2020-01-01'});r=await onRequestGet({env:{MARKET_FEED_URL:'https://example.com/feed'}});assert.equal(r.status,502);}finally{global.fetch=original;}});
