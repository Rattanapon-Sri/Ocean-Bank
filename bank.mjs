export const CONTRACT = '0xa01A3Fc53EF4d3070405A6D911114F65c06cFe1f';
export const CHAIN_ID = '0xaa36a7';
export const ABI = [
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function checkBlance() view returns (uint256 balance)'
];
const UNIT = 10n ** 18n;

export function toWei(input) {
  const value = String(input).trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(value)) {
    throw new Error('กรอกจำนวน ETH เช่น 0.001 โดยมีทศนิยมไม่เกิน 18 ตำแหน่ง');
  }
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * UNIT + BigInt(fraction.padEnd(18, '0'));
  if (amount <= 0n || amount >= 2n ** 256n) throw new Error('จำนวนเงินต้องมากกว่า 0 และไม่เกินขอบเขตที่รองรับ');
  return amount;
}

export function toEther(wei) {
  const value = BigInt(wei);
  const fraction = (value % UNIT).toString().padStart(18, '0').replace(/0+$/, '');
  return `${value / UNIT}${fraction ? `.${fraction}` : ''}`;
}

export function createRpc(endpoint) {
  let id = 0;
  return async (method, params = []) => {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`Infura ตอบกลับ HTTP ${response.status} กรุณาตรวจ API Key และสิทธิ์การใช้งาน`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || 'Infura ไม่สามารถทำรายการได้');
    if (body.result === undefined) throw new Error('Infura ส่งข้อมูลกลับไม่ครบ');
    return body.result;
  };
}

export function createBankClient(rpc, codec) {
  return {
    async balance(account) {
      const result = await rpc('eth_call', [{ to: CONTRACT, from: account, data: codec.balanceData }, 'latest']);
      if (!/^0x[0-9a-f]+$/i.test(result)) throw new Error('อ่านยอดฝากไม่ได้ กรุณาตรวจ Contract และเครือข่าย');
      return BigInt(result);
    },
    async send(wallet, account, action, amount) {
      if (!['deposit', 'withdraw'].includes(action) || typeof amount !== 'bigint' || amount <= 0n) {
        throw new Error('ข้อมูลธุรกรรมไม่ถูกต้อง');
      }
      if (BigInt(await wallet.request({ method: 'eth_chainId' })) !== BigInt(CHAIN_ID)) {
        throw new Error('กรุณาเปลี่ยน MetaMask ไปที่ Sepolia ก่อนทำรายการ');
      }
      const accounts = await wallet.request({ method: 'eth_accounts' });
      if (!accounts[0] || accounts[0].toLowerCase() !== account.toLowerCase()) {
        throw new Error('บัญชีกระเป๋าเปลี่ยนไป กรุณาเชื่อมต่อใหม่');
      }
      return wallet.request({ method: 'eth_sendTransaction', params: [{
        from: account, to: CONTRACT,
        data: action === 'deposit' ? codec.depositData : codec.withdrawData(amount),
        value: action === 'deposit' ? `0x${amount.toString(16)}` : '0x0'
      }] });
    },
    async wait(hash) {
      for (let attempt = 0; attempt < 90; attempt++) {
        const receipt = await rpc('eth_getTransactionReceipt', [hash]);
        if (receipt) {
          if (BigInt(receipt.status) !== 1n) throw new Error('ธุรกรรมไม่สำเร็จบนเครือข่าย ตรวจรายละเอียดใน Etherscan');
          return receipt;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      throw new Error('ยังไม่พบการยืนยัน กรุณาตรวจ Etherscan ก่อนส่งรายการซ้ำ');
    }
  };
}
