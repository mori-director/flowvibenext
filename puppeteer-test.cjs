const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

        console.log("Navigating...");
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

        console.log("Filling form...");
        await page.type('input[name="serviceName"]', 'test service');
        await page.type('input[name="flowName"]', 'test flow');
        await page.type('textarea[name="flowDesc"]', 'A login flow');

        console.log("Clicking analyze...");
        const analyzeBtn = await page.$x("//button[contains(text(), '바이브코딩 분석 시작')]");
        if (analyzeBtn.length > 0) {
            await analyzeBtn[0].click();
        } else {
            console.log("Analyze button not found!");
        }

        console.log("Waiting for step 2...");
        await page.waitForXPath("//h2[contains(., '분석 및 구조화 완료')]", { timeout: 30000 });

        console.log("Clicking next step...");
        const nextBtn = await page.$x("//button[contains(text(), '최종 시각화 보기')]");
        if (nextBtn.length > 0) {
            await nextBtn[0].click();
        } else {
            console.log("Next step button not found!");
        }

        console.log("Waiting for step 3...");
        await page.waitForTimeout(2000);

        const edgePaths = await page.$$eval('.react-flow__edge', svgs => svgs.map(s => s.outerHTML));
        console.log("EDGES FOUND: ", edgePaths.length);

        // Fetch flowState
        const flowState = await page.evaluate(() => window.__flowState);
        console.log("FLOW STATE:", JSON.stringify(flowState, null, 2));

        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
