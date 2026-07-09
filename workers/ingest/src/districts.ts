export interface SeoulDistrict {
  name: string;
  lawdCd: string;
}

export const SEOUL_DISTRICTS: readonly SeoulDistrict[] = [
  { name: "종로구", lawdCd: "11110" },
  { name: "중구", lawdCd: "11140" },
  { name: "용산구", lawdCd: "11170" },
  { name: "성동구", lawdCd: "11200" },
  { name: "광진구", lawdCd: "11215" },
  { name: "동대문구", lawdCd: "11230" },
  { name: "중랑구", lawdCd: "11260" },
  { name: "성북구", lawdCd: "11290" },
  { name: "강북구", lawdCd: "11305" },
  { name: "도봉구", lawdCd: "11320" },
  { name: "노원구", lawdCd: "11350" },
  { name: "은평구", lawdCd: "11380" },
  { name: "서대문구", lawdCd: "11410" },
  { name: "마포구", lawdCd: "11440" },
  { name: "양천구", lawdCd: "11470" },
  { name: "강서구", lawdCd: "11500" },
  { name: "구로구", lawdCd: "11530" },
  { name: "금천구", lawdCd: "11545" },
  { name: "영등포구", lawdCd: "11560" },
  { name: "동작구", lawdCd: "11590" },
  { name: "관악구", lawdCd: "11620" },
  { name: "서초구", lawdCd: "11650" },
  { name: "강남구", lawdCd: "11680" },
  { name: "송파구", lawdCd: "11710" },
  { name: "강동구", lawdCd: "11740" },
];

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

export function seoulDistrictForKstRun(now = new Date()): SeoulDistrict {
  return seoulDistrictsForKstRun(now, 1)[0];
}

export function seoulDistrictsForKstRun(now = new Date(), count = 1): SeoulDistrict[] {
  const kstTimestamp = now.getTime() + KST_OFFSET_MS;
  const dayNumber = Math.floor(kstTimestamp / DAY_MS);
  const kstHour = new Date(kstTimestamp).getUTCHours();
  const slot = Math.floor(kstHour / 6);
  const start = (dayNumber * 4 + slot) % SEOUL_DISTRICTS.length;
  const normalizedCount = Math.min(Math.max(Math.trunc(count), 1), SEOUL_DISTRICTS.length);
  return Array.from({ length: normalizedCount }, (_, index) => SEOUL_DISTRICTS[(start + index) % SEOUL_DISTRICTS.length]);
}
