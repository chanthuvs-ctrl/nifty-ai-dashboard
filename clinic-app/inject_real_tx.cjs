
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const data = JSON.parse(fs.readFileSync('real_transactions_parsed.json', 'utf8'));
  console.log('Injecting transactions into browser localStorage:', data.length);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/admin');
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate((txs) => {
    localStorage.setItem('de_natura_transactions', JSON.stringify(txs));
  }, data);

  console.log('Successfully injected 6,651 transactions into localStorage!');
  await browser.close();
})();
