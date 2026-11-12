import { RPC_URL } from './config.js';
import { ABI, CONTRACT, CHAIN_ID, toWei, toEther, createRpc, createBankClient } from './bank.mjs';

const $ = id => document.getElementById(id);
const rpc = createRpc(RPC_URL);
let client;
let wallet;
let account = null;
let chain = null;
let action = 'deposit';
let busy = false;
let rpcReady = false;
let generation = 0;
let activityCount = 0;
const discovered = new Map();

function status(message, tone = '', hash) {
  $('status').textContent = message;
  $('status').dataset.tone = tone;
  if (hash) {
    const link = document.createElement('a');
    link.href = `https://sepolia.etherscan.io/tx/${hash}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'ดูธุรกรรม ↗';
    $('status').append(link);
  }
}

function message(error) {
  if ([4001, 'ACTION_REJECTED'].includes(error.code)) return 'คุณยกเลิกรายการใน MetaMask ยังไม่มีการส่งธุรกรรม';
  if (error.code === -32002) return 'มีคำขอรออยู่ กรุณาเปิด MetaMask เพื่อดำเนินการ';
  if (error.name === 'TimeoutError') return 'Infura ใช้เวลาตอบกลับนาน กรุณาลองตรวจสอบยอดใหม่';
  return error.shortMessage || error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

function renderControls() {
  const correctChain = chain !== null && BigInt(chain) === BigInt(CHAIN_ID);
  const ready = Boolean(client && account && correctChain && rpcReady && !busy);
  $('connect').disabled = busy || !client;
  $('connect').textContent = account ? (correctChain ? 'เชื่อมต่อแล้ว' : 'เปลี่ยนเป็น Sepolia') : 'เชื่อมต่อ MetaMask';
  $('refresh').disabled = !ready;
  $('amount').disabled = !ready;
  $('submit').disabled = !ready;
  for (const button of document.querySelectorAll('[data-amount]')) button.disabled = !ready;
  for (const tab of document.querySelectorAll('.tab')) tab.disabled = busy;
  $('submit').textContent = busy ? 'กำลังดำเนินการ…' : (action === 'deposit' ? 'ฝากเงิน' : 'ถอนเงิน');
  $('account').textContent = account || 'ยังไม่ได้เชื่อมต่อ';
}

async function refresh() {
  if (!account || !client) return;
  const current = account;
  const revision = generation;
  const results = await Promise.allSettled([
    client.balance(current), rpc('eth_getBalance', [current, 'latest'])
  ]);
  if (revision !== generation) return;
  const [deposited, available] = results;
  $('bank-balance').textContent = deposited.status === 'fulfilled' ? toEther(deposited.value) : '—';
  $('wallet-balance').textContent = available.status === 'fulfilled' ? `${toEther(BigInt(available.value))} ETH` : 'อ่านไม่ได้';
  $('balance-caption').textContent = deposited.status === 'fulfilled' ? 'ยอดฝากใน Bank Contract · อ่านผ่าน Infura' : 'ยังไม่สามารถอ่านยอดฝากได้';
  if (deposited.status === 'rejected') throw deposited.reason;
  if (available.status === 'rejected') throw available.reason;
}

function invalidate() {
  generation++;
  $('bank-balance').textContent = '—';
  $('wallet-balance').textContent = '— ETH';
  $('balance-caption').textContent = 'เชื่อมต่อกระเป๋าเพื่อดูยอดเงินฝาก';
}

function selectWallet() {
  const providers = [...discovered.values()];
  return providers.find(item => item.info.rdns === 'io.metamask')?.provider
    || window.ethereum?.providers?.find(provider => provider.isMetaMask)
    || (window.ethereum?.isMetaMask ? window.ethereum : null);
}
window.addEventListener('eip6963:announceProvider', event => {
  if (event.detail?.info?.rdns && event.detail?.provider?.request) {
    discovered.set(event.detail.info.rdns, event.detail);
  }
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

function attachWallet(provider) {
  if (wallet === provider) return;
  wallet = provider;
  wallet.on?.('accountsChanged', accounts => {
    account = accounts[0] || null; invalidate(); renderControls();
    status(account ? 'บัญชีเปลี่ยนแล้ว กรุณาตรวจสอบยอดก่อนทำรายการ' : 'กระเป๋ายกเลิกการเชื่อมต่อแล้ว');
    if (account) refresh().catch(error => status(message(error), 'error'));
  });
  wallet.on?.('chainChanged', value => {
    chain = value; invalidate(); renderControls();
    if (BigInt(value) !== BigInt(CHAIN_ID)) status('กรุณากดปุ่มเปลี่ยนเป็น Sepolia ก่อนทำรายการ', 'error');
    else if (account) refresh().catch(error => status(message(error), 'error'));
  });
  wallet.on?.('disconnect', () => {
    account = null; chain = null; invalidate(); renderControls();
    status('การเชื่อมต่อ MetaMask ถูกตัด กรุณาเชื่อมต่อใหม่', 'error');
  });
}

$('connect').addEventListener('click', async () => {
  try {
    const provider = selectWallet();
    if (!provider) throw new Error('ไม่พบ MetaMask กรุณาเปิดเว็บด้วย Chrome หรือ Edge ที่ติดตั้งส่วนขยาย MetaMask');
    busy = true; renderControls(); attachWallet(provider);
    const accounts = await wallet.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw new Error('ไม่พบบัญชีกระเป๋าที่อนุญาต');
    account = accounts[0];
    chain = await wallet.request({ method: 'eth_chainId' });
    if (BigInt(chain) !== BigInt(CHAIN_ID)) {
      await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
      chain = await wallet.request({ method: 'eth_chainId' });
    }
    invalidate();
    await refresh();
    status('เชื่อมต่อ MetaMask แล้ว เลือกฝากหรือถอนเงินได้เลย', 'success');
  } catch (error) { status(message(error), 'error'); }
  finally { busy = false; renderControls(); }
});

$('refresh').addEventListener('click', async () => {
  busy = true; renderControls(); status('กำลังตรวจสอบยอดผ่าน Infura…');
  try { await refresh(); status('อัปเดตยอดเงินล่าสุดแล้ว', 'success'); }
  catch (error) { status(message(error), 'error'); }
  finally { busy = false; renderControls(); }
});

for (const kind of ['deposit', 'withdraw']) {
  $(`tab-${kind}`).addEventListener('click', () => {
    action = kind;
    for (const type of ['deposit', 'withdraw']) {
      $(`tab-${type}`).classList.toggle('active', type === action);
      $(`tab-${type}`).setAttribute('aria-pressed', String(type === action));
    }
    renderControls();
  });
}
for (const button of document.querySelectorAll('[data-amount]')) {
  button.addEventListener('click', () => { $('amount').value = button.dataset.amount; $('amount').focus(); });
}

function addActivity(kind, amount, hash, sender) {
  $('activity-empty').hidden = true;
  $('activity-count').textContent = `${++activityCount} รายการ`;
  const item = document.createElement('li');
  const title = document.createElement('div');
  title.textContent = `${kind === 'deposit' ? 'ฝากเงิน' : 'ถอนเงิน'} ${toEther(amount)} ETH`;
  const detail = document.createElement('small');
  detail.textContent = `รอการยืนยัน · ${sender.slice(0, 6)}…${sender.slice(-4)}`;
  title.append(detail);
  const link = document.createElement('a');
  link.textContent = `${hash.slice(0, 10)}… ↗`;
  link.href = `https://sepolia.etherscan.io/tx/${hash}`;
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  item.append(title, link); $('activity-list').prepend(item);
  return detail;
}

$('transaction-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !account || !rpcReady) return;
  let hash;
  let detail;
  const sender = account;
  const kind = action;
  try {
    const amount = toWei($('amount').value);
    busy = true; renderControls();
    if (kind === 'withdraw' && amount > await client.balance(sender)) throw new Error('จำนวนถอนมากกว่ายอดเงินฝากของคุณ');
    status('กรุณาตรวจสอบและยืนยันรายการใน MetaMask…');
    hash = await client.send(wallet, sender, kind, amount);
    detail = addActivity(kind, amount, hash, sender);
    status('ส่งธุรกรรมแล้ว กำลังรอการยืนยันจาก Sepolia…', '', hash);
    await client.wait(hash);
    detail.textContent = `ยืนยันแล้ว · ${sender.slice(0, 6)}…${sender.slice(-4)}`;
    $('amount').value = '';
    status(`${kind === 'deposit' ? 'ฝากเงิน' : 'ถอนเงิน'}สำเร็จ ${toEther(amount)} ETH`, 'success', hash);
    try { await refresh(); }
    catch (error) { status(`ธุรกรรมสำเร็จ แต่อัปเดตยอดไม่ได้: ${message(error)} กดตรวจสอบยอดเงินอีกครั้ง`, 'error', hash); }
  } catch (error) {
    if (detail) detail.textContent = 'ตรวจสอบผลธุรกรรมใน Etherscan ก่อนส่งซ้ำ';
    status(message(error), 'error', hash);
  } finally { busy = false; renderControls(); }
});

async function init() {
  try {
    const { Interface } = await import('https://cdn.jsdelivr.net/npm/ethers@6.17.0/+esm');
    const abi = new Interface(ABI);
    client = createBankClient(rpc, {
      balanceData: abi.encodeFunctionData('checkBlance'),
      depositData: abi.encodeFunctionData('deposit'),
      withdrawData: value => abi.encodeFunctionData('withdraw', [value])
    });
    const actualChain = await rpc('eth_chainId');
    if (BigInt(actualChain) !== BigInt(CHAIN_ID)) throw new Error('Infura endpoint ต้องเป็น Sepolia');
    const code = await rpc('eth_getCode', [CONTRACT, 'latest']);
    if (code === '0x') throw new Error('ไม่พบ Contract บนเครือข่ายนี้');
    rpcReady = true;
    $('rpc-state').textContent = 'Infura · เชื่อมต่อแล้ว';
    status('Infura พร้อมใช้งาน กดเชื่อมต่อ MetaMask เพื่อเริ่มต้น', 'success');
  } catch (error) {
    $('rpc-state').textContent = 'Infura · ยังไม่พร้อม';
    status(`เตรียมการเชื่อมต่อไม่สำเร็จ: ${message(error)} กรุณาตรวจอินเทอร์เน็ตแล้วโหลดหน้าใหม่`, 'error');
  } finally { renderControls(); }
}
init();
