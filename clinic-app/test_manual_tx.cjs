
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('dialog', async dialog => {
    console.log('BROWSER DIALOG ALERT:', dialog.message());
    await dialog.dismiss();
  });

  console.log('1. Opening Admin portal...');
  await page.goto('http://localhost:8000/admin');
  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Clicking Income & Expenses tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent.includes('Income & Expenses'));
    if (target) target.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('3. Inspecting inputs on page...');
  const inputsInfo = await page.evaluate(() => {
    const inps = Array.from(document.querySelectorAll('input'));
    return inps.map(i => ({ placeholder: i.getAttribute('placeholder'), type: i.getAttribute('type'), value: i.value }));
  });

  console.log('Inputs info:', JSON.stringify(inputsInfo, null, 2));

  await browser.close();
})();
