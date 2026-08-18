import { expect, test } from "@playwright/test";

async function dismissFirstVisitOnboarding(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: "지금 가장 필요한 분야는?" });
  try {
    await dialog.waitFor({ state: "visible", timeout: 4_000 });
    await dialog.getByRole("button", { name: "나중에" }).click();
  } catch {
    // Existing preferences or browser state can make the first-visit dialog unnecessary.
  }
}

async function enterHomeAsGuest(page: import("@playwright/test").Page) {
  await page.goto("/");
  if (new URL(page.url()).pathname === "/login") {
    await page.getByRole("button", { name: "로그인 없이 둘러보기" }).click();
  }
  await expect(page).toHaveURL(/\/$/);
}

test("first home entry starts with account access and keeps a guest choice", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2F/);
  await expect(page.getByRole("heading", { level: 1, name: "학습 흐름을 이어가세요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인이나 계정에 문제가 있나요?" })).toHaveAttribute("href", "/support");
  await page.getByRole("button", { name: "로그인 없이 둘러보기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /사회초년생을 위한/ })).toBeVisible();
});

test("global navigation adapts from sidebar to the compact mobile menu", async ({ page }) => {
  await enterHomeAsGuest(page);
  await dismissFirstVisitOnboarding(page);

  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const sidebar = page.locator(".site-sidebar");
  const mobileHeader = page.locator(".mobile-header");

  if (viewportWidth > 900) {
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "5분 학습 시작" })).toBeVisible();
    await expect(mobileHeader).toBeHidden();
  } else {
    await expect(sidebar).toBeHidden();
    await expect(mobileHeader).toBeVisible();
    await page.getByRole("button", { name: "전체 메뉴 열기" }).click();
    await expect(page.getByRole("dialog", { name: "전체 메뉴" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("link", { name: /시작 코스/ })).toBeVisible();
    await page.getByRole("button", { name: "전체 메뉴 닫기" }).click();
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("light and dark modes can be selected and persist after reload", async ({ page }) => {
  await enterHomeAsGuest(page);
  await dismissFirstVisitOnboarding(page);

  const lightMode = page.getByRole("button", { name: "라이트 모드" });
  const darkMode = page.getByRole("button", { name: "다크 모드" });
  await expect(lightMode).toBeVisible();
  await expect(darkMode).toBeVisible();
  await expect(lightMode).toHaveAttribute("aria-pressed", "true");

  await darkMode.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(darkMode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(15, 20, 18)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(darkMode).toHaveAttribute("aria-pressed", "true");

  await lightMode.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(lightMode).toHaveAttribute("aria-pressed", "true");
});

test("home feed renders without horizontal overflow", async ({ page }) => {
  await enterHomeAsGuest(page);
  await dismissFirstVisitOnboarding(page);

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
  const learningCards = page.locator(".comic-panel, .card-news");
  await expect(learningCards).toHaveCount(4);

  const cardContents = (await learningCards.allTextContents()).map((content) =>
    content.replace(/\s+/g, " ").trim(),
  );
  expect(new Set(cardContents).size).toBe(4);

  await expect(page.locator(".action-takeaway")).toHaveCount(0);
  const source = page.locator(".source-note a[target='_blank']");
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("href", /^https:\/\//);

  const next = page.getByRole("button", { name: "다음 카드" });
  if (await next.isVisible()) {
    const current = page.locator("#current-slide");
    const seen = new Set<string>();
    for (let step = 0; step < 5; step += 1) {
      const before = (await current.textContent())?.trim() ?? "";
      seen.add(before);
      if (!(await next.isEnabled())) break;
      await next.click();
      await expect(current).not.toHaveText(before);
    }
    const finalRange = (await current.textContent())?.trim() ?? "";
    seen.add(finalRange);
    expect(finalRange.endsWith("4")).toBe(true);
    expect(seen.size).toBe(page.viewportSize()!.width > 760 ? 3 : 4);
    await expect(next).toBeDisabled();
    if (page.viewportSize()!.width > 760) await expect(page.locator("#carousel-end")).toBeVisible();
    await expect(page.locator("#slide-dots .slide-dot")).toHaveCount(page.viewportSize()!.width > 760 ? 3 : 4);
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

test("knowledge map scales recurring keywords and opens their content list", async ({ page }) => {
  await page.goto("/topics");

  await expect(page.getByRole("heading", { level: 1, name: "누적 지식 한눈에 보기" })).toBeVisible();
  const keywordLinks = page.locator(".keyword-link");
  expect(await keywordLinks.count()).toBeGreaterThan(12);

  const fontSizes = await keywordLinks.evaluateAll((links) =>
    links.map((link) => Number.parseFloat(getComputedStyle(link).fontSize)),
  );
  expect(Math.max(...fontSizes) - Math.min(...fontSizes)).toBeGreaterThan(4);

  const firstKeyword = (await keywordLinks.first().locator("span").textContent())?.trim() ?? "";
  const firstMapCount = Number.parseInt((await keywordLinks.first().locator("small").textContent())?.trim() ?? "", 10);
  expect(firstMapCount).toBeGreaterThan(0);
  await page.getByRole("searchbox", { name: "지도에서 단어 찾기" }).fill(firstKeyword.slice(0, 2));
  await expect(keywordLinks.first()).toBeVisible();
  await keywordLinks.first().click();

  await expect(page).toHaveURL(/\/topics\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(firstKeyword);
  await expect(page.locator(".result-total strong")).toHaveText(String(firstMapCount));
  await expect(page.locator(".result-card").first()).toBeVisible();

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

test("first visit interests create a personalized daily learning entry", async ({ page }) => {
  await enterHomeAsGuest(page);

  const dialog = page.getByRole("dialog", { name: "지금 가장 필요한 분야는?" });
  await expect(dialog).toBeVisible();
  await dialog.locator('label:has(input[value="finance"])').click();
  await dialog.locator('label:has(input[value="health"])').click();
  await expect(dialog.locator("#onboarding-count")).toHaveText("2");
  await dialog.getByRole("button", { name: "내 5분 학습 만들기" }).click();

  await expect(page).toHaveURL(/\/daily\/?\?from=onboarding/);
  await expect(page.locator(".daily-card")).toBeVisible();
});

test("daily five creates a stable session and saves progress", async ({ page }) => {
  await page.goto("/daily");

  await expect(page.getByRole("heading", { level: 1, name: "오늘의 5분 학습" })).toBeVisible();
  await expect(page.locator(".daily-card")).toBeVisible();
  await expect(page.locator(".daily-steps li")).toHaveCount(5);
  await expect(page.locator("#daily-total")).toHaveText("5");

  await page.locator(".daily-choice").first().click();
  await expect(page.locator(".daily-answer")).toBeVisible();
  await expect(page.locator("#daily-completed")).toHaveText("1");

  await page.reload();
  await expect(page.locator("#daily-completed")).toHaveText("1");
  await expect(page.locator(".daily-card-position")).toContainText("/ 5");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("learning profile saves interests and bookmarked knowledge", async ({ page }) => {
  await page.goto("/archive");
  await page.locator(".archive-card").first().click();
  const articleTitle = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";

  const saveButton = page.getByRole("button", { name: "상식 저장하기" });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(page.getByRole("button", { name: "저장한 상식 보기" })).toBeEnabled();

  await page.goto("/me");
  await expect(page.getByRole("heading", { level: 1, name: "내 학습" })).toBeVisible();
  await expect(page.locator("#profile-content")).toBeVisible();
  await expect(page.locator("#saved-list")).toContainText(articleTitle);
  const activityDates = await page.locator("#activity-grid strong").allTextContents();
  expect(activityDates).toHaveLength(7);
  expect(activityDates.every((label) => /^\d{1,2}\.\d{1,2}\.$/.test(label))).toBe(true);
  expect(await page.locator("#activity-grid strong").first().evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");

  await page.locator('label:has(input[value="finance"])').click();
  await page.locator('label:has(input[value="health"])').click();
  await page.getByRole("button", { name: "관심 분야 저장" }).click();
  await expect(page.locator("#preference-status")).toContainText("다음에 만드는 5분 학습부터 반영");

  await page.reload();
  await expect(page.locator("#profile-content")).toBeVisible();
  await expect(page.getByLabel("금융", { exact: true })).toBeChecked();
  await expect(page.getByLabel("건강·마음", { exact: true })).toBeChecked();
});

test("optional account links anonymous learning data and restores it after sign-in", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/me");
  const anonymousUserId = `anon:${await page.evaluate(() => crypto.randomUUID())}`;
  await page.evaluate((userId) => localStorage.setItem("life-quiz-anonymous-user", userId), anonymousUserId);
  const preferenceResponse = await page.evaluate(async (userId) => {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, categories: ["finance", "health"] }),
    });
    return response.status;
  }, anonymousUserId);
  expect(preferenceResponse).toBe(200);

  const unique = `${testInfo.project.name}-${Date.now()}`;
  const email = `life-quiz-${unique}@example.com`;
  const password = `LifeQuiz!${unique}`;
  await page.goto("/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("tab", { name: "계정 만들기" }).click();
  const signup = page.locator("#signup-form");
  await signup.getByLabel("이름").fill("동기화 테스트");
  await signup.getByLabel("이메일").fill(email);
  await signup.getByLabel("비밀번호").fill(password);
  await signup.getByRole("checkbox").check();
  await signup.getByRole("button", { name: "계정 만들기" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: /동기화 테스트님의 계정/ })).toBeVisible();
  await expect(page.locator("#sync-status")).toContainText(/최신 상태|계정에 연결/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.goto("/me");
  await expect(page.getByLabel("금융", { exact: true })).toBeChecked();
  await expect(page.getByLabel("건강·마음", { exact: true })).toBeChecked();

  await page.goto("/account");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const signin = page.locator("#signin-form");
  await signin.getByLabel("이메일").fill(email);
  await signin.getByLabel("비밀번호").fill(password);
  await signin.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email).first()).toBeVisible();

  const changedPassword = `Changed!${unique}`;
  const passwordForm = page.locator("#change-password-form");
  await passwordForm.getByLabel("현재 비밀번호").fill(password);
  await passwordForm.getByLabel("새 비밀번호").fill(changedPassword);
  await passwordForm.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(passwordForm.locator("[data-change-status]")).toContainText("비밀번호를 변경했습니다");

  await page.getByRole("button", { name: "로그아웃" }).click();
  await signin.getByLabel("이메일").fill(email);
  await signin.getByLabel("비밀번호").fill(changedPassword);
  await signin.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/account$/);

  const deleteForm = page.locator("#delete-account-form");
  await deleteForm.getByLabel("현재 비밀번호").fill(changedPassword);
  await deleteForm.getByLabel(/확인을 위해/).fill("삭제");
  await deleteForm.getByRole("button", { name: "계정 영구 삭제" }).click();
  await expect(page).toHaveURL(/\/login\?accountDeleted=1$/);
  await expect(page.getByText("계정과 학습 기록을 삭제했습니다.")).toBeVisible();
});

test("password recovery is explicit while the outbound email domain is not configured", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { level: 1, name: "비밀번호를 다시 설정하세요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "재설정 링크 받기" })).toBeDisabled();
  await expect(page.getByText(/발신 도메인 연결을 준비 중/)).toBeVisible();

  await page.goto("/reset-password");
  await expect(page.getByText("재설정 링크가 없거나 만료되었습니다.")).toBeVisible();
});

test("private support form submits without exposing account details publicly", async ({ page }, testInfo) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { level: 1, name: "문의·피드백" })).toBeVisible();
  await expect(page.getByText("관리자만 열람")).toBeVisible();
  await page.getByLabel("이름").fill("문의 테스트");
  await page.getByLabel("답변받을 이메일").fill(`support-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("문의 유형").selectOption("service_bug");
  await page.getByLabel("제목").fill("Quick Read 이동 상태 문의");
  await page.getByLabel("문의 내용").fill("마지막 카드에서 다음 버튼 상태가 명확한지 확인하기 위한 테스트 문의입니다.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "문의 보내기" }).click();
  await expect(page.getByRole("heading", { name: "문의가 안전하게 접수됐어요" })).toBeVisible();
  await expect(page.locator("#ticket-code")).toHaveText(/^LQ-\d{6}$/);
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

test("article feedback records a helpful response", async ({ page }) => {
  await page.goto("/archive");
  await page.locator(".archive-card").first().click();

  const helpful = page.getByRole("button", { name: "도움됐어요" });
  await expect(helpful).toBeEnabled();
  await helpful.click();
  await expect(helpful).toBeDisabled();
  await expect(page.locator("#feedback-status")).toContainText("고마워요");
});

test("operations dashboard requires a session and renders AI and collector health", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login\?returnTo=/);
  await expect(page.getByRole("heading", { level: 1, name: "운영 품질 대시보드" })).toBeVisible();
  await page.getByLabel("운영 토큰").fill("playwright-admin-token");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "품질 검증 대시보드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "방문에서 학습 완료까지" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 예산과 수집원 안정성" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "문의함" })).toBeVisible();
  await expect(page.getByText("Gemini 일일 요청 예산")).toBeVisible();
  await expect(page.getByRole("heading", { name: /최근 7일 수집원 건강 상태/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "지금 수집·검증" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
