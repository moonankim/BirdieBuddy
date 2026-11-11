// 순서가 금칙어 폴백 동률 규칙(문환P_plan 6.5)의 기준이다.
export const CATEGORY_KEYS = [
  "profanity",
  "belittling",
  "appearance",
  "threat",
  "stalking",
  "sexual_harassment",
  "privacy",
  "hate",
  "illegal_ad",
  "spam",
] as const;

export type FilterCategory = typeof CATEGORY_KEYS[number];

export const CATEGORIES: Record<
  FilterCategory,
  { label: string; scope: "optional" | "mandatory"; description: string }
> = {
  profanity: {
    label: "욕설",
    scope: "optional",
    description: "욕설이나 비속어. 사람을 향하지 않고 골프 샷을 설명하는 거친 은어는 포함하지 않는다",
  },
  belittling: {
    label: "가벼운 비하",
    scope: "optional",
    description: "상대를 깎아내리거나 조롱하는 표현",
  },
  appearance: {
    label: "외모 평가",
    scope: "optional",
    description: "상대의 외모나 몸매를 평가하는 표현",
  },
  threat: {
    label: "협박",
    scope: "mandatory",
    description: "해를 끼치겠다는 위협. 직접 말하지 않고 사고, 안전, 신변을 들먹이며 불안하게 만드는 암시나 돌려 말하는 경고도 포함한다",
  },
  stalking: {
    label: "스토킹성",
    scope: "mandatory",
    description: "집요하게 따라다니거나 위치와 일상을 감시하는 내용. 공개되지 않은 동선, 차량, 옷차림, 집 주변을 직접 보았다거나 안다고 드러내는 내용, 사적인 공간에 몰래 접근했다는 내용도 포함한다. 방송 밖에서 상대를 직접 보았거나 엿들었다고 말하는 내용은 칭찬처럼 말해도 포함한다",
  },
  sexual_harassment: {
    label: "성희롱",
    scope: "mandatory",
    description: "성적인 언급이나 요구. 운동이나 골프 표현에 빗댄 성적 암시도 포함한다",
  },
  privacy: {
    label: "사생활 침해",
    scope: "mandatory",
    description: "주소, 연락처, 가족 등 사적인 정보를 캐거나 공개하는 내용. 사는 곳을 안다고 드러내거나 수입, 연애사를 캐묻는 내용도 포함한다",
  },
  hate: {
    label: "혐오 표현",
    scope: "mandatory",
    description: "성별, 지역, 출신, 장애, 나이 등 집단에 대한 혐오. 노인이나 특정 세대를 싸잡아 깎아내리는 표현, 지역이나 출신을 빗댄 은어로 집단을 비하하는 표현도 포함한다",
  },
  illegal_ad: {
    label: "불법 광고·도박",
    scope: "mandatory",
    description: "불법 광고나 도박 홍보. 은어로 표현한 불법 약물 판매나 비밀 거래 유도도 포함한다",
  },
  spam: {
    label: "스팸·도배",
    scope: "mandatory",
    description: "광고성 권유, 무의미한 내용을 복사해 붙인 도배, 같은 글자나 문구를 기계적으로 길게 반복하는 도배. 경기를 응원하는 짧은 구호나 감탄사를 몇 번 반복하는 것은 포함하지 않는다",
  },
};

// 인플루언서 발신(senderType=influencer)일 때만 spam 설명 끝에 붙인다. 팬의 자기 홍보는 spam으로 남겨야 한다.
export const SPAM_INFLUENCER_NOTE =
  "채팅방의 인플루언서가 자기 레슨, 굿즈, 이벤트, 방송 일정을 알리는 공지는 포함하지 않는다";

// 판정 기준값(문환P_plan 3절). 이 값 이상이면 위반으로 본다.
export const FLAG_THRESHOLD = 0.5;

export const QUALITY_QUESTION: { instructions: string; criteria: readonly string[] } = {
  instructions: "이 메시지가 인플루언서가 답할 가치가 얼마나 있는지 구체성과 답변 가치를 기준으로 평가한다.",
  criteria: [
    "인사, 응원, 감탄처럼 답을 기대하지 않는 메시지",
    "주제가 없거나 막연해서 답하기 어려운 질문",
    "주제는 있지만 누구에게나 해당하는 일반적인 질문",
    "자신의 상황이 일부 드러나 있어 구체적으로 답할 수 있는 질문",
    "구체적인 상황, 수치, 시도한 내용이 담겨 있어 답변이 다른 팬에게도 도움이 되는 질문",
  ],
};

export const JEV_CONTEXT: Record<"user" | "influencer", string> = {
  user: "스크린골프 인플루언서 팬 채팅방에서 유저가 인플루언서에게 보내려는 메시지",
  influencer: "스크린골프 인플루언서 팬 채팅방에서 인플루언서가 팬에게 보내려는 메시지(답변, 전체 공지, 인사말)",
};
