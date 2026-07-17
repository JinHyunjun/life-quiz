import { expect, test } from "@playwright/test";

test("home feed renders without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /사회초년생을 위한/ })).toBeVisible();
  await expect(page.locator(".topic-link").filter({ hasText: "주식·투자" })).toBeVisible();
  await expect(page.locator(".featured-story, .empty-state")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("article carousel and source area are usable", async ({ page }) => {
  await page.goto("/archive");
  await page.locator(".archive-card").first().click();

  await expect(page).toHaveURL(/\/articles\/\d+/);
  await expect(page.locator(".article-header h1")).toBeVisible();
  await expect(page.locator(".article-body")).toBeVisible();
  await expect(page.locator(".deep-read-section").first()).toBeVisible();
  await expect(page.locator(".action-takeaway")).toBeVisible();
  const source = page.locator(".source-note a[target='_blank']");
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("href", /^https:\/\//);

  const next = page.getByRole("button", { name: "다음 카드" });
  if (await next.isVisible()) {
    await next.click();
    await expect(page.locator("#current-slide")).toHaveText("2");
  }
});

test("archive separates older content by date and filters", async ({ page }) => {
  await page.goto("/archive");

  await expect(page.getByRole("heading", { level: 1, name: "지난 상식 보관함" })).toBeVisible();
  await expect(page.locator(".archive-card").first()).toBeVisible();
  await expect(page.getByText("보관된 상식")).toBeVisible();

  const dateList = page.locator(".date-filter-list");
  await expect(dateList).toHaveCSS("overflow-y", "auto");
  const datedTab = dateList.locator(".filter-row").nth(1);
  await expect(datedTab).toBeVisible();
  await datedTab.click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
  await expect(page.locator(".archive-card").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("review queue only includes content explicitly added by this browser", async ({ page }) => {
  await page.goto("/review");

  await expect(page.locator(".empty-review")).toBeVisible();
  await page.goto("/archive");
  await page.locator(".archive-card").first().click();
  const learningButton = page.locator("#learning-button");
  await expect(learningButton).toBeEnabled();
  await learningButton.click();
  await expect(page.locator("#learning-status")).not.toBeEmpty();
  await page.goto("/review");

  const choice = page.locator(".choice").first();
  await expect(choice).toBeVisible();
  await choice.click();
  await expect(page.locator(".answer-feedback")).toBeVisible();
  await expect(page.locator(".feedback-explanation")).toBeVisible();
});

test("starter courses organize foundational visual guides", async ({ page }) => {
  await page.goto("/start");

  await expect(page.getByRole("heading", { level: 1, name: /이 순서로 시작해요/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "월급을 지키는 금융 기초" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "계약 전에 배우는 집 기초" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "잃지 않기 위해 배우는 투자 기초" })).toBeVisible();
  await expect(page.locator(".lesson-grid a, .course-empty").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("chat UI renders grounded answers and source links", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-ratelimit-remaining": "7" },
      body: JSON.stringify({
        answer: "선택한 콘텐츠를 기준으로 핵심을 정리했어요.",
        suggestions: ["한 문장으로 줄여줘", "실생활 예시를 알려줘"],
        sources: [{ id: 1, title: "테스트 상식", citationLabel: "공식 출처", citationUrl: null }],
      }),
    });
  });

  await page.goto("/chat");
  await page.getByLabel("라이프 메이트에게 질문").fill("핵심을 알려줘");
  await page.getByRole("button", { name: "질문 보내기" }).click();

  await expect(page.getByText("선택한 콘텐츠를 기준으로 핵심을 정리했어요.")).toBeVisible();
  await expect(page.getByText("이번 시간 7회 남음")).toBeVisible();
  await expect(page.getByRole("link", { name: "출처 · 공식 출처" })).toBeVisible();
});

test("release notes render the Notion-managed timeline", async ({ page }) => {
  await page.goto("/changelog");

  await expect(page.getByRole("heading", { level: 1, name: "릴리즈 노트" })).toBeVisible();
  await expect(page.locator(".release-item").first()).toContainText(/v0\.\d+/);
  await expect(page.locator(".change-list").first().locator("li").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("operations dashboard requires an administrator session", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login\?returnTo=/);
  await expect(page.getByRole("heading", { level: 1, name: "운영 품질 대시보드" })).toBeVisible();
  await expect(page.getByLabel("운영 토큰")).toBeVisible();
});
