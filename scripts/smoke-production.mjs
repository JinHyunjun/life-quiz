import assert from "node:assert/strict";

const baseUrl = process.env.LIFE_QUIZ_BASE_URL ?? "https://life-quiz.life-quiz.workers.dev";

const root = await fetch(`${baseUrl}/`, { redirect: "manual" });
assert.equal(root.status, 302, "첫 비로그인 접속은 로그인 화면으로 이동해야 합니다.");
assert.match(root.headers.get("location") ?? "", /^\/login/);

await expectPage("/login", ["학습 흐름을 이어가세요", "로그인 없이 둘러보기"]);
await expectPage("/support", ["문의", "피드백"]);
await expectPage("/changelog", ["릴리즈 노트"]);

const guest = await fetch(`${baseUrl}/api/access/guest`, {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    origin: baseUrl,
    referer: `${baseUrl}/login`,
  },
  body: new URLSearchParams({ returnTo: "/" }),
  redirect: "manual",
});
assert.ok([302, 303].includes(guest.status), "게스트 접근 쿠키를 발급해야 합니다.");
const cookie = (guest.headers.get("set-cookie") ?? "").split(";")[0];
assert.ok(cookie.includes("="), "게스트 접근 쿠키가 없습니다.");

const home = await fetch(`${baseUrl}/`, { headers: { cookie } });
assert.equal(home.status, 200, "게스트 홈을 열 수 있어야 합니다.");
assert.match(await home.text(), /라이프퀴즈|오늘의/);

console.log(`Production smoke passed: ${baseUrl}`);

async function expectPage(path, expectedText) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200, `${path} 응답이 정상이 아닙니다.`);
  const html = await response.text();
  for (const text of expectedText) assert.ok(html.includes(text), `${path}에서 '${text}'를 찾지 못했습니다.`);
}
