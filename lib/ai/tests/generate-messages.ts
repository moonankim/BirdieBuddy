import { mkdir, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-5-5";
const BATCH_SIZE = 50;
const REQUEST_SIZE = 60;
const MAX_ATTEMPTS = 3;

const ROOMS = [
  {
    id: "youtuber",
    influencer: "스윙맛집 도윤",
    type: "골프 유튜버",
    topics: [
      "오늘 올라온 드라이버 슬라이스 교정 영상을 따라 해 본 후기",
      "다음 영상 주제 요청, 특히 아이언 거리 늘리기와 숏게임 요청이 많음",
      "스크린 시타 이벤트의 일정과 장소를 여러 명이 반복해서 물어봄",
      "시즌 한정 카드를 뽑은 자랑과 10장 강화 방법 질문",
      "구독자 라운드 모임 제안과 참가 방법 문의",
      "영상 업로드 주기가 줄어든 것에 대한 아쉬움과 응원",
    ],
  },
  {
    id: "media-pro",
    influencer: "한서아 프로",
    type: "미디어 프로",
    topics: [
      "어제 방송된 골프 예능 뒷이야기 질문",
      "방송에서 보여 준 벙커샷을 따라 하는 방법 문의",
      "개인 레슨 가능 여부와 가격을 여러 명이 반복해서 물어봄",
      "다음 시즌 출연 프로그램이 무엇인지 궁금해함",
      "홀로그램 스타일 카드 디자인에 대한 호불호",
      "방송 자막에 나온 표현을 해명해 달라는 요청과 이를 옹호하는 팬들",
    ],
  },
  {
    id: "tour-player",
    influencer: "강태린 선수",
    type: "투어 선수",
    topics: [
      "주말 G투어 대회 결과에 대한 축하와 아쉬움",
      "마지막 홀에서 왜 그 퍼팅 라인을 선택했는지 질문",
      "다음 대회 일정과 현장 응원 방법을 여러 명이 반복해서 물어봄",
      "대회에서 쓴 클럽 세팅 문의",
      "손목 부상이 있는 것 아니냐는 걱정",
      "팬 사인회를 열어 달라는 요청",
    ],
  },
];

const ADJECTIVES = ["버디", "장타", "숏게임", "주말", "새벽", "초보", "백돌이", "싱글", "연습장", "스크린", "파온", "느긋한"];
const NOUNS = ["골퍼", "요정", "아빠", "언니", "형님", "장인", "러버", "지망생", "수집가", "곰", "토끼", "매니아"];

const anthropic = new Anthropic();

function nicknamePool() {
  const pool = ADJECTIVES.flatMap((adjective) => NOUNS.map((noun) => `${adjective}${noun}`));
  return pool.sort(() => Math.random() - 0.5).slice(0, 60);
}

async function generateBatch(room: (typeof ROOMS)[number], topic: string, nicknames: string[]) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system:
        "너는 서비스 시험용 가상 채팅 데이터를 만든다. 실존 인물과 실제 브랜드 이름은 쓰지 않는다. 욕설이나 비방은 넣지 않는다.",
      messages: [
        {
          role: "user",
          content: [
            `가상의 ${room.type} "${room.influencer}"의 팬 채팅방에서 팬들이 보낸 메시지 ${REQUEST_SIZE}개를 만들어 줘.`,
            `이 구간의 주된 화제: ${topic}`,
            "약 70%는 이 화제에 대한 메시지이고, 나머지는 응원, 인사, 잡담이다.",
            "실제 한국어 채팅처럼 짧은 말, 줄임말, 긴 질문을 섞고 서로 똑같은 문장은 쓰지 않는다.",
            `닉네임은 다음 중에서 고르고 같은 사람이 여러 번 말해도 된다: ${nicknames.join(", ")}`,
          ].join("\n"),
        },
      ],
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["messages"],
            properties: {
              messages: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["nickname", "text"],
                  properties: { nickname: { type: "string" }, text: { type: "string" } },
                },
              },
            },
          },
        },
      },
    });

    if (response.stop_reason !== "end_turn") continue;
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    const { messages } = JSON.parse(text) as { messages: { nickname: string; text: string }[] };
    if (messages.length >= BATCH_SIZE) return messages.slice(0, BATCH_SIZE);
  }
  throw new Error(`${room.id}의 "${topic}" 구간을 ${BATCH_SIZE}개까지 만들지 못했습니다.`);
}

const rooms = [];
for (const room of ROOMS) {
  const nicknames = nicknamePool();
  const batches = await Promise.all(room.topics.map((topic) => generateBatch(room, topic, nicknames)));

  // 화제가 칼같이 나뉘면 요약이 지나치게 쉬워지므로 이웃한 구간끼리 섞는다.
  const mixed = batches
    .flatMap((batch, index) =>
      batch.map((message, order) => ({ ...message, rank: index * BATCH_SIZE + order + (Math.random() - 0.5) * 60 })),
    )
    .sort((a, b) => a.rank - b.rank);

  let clock = new Date("2026-11-08T19:00:00+09:00").getTime();
  const messages = mixed.map(({ nickname, text }, index) => {
    clock += (5 + Math.random() * 40) * 1000;
    return { id: index + 1, time: new Date(clock).toISOString(), nickname, text };
  });

  rooms.push({ ...room, messages });
  console.log(`${room.id}: ${messages.length}개`);
}

await mkdir(new URL("./data/", import.meta.url), { recursive: true });
await writeFile(new URL("./data/rooms.json", import.meta.url), JSON.stringify(rooms, null, 2));
