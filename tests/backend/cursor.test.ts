import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeCursor, decodeVerificationCursor, encodeCursor } from '../../lib/api/cursor.js';

test('opaque cursor round-trips UTF-8 JSON and preserves string bigint IDs',()=>{
  const value={revision:'a'.repeat(64),tieMessageId:'9223372036854775807',inboxKey:'cluster:질문'};
  const encoded=encodeCursor(value);
  assert.ok(encoded);
  assert.deepEqual(decodeCursor(encoded),value);
});

test('malformed cursors fail as validation errors',()=>{
  assert.throws(()=>decodeCursor('%%%'),(error:unknown)=>(error as {code?:string}).code==='VALIDATION_ERROR');
  assert.equal(encodeCursor(null),null);
});

test('verification cursors require a safe timestamp and UUID before building PostgREST filters',()=>{
  const value={createdAt:'2026-11-11T02:03:04.000Z',id:'a0000000-0000-4000-8000-000000000001'};
  assert.deepEqual(decodeVerificationCursor(encodeCursor(value)),value);
  assert.throws(()=>decodeVerificationCursor(encodeCursor({createdAt:'2026-11-11T02:03:04Z),id.gt.1',id:value.id})),
    (error:unknown)=>(error as {code?:string}).code==='VALIDATION_ERROR');
  assert.throws(()=>decodeVerificationCursor(encodeCursor({createdAt:value.createdAt,id:'bad-id'})),
    (error:unknown)=>(error as {code?:string}).code==='VALIDATION_ERROR');
});
