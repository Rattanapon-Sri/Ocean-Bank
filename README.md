# Ocean Bank DApp

Assignment 5 — ระบบธนาคารจำลองบน Ethereum Sepolia Testnet

เว็บ HTML/CSS/JavaScript ธีม Ocean Bank สำหรับฝาก ถอน และอ่านยอดเงินบน Ethereum Sepolia

## เปิดบนเครื่อง

ติดตั้ง Node.js แล้วเปิด Terminal ในโฟลเดอร์โปรเจกต์:

```powershell
npm start
```

เปิด http://127.0.0.1:5173 ใน Chrome/Edge ที่ติดตั้ง MetaMask จากนั้นกดเชื่อมต่อและเลือก Sepolia
ไม่ต้องใช้ npm install และไม่มีขั้นตอน build เว็บโหลด ethers 6.17.0 จาก CDN และฟอนต์จาก Google Fonts (มีฟอนต์สำรองในเครื่อง)

## ไฟล์สำคัญ

- `index.html` — หน้าเว็บและข้อมูลนักศึกษา
- `styles.css` — ธีมสีและ responsive layout
- `config.js` — Infura Sepolia endpoint
- `bank.mjs` — RPC, แปลง ETH/wei และเรียก Contract
- `app.js` — เชื่อม MetaMask, อัปเดตหน้าจอ และติดตามธุรกรรม

## การเชื่อมต่อ

Contract: `0xa01A3Fc53EF4d3070405A6D911114F65c06cFe1f`

Chain ID: `11155111` (`0xaa36a7`)

อ่าน `checkBlance()` ผ่าน Infura โดยส่ง `from` เป็นบัญชีที่เชื่อมต่อ เพราะ Contract ใช้ `msg.sender` เพื่อค้นหายอด
ฝาก/ถอนส่งผ่าน MetaMask และรอ receipt จาก Infura ยอดฝากแยกจากยอด ETH ในกระเป๋า
หน้าเว็บไม่เก็บ seed phrase, private key หรือ Infura API Key Secret
Infura API Key ในเว็บเป็นค่าที่ผู้เข้าชมดูได้เสมอ แม้เก็บใน environment variable ตอน build จึงควรจำกัด Allowed Origins ให้ตรงโดเมนที่ใช้งานใน Dashboard และกำหนดโควตาตามต้องการ

## ตรวจสอบ

```powershell
npm test
```

ทดสอบอัตโนมัติไม่ส่งธุรกรรมจริง ให้ทดสอบกับ MetaMask ด้วยตนเอง:

1. เชื่อมต่อบัญชีเดิม ยอดฝากควรตรงกับ Remix
2. ฝาก 0.001 ETH แล้วยืนยัน ยอดฝากเพิ่มหลังธุรกรรมสำเร็จ
3. ถอน 0.0005 ETH แล้วยืนยัน ยอดฝากลดลง (ยอดในกระเป๋ายังหักค่า gas)
4. ถอนเกินยอด, กรอกศูนย์/ติดลบ และปฏิเสธใน MetaMask ต้องมีข้อความที่เข้าใจได้
5. เปลี่ยนบัญชี/เครือข่าย ต้องไม่ส่งธุรกรรมด้วยสถานะเก่า

รายการในครั้งนี้แสดงเฉพาะธุรกรรมจากหน้าที่เปิดอยู่ ไม่ใช่ประวัติทั้งหมด และจะหายเมื่อ reload
ถ้ารอนานหรือการอ่าน receipt ล้มเหลว ให้ตรวจ Etherscan ก่อนทำรายการซ้ำ
Contract ยึดตามโจทย์และใช้ `transfer` จึงเหมาะกับบัญชีทดสอบทั่วไป ไม่ได้ออกแบบรองรับ smart-contract wallet ทุกแบบ
