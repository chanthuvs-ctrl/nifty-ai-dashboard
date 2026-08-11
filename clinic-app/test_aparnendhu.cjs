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

  await new Promise(r => setTimeout(r, 1000));
  console.log('Current URL:', page.url());

  const buttons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent.includes('My Payslips & PDFs'));
    if (target) { target.click(); return true; }
    return false;
  });

  console.log('Clicked Payslips tab:', buttons);

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/tmp/aparnendhu_payslip_verified.png' });
  console.log('Captured Aparnendhu payslip verification screenshot!');

  await browser.close();
})();