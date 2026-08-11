const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100 });

  // 1. Log in as Admin
  console.log('1. Logging in as Admin...');
  await page.goto('http://localhost:8000/login');
  await page.type('input[placeholder*="Username"]', 'chanthuvs@gmail.com');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 1000));

  // 2. Open Payslip Generator in Admin
  console.log('2. Opening Payslip Generator in Admin...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent.includes('Payslip Generator'));
    if (target) target.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 3. Click Save & Generate
  console.log('3. Clicking Save & Generate Payslip...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const genBtn = btns.find(b => b.textContent.includes('Save & Generate'));
    if (genBtn) genBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 4. Sign Out
  console.log('4. Signing out...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const outBtn = btns.find(b => b.textContent.includes('Sign Out'));
    if (outBtn) outBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 5. Log in as Staff (Aparnendhu)
  console.log('5. Logging in as Staff (lavenderladyh@gmail.com)...');
  await page.goto('http://localhost:8000/login');
  await page.type('input[placeholder*="Username"]', 'lavenderladyh@gmail.com');
  await page.type('input[type="password"]', 'staff123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 1000));

  // 6. Open My Payslips & PDFs
  console.log('6. Opening My Payslips & PDFs...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const payslipTab = btns.find(b => b.textContent.includes('My Payslips & PDFs'));
    if (payslipTab) payslipTab.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 7. Capture screenshot
  await page.screenshot({ path: '/tmp/generated_payslip_reflected.png' });
  console.log('Captured screenshot of reflected generated payslip!');

  await browser.close();
})();