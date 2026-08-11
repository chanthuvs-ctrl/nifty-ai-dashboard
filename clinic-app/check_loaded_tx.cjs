
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/admin');
  await new Promise(r => setTimeout(r, 1000));

  const localData = await page.evaluate(() => {
    const raw = localStorage.getItem('de_natura_transactions');
    return raw ? JSON.parse(raw) : [];
  });

  console.log('Loaded transactions in localStorage count:', localData.length);
  console.log('Transactions data:', JSON.stringify(localData, null, 2));

  await browser.close();
})();
