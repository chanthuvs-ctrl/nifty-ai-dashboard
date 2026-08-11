
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  console.log('Navigating to login...');
  await page.goto('http://localhost:8000/login');

  console.log('Logging in as lavenderladyh@gmail.com...');
  await page.type('input[placeholder*="Username"]', 'lavenderladyh@gmail.com');
  await page.type('input[type="password"]', 'staff123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  console.log('Current URL:', page.url());

  console.log('Clicking My Payslips & PDFs tab...');
  const buttons = await page.48434('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('My Payslips & PDFs')) {
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/tmp/aparnendhu_payslip_verified.png' });
  console.log('Captured Aparnendhu payslip verification screenshot!');

  await browser.close();
})();
