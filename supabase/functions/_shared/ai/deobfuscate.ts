// 금칙어를 기호·닮은꼴 문자·자모 분해로 숨긴 표기를 대조용 문자열로 되돌리는 순수 함수 모음.
// 의존성 없음. 키워드 대조는 호출하는 쪽(keywords.ts)이 맡는다.

// 한자 닮은꼴 (음절·자모 단위)
const CHAR_MAP: Record<string, string> = { "卡": "카", "己": "ㄹ", "口": "ㅁ" };
// 조합형 초성 바로 뒤에서만 모음으로 읽는 닮은꼴 (U+1161 ㅏ, U+1162 ㅐ, U+1175 ㅣ)
const VOWEL_LOOKALIKE: Record<string, string> = {
  r: "ᅡ",
  R: "ᅡ",
  "ト": "ᅡ",
  "卜": "ᅡ",
  H: "ᅢ",
  "1": "ᅵ",
  l: "ᅵ",
  I: "ᅵ",
};
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s" };
// 조합형 초성 → 종성 (ᄄ·ᄈ·ᄍ은 종성이 없다)
const L2T: Record<number, number> = {
  0: 1, 1: 2, 2: 4, 3: 7, 5: 8, 6: 16, 7: 17, 9: 19, 10: 20, 11: 21, 12: 22, 14: 23, 15: 24, 16: 25, 17: 26, 18: 27,
};

const isLead = (c: number) => c >= 0x1100 && c <= 0x1112;
const isVowel = (c: number) => c >= 0x1161 && c <= 0x1175;

/** 기호·공백 제거와 소문자화만 한 문자열. keywords.ts가 evasionHits의 비교 기준으로 쓴다. */
export function plainForm(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * 대조용 문자열(소문자, 문자·숫자만). 단계 순서가 결과를 바꾸므로 바꾸지 않는다.
 * 닮은꼴 표 → NFKC → 기호 제거 → 초성 뒤 모음 닮은꼴 → NFC → 받침 붙이기 → 소문자화.
 * attachFinals=false면 받침 붙이기만 건너뛴다. 금칙어 바로 뒤의 낱자 초성(토토ㅋ)이 금칙어의 마지막
 * 음절에 붙어 금칙어를 지우는 것을 keywords.ts가 이 형태와 대조해 잡는다.
 */
export function deobfuscate(text: string, protect: readonly string[] = [], attachFinals = true): string {
  let s = [...text].map((c) => CHAR_MAP[c] ?? c).join("").normalize("NFKC");
  s = s.replace(/[^\p{L}\p{N}]/gu, "");
  const cs = [...s];
  for (let i = 1; i < cs.length; i++) {
    if (VOWEL_LOOKALIKE[cs[i]] && isLead(cs[i - 1].codePointAt(0)!)) cs[i] = VOWEL_LOOKALIKE[cs[i]];
  }
  s = cs.join("").normalize("NFC");
  // 보호 단어(금칙어 예외)는 받침 붙이기 전에 비문자 자리표시자로 바꾼다. 그렇지 않으면 "토토로ㅋ"가
  // "토토롴"이 되어 예외가 깨진다. 결과에 "_"가 남는 것은 이 경우뿐이다.
  for (const word of protect) s = s.replaceAll(word, "_");
  if (!attachFinals) return s.toLowerCase();

  // 받침 없는 음절 뒤의 낱자 초성은 종성으로 붙인다. 단 뒤가 모음이면 다음 음절의 초성이고,
  // 뒤가 또 낱자 초성이면 ㄹㅇ·ㅁㅊ 같은 초성체이므로 붙이지 않는다(붙이면 시바 ㄹㅇ→시발, 한나 ㅁㅊ→한남).
  const out: string[] = [];
  const arr = [...s];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i].codePointAt(0)!;
    const prev = out.length ? out[out.length - 1].codePointAt(0)! : 0;
    const next = i + 1 < arr.length ? arr[i + 1].codePointAt(0)! : 0;
    const prevOpenSyllable = prev >= 0xac00 && prev <= 0xd7a3 && (prev - 0xac00) % 28 === 0;
    if (isLead(c) && !isVowel(next) && !isLead(next) && prevOpenSyllable && L2T[c - 0x1100] !== undefined) {
      out[out.length - 1] = String.fromCodePoint(prev + L2T[c - 0x1100]);
    } else out.push(arr[i]);
  }
  return out.join("").toLowerCase();
}

/**
 * 공백 단위 영문 토큰. transform=true면 NFKC와 leet 치환을 먼저 한다.
 * 한 글자 토큰이 3개 이상 이어지면(B A C C A R A T) 이어 붙인 토큰도 추가한다.
 */
export function latinTokens(text: string, transform = true): string[] {
  const src = transform ? text.normalize("NFKC") : text;
  const base = src.toLowerCase().split(/\s+/).map((t) =>
    [...t].map((c) => transform ? (LEET[c] ?? c) : c).join("").replace(/[^a-z]/g, "")
  );
  const out = [...base];
  let run: string[] = [];
  for (const t of [...base, ""]) {
    if (t.length === 1) run.push(t);
    else {
      if (run.length >= 3) out.push(run.join(""));
      run = [];
    }
  }
  return out;
}
