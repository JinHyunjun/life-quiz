from __future__ import annotations

from pathlib import Path

import fitz
from PIL import Image
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
ASSET_DIR = ROOT / "docs" / "portfolio" / "assets"
PORTFOLIO_PDF = OUTPUT_DIR / "Life_Quiz_PM_Portfolio_2026-08.pdf"
DECISION_PDF = OUTPUT_DIR / "Life_Quiz_Decision_Map_2026-08.pdf"

W, H = landscape(A4)

BG = HexColor("#F4F7F3")
WHITE = HexColor("#FFFFFF")
INK = HexColor("#10251E")
GREEN = HexColor("#176B4B")
MINT = HexColor("#DDEFE6")
PALE = HexColor("#E9F0EC")
LINE = HexColor("#D7E0DB")
GRAY = HexColor("#66766F")
LIGHT_GRAY = HexColor("#EEF2EF")
CORAL = HexColor("#EC6A5E")
PINK = HexColor("#A13D72")
BLUE = HexColor("#3569A8")
GOLD = HexColor("#B58416")
RED = HexColor("#B94A48")

FONT_REGULAR = "LifeQuiz"
FONT_BOLD = "LifeQuizBold"


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, r"C:\Windows\Fonts\malgun.ttf"))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\malgunbd.ttf"))


def text_width(text: str, size: float, font: str = FONT_REGULAR) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap_text(text: str, width: float, size: float, font: str = FONT_REGULAR) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for char in paragraph:
            candidate = current + char
            if current and text_width(candidate, size, font) > width:
                lines.append(current.rstrip())
                current = char.lstrip()
            else:
                current = candidate
        if current:
            lines.append(current.rstrip())
    return lines


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    size: float = 10,
    color=INK,
    font: str = FONT_REGULAR,
    leading: float | None = None,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.45
    lines = wrap_text(text, width, size, font)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    cursor = y
    for line in lines:
        c.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def draw_bullet_list(
    c: canvas.Canvas,
    items: list[str],
    x: float,
    y: float,
    width: float,
    size: float = 9.2,
    color=INK,
    bullet_color=GREEN,
    gap: float = 7,
) -> float:
    cursor = y
    for item in items:
        c.setFillColor(bullet_color)
        c.circle(x + 3, cursor + 2.5, 2.2, fill=1, stroke=0)
        lines = wrap_text(item, width - 16, size)
        c.setFont(FONT_REGULAR, size)
        c.setFillColor(color)
        line_cursor = cursor
        for line in lines:
            c.drawString(x + 14, line_cursor, line)
            line_cursor -= size * 1.42
        cursor = line_cursor - gap
    return cursor


def rounded_panel(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill=WHITE, stroke=LINE, radius: float = 8) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def section_label(c: canvas.Canvas, text: str, x: float, y: float, color=GREEN) -> None:
    c.setFillColor(color)
    c.setFont(FONT_BOLD, 8.2)
    c.drawString(x, y, text.upper())


def title(c: canvas.Canvas, text: str, y: float, subtitle: str | None = None) -> float:
    section_label(c, "LIFE QUIZ - PM CASE STUDY", 42, y + 24)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 25)
    c.drawString(42, y, text)
    cursor = y - 24
    if subtitle:
        cursor = draw_text(c, subtitle, 42, cursor, W - 84, 10.5, GRAY, leading=15)
    return cursor


def footer(c: canvas.Canvas, page_no: int, section: str) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(42, 28, W - 42, 28)
    c.setFillColor(GRAY)
    c.setFont(FONT_REGULAR, 7.5)
    c.drawString(42, 16, f"Life Quiz PM Portfolio - 2026.08.01 - {section}")
    c.drawRightString(W - 42, 16, str(page_no))


def metric(c: canvas.Canvas, x: float, y: float, value: str, label: str, color=GREEN, note: str | None = None) -> None:
    c.setFillColor(color)
    c.setFont(FONT_BOLD, 22)
    c.drawString(x, y, value)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 8.6)
    c.drawString(x, y - 17, label)
    if note:
        c.setFillColor(GRAY)
        c.setFont(FONT_REGULAR, 7.2)
        c.drawString(x, y - 30, note)


def draw_image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    with Image.open(path) as image:
        iw, ih = image.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, w, h)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(str(path), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def page_background(c: canvas.Canvas, color=BG) -> None:
    c.setFillColor(color)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def draw_cover(c: canvas.Canvas) -> None:
    page_background(c, WHITE)
    home = ASSET_DIR / "home-cover.jpg"
    draw_image_cover(c, home, W * 0.50, 0, W * 0.50, H)
    c.setFillColor(WHITE)
    c.setFillAlpha(0.92)
    c.rect(W * 0.47, 0, 48, H, fill=1, stroke=0)
    c.setFillAlpha(1)

    section_label(c, "PRODUCT MANAGER CASE STUDY", 54, H - 66)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 42)
    c.drawString(54, H - 126, "Life Quiz")
    draw_text(c, "읽은 정보를 실제 판단 순간에\n떠올리게 만드는 생활상식 학습", 54, H - 166, 345, 18, INK, FONT_BOLD, 27)
    draw_text(c, "출처 기반 큐레이션, 5분 학습, FSRS 복습,\n근거형 AI를 무료 운영 제약 안에서 설계했습니다.", 54, H - 245, 340, 10.5, GRAY, leading=17)

    c.setFillColor(GREEN)
    c.roundRect(54, 164, 328, 62, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 12)
    c.drawString(72, 199, "기능보다 먼저 정한 네 가지 기준")
    c.setFont(FONT_REGULAR, 9)
    c.drawString(72, 180, "출처 - 기억 - 배치 AI - 무료 운영")

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 10)
    c.drawString(54, 112, "Jin Hyunjun")
    c.setFont(FONT_REGULAR, 8.5)
    c.setFillColor(GRAY)
    c.drawString(54, 95, "제품 기획 / 정보구조 / AI 품질 / 운영 QA")
    c.drawString(54, 79, "2026.06.26 - 진행 중 | Snapshot 2026.08.01")
    c.setStrokeColor(GREEN)
    c.setLineWidth(2)
    c.line(54, 54, 382, 54)
    c.showPage()


def draw_overview(c: canvas.Canvas) -> None:
    page_background(c)
    title(c, "30초 안에 보는 Life Quiz", H - 70, "서비스 설명보다 문제, 판단, 근거, 남은 검증을 먼저 보여줍니다.")

    col_w = 228
    xs = [42, 306, 570]
    labels = [("PROBLEM", CORAL), ("DECISION", GREEN), ("VALUE", BLUE)]
    headings = ["정보는 찾지만\n기억으로 남지 않는다", "출처 확인과 복습을\n하나의 흐름으로 묶는다", "기획 판단을 실제\n운영 데이터로 검증한다"]
    bodies = [
        "사회초년생에게 돈, 집, 직장, 권리 정보는 흩어져 있고 용어가 어렵다. 한 번 읽은 정보도 판단 순간에는 떠오르지 않는다.",
        "원문 링크가 있는 Quick/Deep Read, 상황형 퀴즈, FSRS 복습을 연결하고 AI는 검증된 원천 안에서만 사용한다.",
        "무료 티어 예산, 수집 로그, 품질 대시보드, 사용자 피드백을 제품 정책으로 설계해 출시 후에도 원인을 추적한다.",
    ]
    for x, (label, accent), heading, body in zip(xs, labels, headings, bodies):
        section_label(c, label, x, H - 145, accent)
        draw_text(c, heading, x, H - 174, col_w, 15, INK, FONT_BOLD, 21)
        draw_text(c, body, x, H - 231, col_w, 9.2, GRAY, leading=14)

    c.setStrokeColor(LINE)
    c.line(42, 288, W - 42, 288)
    metric(c, 54, 246, "617", "공개 콘텐츠", GREEN, "원격 D1")
    metric(c, 214, 246, "12", "생활 분야", PINK, "4개 지식 묶음")
    metric(c, 364, 246, "17", "릴리즈", CORAL, "v0.1 - v0.17")
    metric(c, 510, 246, "32+22", "로직 + E2E", BLUE, "desktop / mobile")
    metric(c, 696, 246, "4회", "일일 수집", GOLD, "Cron 1개")

    rounded_panel(c, 42, 58, W - 84, 112, fill=WHITE)
    section_label(c, "CANDID STATUS", 60, 144, RED)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 13)
    c.drawString(60, 119, "구현 결과는 확인했지만 사용자 성과와 일일 다양성은 아직 검증 중입니다.")
    draw_text(c, "익명 식별자 3개·일일 세션 2개·복습 1건이라 리텐션 개선을 주장하지 않습니다. 8월 1일 오늘 피드도 9건·3/12개 분야에 그쳐, 자동 복구 기능 출시와 목표 달성을 분리해 보고합니다.", 60, 94, W - 120, 9.3, GRAY, leading=14)
    footer(c, 2, "Overview")
    c.showPage()


def draw_problem(c: canvas.Canvas) -> None:
    page_background(c)
    title(c, "처음부터 기능 목록보다 판단 기준을 정했다", H - 70, "초기 문제는 사용자 인터뷰로 확정한 사실이 아니라, 검증해야 할 제품 가설로 두었습니다.")

    rounded_panel(c, 42, 286, 320, 190, fill=INK, stroke=INK)
    section_label(c, "PROBLEM STATEMENT", 62, 448, MINT)
    draw_text(c, "사회초년생은 생활 의사결정에 필요한 정보를 찾더라도, 출처를 신뢰하고 자신의 말로 이해한 뒤 필요한 순간에 다시 떠올리기 어렵다.", 62, 414, 280, 15, WHITE, FONT_BOLD, 23)
    draw_text(c, "검증 상태: 타깃 사용자의 일반적인 어려움과 기획자의 관찰에서 출발. 정식 인터뷰와 행동 데이터는 다음 단계.", 62, 323, 280, 8.5, HexColor("#C6D5CF"), leading=13)

    decisions = [
        ("출처", "원문 재배포 대신 재구성 + SOURCE", GREEN),
        ("기억", "조회보다 퀴즈와 다음 복습일", PINK),
        ("AI", "실시간 자유 생성보다 배치 편집", BLUE),
        ("비용", "트래픽과 생성 비용을 분리", GOLD),
    ]
    x0, y0 = 396, 432
    for idx, (key, value, accent) in enumerate(decisions):
        y = y0 - idx * 55
        c.setFillColor(accent)
        c.roundRect(x0, y - 6, 58, 30, 5, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 9.2)
        c.drawCentredString(x0 + 29, y + 4, key)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 11)
        c.drawString(x0 + 76, y + 4, value)
        c.setStrokeColor(LINE)
        c.line(x0 + 76, y - 12, W - 48, y - 12)

    section_label(c, "PRIORITY", 42, 244)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 14)
    c.drawString(42, 220, "P0는 신뢰와 기억, P1은 편의, P2는 계정화")
    draw_bullet_list(c, [
        "P0 - 출처 링크, 검수 상태, 중복 차단, 카드·본문·퀴즈, FSRS",
        "P1 - 5분 학습, 관심 분야, 저장, 학습 리포트, 근거형 챗",
        "P2 - 정식 로그인, 기기 간 동기화, 지역 개인화",
    ], 42, 194, 355, size=9.2)

    section_label(c, "DEFERRED ON PURPOSE", 444, 244, CORAL)
    draw_bullet_list(c, [
        "사용자 요청 시 실시간 콘텐츠 생성",
        "종목 추천과 개인화 투자 조언",
        "AI 이미지 생성과 독립 Cron 추가",
        "채택 신호보다 앞선 인증 복잡도",
    ], 444, 220, 340, size=9.2, bullet_color=CORAL)
    footer(c, 3, "Problem and priorities")
    c.showPage()


def draw_learning_case(c: canvas.Canvas) -> None:
    page_background(c, WHITE)
    title(c, "Case 1. 읽기 피드를 5분 학습으로 바꿨다", H - 70, "사용자가 직접 담은 카드만 복습하고, 매일 새 지식과 FSRS 복습을 다섯 문제로 섞었습니다.")

    daily = ASSET_DIR / "daily.png"
    rounded_panel(c, 42, 74, 430, 390, fill=LIGHT_GRAY)
    draw_image_cover(c, daily, 51, 83, 412, 372)

    x = 504
    section_label(c, "HYPOTHESIS", x, 450, PINK)
    draw_text(c, "복습 최대 2장 + 서로 다른 분야의 새 상식으로 5개를 만들면 부담을 낮추면서 회상 행동을 만들 수 있다.", x, 423, 290, 11.2, INK, FONT_BOLD, 17)

    section_label(c, "CORE PRD", x, 338)
    draw_bullet_list(c, [
        "날짜·브라우저별 세션과 순서를 고정",
        "복습 최대 2개, 전체 5개, 분야 중복 최소화",
        "Again/Hard/Good/Easy를 FSRS에 전달",
    ], x, 314, 290, size=8.9)

    section_label(c, "TRADE-OFF", x, 206, CORAL)
    draw_text(c, "정식 로그인보다 익명 흐름을 먼저 출시했습니다. 채택 신호가 없는 상태에서 계정 귀속을 먼저 만들면 범위만 커질 수 있기 때문입니다.", x, 182, 290, 8.8, GRAY, leading=13)

    c.setFillColor(MINT)
    c.roundRect(x, 76, 290, 64, 7, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont(FONT_BOLD, 9)
    c.drawString(x + 15, 119, "현재 결론")
    draw_text(c, "기능은 E2E로 검증했지만 완료율과 기억 효과는 사용자 표본 부족으로 미검증입니다.", x + 15, 99, 260, 8.5, INK, leading=12)
    footer(c, 4, "Learning experience")
    c.showPage()


def draw_architecture_case(c: canvas.Canvas) -> None:
    page_background(c)
    title(c, "Case 2. 무료 운영 제약을 제품 정책으로 만들었다", H - 70, "기술 선택의 목적은 스택을 늘리는 것이 아니라 키 노출, 호출 비용, 운영 지점을 줄이는 것이었습니다.")

    y = 395
    nodes = [
        (54, 190, "사용자 브라우저", "탐색 · 5분 학습 · 복습", BLUE),
        (270, 210, "life-quiz Worker", "Astro 화면 · API · Static Assets", GREEN),
        (506, 138, "Cloudflare D1", "콘텐츠 · 퀴즈 · 학습 · 로그", GOLD),
        (670, 130, "ingest Worker", "Hono · Cron · Gemini", PINK),
    ]
    c.setStrokeColor(HexColor("#91A79C"))
    c.setLineWidth(2)
    for x1, x2 in [(244, 270), (480, 506), (644, 670)]:
        c.line(x1, y + 34, x2, y + 34)
        c.line(x2 - 7, y + 39, x2, y + 34)
        c.line(x2 - 7, y + 29, x2, y + 34)
    for x, w, head, body, accent in nodes:
        c.setFillColor(WHITE)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, w, 70, 8, fill=1, stroke=1)
        c.setFillColor(accent)
        c.rect(x, y, 6, 70, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 10.5)
        c.drawString(x + 16, y + 43, head)
        c.setFillColor(GRAY)
        c.setFont(FONT_REGULAR, 7.8)
        c.drawString(x + 16, y + 23, body)

    c.setFillColor(INK)
    c.roundRect(270, 331, 530, 34, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 8.4)
    c.drawString(291, 343, "SERVICE BINDING - 공개 URL 없이 앱 Worker가 비공개 수집 Worker를 호출")

    section_label(c, "OPERATING RULES", 42, 286)
    rules = [
        ("Cron", "1개 표현식", "KST 00·06·12·18"),
        ("Gemini", "12 RPM", "KST 400회/일"),
        ("Batch", "최대 12번", "성공·실패 모두 포함"),
        ("Policy", "원문 실패 = 중단", "URL만으로 추정 금지"),
    ]
    for i, (label, value, note) in enumerate(rules):
        x = 42 + i * 196
        rounded_panel(c, x, 177, 174, 82, fill=WHITE)
        section_label(c, label, x + 14, 238, [GREEN, PINK, BLUE, CORAL][i])
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 14)
        c.drawString(x + 14, 212, value)
        c.setFillColor(GRAY)
        c.setFont(FONT_REGULAR, 7.8)
        c.drawString(x + 14, 193, note)

    rounded_panel(c, 42, 62, W - 84, 80, fill=INK, stroke=INK)
    c.setFillColor(MINT)
    c.setFont(FONT_BOLD, 9)
    c.drawString(60, 120, "LEARNING")
    draw_text(c, "무료라는 목표만 세우면 관측성이 빠집니다. 그래서 수집 이력, Gemini 요청 로그, 소스 건강 상태를 D1에 남기고 운영 대시보드에서 비용과 품질을 함께 판단하도록 바꿨습니다.", 60, 97, W - 120, 10, WHITE, leading=15)
    footer(c, 5, "Architecture and constraints")
    c.showPage()


def draw_line_chart(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    data = [
        ("7/18", 3, 2), ("7/19", 17, 10), ("7/20", 24, 11), ("7/21", 21, 11),
        ("7/22", 15, 7), ("7/23", 14, 3), ("7/24", 15, 6), ("7/25", 12, 4),
        ("7/26", 12, 4), ("7/27", 15, 6), ("7/28", 13, 3), ("7/29", 11, 4),
        ("7/30", 14, 4), ("7/31", 12, 3), ("8/1", 9, 3),
    ]
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    for tick in [0, 6, 12, 18, 24]:
        yy = y + (tick / 24) * h
        c.line(x, yy, x + w, yy)
        c.setFillColor(GRAY)
        c.setFont(FONT_REGULAR, 6.5)
        c.drawRightString(x - 6, yy - 2, str(tick))
    points_count = []
    points_cat = []
    for i, (_, count, cats) in enumerate(data):
        px = x + (i / (len(data) - 1)) * w
        points_count.append((px, y + (count / 24) * h))
        points_cat.append((px, y + (cats / 12) * h))
    for points, color in [(points_count, GREEN), (points_cat, CORAL)]:
        c.setStrokeColor(color)
        c.setLineWidth(2.2)
        path = c.beginPath()
        path.moveTo(*points[0])
        for point in points[1:]:
            path.lineTo(*point)
        c.drawPath(path, fill=0, stroke=1)
        c.setFillColor(color)
        for px, py in points:
            c.circle(px, py, 2.2, fill=1, stroke=0)
    for i in [0, 3, 6, 9, 12, 14]:
        px = x + (i / (len(data) - 1)) * w
        c.setFillColor(GRAY)
        c.setFont(FONT_REGULAR, 6.5)
        c.drawCentredString(px, y - 14, data[i][0])


def draw_content_case(c: canvas.Canvas) -> None:
    page_background(c, WHITE)
    title(c, "Case 3. 수집 성공과 콘텐츠 건강을 분리했다", H - 70, "실행이 성공해도 후보가 비거나 특정 분야만 쌓이면 사용자에게는 실패입니다.")

    rounded_panel(c, 42, 260, 470, 220, fill=LIGHT_GRAY)
    section_label(c, "REMOTE D1 - LAST 15 DAYS", 60, 452)
    draw_line_chart(c, 74, 302, 410, 122)
    c.setFillColor(GREEN)
    c.rect(76, 276, 14, 3, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(FONT_REGULAR, 7.5)
    c.drawString(96, 273, "발행 건수 / 24")
    c.setFillColor(CORAL)
    c.rect(194, 276, 14, 3, fill=1, stroke=0)
    c.setFillColor(INK)
    c.drawString(214, 273, "분야 수 / 12")

    section_label(c, "AUG 01 STATUS", 548, 452, RED)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 31)
    c.drawString(548, 410, "9건 / 3분야")
    draw_bullet_list(c, [
        "주거 6, 금융 2, 투자 1",
        "일일 최소 12건·12분야 목표 미달",
        "누적 부동산 264/617, 약 42.8%",
    ], 548, 378, 244, size=8.9, bullet_color=RED)

    section_label(c, "ROOT CAUSES", 42, 224, CORAL)
    draw_bullet_list(c, [
        "Wikimedia 403·429, YouTube 빈 응답",
        "URL 영구 중복으로 갱신 자료까지 차단",
        "Cron 성공 여부가 빈 후보를 가림",
        "자치구 자료를 여러 카드로 따로 발행",
    ], 42, 200, 330, size=8.8, bullet_color=CORAL)

    section_label(c, "SHIPPED", 414, 224, GREEN)
    draw_bullet_list(c, [
        "수집원별 후보·빈 응답·오류 로그",
        "부족 분야 우선 + 분야별 최소·상한",
        "실패 분야의 당일 다음 회차 재시도",
        "공공데이터 응답 지문과 자치구 통합 브리핑",
    ], 414, 200, 350, size=8.8)

    c.setFillColor(MINT)
    c.roundRect(414, 61, 386, 70, 7, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont(FONT_BOLD, 9)
    c.drawString(431, 110, "판단")
    draw_text(c, "자동 복구를 출시했지만 목표는 아직 미달입니다. 다음 평가는 18시 이후 분야 커버리지와 단일 분야 점유율 SLO로 진행합니다.", 431, 89, 350, 8.7, INK, leading=13)
    footer(c, 6, "Content operations")
    c.showPage()


def draw_results(c: canvas.Canvas) -> None:
    page_background(c)
    title(c, "결과는 산출물, 품질, 사용자 성과로 나눠 말한다", H - 70, "구현 규모를 사용자 효과처럼 보이게 하지 않고, 측정된 것과 아직 모르는 것을 분리했습니다.")

    sections = [
        (42, 480, 360, "PRODUCTION OUTPUT", GREEN, [
            ("617", "공개 콘텐츠"), ("12", "분야"), ("17", "릴리즈"), ("36", "커밋")
        ]),
        (42, 330, 210, "QUALITY EVIDENCE", BLUE, [
            ("617/617", "출처 URL"), ("617/617", "퀴즈"), ("615/617", "4장 카드"), ("32+22", "테스트")
        ]),
        (42, 180, 60, "ADOPTION SIGNAL", CORAL, [
            ("3", "익명 ID"), ("2", "일일 세션"), ("1", "복습"), ("0", "완료 항목")
        ]),
    ]
    for x, label_y, panel_y, label, accent, values in sections:
        section_label(c, label, x, label_y, accent)
        rounded_panel(c, x, panel_y, 515, 90, fill=WHITE)
        for idx, (value, caption) in enumerate(values):
            mx = x + 20 + idx * 125
            c.setFillColor(accent)
            c.setFont(FONT_BOLD, 18)
            c.drawString(mx, panel_y + 50, value)
            c.setFillColor(INK)
            c.setFont(FONT_BOLD, 7.8)
            c.drawString(mx, panel_y + 28, caption)

    rounded_panel(c, 590, 82, 210, 386, fill=INK, stroke=INK)
    section_label(c, "WHAT THIS PROVES", 611, 438, MINT)
    draw_bullet_list(c, [
        "제품 가설을 실제 서비스로 연결했다.",
        "출처·복습·무료 운영 정책을 코드로 고정했다.",
        "출시 후 문제를 원격 데이터로 진단했다.",
    ], 611, 408, 166, size=9.2, color=WHITE, bullet_color=MINT)
    section_label(c, "WHAT IT DOES NOT PROVE", 611, 274, CORAL)
    draw_bullet_list(c, [
        "사용자 만족도 또는 리텐션 향상",
        "FSRS의 장기 기억 인과 효과",
        "12개 분야의 일일 균형 달성",
    ], 611, 244, 166, size=9.2, color=WHITE, bullet_color=CORAL)
    footer(c, 7, "Measured outcomes")
    c.showPage()


def draw_iteration(c: canvas.Canvas) -> None:
    page_background(c, WHITE)
    title(c, "한 달의 17개 릴리즈는 세 번의 방향 전환이었다", H - 70, "기능 수보다 어떤 신호를 보고 우선순위를 바꿨는지 설명합니다.")

    c.setStrokeColor(LINE)
    c.setLineWidth(3)
    c.line(74, 332, W - 74, 332)
    phases = [
        (92, "6/26", "MVP", "출처 기반 카드\nFSRS 복습", GREEN),
        (280, "6/27-7/12", "확장", "12개 분야\n챗·보관함", BLUE),
        (480, "7/17-7/27", "운영", "QA 대시보드\n5분 학습", CORAL),
        (680, "7/31-8/1", "검증", "개인화\n소스 건강", PINK),
    ]
    for x, date, phase, body, accent in phases:
        c.setFillColor(accent)
        c.circle(x, 332, 8, fill=1, stroke=0)
        c.setFillColor(GRAY)
        c.setFont(FONT_BOLD, 7.5)
        c.drawCentredString(x, 354, date)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 13)
        c.drawCentredString(x, 296, phase)
        lines = body.split("\n")
        c.setFont(FONT_REGULAR, 8.5)
        c.setFillColor(GRAY)
        c.drawCentredString(x, 274, lines[0])
        c.drawCentredString(x, 259, lines[1])

    rounded_panel(c, 42, 74, 355, 126, fill=LIGHT_GRAY)
    section_label(c, "ROLE", 60, 174)
    draw_bullet_list(c, [
        "문제 정의, 기능 우선순위, 정보구조",
        "콘텐츠·출처·투자 안전·AI 정책",
        "무료 운영 예산과 QA 기준",
        "원격 데이터 기반 릴리즈 판단",
    ], 60, 150, 315, size=8.8)

    rounded_panel(c, 430, 74, 370, 126, fill=MINT)
    section_label(c, "COLLABORATION", 448, 174, GREEN)
    draw_text(c, "AI 코딩 도구와 협업해 요구사항을 코드, 테스트, 배포로 연결했습니다. 생성 결과를 그대로 채택하지 않고 저장소 패턴, 타입 검사, E2E, 원격 D1로 검증했습니다.", 448, 148, 334, 9.3, INK, leading=14)
    draw_text(c, "전통적인 개발·디자인 조직 협업으로 과장하지 않고, 기획자가 구현 가능한 수준까지 제품을 이끈 개인 프로젝트로 설명합니다.", 448, 98, 334, 7.9, GREEN, FONT_BOLD, 12)
    footer(c, 8, "Iteration and role")
    c.showPage()


def draw_qa(c: canvas.Canvas) -> None:
    page_background(c)
    title(c, "QA는 출시 전 체크리스트가 아니라 운영 루프다", H - 70, "사용자 흐름, 콘텐츠 구조, 수집원 건강, AI 예산을 서로 다른 검증 층으로 나눴습니다.")

    qa_layers = [
        ("01", "콘텐츠", "출처·카드 4장·Deep Read·퀴즈", GREEN),
        ("02", "제품 흐름", "desktop/mobile E2E 22건", BLUE),
        ("03", "운영", "D1 수집 로그·소스 건강·예산", GOLD),
        ("04", "사용자", "6종 피드백·QA 큐·처리 상태", PINK),
    ]
    for idx, (no, head, body, accent) in enumerate(qa_layers):
        y = 413 - idx * 74
        c.setFillColor(accent)
        c.setFont(FONT_BOLD, 15)
        c.drawString(48, y, no)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 12)
        c.drawString(96, y, head)
        c.setFillColor(GRAY)
        c.setFont(FONT_REGULAR, 9.2)
        c.drawString(215, y, body)
        c.setStrokeColor(LINE)
        c.line(96, y - 22, 478, y - 22)

    rounded_panel(c, 520, 175, 280, 280, fill=WHITE)
    section_label(c, "LATEST QUALITY READ", 540, 427, RED)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 17)
    c.drawString(540, 394, "검사는 통과했지만")
    c.drawString(540, 371, "운영 목표는 미달")
    draw_bullet_list(c, [
        "로직 32건 통과",
        "E2E 22건 통과",
        "타입 검사·빌드 통과",
        "오늘 분야 3/12",
        "오늘 발행 9건",
    ], 540, 333, 230, size=9, bullet_color=RED)
    c.setFillColor(HexColor("#FCE7E4"))
    c.roundRect(540, 194, 240, 62, 6, fill=1, stroke=0)
    draw_text(c, "테스트 성공은 공급 다양성을 보장하지 않습니다. 운영 SLO를 별도 품질 게이트로 추가해야 합니다.", 555, 231, 210, 8.4, RED, FONT_BOLD, 12)

    footer(c, 9, "Quality loop")
    c.showPage()


def draw_next(c: canvas.Canvas) -> None:
    page_background(c, WHITE)
    title(c, "다음 4주는 기능보다 검증에 투자한다", H - 70, "사용자 채택과 콘텐츠 공급을 측정한 뒤 로그인과 동기화의 투자 여부를 결정합니다.")

    weeks = [
        ("W1", "계측", "방문 -> 시작 -> 첫 응답 -> 완료 -> 7일 재방문", GREEN),
        ("W2", "과업 테스트", "사회초년생 5명, 출처 확인과 5분 학습 관찰", BLUE),
        ("W3", "공급 SLO", "분야 >=10/12, 발행 >=12, 단일 분야 <=35%", CORAL),
        ("W4", "투자 판단", "채택 신호가 있으면 로그인·기기 동기화", PINK),
    ]
    for idx, (week, head, body, accent) in enumerate(weeks):
        y = 420 - idx * 82
        c.setFillColor(accent)
        c.roundRect(44, y - 6, 54, 34, 5, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 10)
        c.drawCentredString(71, y + 5, week)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 12)
        c.drawString(120, y + 7, head)
        draw_text(c, body, 250, y + 7, 520, 9.2, GRAY, leading=13)
        c.setStrokeColor(LINE)
        c.line(120, y - 22, W - 50, y - 22)

    rounded_panel(c, 42, 62, W - 84, 74, fill=INK, stroke=INK)
    c.setFillColor(MINT)
    c.setFont(FONT_BOLD, 10)
    c.drawString(60, 111, "핵심 회고")
    draw_text(c, "빠르게 많이 만드는 능력보다, 지금 어떤 수치를 믿을 수 있고 무엇을 아직 모르는지 구분하는 능력이 제품의 다음 결정을 더 정확하게 만들었습니다.", 60, 88, 540, 10, WHITE, FONT_BOLD, 15)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 8.5)
    c.drawRightString(W - 60, 111, "LIVE")
    c.setFont(FONT_REGULAR, 7.5)
    c.drawRightString(W - 60, 93, "life-quiz.life-quiz.workers.dev")
    c.drawRightString(W - 60, 77, "github.com/JinHyunjun/life-quiz")
    c.linkURL("https://life-quiz.life-quiz.workers.dev/", (600, 86, W - 58, 104), relative=0)
    c.linkURL("https://github.com/JinHyunjun/life-quiz", (600, 70, W - 58, 86), relative=0)
    footer(c, 10, "Next validation")
    c.showPage()


def build_portfolio() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PORTFOLIO_PDF), pagesize=(W, H), pageCompression=1)
    c.setTitle("Life Quiz PM Portfolio 2026-08")
    c.setAuthor("Jin Hyunjun")
    draw_cover(c)
    draw_overview(c)
    draw_problem(c)
    draw_learning_case(c)
    draw_architecture_case(c)
    draw_content_case(c)
    draw_results(c)
    draw_iteration(c)
    draw_qa(c)
    draw_next(c)
    c.save()


def build_decision_map() -> None:
    c = canvas.Canvas(str(DECISION_PDF), pagesize=(W, H), pageCompression=1)
    c.setTitle("Life Quiz One-page Decision Map 2026-08")
    c.setAuthor("Jin Hyunjun")
    page_background(c, WHITE)
    section_label(c, "ONE-PAGE DECISION MAP", 40, H - 40)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 23)
    c.drawString(40, H - 72, "Life Quiz - 출처 기반 생활상식을 장기 기억으로")
    c.setFillColor(GRAY)
    c.setFont(FONT_REGULAR, 8.5)
    c.drawRightString(W - 40, H - 68, "Snapshot 2026.08.01")

    blocks = [
        (40, 344, 235, 158, "1. 문제와 원인", CORAL, [
            "정보가 흩어지고 용어가 어려움",
            "한 번 읽고 지나쳐 판단 순간에 회상 실패",
            "실시간 AI는 비용·환각이 트래픽과 함께 증가",
            "초기 문제는 인터뷰 전 제품 가설",
        ]),
        (303, 344, 235, 158, "2. 가설과 성공 기준", GREEN, [
            "출처 + 계층형 읽기 + 퀴즈 + FSRS",
            "공개 글 SOURCE·퀴즈 100%",
            "5분 세션 안정성, 7일 재방문 계측",
            "무료 범위 안에서 예산을 코드로 제한",
        ]),
        (566, 344, 235, 158, "3. 핵심 PRD", BLUE, [
            "Quick/Deep Read와 4장 카드",
            "복습 최대 2개 + 새 상식 = 5개",
            "앱/비공개 수집 Worker 분리",
            "수집 로그·분야 최소/상한·QA 큐",
        ]),
        (40, 153, 235, 158, "4. 우선순위와 포기", GOLD, [
            "P0 출처·기억·운영 관측성",
            "P1 개인화·저장·근거형 챗",
            "정식 로그인은 채택 검증 뒤로",
            "종목 추천·실시간 생성·AI 이미지는 제외",
        ]),
        (303, 153, 235, 158, "5. 출시 결과", PINK, [
            "공개 617건, 12분야, 17릴리즈",
            "SOURCE·퀴즈 617/617",
            "4장 카드 615/617",
            "로직 32 + E2E 22 통과",
        ]),
        (566, 153, 235, 158, "6. 한계와 다음 판단", RED, [
            "사용자 성과 표본 부족",
            "오늘 9건·3/12분야로 목표 미달",
            "5명 과업 테스트와 퍼널 계측",
            "18시 이후 공급 SLO로 복구 효과 판단",
        ]),
    ]
    for x, y, w, h, head, accent, items in blocks:
        rounded_panel(c, x, y, w, h, fill=LIGHT_GRAY)
        c.setFillColor(accent)
        c.rect(x, y + h - 6, w, 6, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 11)
        c.drawString(x + 14, y + h - 30, head)
        draw_bullet_list(c, items, x + 14, y + h - 55, w - 28, size=7.7, bullet_color=accent, gap=5)

    c.setFillColor(INK)
    c.rect(40, 48, W - 80, 76, fill=1, stroke=0)
    c.setFillColor(MINT)
    c.setFont(FONT_BOLD, 8)
    c.drawString(56, 100, "DECISION")
    draw_text(c, "구현을 더 늘리기 전에 활성화 퍼널과 공급 다양성을 검증한다. 채택 신호가 확인될 때만 로그인·동기화에 투자한다.", 56, 80, 555, 10.5, WHITE, FONT_BOLD, 15)
    c.setFillColor(WHITE)
    c.setFont(FONT_REGULAR, 7.3)
    c.drawRightString(W - 56, 95, "life-quiz.life-quiz.workers.dev")
    c.drawRightString(W - 56, 78, "github.com/JinHyunjun/life-quiz")
    c.drawRightString(W - 56, 61, "Jin Hyunjun")
    c.save()


def render_pdf(pdf_path: Path) -> Path:
    render_dir = TMP_DIR / pdf_path.stem
    render_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.7, 1.7), alpha=False)
        pix.save(render_dir / f"page-{index + 1:02d}.png")
    doc.close()
    return render_dir


if __name__ == "__main__":
    register_fonts()
    build_portfolio()
    build_decision_map()
    portfolio_render = render_pdf(PORTFOLIO_PDF)
    decision_render = render_pdf(DECISION_PDF)
    print(PORTFOLIO_PDF)
    print(DECISION_PDF)
    print(portfolio_render)
    print(decision_render)
