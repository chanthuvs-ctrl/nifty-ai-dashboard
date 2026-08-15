const http = require('http');

console.log("🔍 Running verification tests for De Natura Aesthetics Google Ads Automation...");

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3005,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  try {
    // 1. Analytics test in INR
    console.log("Testing GET /api/analytics...");
    const analytics = await makeRequest('/api/analytics');
    console.log(`✅ Analytics Status: ${analytics.status}, Total Spend: ₹${analytics.data.analytics.summary.totalSpend.toLocaleString('en-IN')}, Clinic Revenue: ₹${analytics.data.analytics.summary.totalRevenue.toLocaleString('en-IN')}, ROAS: ${analytics.data.analytics.summary.roas}x`);

    // 2. Record In-Clinic Payment Test
    console.log("Testing POST /api/clinic/payments...");
    const payRes = await makeRequest('/api/clinic/payments', 'POST', {
      patientName: "Meera Reddy",
      treatment: "Glutathione Radiance 4-Dose Package",
      amount: 15000,
      paymentDate: "2026-08-12",
      campaignId: "cmp-102"
    });
    console.log(`✅ Clinic Payment Status: ${payRes.status}, Patient: ${payRes.data.payment.patientName}, Amount: ₹${payRes.data.payment.amount}`);

    // 3. AI Copy Generator Test for Cosmetic Clinic
    console.log("Testing POST /api/ai/generate-ad-copy...");
    const copyRes = await makeRequest('/api/ai/generate-ad-copy', 'POST', {
      prompt: "De Natura Aesthetics Cosmetic Clinic",
      businessType: "SEARCH"
    });
    console.log(`✅ AI Copy Status: ${copyRes.status}, Headlines Count: ${copyRes.data.adCopy.headlines.length}, Locations: ${copyRes.data.adCopy.targetLocations.join(', ')}`);

    // 4. Rule Execution Test
    console.log("Testing POST /api/rules/evaluate...");
    const evalRes = await makeRequest('/api/rules/evaluate', 'POST');
    console.log(`✅ Rule Evaluation Status: ${evalRes.status}, Actions Executed: ${evalRes.data.result.actionsExecuted}`);

    console.log("🎉 All De Natura Aesthetics backend verification tests completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

runTests();
