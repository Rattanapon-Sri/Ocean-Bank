import test from 'node:test';
import assert from 'node:assert/strict';
import { toWei, toEther, createBankClient, createRpc } from '../bank.mjs';

test('decimal amounts keep wei precision and accept the smallest unit', () => {
  assert.equal(toWei('0.001'), 1000000000000000n);
  assert.equal(toWei('0.000000000000000001'), 1n);
  assert.equal(toWei('1.123456789012345678'), 1123456789012345678n);
  assert.equal(toEther(500000000000000n), '0.0005');
});
test('reject invalid or zero amounts before contacting a wallet', () => {
  for (const value of ['0', '-1', '1e3', 'NaN', '', '.5', '0.0000000000000000001']) {
    assert.throws(() => toWei(value));
  }
});
test('balance call includes the connected account, not the default zero sender', async () => {
  let observed;
  const client = createBankClient(async (method, params) => {
    observed = { method, params };
    return '0x7';
  }, { balanceData: '0x12345678', withdrawData: () => '0x' });
  assert.equal(await client.balance('0xabc'), 7n);
  assert.equal(observed.method, 'eth_call');
  assert.equal(observed.params[0].from, '0xabc');
});
test('wrong network prevents any transaction submission', async () => {
  const calls = [];
  const wallet = { request: async ({ method }) => {
    calls.push(method);
    return '0x1';
  }};
  const client = createBankClient(async () => '0x0', {});
  await assert.rejects(client.send(wallet, '0xabc', 'deposit', 1n), /Sepolia/);
  assert.deepEqual(calls, ['eth_chainId']);
});
test('deposit sends value while withdrawal sends encoded argument and zero value', async () => {
  const transactions = [];
  const wallet = { request: async ({ method, params }) => {
    if (method === 'eth_chainId') return '0xaa36a7';
    if (method === 'eth_accounts') return ['0xabc'];
    transactions.push(params[0]); return '0xhash';
  }};
  const client = createBankClient(async () => '0x0', {
    depositData: '0xd0e30db0', withdrawData: amount => `encoded:${amount}`
  });
  await client.send(wallet, '0xabc', 'deposit', 16n);
  await client.send(wallet, '0xabc', 'withdraw', 7n);
  assert.equal(transactions[0].value, '0x10');
  assert.equal(transactions[1].value, '0x0');
  assert.equal(transactions[1].data, 'encoded:7');
});

test('a changed wallet account prevents submitting with the previous account', async () => {
  const calls = [];
  const wallet = { request: async ({ method }) => {
    calls.push(method);
    return method === 'eth_chainId' ? '0xaa36a7' : ['0xdef'];
  }};
  const client = createBankClient(async () => '0x0', {});
  await assert.rejects(client.send(wallet, '0xabc', 'withdraw', 1n), /บัญชีกระเป๋าเปลี่ยน/);
  assert.equal(calls.includes('eth_sendTransaction'), false);
});

test('a reverted receipt is not reported as success', async () => {
  const client = createBankClient(async () => ({ status: '0x0' }), {});
  await assert.rejects(client.wait('0xhash'), /ธุรกรรมไม่สำเร็จ/);
});

test('RPC failures are surfaced instead of becoming a zero balance', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401 }));
  const rpc = createRpc('https://example.invalid');
  await assert.rejects(rpc('eth_chainId'), /HTTP 401/);
});
